import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db';
import { installedMods, servers } from '$lib/server/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { getProjectVersions } from '$lib/server/modrinth';

export const GET: RequestHandler = async ({ params }: { params: Record<string, string> }) => {
	const serverId = params.id;

	const row = db.select().from(servers).where(eq(servers.id, serverId)).get();
	if (!row) return json({ error: 'Server not found' }, { status: 404 });

	const installed = db.select().from(installedMods)
		.where(eq(installedMods.serverId, serverId))
		.all();

	const results: { projectId: string; currentVersion: string; latestVersion: string | null; hasUpdate: boolean }[] = [];

	for (const item of installed) {
		try {
			const versions = await getProjectVersions(item.projectId, [row.gameVersion], [row.loader || row.platform].filter(Boolean));
			const latest = versions.find(v => v.featured) ?? versions[0];
			const latestVersion = latest?.version_number ?? null;
			results.push({
				projectId: item.projectId,
				currentVersion: item.versionNumber,
				latestVersion,
				hasUpdate: latestVersion !== null && latestVersion !== item.versionNumber,
			});
		} catch {
			results.push({ projectId: item.projectId, currentVersion: item.versionNumber, latestVersion: null, hasUpdate: false });
		}
	}

	return json(results);
};

export const POST: RequestHandler = async ({ params, request }: { params: Record<string, string>; request: Request }) => {
	const serverId = params.id;
	const { projectIds } = await request.json() as { projectIds?: string[] };

	const row = db.select().from(servers).where(eq(servers.id, serverId)).get();
	if (!row) return json({ error: 'Server not found' }, { status: 404 });

	let installed;
	if (projectIds && projectIds.length > 0) {
		installed = db.select().from(installedMods)
			.where(and(
				eq(installedMods.serverId, serverId),
				inArray(installedMods.projectId, projectIds)
			))
			.all();
	} else {
		installed = db.select().from(installedMods)
			.where(eq(installedMods.serverId, serverId))
			.all();
	}

	const results: Record<string, { currentVersion: string; latestVersion: string | null; hasUpdate: boolean }> = {};

	for (const item of installed) {
		try {
			const versions = await getProjectVersions(item.projectId, [row.gameVersion], [row.loader || row.platform].filter(Boolean));
			const latest = versions.find(v => v.featured) ?? versions[0];
			const latestVersion = latest?.version_number ?? null;
			results[item.projectId] = {
				currentVersion: item.versionNumber,
				latestVersion,
				hasUpdate: latestVersion !== null && latestVersion !== item.versionNumber,
			};
		} catch {
			results[item.projectId] = { currentVersion: item.versionNumber, latestVersion: null, hasUpdate: false };
		}
	}

	return json(results);
};
