import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listBackups, formatBackupSize } from '$lib/server/backups';

export const GET: RequestHandler = async ({ params }) => {
	const backups = listBackups(params.id);
	const enriched = backups.map((b) => ({
		...b,
		sizeFormatted: formatBackupSize(b.size)
	}));
	return json(enriched);
};

export const POST: RequestHandler = async ({ params, request }) => {
	const { createBackup } = await import('$lib/server/backups');
	const body = await request.json();
	const backup = createBackup(params.id, body.name || `Backup ${new Date().toLocaleDateString()}`);
	return json(backup, { status: 201 });
};
