import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { getAllDaemons, fetchEggList, fetchEggVersions } from '$lib/server/daemon-client';

export const GET: RequestHandler = async () => {
	const daemons = getAllDaemons();
	const eggs: Record<string, unknown>[] = [];

	for (const daemon of daemons) {
		if (!daemon.connected) continue;
		try {
			const list = await fetchEggList(daemon.id);
			if (list && Array.isArray(list)) {
				eggs.push(...list);
			}
		} catch {}
	}

	return json(eggs);
};

export const POST: RequestHandler = async ({ request }: { request: Request }) => {
	const { eggId, daemonId } = await request.json() as { eggId: string; daemonId?: string };

	if (daemonId) {
		const versions = await fetchEggVersions(daemonId, eggId);
		return json(versions ?? []);
	}

	const daemons = getAllDaemons();
	for (const daemon of daemons) {
		if (!daemon.connected) continue;
		try {
			const versions = await fetchEggVersions(daemon.id, eggId);
			if (versions && Array.isArray(versions)) {
				return json(versions);
			}
		} catch {}
	}

	return json([]);
};
