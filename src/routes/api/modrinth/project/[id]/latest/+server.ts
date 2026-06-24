import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getProjectVersions } from '$lib/server/modrinth';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const versions = await getProjectVersions(params.id);
		if (versions.length === 0) {
			return json({ version_number: null }, { status: 404 });
		}
		const featured = versions.find((v) => v.featured) ?? versions[0];
		return json({ version_number: featured?.version_number ?? null });
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : 'Failed to fetch' }, { status: 500 });
	}
};
