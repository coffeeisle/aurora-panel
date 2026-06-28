import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { nodes } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { removeDaemon } from '$lib/server/daemon-client';

export const GET: RequestHandler = async () => {
	const allNodes = db.select().from(nodes).all();
	return json(allNodes);
};

export const DELETE: RequestHandler = async ({ url }) => {
	const id = url.searchParams.get('id');
	if (!id) {
		return json({ error: 'Missing node id' }, { status: 400 });
	}
	removeDaemon(id);
	db.delete(nodes).where(eq(nodes.id, id)).run();
	return json({ success: true });
};
