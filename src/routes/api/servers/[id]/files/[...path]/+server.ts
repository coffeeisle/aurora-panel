import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getFileContent, saveFileContent, deleteEntry, renameEntry, createEntry } from '$lib/server/files';

export const GET: RequestHandler = async ({ params, url }) => {
	const filePath = url.searchParams.get('path');
	if (!filePath) return json({ error: 'Missing path' }, { status: 400 });

	const content = getFileContent(params.id, filePath);
	if (content === null) return json({ error: 'File not found' }, { status: 404 });

	return json({ content });
};

export const PUT: RequestHandler = async ({ params, request, url }) => {
	const filePath = url.searchParams.get('path');
	if (!filePath) return json({ error: 'Missing path' }, { status: 400 });

	const { content } = await request.json();
	saveFileContent(params.id, filePath, content);
	return json({ success: true });
};

export const PATCH: RequestHandler = async ({ params, request, url }) => {
	const path = url.searchParams.get('path');
	const action = url.searchParams.get('action');
	if (!path) return json({ error: 'Missing path' }, { status: 400 });

	if (action === 'rename') {
		const { name } = await request.json();
		return json({ success: renameEntry(params.id, path, name) });
	}

	if (action === 'mkdir') {
		const { name } = await request.json();
		return json({ success: createEntry(params.id, path, name, 'directory') });
	}

	if (action === 'touch') {
		const { name } = await request.json();
		return json({ success: createEntry(params.id, path, name, 'file') });
	}

	return json({ error: 'Unknown action' }, { status: 400 });
};

export const DELETE: RequestHandler = async ({ params, url }) => {
	const filePath = url.searchParams.get('path');
	if (!filePath) return json({ error: 'Missing path' }, { status: 400 });

	return json({ success: deleteEntry(params.id, filePath) });
};
