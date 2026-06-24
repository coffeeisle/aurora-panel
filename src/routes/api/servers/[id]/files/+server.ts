import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { daemonListFiles } from '$lib/server/daemon-client';
import { db } from '$lib/server/db';
import { servers } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const GET: RequestHandler = async ({ params, url }) => {
	const serverId = params.id;
	const dir = url.searchParams.get('dir') || '/';

	const server = db.select().from(servers).where(eq(servers.id, serverId)).get();
	if (!server) return json({ error: 'Server not found' }, { status: 404 });

	const daemonId = server.nodeId || 'node-01';
	try {
		const res = await daemonListFiles(daemonId, serverId, dir);
		if (!res.ok) {
			const text = await res.text().catch(() => 'Daemon error');
			return json({ error: text }, { status: res.status });
		}
		const entries = await res.json();
		return json(entries);
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : 'Failed to reach daemon' }, { status: 502 });
	}
};
