import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db';
import { installedMods, servers } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { getDaemon, daemonFetch, daemonDeleteEntry } from '$lib/server/daemon-client';
import { emitModrinthChange } from '$lib/server/io';
import { getTargetFolder, getVersion } from '$lib/server/modrinth';

export const POST: RequestHandler = async ({ params }: { params: Record<string, string> }) => {
	const serverId = params.id;
	const projectId = params.projectId;

	const row = db.select().from(servers).where(eq(servers.id, serverId)).get();
	if (!row) return json({ error: 'Server not found' }, { status: 404 });

	const installed = db.select().from(installedMods)
		.where(and(eq(installedMods.serverId, serverId), eq(installedMods.projectId, projectId)))
		.all();

	if (installed.length === 0) return json({ error: 'Not installed' }, { status: 404 });

	for (const item of installed) {
		const folder = getTargetFolder(item.projectType);
		if (!folder || !row.nodeId) continue;

		try {
			const version = await getVersion(item.versionId);
			const primary = version.files.find(f => f.primary) ?? version.files[0];
			if (primary) {
				const filePath = `${folder}/${primary.filename}`;
				await daemonDeleteEntry(row.nodeId, serverId, filePath);
			}
		} catch (e) {
			console.error(`[Modrinth] Failed to resolve file for removal ${item.projectId}:`, e);
		}
	}

	const removedType = installed[0]?.projectType || 'mod';

	db.delete(installedMods)
		.where(and(eq(installedMods.serverId, serverId), eq(installedMods.projectId, projectId)))
		.run();

	emitModrinthChange(serverId, 'removed', { projectId, projectType: removedType });

	return json({ success: true, removed: installed.length });
};
