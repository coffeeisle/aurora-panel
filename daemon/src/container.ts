import Docker from 'dockerode';
import type { ManagedServer } from './types';

const docker = new Docker();
let networkEnsured = false;

export async function ensureDockerNetwork(networkName: string): Promise<boolean> {
	if (networkEnsured) return true;
	try {
		const networks = await docker.listNetworks();
		const exists = networks.some(n => n.Name === networkName);
		if (!exists) {
			await docker.createNetwork({ Name: networkName, CheckDuplicate: true });
			console.log(`[Docker] Created network '${networkName}'`);
		}
		networkEnsured = true;
		return true;
	} catch (e) {
		console.warn('[Docker] Not available:', e);
		return false;
	}
}

export function getContainerName(serverId: string): string {
	return `aurora-${serverId}`;
}

export async function getContainerState(containerName: string): Promise<string> {
	try {
		const info = await docker.getContainer(containerName).inspect();
		return info.State.Status;
	} catch {
		return 'not_found';
	}
}

export async function startContainer(srv: ManagedServer, networkName: string): Promise<boolean> {
	try {
		const containerName = getContainerName(srv.id);
		const serverDir = `${process.env['SERVERS_DIR'] ?? './servers'}/${srv.id}`;

		const existing = await docker.getContainer(containerName).inspect().catch(() => null);
		if (existing) {
			if (existing.State.Status === 'running') {
				console.log(`[Docker] Container ${containerName} already running`);
				return true;
			}
			await docker.getContainer(containerName).remove({ force: true }).catch(() => {});
		}

		const image = srv.dockerImage || 'eclipse-temurin:21-jre';
		await pullImage(image);

		const env: string[] = [
			`SERVER_ID=${srv.id}`,
			`SERVER_NAME=${srv.name}`,
			`MEMORY=${srv.allocatedMemory}M`,
			`TYPE=${srv.loader?.toUpperCase() || 'VANILLA'}`,
			`VERSION=${srv.gameVersion}`,
			`PORT=${srv.port}`,
		];

		const container = await docker.createContainer({
			Image: image,
			name: containerName,
			Hostname: srv.id.slice(0, 63),
			ExposedPorts: { [`${srv.port}/tcp`]: {} },
			Env: env,
			Cmd: ['sh', '-c', srv.startupCommand || 'java -Xmx${MEMORY}M -jar server.jar nogui'],
			WorkingDir: '/data',
			HostConfig: {
				NetworkMode: networkName,
				PortBindings: {
					[`${srv.port}/tcp`]: [{ HostPort: String(srv.port) }],
				},
				Binds: [`${serverDir}:/data`],
				Memory: srv.allocatedMemory * 1024 * 1024,
				MemorySwap: srv.allocatedMemory * 1024 * 1024,
				NanoCpus: Math.ceil((srv.allocatedCpu || 100) / 100) * 1_000_000_000,
				RestartPolicy: { Name: 'no' },
				Ulimits: [
					{ Name: 'nofile', Soft: 65536, Hard: 65536 },
				],
			},
		});

		await container.start();
		console.log(`[Docker] Started container ${containerName} for ${srv.name}`);
		return true;
	} catch (e) {
		console.error('[Docker] Start error:', e);
		return false;
	}
}

export async function stopContainer(srv: ManagedServer): Promise<boolean> {
	try {
		const containerName = getContainerName(srv.id);
		const container = docker.getContainer(containerName);
		await container.stop({ t: 10 }).catch(() => {});
		await container.remove({ force: true }).catch(() => {});
		console.log(`[Docker] Stopped and removed container ${containerName}`);
		return true;
	} catch (e) {
		console.error('[Docker] Stop error:', e);
		return false;
	}
}

export async function restartContainer(srv: ManagedServer, networkName: string): Promise<boolean> {
	await stopContainer(srv);
	return startContainer(srv, networkName);
}

export async function executeCommand(srv: ManagedServer, command: string): Promise<string> {
	try {
		const exec = await docker.getContainer(getContainerName(srv.id)).exec({
			Cmd: ['sh', '-c', command],
			AttachStdout: true,
			AttachStderr: true,
		});
		const stream = await exec.start({ Detach: false, Tty: false });
		return new Promise((resolve, reject) => {
			let output = '';
			stream.on('data', (chunk: Buffer) => { output += chunk.toString(); });
			stream.on('end', () => resolve(output.trim()));
			stream.on('error', reject);
		});
	} catch {
		return '';
	}
}

export async function getContainerLogs(containerName: string, tail: number = 100): Promise<string[]> {
	try {
		const container = docker.getContainer(containerName);
		const logs = await container.logs({ stdout: true, stderr: true, tail });
		return logs.toString().split('\n').filter(Boolean);
	} catch {
		return [];
	}
}

export async function streamContainerLogs(
	srv: ManagedServer,
	onLine: (line: string) => void,
	onError: (error: Error) => void,
	onEnd: () => void
): Promise<() => void> {
	const containerName = getContainerName(srv.id);
	let aborted = false;

	try {
		const container = docker.getContainer(containerName);
		const logStream = await container.logs({
			stdout: true,
			stderr: true,
			follow: true,
			tail: 50,
		});

		const decoder = new TextDecoder();
		let buffer = '';

		logStream.on('data', (chunk: Buffer) => {
			if (aborted) return;
			buffer += decoder.decode(chunk, { stream: true });
			const lines = buffer.split('\n');
			buffer = lines.pop() || '';
			for (const line of lines) {
				if (line) {
					const cleaned = line.replace(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[\d.]*Z\s+/, '');
					onLine(cleaned);
				}
			}
		});

		logStream.on('end', () => {
			if (!aborted) onEnd();
		});

		logStream.on('error', (err: Error) => {
			if (!aborted) onError(err);
		});

		return () => {
			aborted = true;
			try { (logStream as any).destroy?.(); } catch {}
		};
	} catch (e) {
		onError(e as Error);
		return () => {};
	}
}

export async function sendStdin(srv: ManagedServer, command: string): Promise<void> {
	try {
		const containerName = getContainerName(srv.id);
		const container = docker.getContainer(containerName);
		const exec = await container.exec({
			Cmd: ['sh', '-c', `echo "${command.replace(/"/g, '\\"')}" >> /proc/1/fd/0`],
			AttachStdout: false,
			AttachStderr: false,
		});
		await exec.start({ Detach: true, Tty: false }).catch(() => {});
	} catch {
		// Best-effort
	}
}

async function pullImage(image: string): Promise<void> {
	try {
		await docker.pull(image);
	} catch {
		console.warn(`[Docker] Failed to pull image ${image}, may already exist locally`);
	}
}

export async function getContainerStats(containerName: string): Promise<{ cpuPercent: number; memoryBytes: number } | null> {
	try {
		const container = docker.getContainer(containerName);
		const stats = await container.stats({ stream: false });
		const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
		const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
		const cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * stats.cpu_stats.online_cpus * 100 : 0;
		const memoryBytes = stats.memory_stats.usage || 0;
		return { cpuPercent: Math.round(cpuPercent * 100) / 100, memoryBytes };
	} catch {
		return null;
	}
}
