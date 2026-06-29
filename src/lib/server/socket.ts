import http from 'node:http';
import { Server as SocketServer } from 'socket.io';
import { verifyDaemonToken } from './daemon-auth';
import { persistDaemon, markDaemonOffline, updateDaemonStats } from './daemon-client';

export function createSocketServer(_httpServer?: http.Server) {
	const socketPort = parseInt(process.env['SOCKET_PORT'] ?? '3001', 10);
	const ioServer = http.createServer();
	const io = new SocketServer(ioServer, {
		cors: {
			origin: process.env['PUBLIC_APP_URL'] ?? '*',
			credentials: true,
		},
		path: '/ws',
		addTrailingSlash: false,
		pingInterval: 25000,
		pingTimeout: 20000,
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

			socket.on('daemon:register', (data: Record<string, unknown>) => {
				const host = (data.host as string) || 'localhost';
				const port = (data.port as number) || 8443;
				const name = (data.name as string) || daemonId;
				persistDaemon(daemonId, host, port, name);
				io.emit('daemon:registered', { ...data, id: daemonId, host, port, name });
			});

			socket.on('daemon:stats', (data: Record<string, unknown>) => {
				updateDaemonStats(data as Parameters<typeof updateDaemonStats>[0]);
				io.emit('daemon:stats', data);
			});

			socket.on('server:status', (data: { id: string; status: string; crashCount?: number }) => {
				io.to(`server:${data.id}`).emit('server:status', data);
				io.emit('server:status:global', data);
			});

			socket.on('server:crashed', (data: { id: string; name: string; crashCount: number }) => {
				io.to(`server:${data.id}`).emit('server:crashed', data);
				io.emit('server:crashed:global', data);
			});

			socket.on('server:created', (data: { id: string; success: boolean; status: string }) => {
				io.emit('server:created', data);
			});

			socket.on('console:output', (data: { serverId: string; line: string }) => {
				io.to(`server:${data.serverId}`).emit('console:output', data);
			});

			socket.on('console:history', (data: string[]) => {
				const serverId = socket.handshake.auth.serverId || '';
				io.to(`server:${serverId}`).emit('console:history', data);
			});

			socket.on('disconnect', () => {
				markDaemonOffline(daemonId);
				io.emit('daemon:disconnected', { id: daemonId });
				console.log(`[Socket] Daemon disconnected: ${daemonId}`);
			});
		}

		if (type === 'browser' || type === 'dev') {
			socket.on('console:subscribe', (serverId: string) => {
				socket.join(`server:${serverId}`);
				emitToDaemon(io, 'console:subscribe', serverId);
			});

			socket.on('console:unsubscribe', (serverId: string) => {
				socket.leave(`server:${serverId}`);
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

			socket.on('server:kill', (serverId: string) => {
				emitToDaemon(io, 'server:kill', serverId);
			});

			socket.on('server:restart', (serverId: string) => {
				emitToDaemon(io, 'server:restart', serverId);
			});
		}
	});

	ioServer.listen(socketPort, () => {
		console.log(`[Socket] Listening on port ${socketPort}`);
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
