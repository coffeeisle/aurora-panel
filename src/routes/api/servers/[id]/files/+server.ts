import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { daemonListFiles } from '$lib/server/daemon-client';
import { servers, getServerById } from '$lib/stores/servers';
import { get } from 'svelte/store';

export const GET: RequestHandler = async ({ params, url }) => {
	const serverId = params.id;
	const dir = url.searchParams.get('dir') || '/';

	const server = getServerById(serverId);
	if (!server) return json({ error: 'Server not found' }, { status: 404 });

	const daemonId = server.nodeName || 'node-01';
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
