import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { backups, servers } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { daemonFetch } from '$lib/server/daemon-client';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	const { serverId, backupId } = await request.json();
	if (!serverId || !backupId) {
		return json({ error: 'Missing serverId or backupId' }, { status: 400 });
	}

	const server = db.select().from(servers).where(eq(servers.id, serverId)).get();
	if (!server) return json({ error: 'Server not found' }, { status: 404 });

	const backup = db.select().from(backups).where(eq(backups.id, backupId)).get();
	if (!backup) return json({ error: 'Backup not found' }, { status: 404 });

	const daemonId = server.nodeId || 'node-01';
	const fileName = `${backup.id}.tar.gz`;

	try {
		const res = await daemonFetch(daemonId, '/backup/restore', {
			method: 'POST',
			body: JSON.stringify({ serverId, fileName })
		});

		if (!res.ok) {
			const err = await res.json().catch(() => ({ error: 'Daemon error' }));
			return json(err, { status: res.status });
		}

		const data = await res.json();
		return json(data);
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : 'Failed to reach daemon' }, { status: 502 });
	}
};
