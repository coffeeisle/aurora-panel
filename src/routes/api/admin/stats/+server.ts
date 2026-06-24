import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { servers, users, nodes } from '$lib/server/db/schema';
import { count, eq } from 'drizzle-orm';

export const GET: RequestHandler = async () => {
	const serverCount = db.select({ count: count() }).from(servers).get()?.count ?? 0;
	const userCount = db.select({ count: count() }).from(users).get()?.count ?? 0;
	const nodeCount = db.select({ count: count() }).from(nodes).get()?.count ?? 0;
	const onlineNodes = db.select({ count: count() }).from(nodes).where(eq(nodes.status, 'online')).get()?.count ?? 0;

	return json({
		totalServers: serverCount,
		totalUsers: userCount,
		totalNodes: nodeCount,
		onlineNodes
	});
};
