import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deleteBackup } from '$lib/server/backups';

export const DELETE: RequestHandler = async ({ params }) => {
	const success = deleteBackup(params.id, params.backupId);
	if (!success) {
		return json({ error: 'Backup not found' }, { status: 404 });
	}
	return json({ success: true });
};

export const GET: RequestHandler = async ({ params, url }) => {
	if (url.searchParams.has('download')) {
		// In a real implementation, this would stream the actual backup file
		return new Response('Backup file content (mock)', {
			headers: {
				'Content-Type': 'application/octet-stream',
				'Content-Disposition': `attachment; filename="backup-${params.backupId}.tar.gz"`
			}
		});
	}

	return json({ error: 'Not found' }, { status: 404 });
};
