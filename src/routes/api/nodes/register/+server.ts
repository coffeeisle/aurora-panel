import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { persistDaemon } from '$lib/server/daemon-client';

export const POST: RequestHandler = async ({ request }) => {
	const { id, name, host, port } = await request.json();

	if (!id || !host) {
		return json({ success: false, error: 'Missing id or host' }, { status: 400 });
	}

	persistDaemon(id, host, port || 8443, name);

	return json({
		success: true,
		message: `Node ${name || id} registered at ${host}:${port || 8443}`
	});
};
