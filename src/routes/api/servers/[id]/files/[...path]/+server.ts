import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { daemonReadFile, daemonWriteFile, daemonDeleteEntry, daemonRenameEntry, daemonCreateEntry } from '$lib/server/daemon-client';
import { db } from '$lib/server/db';
import { servers } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

function getDaemonId(serverId: string): string | null {
	const server = db.select().from(servers).where(eq(servers.id, serverId)).get();
	return server?.nodeId || 'node-01';
}

export const GET: RequestHandler = async ({ params, url }) => {
	const filePath = url.searchParams.get('path');
	if (!filePath) return json({ error: 'Missing path' }, { status: 400 });

	const daemonId = getDaemonId(params.id);
	if (!daemonId) return json({ error: 'Server not found' }, { status: 404 });

	const result = await daemonReadFile(daemonId, params.id, filePath);
	if (!result) return json({ error: 'File not found' }, { status: 404 });
	return json(result);
};

export const PUT: RequestHandler = async ({ params, request, url }) => {
	const filePath = url.searchParams.get('path');
	if (!filePath) return json({ error: 'Missing path' }, { status: 400 });

	const daemonId = getDaemonId(params.id);
	if (!daemonId) return json({ error: 'Server not found' }, { status: 404 });

	const { content } = await request.json();
	const ok = await daemonWriteFile(daemonId, params.id, filePath, content);
	if (!ok) return json({ error: 'Failed to write file' }, { status: 500 });
	return json({ success: true });
};

export const PATCH: RequestHandler = async ({ params, request, url }) => {
	const path = url.searchParams.get('path');
	const action = url.searchParams.get('action');
	if (!path) return json({ error: 'Missing path' }, { status: 400 });

	const daemonId = getDaemonId(params.id);
	if (!daemonId) return json({ error: 'Server not found' }, { status: 404 });

	const { name } = await request.json();

	if (action === 'rename') {
		const ok = await daemonRenameEntry(daemonId, params.id, path, name);
		return json({ success: ok });
	}
	if (action === 'mkdir' || action === 'touch') {
		const type = action === 'mkdir' ? 'directory' : 'file';
		const ok = await daemonCreateEntry(daemonId, params.id, path, name, type);
		return json({ success: ok });
	}

	return json({ error: 'Unknown action' }, { status: 400 });
};

export const DELETE: RequestHandler = async ({ params, url }) => {
	const filePath = url.searchParams.get('path');
	if (!filePath) return json({ error: 'Missing path' }, { status: 400 });

	const daemonId = getDaemonId(params.id);
	if (!daemonId) return json({ error: 'Server not found' }, { status: 404 });

	const ok = await daemonDeleteEntry(daemonId, params.id, filePath);
	return json({ success: ok });
};
