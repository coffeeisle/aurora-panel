import type { Server as HttpServer } from 'node:http';
import { Server as SocketServer } from 'socket.io';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env['DAEMON_JWT_SECRET'] ?? 'dev-secret';

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
		if (!token) {
			return next(new Error('Authentication required'));
		}
		try {
			const decoded = jwt.verify(token, JWT_SECRET);
			(socket as any).data = decoded;
			next();
		} catch {
			next(new Error('Invalid token'));
		}
	});

	io.on('connection', (socket) => {
		console.log(`Daemon connected: ${socket.id}`);

		socket.on('server:start', async (serverId: string) => {
			socket.emit('server:status', { id: serverId, status: 'starting' });
		});

		socket.on('server:stop', async (serverId: string) => {
			socket.emit('server:status', { id: serverId, status: 'stopped' });
		});

		socket.on('server:restart', async (serverId: string) => {
			socket.emit('server:status', { id: serverId, status: 'restarting' });
		});

		socket.on('disconnect', () => {
			console.log(`Daemon disconnected: ${socket.id}`);
		});
	});

	return io;
}
