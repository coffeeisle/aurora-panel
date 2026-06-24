import type { Server as HttpServer } from 'node:http';
import { createSocketServer } from '$lib/server/socket';
import { setIO } from '$lib/server/io';

export function init(server: HttpServer) {
	const io = createSocketServer(server);
	setIO(io);
}
