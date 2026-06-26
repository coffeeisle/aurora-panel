import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db';
import { installedMods } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

export const GET: RequestHandler = async ({ params }) => {
	const serverId = params.id;
	const items = db.select().from(installedMods)
		.where(eq(installedMods.serverId, serverId))
		.all();

	return json(items.map(m => ({
		id: m.id,
		projectId: m.projectId,
		projectType: m.projectType,
		versionId: m.versionId,
		versionNumber: m.versionNumber,
		title: m.title || m.projectId,
		slug: m.slug,
		iconUrl: m.iconUrl,
		installedAt: m.installedAt,
	})));
};
