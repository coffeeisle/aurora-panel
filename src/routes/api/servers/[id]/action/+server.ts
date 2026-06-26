import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getIO } from '$lib/server/io';

export const POST: RequestHandler = async ({ params, request }) => {
	const { action } = await request.json() as { action: string };
	const validActions = ['start', 'stop', 'restart', 'kill'];
	if (!validActions.includes(action)) {
		return json({ error: `Invalid action: ${action}` }, { status: 400 });
	}

	const io = getIO();
	if (!io) {
		return json({ error: 'Socket server not available' }, { status: 503 });
	}

	const event = `server:${action}`;
	const sockets = io.sockets.sockets;
	let sent = false;
	for (const [, sock] of sockets) {
		if (sock.handshake.auth.type === 'daemon') {
			sock.emit(event, params.id);
			sent = true;
		}
	}

	if (!sent) {
		return json({ error: 'No daemon connected' }, { status: 503 });
	}

	return json({ success: true, action, serverId: params.id });
};
