import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getGameVersions } from '$lib/server/modrinth';

export const GET: RequestHandler = async () => {
	const versions = await getGameVersions();
	return json(versions);
};
