import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { backups } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

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
	const now = new Date();
	const backup = {
		id: `bak_${nanoid(8)}`,
		serverId: params.id,
		name: body.name || `Backup ${now.toLocaleDateString()}`,
		size: Math.floor(Math.random() * 500_000_000) + 50_000_000,
		type: 'full' as const,
		checksum: nanoid(8),
		createdAt: now
	};
	db.insert(backups).values(backup).run();
	return json({ ...backup, sizeFormatted: formatBackupSize(backup.size) }, { status: 201 });
};
