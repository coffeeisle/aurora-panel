import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { servers } from '$lib/stores/servers';
import { get } from 'svelte/store';

export const PUT: RequestHandler = async ({ params, request }) => {
	const serverId = params.id;
	const currentServers = get(servers);
	const idx = currentServers.findIndex((s) => s.id === serverId);
	if (idx === -1) {
		return json({ success: false, error: 'Server not found' }, { status: 404 });
	}

	const body = await request.json();
	const server = { ...currentServers[idx] };

	if (body.name !== undefined) server.name = body.name;
	if (body.allocatedMemory !== undefined) server.allocatedMemory = body.allocatedMemory;
	if (body.allocatedDisk !== undefined) server.allocatedDisk = body.allocatedDisk;
	if (body.allocatedCpu !== undefined) server.allocatedCpu = body.allocatedCpu;
	if (body.port !== undefined) server.port = body.port;
	if (body.nodeName !== undefined) server.nodeName = body.nodeName;
	if (body.gameVersion !== undefined) server.gameVersion = body.gameVersion;
	if (body.loader !== undefined) server.loader = body.loader;

	currentServers[idx] = server;
	servers.set(currentServers);

	return json({ success: true, server });
};
