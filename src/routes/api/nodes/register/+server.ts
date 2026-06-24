import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { registerDaemon } from '$lib/server/daemon-client';

export const POST: RequestHandler = async ({ request }) => {
	const { id, host, port } = await request.json();

	if (!id || !host) {
		return json({ success: false, error: 'Missing id or host' }, { status: 400 });
	}

	registerDaemon(id, host, port || 8443);

	return json({
		success: true,
		message: `Node ${id} registered at ${host}:${port || 8443}`
	});
};
