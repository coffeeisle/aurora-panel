import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { getAllDaemons, getDaemonToken } from '$lib/server/daemon-client';

export const GET: RequestHandler = async ({ params, url }) => {
	const eggId = params.eggId;
	const forceRefresh = url.searchParams.has('refresh');
	const daemons = getAllDaemons();
	const token = getDaemonToken();

	for (const daemon of daemons) {
		if (!daemon.connected) continue;
		try {
			const endpoint = forceRefresh ? '/eggs/versions/refresh' : '/eggs/versions';
			const res = await fetch(`${daemon.url}${endpoint}`, {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${token}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ eggId }),
			});
			if (res.ok) {
				const data = await res.json();
				return json(data);
			}
		} catch {}
	}

	return json([]);
};
