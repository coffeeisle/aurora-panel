import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listFiles, formatFileSize } from '$lib/server/files';

export const GET: RequestHandler = async ({ params, url }) => {
	const dir = url.searchParams.get('dir') || '/';
	const entries = listFiles(params.id, dir);
	const enriched = entries.map((e) => ({
		...e,
		sizeFormatted: e.type === 'file' ? formatFileSize(e.size) : ''
	}));
	return json(enriched);
};
