import type { Server as SocketServer } from 'socket.io';

let _io: SocketServer | null = null;

export function setIO(io: SocketServer) {
	_io = io;
}

export function getIO(): SocketServer | null {
	return _io;
}

export function emitModrinthChange(serverId: string, event: 'installed' | 'removed' | 'updated', payload: { projectId: string; projectType: string; versionNumber?: string }) {
	const io = getIO();
	if (!io) return;
	io.to(`server:${serverId}`).emit('modrinth:changed', { serverId, event, ...payload });
	io.emit('modrinth:changed:global', { serverId, event, ...payload });
}
