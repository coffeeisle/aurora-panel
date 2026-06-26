import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { backups, servers } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { getDaemon, daemonFetch } from '$lib/server/daemon-client';

export const DELETE: RequestHandler = async ({ params }) => {
	const existing = db.select().from(backups).where(eq(backups.id, params.backupId)).get();
	if (!existing) {
		return json({ error: 'Backup not found' }, { status: 404 });
	}

	const server = db.select().from(servers).where(eq(servers.id, params.id)).get();
	if (server?.nodeId && existing.filePath) {
		try {
			await daemonFetch(server.nodeId, `/backup/${encodeURIComponent(existing.filePath)}?server=${encodeURIComponent(params.id)}`, {
				method: 'DELETE',
			});
		} catch {
			// Continue even if daemon delete fails
		}
	}

	db.delete(backups).where(eq(backups.id, params.backupId)).run();
	return json({ success: true });
};

export const GET: RequestHandler = async ({ params, url }) => {
	if (!url.searchParams.has('download')) {
		return json({ error: 'Not found' }, { status: 404 });
	}

	const existing = db.select().from(backups).where(eq(backups.id, params.backupId)).get();
	if (!existing) {
		return json({ error: 'Backup not found' }, { status: 404 });
	}

	const server = db.select().from(servers).where(eq(servers.id, params.id)).get();
	if (!server?.nodeId || !existing.filePath) {
		return json({ error: 'Backup file not available' }, { status: 404 });
	}

	try {
		const res = await daemonFetch(server.nodeId, `/backup/${encodeURIComponent(existing.filePath)}?server=${encodeURIComponent(params.id)}`, {}, 30000);
		if (!res.ok) {
			return json({ error: 'Backup file not found on daemon' }, { status: 404 });
		}

		const blob = await res.blob();
		return new Response(blob, {
			headers: {
				'Content-Type': 'application/gzip',
				'Content-Disposition': `attachment; filename="${existing.filePath}"`,
				'Content-Length': blob.size.toString(),
			},
		});
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : 'Failed to reach daemon' }, { status: 502 });
	}
};
