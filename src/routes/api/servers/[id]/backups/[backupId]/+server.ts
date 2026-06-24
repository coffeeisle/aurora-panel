import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { backups } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const DELETE: RequestHandler = async ({ params }) => {
	const existing = db.select().from(backups).where(eq(backups.id, params.backupId)).get();
	if (!existing) {
		return json({ error: 'Backup not found' }, { status: 404 });
	}
	db.delete(backups).where(eq(backups.id, params.backupId)).run();
	return json({ success: true });
};

export const GET: RequestHandler = async ({ params, url }) => {
	if (url.searchParams.has('download')) {
		return new Response('Backup file content (mock)', {
			headers: {
				'Content-Type': 'application/octet-stream',
				'Content-Disposition': `attachment; filename="backup-${params.backupId}.tar.gz"`
			}
		});
	}
	return json({ error: 'Not found' }, { status: 404 });
};
