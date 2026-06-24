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
		consoleLines: [], consoleTimer: null
	},
	{
		id: 'srv_02', name: 'Creative Build', status: 'stopped',
		gameVersion: '1.21.4', loader: 'Paper', platform: 'paper',
		port: 25566, allocatedMemory: 2048, allocatedDisk: 10240, allocatedCpu: 100,
		consoleLines: [], consoleTimer: null
	},
	{
		id: 'srv_03', name: 'Modded Adventures', status: 'stopped',
		gameVersion: '1.20.1', loader: 'Forge', platform: 'forge',
		port: 25567, allocatedMemory: 8192, allocatedDisk: 40960, allocatedCpu: 300,
		consoleLines: [], consoleTimer: null
	},
	{
		id: 'srv_04', name: 'MiniGames Network', status: 'stopped',
		gameVersion: '1.21', loader: 'Paper', platform: 'paper',
		port: 25568, allocatedMemory: 3072, allocatedDisk: 15360, allocatedCpu: 150,
		consoleLines: [], consoleTimer: null
	},
	{
		id: 'srv_05', name: 'Palworld Server', status: 'stopped',
		gameVersion: 'latest', loader: '', platform: 'steamcmd',
		port: 8211, allocatedMemory: 8192, allocatedDisk: 30720, allocatedCpu: 200,
		consoleLines: [], consoleTimer: null
	}
];

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
			servers: servers.map(s => ({ id: s.id, name: s.name, status: s.status }))
		});
	});

	socket.on('disconnect', () => {
		console.log(`[Daemon ${DAEMON_ID}] Disconnected from panel`);
	});

	socket.on('connect_error', (err) => {
		console.error(`[Daemon ${DAEMON_ID}] Connection error:`, err.message);
	});

	socket.on('server:start', (serverId: string) => {
		const srv = getServer(serverId);
		if (!srv) return;
		console.log(`[Daemon ${DAEMON_ID}] Starting server ${srv.name}`);
		startServerOutput(srv, socket);
		socket.emit('server:status', { id: serverId, status: 'running' });
	});

	socket.on('server:stop', (serverId: string) => {
		const srv = getServer(serverId);
		if (!srv) return;
		console.log(`[Daemon ${DAEMON_ID}] Stopping server ${srv.name}`);
		stopServerOutput(srv);
		socket.emit('server:status', { id: serverId, status: 'stopped' });
		srv.consoleLines.push('\x1b[31mWARN[0m] Server stopped');
		socket.emit('console:output', { serverId, line: '\x1b[31mWARN[0m] Server stopped' });
	});

	socket.on('server:restart', (serverId: string) => {
		const srv = getServer(serverId);
		if (!srv) return;
		console.log(`[Daemon ${DAEMON_ID}] Restarting server ${srv.name}`);
		stopServerOutput(srv);
		socket.emit('server:status', { id: serverId, status: 'restarting' });
		setTimeout(() => {
			startServerOutput(srv, socket);
			socket.emit('server:status', { id: serverId, status: 'running' });
		}, 1000);
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

	Bun.serve({
		port: DAEMON_PORT,
		async fetch(req) {
			const url = new URL(req.url);

			if (url.pathname === '/health') {
				const stats = getSystemStats();
				return Response.json({
					status: 'ok',
					daemonId: DAEMON_ID,
					...stats,
					uptime: process.uptime(),
					version: DAEMON_VERSION
				});
			}

			if (url.pathname === '/servers') {
				return Response.json(servers.map(s => ({
					id: s.id, name: s.name, status: s.status,
					gameVersion: s.gameVersion, loader: s.loader, platform: s.platform, port: s.port,
					allocatedMemory: s.allocatedMemory, allocatedDisk: s.allocatedDisk, allocatedCpu: s.allocatedCpu
				})));
			}

			return Response.json({ error: 'Not found' }, { status: 404 });
		}
	});

	console.log(`[Daemon ${DAEMON_ID}] HTTP server listening on port ${DAEMON_PORT}`);
}

main().catch(console.error);
