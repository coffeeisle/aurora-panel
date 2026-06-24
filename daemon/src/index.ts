import { io as createSocketClient, type Socket } from 'socket.io-client';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env['DAEMON_JWT_SECRET'] ?? 'dev-secret';
const PANEL_URL = process.env['PANEL_URL'] ?? 'http://localhost:5173';
const DAEMON_PORT = parseInt(process.env['DAEMON_PORT'] ?? '8443', 10);
const DAEMON_ID = process.env['DAEMON_ID'] ?? 'node-01';
const DAEMON_NAME = process.env['DAEMON_NAME'] ?? DAEMON_ID;
const DAEMON_VERSION = process.env['DAEMON_VERSION'] ?? '0.1.0';
const DAEMON_TOKEN = jwt.sign({ id: DAEMON_ID, type: 'daemon' }, JWT_SECRET, { expiresIn: '24h' });
const SERVERS_DIR = process.env['SERVERS_DIR'] ?? './servers';
const DOCKER_NETWORK = process.env['DOCKER_NETWORK'] ?? 'aurora';

interface ManagedServer {
	id: string;
	name: string;
	status: 'starting' | 'running' | 'stopping' | 'stopped' | 'error';
	gameVersion: string;
	loader: string;
	platform: string;
	port: number;
	allocatedMemory: number;
	allocatedDisk: number;
	allocatedCpu: number;
	consoleLines: string[];
	consoleTimer: ReturnType<typeof setInterval> | null;
	processType?: 'docker' | 'bare';
	dockerImage?: string;
}

// ── Docker Management ──
async function ensureDockerNetwork(): Promise<boolean> {
	try {
		const { exitCode } = await Bun.$`docker network inspect ${DOCKER_NETWORK}`.quiet();
		if (exitCode !== 0) {
			await Bun.$`docker network create ${DOCKER_NETWORK}`;
			console.log(`[Docker] Created network '${DOCKER_NETWORK}'`);
		}
		return true;
	} catch {
		console.warn('[Docker] Not available — falling back to bare process mode');
		return false;
	}
}

function getContainerName(serverId: string): string {
	return `aurora-${serverId}`;
}

async function dockerStartContainer(srv: ManagedServer): Promise<boolean> {
	try {
		const containerName = getContainerName(srv.id);
		const image = srv.dockerImage || 'itzg/minecraft-server:latest';
		const serverDir = `${SERVERS_DIR}/${srv.id}`;

		const args = [
			'run', '-d',
			'--name', containerName,
			'--network', DOCKER_NETWORK,
			'-p', `${srv.port}:${srv.port}`,
			'-e', `MEMORY=${srv.allocatedMemory}M`,
			'-e', `TYPE=${srv.loader || 'VANILLA'}`,
			'-e', `VERSION=${srv.gameVersion}`,
			'-v', `${serverDir}:/data`,
			'--memory', `${srv.allocatedMemory}m`,
			'--cpus', String(Math.ceil(srv.allocatedCpu / 100)),
			'--restart', 'no',
			image
		];

		const { exitCode, stderr } = await Bun.$`docker ${args}`.quiet();
		if (exitCode === 0) {
			console.log(`[Docker] Started container ${containerName} for ${srv.name}`);
			return true;
		} else {
			console.error(`[Docker] Failed to start ${containerName}:`, stderr.toString());
			return false;
		}
	} catch (e) {
		console.error('[Docker] Start error:', e);
		return false;
	}
}

async function dockerStopContainer(srv: ManagedServer): Promise<boolean> {
	try {
		const containerName = getContainerName(srv.id);
		const { exitCode } = await Bun.$`docker stop ${containerName}`.quiet();
		await Bun.$`docker rm ${containerName}`.quiet();
		if (exitCode === 0) {
			console.log(`[Docker] Stopped and removed container ${containerName}`);
		}
		return true;
	} catch (e) {
		console.error('[Docker] Stop error:', e);
		return false;
	}
}

async function dockerContainerStatus(srv: ManagedServer): Promise<string> {
	try {
		const containerName = getContainerName(srv.id);
		const proc = Bun.$`docker inspect --format='{{.State.Status}}' ${containerName}`;
		const text = await proc.text();
		return text.trim();
	} catch {
		return 'not_found';
	}
}

async function dockerExec(srv: ManagedServer, command: string): Promise<string> {
	try {
		const containerName = getContainerName(srv.id);
		const proc = Bun.$`docker exec ${containerName} sh -c ${command}`;
		const text = await proc.text();
		return text.trim();
	} catch {
		return '';
	}
}

function getDockerLogs(srv: ManagedServer): string[] {
	return [`[Docker] Container '${getContainerName(srv.id)}' log output (mock)`];
}

const mockOutputs = [
	'[32mINFO[0m] Starting Minecraft server on *:25565',
	'[32mINFO[0m] Loading properties',
	'[32mINFO[0m] Default game type: SURVIVAL',
	'[32mINFO[0m] Preparing spawn area: 0%',
	'[32mINFO[0m] Preparing spawn area: 25%',
	'[32mINFO[0m] Preparing spawn area: 50%',
	'[32mINFO[0m] Preparing spawn area: 75%',
	'[32mINFO[0m] Preparing spawn area: 100%',
	'[32mINFO[0m] Done (1.234s)! For help, type "help"',
	'[32mINFO[0m] <Steve> Hello everyone!',
	'[32mINFO[0m] <Alex> Welcome to the server!',
	'[33mWARN[0m] Can\'t keep up! Is the server overloaded?',
	'[32mINFO[0m] Player Steve joined the game',
	'[32mINFO[0m] Player Alex joined the game',
	'[32mINFO[0m] Autosave started',
	"[32mINFO[0m] Saving chunks for level 'Server Level'/minecraft:overworld",
	'[32mINFO[0m] Autosave finished',
];

const servers: ManagedServer[] = [
	{
		id: 'srv_01', name: 'Survival World', status: 'stopped',
		gameVersion: '1.21.4', loader: 'Fabric', platform: 'fabric',
		port: 25565, allocatedMemory: 4096, allocatedDisk: 20480, allocatedCpu: 200,
		consoleLines: [], consoleTimer: null,
		processType: 'docker', dockerImage: 'itzg/minecraft-server:latest'
	},
	{
		id: 'srv_02', name: 'Creative Build', status: 'stopped',
		gameVersion: '1.21.4', loader: 'Paper', platform: 'paper',
		port: 25566, allocatedMemory: 2048, allocatedDisk: 10240, allocatedCpu: 100,
		consoleLines: [], consoleTimer: null,
		processType: 'docker', dockerImage: 'itzg/minecraft-server:latest'
	},
	{
		id: 'srv_03', name: 'Modded Adventures', status: 'stopped',
		gameVersion: '1.20.1', loader: 'Forge', platform: 'forge',
		port: 25567, allocatedMemory: 8192, allocatedDisk: 40960, allocatedCpu: 300,
		consoleLines: [], consoleTimer: null,
		processType: 'docker', dockerImage: 'itzg/minecraft-server:latest'
	},
	{
		id: 'srv_04', name: 'MiniGames Network', status: 'stopped',
		gameVersion: '1.21', loader: 'Paper', platform: 'paper',
		port: 25568, allocatedMemory: 3072, allocatedDisk: 15360, allocatedCpu: 150,
		consoleLines: [], consoleTimer: null,
		processType: 'docker', dockerImage: 'itzg/minecraft-server:latest'
	},
	{
		id: 'srv_05', name: 'Palworld Server', status: 'stopped',
		gameVersion: 'latest', loader: '', platform: 'steamcmd',
		port: 8211, allocatedMemory: 8192, allocatedDisk: 30720, allocatedCpu: 200,
		consoleLines: [], consoleTimer: null,
		processType: 'bare'
	}
];

// ── Mock in-memory file system ──
type FsEntry = { name: string; type: 'file' | 'directory'; size: number; modifiedAt: string; mime?: string };
const daemonFiles = new Map<string, FsEntry[]>();
const daemonContents = new Map<string, string>();

function createServerDirs(id: string) {
	if (!daemonFiles.has(id)) {
		daemonFiles.set(id, [
			{ name: 'server.properties', type: 'file', size: 2840, modifiedAt: new Date().toISOString(), mime: 'text/plain' },
			{ name: 'eula.txt', type: 'file', size: 168, modifiedAt: new Date().toISOString(), mime: 'text/plain' },
			{ name: 'ops.json', type: 'file', size: 128, modifiedAt: new Date().toISOString(), mime: 'application/json' },
			{ name: 'whitelist.json', type: 'file', size: 64, modifiedAt: new Date().toISOString(), mime: 'application/json' },
			{ name: 'banned-players.json', type: 'file', size: 32, modifiedAt: new Date().toISOString(), mime: 'application/json' },
			{ name: 'logs', type: 'directory', size: 0, modifiedAt: new Date().toISOString() },
			{ name: 'world', type: 'directory', size: 0, modifiedAt: new Date().toISOString() },
			{ name: 'plugins', type: 'directory', size: 0, modifiedAt: new Date().toISOString() },
			{ name: 'mods', type: 'directory', size: 0, modifiedAt: new Date().toISOString() },
		]);
		daemonFiles.set(`${id}:/logs`, [
			{ name: 'latest.log', type: 'file', size: 45280, modifiedAt: new Date().toISOString(), mime: 'text/plain' },
		]);
		daemonFiles.set(`${id}:/world`, [
			{ name: 'level.dat', type: 'file', size: 2048000, modifiedAt: new Date().toISOString(), mime: 'application/octet-stream' },
			{ name: 'region', type: 'directory', size: 0, modifiedAt: new Date().toISOString() },
		]);
		daemonContents.set(`${id}:/server.properties`, 'motd=Aurora Panel Server\ngamemode=survival\ndifficulty=normal\npvp=true\nmax-players=20\nserver-port=25565\nonline-mode=true\n');
		daemonContents.set(`${id}:/eula.txt`, 'eula=true\n');
		daemonContents.set(`${id}:/ops.json`, '[]');
		daemonContents.set(`${id}:/whitelist.json`, '[]');
		daemonContents.set(`${id}:/banned-players.json`, '[]');
	}
}

function normalizeDir(s: string): string {
	return s.endsWith('/') ? s.slice(0, -1) : s;
}

function listDaemonFiles(serverId: string, dir: string): { name: string; path: string; type: string; size: number; modifiedAt: string; sizeFormatted: string }[] {
	createServerDirs(serverId);
	const key = `${serverId}:${normalizeDir(dir)}`;
	const entries = daemonFiles.get(key) || daemonFiles.get(`${serverId}:/`) || [];
	return entries.map(e => ({
		...e,
		path: `${dir === '/' ? '' : dir}/${e.name}`,
		sizeFormatted: e.type === 'file' ? formatDaemonSize(e.size) : ''
	}));
}

function readDaemonFile(serverId: string, filePath: string): string | null {
	const content = daemonContents.get(`${serverId}:${filePath}`);
	return content ?? null;
}

function writeDaemonFile(serverId: string, filePath: string, content: string): void {
	daemonContents.set(`${serverId}:${filePath}`, content);
	const dirKey = `${serverId}:/`;
	const entries = daemonFiles.get(dirKey) || [];
	const existing = entries.find(e => `/${e.name}` === filePath);
	if (!existing) {
		entries.push({ name: filePath.split('/').pop() || 'file', type: 'file', size: content.length, modifiedAt: new Date().toISOString(), mime: 'text/plain' });
	}
}

function deleteDaemonEntry(serverId: string, filePath: string): boolean {
	const fileName = filePath.split('/').pop() || '';
	const parentDir = filePath.substring(0, filePath.lastIndexOf('/')) || '/';
	const dirKey = `${serverId}:${normalizeDir(parentDir)}`;
	const entries = daemonFiles.get(dirKey);
	if (!entries) return false;
	const idx = entries.findIndex(e => e.name === fileName);
	if (idx === -1) return false;
	entries.splice(idx, 1);
	daemonContents.delete(`${serverId}:${filePath}`);
	return true;
}

function renameDaemonEntry(serverId: string, oldPath: string, newName: string): boolean {
	const parentDir = oldPath.substring(0, oldPath.lastIndexOf('/')) || '/';
	const dirKey = `${serverId}:${normalizeDir(parentDir)}`;
	const entries = daemonFiles.get(dirKey);
	if (!entries) return false;
	const entry = entries.find(e => e.name === oldPath.split('/').pop());
	if (!entry) return false;
	const content = daemonContents.get(`${serverId}:${oldPath}`);
	if (content !== undefined) {
		daemonContents.delete(`${serverId}:${oldPath}`);
		const newPath = parentDir === '/' ? `/${newName}` : `${parentDir}/${newName}`;
		daemonContents.set(`${serverId}:${newPath}`, content);
	}
	entry.name = newName;
	return true;
}

function createDaemonEntry(serverId: string, parentDir: string, name: string, type: 'file' | 'directory'): boolean {
	const dirKey = `${serverId}:${normalizeDir(parentDir)}`;
	const entries = daemonFiles.get(dirKey) || daemonFiles.get(`${serverId}:/`);
	if (!entries) return false;
	if (entries.some(e => e.name === name)) return false;
	entries.push({ name, type, size: type === 'file' ? 0 : 0, modifiedAt: new Date().toISOString(), mime: type === 'file' ? 'text/plain' : undefined });
	return true;
}

function formatDaemonSize(bytes: number): string {
	if (bytes === 0) return '0 B';
	const k = 1024;
	const sizes = ['B', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getServer(id: string): ManagedServer | undefined {
	return servers.find((s) => s.id === id);
}

function getSystemStats() {
	return {
		cpu: {
			load: Math.random() * 100,
			cores: 8
		},
		memory: {
			total: 32768,
			used: Math.floor(Math.random() * 16384) + 4096
		},
		disk: {
			total: 512000,
			used: Math.floor(Math.random() * 256000) + 50000
		}
	};
}

function startServerOutput(srv: ManagedServer, socket: Socket) {
	if (srv.consoleTimer) return;
	srv.status = 'running';
	srv.consoleTimer = setInterval(() => {
		const line = mockOutputs[Math.floor(Math.random() * mockOutputs.length)]!;
		srv.consoleLines.push(`\x1b[${line}`);
		if (srv.consoleLines.length > 500) srv.consoleLines.shift();
		socket.emit('console:output', { serverId: srv.id, line: `\x1b[${line}` });
	}, 3000 + Math.random() * 4000);
}

function stopServerOutput(srv: ManagedServer) {
	if (srv.consoleTimer) {
		clearInterval(srv.consoleTimer);
		srv.consoleTimer = null;
	}
	srv.status = 'stopped';
}

function handleCommand(srv: ManagedServer, command: string, socket: Socket) {
	const line = `> ${command}`;
	srv.consoleLines.push(line);
	socket.emit('console:output', { serverId: srv.id, line });

	const cmd = command.toLowerCase().trim();
	setTimeout(() => {
		let response = '';
		if (cmd === 'help') {
			response = '--- Help ---\n/help - Show help\n/list - List players\n/say <msg> - Broadcast message\n/stop - Stop server';
		} else if (cmd === 'list') {
			response = 'There are 2/20 players online: Steve, Alex';
		} else if (cmd.startsWith('say ')) {
			response = `[Server] ${cmd.slice(4)}`;
		} else if (cmd === 'stop') {
			response = '[31mWARN[0m] Server shutting down...';
			stopServerOutput(srv);
		} else {
			response = `[33mWARN[0m] Unknown command. Use 'help' for a list of commands.`;
		}
		for (const r of response.split('\n')) {
			const formatted = r.startsWith('[') ? `\x1b[${r}` : `[32mINFO[0m] ${r}`;
			srv.consoleLines.push(formatted);
			if (srv.consoleLines.length > 500) srv.consoleLines.shift();
			socket.emit('console:output', { serverId: srv.id, line: formatted });
		}
	}, 200);
}

async function main() {
	console.log(`[Daemon ${DAEMON_ID}] Starting...`);

	await ensureDockerNetwork();

	const socket: Socket = createSocketClient(PANEL_URL, {
		path: '/ws',
		auth: { token: DAEMON_TOKEN, type: 'daemon', daemonId: DAEMON_ID },
		transports: ['websocket', 'polling'],
		reconnection: true,
		reconnectionAttempts: Infinity,
		reconnectionDelay: 2000,
	});

	socket.on('connect', () => {
		console.log(`[Daemon ${DAEMON_ID}] Connected to panel at ${PANEL_URL}`);
		const stats = getSystemStats();
		socket.emit('daemon:register', {
			id: DAEMON_ID,
			name: DAEMON_NAME,
			host: 'localhost',
			port: DAEMON_PORT,
			...stats,
			uptime: process.uptime(),
			version: DAEMON_VERSION,
			servers: servers.map(s => ({ id: s.id, name: s.name, status: s.status, processType: s.processType || 'bare' }))
		});
	});

	socket.on('disconnect', () => {
		console.log(`[Daemon ${DAEMON_ID}] Disconnected from panel`);
	});

	socket.on('connect_error', (err) => {
		console.error(`[Daemon ${DAEMON_ID}] Connection error:`, err.message);
	});

	socket.on('server:start', async (serverId: string) => {
		const srv = getServer(serverId);
		if (!srv) return;
		console.log(`[Daemon ${DAEMON_ID}] Starting server ${srv.name}`);

		if (srv.processType === 'docker') {
			const started = await dockerStartContainer(srv);
			if (started) {
				srv.status = 'running';
				startServerOutput(srv, socket);
				socket.emit('server:status', { id: serverId, status: 'running' });
			} else {
				srv.status = 'error';
				socket.emit('server:status', { id: serverId, status: 'error' });
			}
		} else {
			startServerOutput(srv, socket);
			socket.emit('server:status', { id: serverId, status: 'running' });
		}
	});

	socket.on('server:stop', async (serverId: string) => {
		const srv = getServer(serverId);
		if (!srv) return;
		console.log(`[Daemon ${DAEMON_ID}] Stopping server ${srv.name}`);

		if (srv.processType === 'docker') {
			await dockerStopContainer(srv);
		}
		stopServerOutput(srv);
		socket.emit('server:status', { id: serverId, status: 'stopped' });
		srv.consoleLines.push('\x1b[31mWARN[0m] Server stopped');
		socket.emit('console:output', { serverId, line: '\x1b[31mWARN[0m] Server stopped' });
	});

	socket.on('server:restart', async (serverId: string) => {
		const srv = getServer(serverId);
		if (!srv) return;
		console.log(`[Daemon ${DAEMON_ID}] Restarting server ${srv.name}`);

		if (srv.processType === 'docker') {
			await dockerStopContainer(srv);
		}
		stopServerOutput(srv);
		socket.emit('server:status', { id: serverId, status: 'restarting' });

		setTimeout(async () => {
			if (srv.processType === 'docker') {
				await dockerStartContainer(srv);
			}
			startServerOutput(srv, socket);
			socket.emit('server:status', { id: serverId, status: 'running' });
		}, 1000);
	});

	socket.on('server:create', async (data: { id: string; name: string; port: number; allocatedMemory: number; allocatedDisk: number; allocatedCpu: number; gameVersion: string; loader: string; processType?: string; dockerImage?: string }) => {
		const existing = getServer(data.id);
		if (existing) {
			console.log(`[Daemon ${DAEMON_ID}] Server ${data.id} already exists, skipping creation`);
			return;
		}
		const srv: ManagedServer = {
			id: data.id,
			name: data.name,
			status: 'stopped',
			gameVersion: data.gameVersion || 'latest',
			loader: data.loader || '',
			platform: data.loader || '',
			port: data.port || 25565,
			allocatedMemory: data.allocatedMemory || 1024,
			allocatedDisk: data.allocatedDisk || 10240,
			allocatedCpu: data.allocatedCpu || 100,
			consoleLines: [],
			consoleTimer: null,
			processType: (data.processType as 'docker' | 'bare') || 'docker',
			dockerImage: data.dockerImage
		};
		servers.push(srv);
		createServerDirs(data.id);
		console.log(`[Daemon ${DAEMON_ID}] Created server ${srv.name} (${srv.id})`);

		if (srv.processType === 'docker') {
			const pulled = await Bun.$`docker pull ${srv.dockerImage || 'itzg/minecraft-server:latest'}`.quiet().then(() => true).catch(() => false);
			if (pulled) console.log(`[Docker] Pulled image for ${srv.name}`);
		}

		socket.emit('server:created', { id: data.id, success: true });
	});

	socket.on('console:command', ({ serverId, command }: { serverId: string; command: string }) => {
		const srv = getServer(serverId);
		if (!srv) return;
		handleCommand(srv, command, socket);
	});

	socket.on('console:subscribe', (serverId: string) => {
		const srv = getServer(serverId);
		if (!srv) return;
		socket.emit('console:history', srv.consoleLines);
	});

	socket.on('docker:exec', async ({ serverId, command }: { serverId: string; command: string }) => {
		const srv = getServer(serverId);
		if (!srv || srv.processType !== 'docker') return;
		const result = await dockerExec(srv, command);
		socket.emit('docker:exec:result', { serverId, result });
	});

	socket.on('docker:logs', async (serverId: string) => {
		const srv = getServer(serverId);
		if (!srv || srv.processType !== 'docker') return;
		const logs = getDockerLogs(srv);
		socket.emit('docker:logs:result', { serverId, logs });
	});

	Bun.serve({
		port: DAEMON_PORT,
		async fetch(req) {
			const url = new URL(req.url);
			const pathname = url.pathname;

			try {
				if (pathname === '/health') {
					const stats = getSystemStats();
					return Response.json({
						status: 'ok',
						daemonId: DAEMON_ID,
						...stats,
						uptime: process.uptime(),
						version: DAEMON_VERSION
					});
				}

				if (pathname === '/servers') {
					return Response.json(servers.map(s => ({
						id: s.id, name: s.name, status: s.status,
						gameVersion: s.gameVersion, loader: s.loader, platform: s.platform, port: s.port,
						allocatedMemory: s.allocatedMemory, allocatedDisk: s.allocatedDisk, allocatedCpu: s.allocatedCpu,
						processType: s.processType || 'bare', dockerImage: s.dockerImage
					})));
				}

				if (pathname === '/docker/info') {
					const dockerAvailable = await ensureDockerNetwork().catch(() => false);
					return Response.json({
						available: dockerAvailable,
						network: DOCKER_NETWORK,
						containers: servers.filter(s => s.processType === 'docker').map(s => ({
							id: s.id, name: s.name, container: getContainerName(s.id), status: s.status
						}))
					});
				}

				if (pathname === '/backup' && req.method === 'POST') {
					const { serverId } = await req.json() as { serverId: string };
					const srv = getServer(serverId);
					if (!srv) return Response.json({ error: 'Server not found' }, { status: 404 });
					const backupDir = `${SERVERS_DIR}/${srv.id}/backups`;
					const backupName = `backup-${Date.now()}.tar.gz`;
					await Bun.$`mkdir -p ${backupDir}`;
					const proc = Bun.$`tar -czf ${backupDir}/${backupName} -C ${SERVERS_DIR}/${srv.id} .`;
					const { exitCode } = await proc.quiet();
					if (exitCode !== 0) return Response.json({ error: 'Backup failed' }, { status: 500 });
					return Response.json({ success: true, name: backupName, path: `${backupDir}/${backupName}` });
				}

				if (pathname.startsWith('/backup/') && req.method === 'DELETE') {
					const serverId = url.searchParams.get('server');
					const fileName = pathname.replace('/backup/', '');
					if (!serverId || !fileName) return Response.json({ error: 'Missing params' }, { status: 400 });
					await Bun.$`rm -f ${SERVERS_DIR}/${serverId}/backups/${fileName}`;
					return Response.json({ success: true });
				}

				if (pathname === '/backup/restore' && req.method === 'POST') {
					const { serverId, fileName } = await req.json() as { serverId: string; fileName: string };
					const backupPath = `${SERVERS_DIR}/${serverId}/backups/${fileName}`;
					await Bun.$`tar -xzf ${backupPath} -C ${SERVERS_DIR}/${serverId}`;
					return Response.json({ success: true, message: `Restored from ${fileName}` });
				}

				if (pathname.startsWith('/files/')) {
					const serverId = url.searchParams.get('server');
					if (!serverId) return Response.json({ error: 'Missing server' }, { status: 400 });
					const dir = url.searchParams.get('dir');
					const filePath = url.searchParams.get('path');
					const action = url.searchParams.get('action');

					if (req.method === 'GET' && dir !== null) {
						return Response.json(listDaemonFiles(serverId, dir));
					}
					if (req.method === 'GET' && filePath) {
						const content = readDaemonFile(serverId, filePath);
						if (content === null) return Response.json({ error: 'File not found' }, { status: 404 });
						return Response.json({ content });
					}
					if (req.method === 'PUT' && filePath) {
						const body = await req.json() as { content?: string };
						if (!body || body.content === undefined) return Response.json({ error: 'Missing content' }, { status: 400 });
						writeDaemonFile(serverId, filePath, body.content);
						return Response.json({ success: true });
					}
					if (req.method === 'DELETE' && filePath) {
						return Response.json({ success: deleteDaemonEntry(serverId, filePath) });
					}
					if (req.method === 'PATCH' && action) {
						const body = await req.json() as { name?: string };
						if (action === 'rename' && filePath && body?.name) {
							return Response.json({ success: renameDaemonEntry(serverId, filePath, body.name) });
						}
						if ((action === 'mkdir' || action === 'touch') && dir && body?.name) {
							return Response.json({ success: createDaemonEntry(serverId, dir, body.name, action === 'mkdir' ? 'directory' : 'file') });
						}
						return Response.json({ error: 'Invalid action' }, { status: 400 });
					}
					return Response.json({ error: 'Invalid request' }, { status: 400 });
				}

				return Response.json({ error: 'Not found' }, { status: 404 });
			} catch (e) {
				return Response.json({ error: e instanceof Error ? e.message : 'Internal error' }, { status: 500 });
			}
		}
	});

	console.log(`[Daemon ${DAEMON_ID}] HTTP server listening on port ${DAEMON_PORT}`);
}

main().catch(console.error);
