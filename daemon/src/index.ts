import { io as createSocketClient, type Socket } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import type { ManagedServer, SystemStats } from './types';
import { ensureDockerNetwork, getContainerName, getContainerState, startContainer, stopContainer, restartContainer, executeCommand, getContainerLogs, streamContainerLogs, sendStdin, getContainerStats } from './container';
import { listFiles, readFile, writeFile_, deleteEntry, renameEntry, createEntry, createServerDirectory, ensureEula, getServerDirectorySize, readBinaryFile, writeBinaryFile, copyFile } from './files';
import { getSystemStats } from './metrics';
import { getEgg, getEggForPlatform } from './eggs';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { getHostInfo } from './metrics';

// ── Config ──
const JWT_SECRET = process.env['DAEMON_JWT_SECRET'] ?? 'dev-secret';
const PANEL_URL = process.env['PANEL_URL'] ?? 'http://localhost:5173';
const DAEMON_PORT = parseInt(process.env['DAEMON_PORT'] ?? '8443', 10);
const DAEMON_ID = process.env['DAEMON_ID'] ?? 'node-01';
const DAEMON_NAME = process.env['DAEMON_NAME'] ?? DAEMON_ID;
const DAEMON_VERSION = process.env['DAEMON_VERSION'] ?? '0.2.0';
const SERVERS_DIR = process.env['SERVERS_DIR'] ?? './servers';
const DATA_DIR = process.env['DATA_DIR'] ?? './data';
const DOCKER_NETWORK = process.env['DOCKER_NETWORK'] ?? 'aurora';
const AUTO_RESTART = process.env['AUTO_RESTART'] !== 'false';
const MAX_CRASH_RESTARTS = parseInt(process.env['MAX_CRASH_RESTARTS'] ?? '3', 10);

const DAEMON_TOKEN = jwt.sign({ id: DAEMON_ID, type: 'daemon' }, JWT_SECRET, { expiresIn: '24h' });

// ── State ──
const servers = new Map<string, ManagedServer>();
const logStreamers = new Map<string, () => void>();
let statsInterval: ReturnType<typeof setInterval> | null = null;
let healthCheckInterval: ReturnType<typeof setInterval> | null = null;

// ── State Persistence ──
const stateFile = join(DATA_DIR, 'daemon-state.json');

function loadState(): void {
	try {
		if (existsSync(stateFile)) {
			const data = JSON.parse(readFileSync(stateFile, 'utf-8')) as ManagedServer[];
			for (const s of data) {
				s.status = 'stopped';
				s.crashCount = 0;
				s.consoleLines = [];
				servers.set(s.id, s);
			}
			console.log(`[State] Loaded ${servers.size} servers from state file`);
		}
	} catch (e) {
		console.warn('[State] Could not load state:', e);
	}
}

function saveState(): void {
	try {
		if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
		const data = Array.from(servers.values()).map(({ consoleLines, ...rest }) => rest);
		writeFileSync(stateFile, JSON.stringify(data, null, 2));
	} catch (e) {
		console.error('[State] Failed to save state:', e);
	}
}

// ── Server Management ──

function getOrCreateServer(id: string, data?: Partial<ManagedServer>): ManagedServer | undefined {
	if (servers.has(id)) return servers.get(id);
	if (!data) return undefined;

	const srv: ManagedServer = {
		id: data.id || id,
		name: data.name || id,
		slug: data.slug || id,
		status: 'stopped',
		type: data.type || 'minecraft',
		game: data.game || 'minecraft',
		gameVersion: data.gameVersion || 'latest',
		loader: data.loader || '',
		platform: data.platform || '',
		port: data.port || 25565,
		allocatedMemory: data.allocatedMemory || 1024,
		allocatedDisk: data.allocatedDisk || 10240,
		allocatedCpu: data.allocatedCpu || 100,
		processType: data.processType || 'docker',
		dockerImage: data.dockerImage || 'eclipse-temurin:21-jre',
		startupCommand: data.startupCommand || 'java -Xmx${MEMORY}M -jar server.jar nogui',
		stopCommand: data.stopCommand || 'stop',
		consoleLines: [],
		crashCount: 0,
		lastCrashedAt: null,
		stats: { cpuPercent: 0, memoryBytes: 0, diskBytes: 0, uptime: 0 },
		createdAt: data.createdAt || Date.now(),
		updatedAt: Date.now(),
	};
	servers.set(id, srv);
	saveState();
	return srv;
}

function updateServerStatus(id: string, status: ManagedServer['status']): void {
	const srv = servers.get(id);
	if (srv) {
		srv.status = status;
		srv.updatedAt = Date.now();
		saveState();
	}
}

// ── Crash Detection & Auto-Restart ──

async function checkContainerHealth(socket: Socket): Promise<void> {
	for (const [, srv] of servers) {
		if (srv.status !== 'running' && srv.status !== 'starting') continue;
		if (srv.processType !== 'docker') continue;

		const containerName = getContainerName(srv.id);
		const state = await getContainerState(containerName);

		if (state === 'exited' || state === 'dead') {
			console.warn(`[Crash] Server ${srv.name} (${srv.id}) has exited with state: ${state}`);
			srv.crashCount++;
			srv.lastCrashedAt = Date.now();
			srv.status = 'crashed';
			socket.emit('server:status', { id: srv.id, status: 'crashed', crashCount: srv.crashCount });
			socket.emit('server:crashed', { id: srv.id, name: srv.name, crashCount: srv.crashCount });

			if (AUTO_RESTART && srv.crashCount <= MAX_CRASH_RESTARTS) {
				console.log(`[Crash] Auto-restarting ${srv.name} (attempt ${srv.crashCount}/${MAX_CRASH_RESTARTS})`);
				socket.emit('console:output', { serverId: srv.id, line: `[Aurora] Server crashed! Auto-restarting (attempt ${srv.crashCount}/${MAX_CRASH_RESTARTS})...` });
				const started = await startContainer(srv, DOCKER_NETWORK);
				if (started) {
					updateServerStatus(srv.id, 'running');
					socket.emit('server:status', { id: srv.id, status: 'running' });
					socket.emit('console:output', { serverId: srv.id, line: '[Aurora] Server auto-restarted successfully' });
					attachConsoleStreaming(srv, socket);
				} else {
					socket.emit('console:output', { serverId: srv.id, line: '[Aurora] Auto-restart failed!' });
				}
			} else if (srv.crashCount > MAX_CRASH_RESTARTS) {
				socket.emit('console:output', { serverId: srv.id, line: `[Aurora] Max crash restarts (${MAX_CRASH_RESTARTS}) reached. Manual intervention required.` });
			}

			stopConsoleStream(srv.id);
			saveState();
		} else if (state === 'not_found') {
			if (srv.status === 'running') {
				updateServerStatus(srv.id, 'stopped');
				socket.emit('server:status', { id: srv.id, status: 'stopped' });
				stopConsoleStream(srv.id);
			}
		}
	}
}

function attachConsoleStreaming(srv: ManagedServer, socket: Socket): void {
	stopConsoleStream(srv.id);
	if (srv.processType !== 'docker') return;

	const containerName = getContainerName(srv.id);
	const cleanup = streamContainerLogs(
		srv,
		(line) => {
			srv.consoleLines.push(line);
			if (srv.consoleLines.length > 1000) srv.consoleLines.shift();
			socket.emit('console:output', { serverId: srv.id, line });
		},
		(err) => {
			console.error(`[Console] Error for ${srv.id}:`, err.message);
		},
		() => {
			console.log(`[Console] Stream ended for ${srv.id}`);
		}
	);

	cleanup.then(fn => logStreamers.set(srv.id, fn)).catch(() => {});
}

function stopConsoleStream(serverId: string): void {
	const cleanup = logStreamers.get(serverId);
	if (cleanup) {
		cleanup();
		logStreamers.delete(serverId);
	}
}

// ── Stats Collection ──

async function collectStats(socket: Socket): Promise<void> {
	for (const [, srv] of servers) {
		if (srv.status !== 'running') continue;
		if (srv.processType === 'docker') {
			const containerName = getContainerName(srv.id);
			const stats = await getContainerStats(containerName);
			if (stats) {
				srv.stats.cpuPercent = stats.cpuPercent;
				srv.stats.memoryBytes = stats.memoryBytes;
			}
		}
		srv.stats.diskBytes = getServerDirectorySize(SERVERS_DIR, srv.id);
		srv.stats.uptime = srv.status === 'running' ? Math.floor((Date.now() - srv.updatedAt) / 1000) : 0;
	}

	const systemStats = getSystemStats({ serversDir: SERVERS_DIR, daemonId: DAEMON_ID, version: DAEMON_VERSION, serversCount: servers.size });
	socket.emit('daemon:stats', systemStats);
}

// ── Main ──

async function main() {
	console.log(`[Daemon ${DAEMON_ID}] Starting Aurora Daemon v${DAEMON_VERSION}`);
	console.log(`[Daemon] Host: ${getHostInfo().hostname} (${getHostInfo().platform}/${getHostInfo().arch})`);

	if (!existsSync(SERVERS_DIR)) mkdirSync(SERVERS_DIR, { recursive: true });
	if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

	loadState();

	const dockerAvailable = await ensureDockerNetwork(DOCKER_NETWORK);
	console.log(`[Docker] ${dockerAvailable ? 'Available' : 'Not available — using bare process mode'}`);

	// ── Socket.IO Connection ──
	const socket: Socket = createSocketClient(PANEL_URL, {
		path: '/ws',
		auth: { token: DAEMON_TOKEN, type: 'daemon', daemonId: DAEMON_ID },
		transports: ['websocket', 'polling'],
		reconnection: true,
		reconnectionAttempts: Infinity,
		reconnectionDelay: 2000,
		reconnectionDelayMax: 30000,
	});

	socket.on('connect', () => {
		console.log(`[Daemon ${DAEMON_ID}] Connected to panel at ${PANEL_URL}`);
		sendRegistration(socket);
	});

	socket.on('disconnect', () => {
		console.log(`[Daemon ${DAEMON_ID}] Disconnected from panel — servers continue running`);
	});

	socket.on('connect_error', (err) => {
		console.error(`[Daemon ${DAEMON_ID}] Connection error:`, err.message);
	});

	// ── Server Lifecycle Events ──

	socket.on('server:start', async (serverId: string) => {
		const srv = servers.get(serverId);
		if (!srv) { socket.emit('server:status', { id: serverId, status: 'error', error: 'Server not found' }); return; }
		console.log(`[Daemon] Starting server ${srv.name} (${srv.id})`);

		updateServerStatus(srv.id, 'starting');
		socket.emit('server:status', { id: serverId, status: 'starting' });

		if (srv.processType === 'docker') {
			ensureEula(SERVERS_DIR, srv.id);
			const started = await startContainer(srv, DOCKER_NETWORK);
			if (started) {
				updateServerStatus(srv.id, 'running');
				socket.emit('server:status', { id: serverId, status: 'running' });
				attachConsoleStreaming(srv, socket);
			} else {
				updateServerStatus(srv.id, 'error');
				socket.emit('server:status', { id: serverId, status: 'error' });
				socket.emit('console:output', { serverId, line: '[ERROR] Failed to start server container' });
			}
		} else {
			updateServerStatus(srv.id, 'running');
			socket.emit('server:status', { id: serverId, status: 'running' });
		}
	});

	socket.on('server:stop', async (serverId: string) => {
		const srv = servers.get(serverId);
		if (!srv) return;
		console.log(`[Daemon] Stopping server ${srv.name}`);

		updateServerStatus(srv.id, 'stopping');
		socket.emit('server:status', { id: serverId, status: 'stopping' });

		if (srv.processType === 'docker') {
			await executeCommand(srv, srv.stopCommand || 'stop').catch(() => {});
			await new Promise(resolve => setTimeout(resolve, 2000));
			await stopContainer(srv);
		}

		stopConsoleStream(srv.id);
		updateServerStatus(srv.id, 'stopped');
		socket.emit('server:status', { id: serverId, status: 'stopped' });
		socket.emit('console:output', { serverId, line: '[INFO] Server stopped' });
	});

	socket.on('server:kill', async (serverId: string) => {
		const srv = servers.get(serverId);
		if (!srv) return;
		console.log(`[Daemon] Killing server ${srv.name}`);

		if (srv.processType === 'docker') {
			await stopContainer(srv);
		}

		stopConsoleStream(srv.id);
		updateServerStatus(srv.id, 'stopped');
		socket.emit('server:status', { id: serverId, status: 'stopped' });
	});

	socket.on('server:restart', async (serverId: string) => {
		const srv = servers.get(serverId);
		if (!srv) return;
		console.log(`[Daemon] Restarting server ${srv.name}`);

		updateServerStatus(srv.id, 'restarting');
		socket.emit('server:status', { id: serverId, status: 'restarting' });

		if (srv.processType === 'docker') {
			await executeCommand(srv, srv.stopCommand || 'stop').catch(() => {});
			await new Promise(resolve => setTimeout(resolve, 2000));
			stopConsoleStream(srv.id);
			const restarted = await restartContainer(srv, DOCKER_NETWORK);
			if (restarted) {
				updateServerStatus(srv.id, 'running');
				socket.emit('server:status', { id: serverId, status: 'running' });
				attachConsoleStreaming(srv, socket);
			} else {
				updateServerStatus(srv.id, 'error');
				socket.emit('server:status', { id: serverId, status: 'error' });
			}
		} else {
			updateServerStatus(srv.id, 'running');
			socket.emit('server:status', { id: serverId, status: 'running' });
		}
	});

	// ── Server Creation (with auto-download) ──

	socket.on('server:create', async (data: {
		id: string; name: string; slug: string; gameVersion: string; loader: string; platform: string;
		allocatedMemory: number; allocatedDisk: number; allocatedCpu: number; allocationPort: number;
		processType?: string; dockerImage?: string; type: string; game: string;
	}) => {
		if (servers.has(data.id)) {
			console.log(`[Daemon] Server ${data.id} already exists`);
			return;
		}

		console.log(`[Daemon] Creating server ${data.name} (${data.id})`);

		const srv = getOrCreateServer(data.id, {
			id: data.id,
			name: data.name,
			slug: data.slug || data.name.toLowerCase().replace(/\s+/g, '-'),
			type: (data.type || 'minecraft') as ManagedServer['type'],
			game: data.game || 'minecraft',
			gameVersion: data.gameVersion || 'latest',
			loader: data.loader || '',
			platform: data.platform || '',
			port: data.allocationPort || 25565,
			allocatedMemory: data.allocatedMemory || 1024,
			allocatedDisk: data.allocatedDisk || 10240,
			allocatedCpu: data.allocatedCpu || 100,
			processType: (data.processType as ManagedServer['processType']) || 'docker',
			dockerImage: data.dockerImage || 'eclipse-temurin:21-jre',
		});

		if (!srv) return;

		updateServerStatus(srv.id, 'installing');
		createServerDirectory(SERVERS_DIR, srv.id);
		ensureEula(SERVERS_DIR, srv.id);

		// Auto-download server jar using egg system
		if (srv.type === 'minecraft' && srv.gameVersion && srv.gameVersion !== 'latest') {
			const egg = getEggForPlatform(srv.platform || srv.loader);
			if (egg) {
				console.log(`[Daemon] Downloading ${egg.name} ${srv.gameVersion} via egg system...`);
				socket.emit('console:output', { serverId: srv.id, line: `[Aurora] Downloading ${egg.name} ${srv.gameVersion}...` });
				const success = await egg.download(srv.gameVersion, join(SERVERS_DIR, srv.id));
				if (success) {
					console.log(`[Daemon] Successfully downloaded ${egg.name} ${srv.gameVersion}`);
					socket.emit('console:output', { serverId: srv.id, line: `[Aurora] ${egg.name} ${srv.gameVersion} downloaded successfully` });
				} else {
					console.warn(`[Daemon] Failed to download ${egg.name} ${srv.gameVersion}`);
					socket.emit('console:output', { serverId: srv.id, line: `[Aurora] WARNING: Could not auto-download server jar. You may need to upload it manually.` });
				}
			} else {
				console.log(`[Daemon] No egg found for platform ${srv.platform || srv.loader}, skipping auto-download`);
			}
		}

		updateServerStatus(srv.id, 'stopped');
		socket.emit('server:created', { id: data.id, success: true, status: 'stopped' });
		saveState();
	});

	// ── Console Events ──

	socket.on('console:command', async ({ serverId, command }: { serverId: string; command: string }) => {
		const srv = servers.get(serverId);
		if (!srv) return;

		srv.consoleLines.push(`> ${command}`);
		socket.emit('console:output', { serverId, line: `> ${command}` });

		if (srv.processType === 'docker') {
			await sendStdin(srv, command);
		}

		saveState();
	});

	socket.on('console:subscribe', async (serverId: string) => {
		const srv = servers.get(serverId);
		if (!srv) return;

		socket.emit('console:history', srv.consoleLines.slice(-200));

		if (srv.processType === 'docker' && srv.status === 'running') {
			const logs = await getContainerLogs(getContainerName(srv.id), 50);
			if (logs.length > 0) {
				socket.emit('console:history', logs);
			}
		}
	});

	socket.on('docker:exec', async ({ serverId, command }: { serverId: string; command: string }) => {
		const srv = servers.get(serverId);
		if (!srv || srv.processType !== 'docker') return;
		const result = await executeCommand(srv, command);
		socket.emit('docker:exec:result', { serverId, result });
	});

	socket.on('docker:logs', async (serverId: string) => {
		const srv = servers.get(serverId);
		if (!srv || srv.processType !== 'docker') return;
		const logs = await getContainerLogs(getContainerName(srv.id));
		socket.emit('docker:logs:result', { serverId, logs });
	});

	// ── Periodic Tasks ──

	statsInterval = setInterval(() => {
		collectStats(socket).catch(() => {});
	}, 5000);

	healthCheckInterval = setInterval(() => {
		checkContainerHealth(socket).catch(() => {});
	}, 10000);

	// Save state every 30 seconds
	setInterval(() => saveState(), 30000);

	// Re-attach console streaming for any running servers after reconnect
	socket.on('connect', () => {
		for (const [, srv] of servers) {
			if (srv.status === 'running' && srv.processType === 'docker') {
				attachConsoleStreaming(srv, socket);
			}
		}
	});

	// ── HTTP Server (REST API) ──

	Bun.serve({
		port: DAEMON_PORT,
		async fetch(req) {
			const url = new URL(req.url);
			const pathname = url.pathname;

			// Auth check for REST endpoints
			const authHeader = req.headers.get('authorization');
			if (pathname !== '/health') {
				if (!authHeader || !authHeader.startsWith('Bearer ')) {
					return Response.json({ error: 'Unauthorized' }, { status: 401 });
				}
				const token = authHeader.slice(7);
				try {
					const decoded = jwt.verify(token, JWT_SECRET) as { id: string; type: string };
					if (decoded.type !== 'panel' && decoded.type !== 'daemon') {
						return Response.json({ error: 'Invalid token type' }, { status: 403 });
					}
				} catch {
					return Response.json({ error: 'Invalid token' }, { status: 401 });
				}
			}

			try {
				if (pathname === '/health') {
					const systemStats = getSystemStats({ serversDir: SERVERS_DIR, daemonId: DAEMON_ID, version: DAEMON_VERSION, serversCount: servers.size });
					return Response.json({
						status: 'ok',
						...systemStats,
						host: getHostInfo(),
						servers: Array.from(servers.values()).map(s => ({
							id: s.id, name: s.name, status: s.status, processType: s.processType,
						})),
					});
				}

				if (pathname === '/servers') {
					return Response.json(Array.from(servers.values()).map(s => ({
						id: s.id, name: s.name, status: s.status,
						gameVersion: s.gameVersion, loader: s.loader, platform: s.platform,
						port: s.port, processType: s.processType,
						stats: s.stats, crashCount: s.crashCount,
					})));
				}

				if (pathname === '/docker/info') {
					return Response.json({
						available: dockerAvailable,
						network: DOCKER_NETWORK,
						containers: Array.from(servers.values()).filter(s => s.processType === 'docker').map(s => ({
							id: s.id, name: s.name, container: getContainerName(s.id), status: s.status,
						})),
					});
				}

				if (pathname === '/eggs') {
					const { getAllEggs } = await import('./eggs');
					return Response.json(getAllEggs().map(e => ({
						id: e.id, name: e.name, game: e.game, description: e.description,
						loader: e.loader, platform: e.platform,
						defaultMemory: e.defaultMemory, defaultDisk: e.defaultDisk, defaultCpu: e.defaultCpu, defaultPort: e.defaultPort,
						supportsMods: e.supportsMods, supportsPlugins: e.supportsPlugins, supportsDatapacks: e.supportsDatapacks,
					})));
				}

				if (pathname === '/eggs/versions' && req.method === 'POST') {
					const { eggId } = await req.json() as { eggId: string };
					const egg = getEgg(eggId);
					if (!egg) return Response.json({ error: 'Egg not found' }, { status: 404 });
					const versions = await egg.versionList();
					return Response.json(versions);
				}

				if (pathname === '/eggs/versions/refresh' && req.method === 'POST') {
					const { refreshManifest } = await import('./version-manifest');
					await refreshManifest();
					const { getAllEggs } = await import('./eggs');
					return Response.json({ success: true, eggs: getAllEggs().map(e => ({
						id: e.id, name: e.name,
					})) });
				}

				// ── Backup Operations ──
				if (pathname === '/backup' && req.method === 'POST') {
					const { serverId } = await req.json() as { serverId: string };
					if (!servers.has(serverId)) return Response.json({ error: 'Server not found' }, { status: 404 });
					const backupDir = `${SERVERS_DIR}/${serverId}/backups`;
					const backupName = `backup-${Date.now()}.tar.gz`;
					try {
						if (!existsSync(backupDir)) mkdirSync(backupDir, { recursive: true });
						const proc = Bun.$`tar -czf ${backupDir}/${backupName} -C ${SERVERS_DIR}/${serverId} --exclude=backups .`;
						const { exitCode } = await proc.quiet();
						if (exitCode !== 0) throw new Error('tar failed');
						const stats = existsSync(`${backupDir}/${backupName}`) ? await import('node:fs').then(fs => fs.statSync(`${backupDir}/${backupName}`)) : null;
						return Response.json({ success: true, name: backupName, size: stats?.size || 0, path: `${backupDir}/${backupName}` });
					} catch (e) {
						return Response.json({ error: 'Backup failed', details: String(e) }, { status: 500 });
					}
				}

				if (pathname.startsWith('/backup/') && req.method === 'GET') {
					const fileName = pathname.replace('/backup/', '');
					const serverId = url.searchParams.get('server');
					if (!serverId || !fileName) return Response.json({ error: 'Missing params' }, { status: 400 });
					const filePath = `${SERVERS_DIR}/${serverId}/backups/${fileName}`;
					if (!existsSync(filePath)) return Response.json({ error: 'Not found' }, { status: 404 });
					const file = Bun.file(filePath);
					return new Response(file, {
						headers: { 'Content-Type': 'application/gzip' },
					});
				}

				if (pathname.startsWith('/backup/') && req.method === 'DELETE') {
					const fileName = pathname.replace('/backup/', '');
					const serverId = url.searchParams.get('server');
					if (!serverId || !fileName) return Response.json({ error: 'Missing params' }, { status: 400 });
					const filePath = `${SERVERS_DIR}/${serverId}/backups/${fileName}`;
					if (!existsSync(filePath)) return Response.json({ error: 'Not found' }, { status: 404 });
					await import('node:fs').then(fs => fs.unlinkSync(filePath));
					return Response.json({ success: true });
				}

				if (pathname === '/backup/restore' && req.method === 'POST') {
					const { serverId, fileName } = await req.json() as { serverId: string; fileName: string };
					const backupPath = `${SERVERS_DIR}/${serverId}/backups/${fileName}`;
					if (!existsSync(backupPath)) return Response.json({ error: 'Backup not found' }, { status: 404 });
					const proc = Bun.$`tar -xzf ${backupPath} -C ${SERVERS_DIR}/${serverId}`;
					const { exitCode } = await proc.quiet();
					if (exitCode !== 0) return Response.json({ error: 'Restore failed' }, { status: 500 });
					return Response.json({ success: true, message: `Restored from ${fileName}` });
				}

				// ── File Operations (Real Filesystem) ──
				if (pathname.startsWith('/files/')) {
					const serverId = url.searchParams.get('server');
					if (!serverId) return Response.json({ error: 'Missing server' }, { status: 400 });
					if (!servers.has(serverId)) return Response.json({ error: 'Server not found' }, { status: 404 });

					const dir = url.searchParams.get('dir');
					const filePath = url.searchParams.get('path');
					const action = url.searchParams.get('action');

					if (req.method === 'GET' && dir !== null) {
						return Response.json(listFiles(SERVERS_DIR, serverId, dir));
					}
					if (req.method === 'GET' && filePath) {
						const content = readFile(SERVERS_DIR, serverId, filePath);
						if (content === null) return Response.json({ error: 'File not found' }, { status: 404 });
						const ext = filePath.split('.').pop()?.toLowerCase();
						const isText = ['txt', 'properties', 'json', 'yml', 'yaml', 'xml', 'log', 'cfg', 'conf', 'toml', 'md', 'js', 'ts', 'css', 'html', 'sh', 'env'].includes(ext || '');
						return Response.json({ content, isTextFile: isText });
					}
					if (req.method === 'PUT' && filePath) {
						const body = await req.json() as { content?: string };
						if (!body || body.content === undefined) return Response.json({ error: 'Missing content' }, { status: 400 });
						return Response.json({ success: writeFile_(SERVERS_DIR, serverId, filePath, body.content) });
					}
					if (req.method === 'DELETE' && filePath) {
						return Response.json({ success: deleteEntry(SERVERS_DIR, serverId, filePath) });
					}
					if (req.method === 'PATCH' && action) {
						const body = await req.json() as { name?: string };
						if (action === 'rename' && filePath && body?.name) {
							return Response.json({ success: renameEntry(SERVERS_DIR, serverId, filePath, body.name) });
						}
						if ((action === 'mkdir' || action === 'touch') && dir && body?.name) {
							const type = action === 'mkdir' ? 'directory' : 'file';
							return Response.json({ success: createEntry(SERVERS_DIR, serverId, dir, body.name, type) });
						}
						return Response.json({ error: 'Invalid action' }, { status: 400 });
					}
					return Response.json({ error: 'Invalid request' }, { status: 400 });
				}

				return Response.json({ error: 'Not found' }, { status: 404 });
			} catch (e) {
				return Response.json({ error: e instanceof Error ? e.message : 'Internal error' }, { status: 500 });
			}
		},
	});

	console.log(`[Daemon ${DAEMON_ID}] HTTP server listening on port ${DAEMON_PORT}`);

	// ── Graceful Shutdown ──

	process.on('SIGINT', async () => {
		console.log('\n[Daemon] Shutting down...');
		shutdown(socket);
	});

	process.on('SIGTERM', async () => {
		console.log('[Daemon] Shutting down...');
		shutdown(socket);
	});
}

function sendRegistration(socket: Socket): void {
	const systemStats = getSystemStats({ serversDir: SERVERS_DIR, daemonId: DAEMON_ID, version: DAEMON_VERSION, serversCount: servers.size });
	socket.emit('daemon:register', {
		id: DAEMON_ID,
		name: DAEMON_NAME,
		host: 'localhost',
		port: DAEMON_PORT,
		...systemStats,
		servers: Array.from(servers.values()).map(s => ({
			id: s.id, name: s.name, status: s.status, processType: s.processType,
			loader: s.loader, gameVersion: s.gameVersion, stats: s.stats,
		})),
	});
}

function shutdown(socket: Socket): void {
	if (statsInterval) clearInterval(statsInterval);
	if (healthCheckInterval) clearInterval(healthCheckInterval);

	for (const [id, cleanup] of logStreamers) {
		cleanup();
	}
	logStreamers.clear();

	saveState();
	socket.disconnect();

	console.log('[Daemon] Goodbye');
	process.exit(0);
}

main().catch(console.error);
