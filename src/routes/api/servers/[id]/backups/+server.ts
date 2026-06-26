import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { backups, servers } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getDaemon, daemonFetch } from '$lib/server/daemon-client';

function formatBackupSize(bytes: number): string {
	if (bytes === 0) return '0 B';
	const k = 1024;
	const sizes = ['B', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export const GET: RequestHandler = async ({ params }) => {
	const items = db.select().from(backups).where(eq(backups.serverId, params.id)).all();
	return json(items.map(b => ({ ...b, sizeFormatted: formatBackupSize(b.size) })));
};

export const POST: RequestHandler = async ({ params, request }) => {
	const body = await request.json();

	const server = db.select().from(servers).where(eq(servers.id, params.id)).get();
	if (!server) return json({ error: 'Server not found' }, { status: 404 });

	const daemonId = server.nodeId as string;
	const daemon = getDaemon(daemonId);

	if (!daemon || !daemon.connected) {
		return json({ error: 'Daemon not connected' }, { status: 503 });
	}

	try {
		const res = await daemonFetch(daemonId, '/backup', {
			method: 'POST',
			body: JSON.stringify({ serverId: params.id }),
		});

		if (!res.ok) {
			const err = await res.json().catch(() => ({ error: 'Backup failed' }));
			return json(err, { status: res.status });
		}

		const { name, size } = await res.json() as { name: string; size: number; path?: string };
		const now = new Date();
		const backup = {
			id: `bak_${nanoid(8)}`,
			serverId: params.id,
			name: body.name || name || `Backup ${now.toLocaleDateString()}`,
			size,
			type: 'full' as const,
			checksum: null as string | null,
			filePath: name,
			createdAt: now,
		};

		db.insert(backups).values(backup).run();
		return json({ ...backup, sizeFormatted: formatBackupSize(size) }, { status: 201 });
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : 'Failed to reach daemon' }, { status: 502 });
	}
};
