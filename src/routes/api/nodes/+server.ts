import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { nodes } from '$lib/server/db/schema';

export const GET: RequestHandler = async () => {
	const allNodes = db.select().from(nodes).all();
	return json(allNodes);
};
