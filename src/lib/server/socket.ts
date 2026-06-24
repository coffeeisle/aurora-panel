import type { Server as HttpServer } from 'node:http';
import { Server as SocketServer } from 'socket.io';
import { verifyDaemonToken } from './daemon-auth';

export function createSocketServer(httpServer: HttpServer) {
	const io = new SocketServer(httpServer, {
		cors: {
			origin: process.env['PUBLIC_APP_URL'] ?? 'http://localhost:5173',
			credentials: true
		},
		path: '/ws'
	});

	io.use((socket, next) => {
		const token = socket.handshake.auth.token;
		const type = socket.handshake.auth.type;

		if (type === 'daemon') {
			const decoded = verifyDaemonToken(token);
			if (!decoded) return next(new Error('Invalid daemon token'));
			next();
		} else if (type === 'browser') {
			if (!token) return next(new Error('Authentication required'));
			try {
				verifyDaemonToken(token);
				next();
			} catch {
				next(new Error('Invalid token'));
			}
		} else if (type === 'dev') {
			next();
		} else {
			next(new Error('Invalid connection type'));
		}
	});

	io.on('connection', (socket) => {
		const type = socket.handshake.auth.type;

		if (type === 'daemon') {
			const daemonId = socket.handshake.auth.daemonId || 'unknown';
			console.log(`[Socket] Daemon connected: ${daemonId} (${socket.id})`);

			socket.on('daemon:register', (data: {
				id: string; name?: string; host?: string; port?: number;
				cpu?: { load: number; cores: number };
				memory?: { total: number; used: number };
				disk?: { total: number; used: number };
				uptime?: number; version?: string;
				servers?: { id: string; name: string; status: string }[];
			}) => {
				io.emit('daemon:registered', data);
			});

			socket.on('server:status', (data: { id: string; status: string }) => {
				io.to(`server:${data.id}`).emit('server:status', data);
				io.emit('server:status:global', data);
			});

			socket.on('console:output', (data: { serverId: string; line: string }) => {
				io.to(`server:${data.serverId}`).emit('console:output', data);
			});

			socket.on('disconnect', () => {
				io.emit('daemon:disconnected', { id: daemonId });
				console.log(`[Socket] Daemon disconnected: ${daemonId}`);
			});
		}

		if (type === 'browser' || type === 'dev') {
			socket.on('console:subscribe', (serverId: string) => {
				socket.join(`server:${serverId}`);
				emitToDaemon(io, 'console:subscribe', serverId);
			});

			socket.on('console:command', (data: { serverId: string; command: string }) => {
				emitToDaemon(io, 'console:command', data);
			});

			socket.on('server:start', (serverId: string) => {
				emitToDaemon(io, 'server:start', serverId);
			});

			socket.on('server:stop', (serverId: string) => {
				emitToDaemon(io, 'server:stop', serverId);
			});

			socket.on('server:restart', (serverId: string) => {
				emitToDaemon(io, 'server:restart', serverId);
			});
		}
	});

	return io;
}

function emitToDaemon(io: SocketServer, event: string, data: unknown) {
	const sockets = io.sockets.sockets;
	for (const [, sock] of sockets) {
		if (sock.handshake.auth.type === 'daemon') {
			sock.emit(event, data);
		}
	}
}
