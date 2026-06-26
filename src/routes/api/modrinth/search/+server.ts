import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { searchMods } from '$lib/server/modrinth';

export const GET: RequestHandler = async ({ url }) => {
	const query = url.searchParams.get('query') || '';
	const projectType = url.searchParams.get('type') || 'mod';
	const offset = parseInt(url.searchParams.get('offset') || '0', 10);
	const limit = parseInt(url.searchParams.get('limit') || '20', 10);

	let facets: string[][] = [];
	try {
		const raw = url.searchParams.get('facets');
		if (raw) facets = JSON.parse(raw);
	} catch {}

	const gameVersions: string[] = [];
	const loaders: string[] = [];
	let environment = '';

	for (const facet of facets) {
		for (const f of facet) {
			if (f.startsWith('versions:')) {
				gameVersions.push(...f.replace('versions:', '').split('|'));
			} else if (f.startsWith('categories:')) {
				loaders.push(f.replace('categories:', ''));
			} else if (f.startsWith('client_side:')) {
				environment = 'client';
			} else if (f.startsWith('server_side:')) {
				environment = environment === 'client' ? 'both' : 'server';
			}
		}
	}

	const result = await searchMods({ query, projectType, gameVersions, loaders, categories: [], environment, offset, limit });
	return json(result);
};
