import type { Server as HttpServer } from 'node:http';
import { createSocketServer } from '$lib/server/socket';

export function init(server: HttpServer) {
	createSocketServer(server);
}
