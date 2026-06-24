import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { resolveInstall, downloadVersionFile, getTargetFolder, checkCompatibility } from '$lib/server/modrinth';
import { db } from '$lib/server/db';
import { servers } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const POST: RequestHandler = async ({ params, request }) => {
	const serverId = params.id;
	const row = db.select().from(servers).where(eq(servers.id, serverId)).get();
	if (!row) {
		return json({ success: false, error: 'Server not found' }, { status: 404 });
	}
	const server = { gameVersion: row.gameVersion, loader: row.loader, platform: row.platform };

	const body = await request.json();
	const { projectId, versionId, projectType, allowIncompatible } = body as {
		projectId: string;
		versionId?: string;
		projectType?: string;
		allowIncompatible?: boolean;
	};

	if (!projectId) {
		return json({ success: false, error: 'Missing projectId' }, { status: 400 });
	}

	const pType = projectType || 'mod';
	const targetFolder = getTargetFolder(pType);
	if (!targetFolder && pType !== 'modpack') {
		return json({ success: false, error: `Unknown project type: ${pType}` }, { status: 400 });
	}

	try {
		const resolved = await resolveInstall(projectId, {
			gameVersions: versionId ? undefined : [server.gameVersion],
			loaders: versionId ? undefined : [server.loader || server.platform]
		});

		if (!allowIncompatible) {
			const { compatible, reasons } = checkCompatibility(
				resolved.version,
				server.gameVersion,
				server.loader || server.platform
			);
			if (!compatible) {
				return json({
					success: false,
					error: 'Incompatible install',
					reasons,
					compatible: false
				}, { status: 400 });
			}
		}

		const buffer = await downloadVersionFile(resolved.file.url);

		return json({
			success: true,
			file: {
				name: resolved.file.filename,
				size: resolved.file.size,
				targetFolder: targetFolder || 'mods'
			},
			version: {
				id: resolved.version.id,
				versionNumber: resolved.version.version_number,
				name: resolved.version.name
			},
			dependencies: resolved.dependencies.length,
			size: buffer.byteLength
		});
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Unknown error';
		return json({ success: false, error: message }, { status: 500 });
	}
};
