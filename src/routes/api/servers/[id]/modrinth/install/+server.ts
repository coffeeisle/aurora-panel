import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { resolveInstall, downloadVersionFile, getTargetFolder, checkCompatibility, getVersion } from '$lib/server/modrinth';
import { db } from '$lib/server/db';
import { servers, installedMods } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getDaemon, daemonFetch } from '$lib/server/daemon-client';

export const POST: RequestHandler = async ({ params, request }: { params: Record<string, string>; request: Request }) => {
	const serverId = params.id;
	const row = db.select().from(servers).where(eq(servers.id, serverId)).get();
	if (!row) {
		return json({ success: false, error: 'Server not found' }, { status: 404 });
	}
	const server = { gameVersion: row.gameVersion, loader: row.loader, platform: row.platform, nodeId: row.nodeId };

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

	try {
		let resolved;
		if (versionId) {
			const v = await getVersion(versionId);
			const pf = v.files.find(f => f.primary) ?? v.files[0];
			if (!pf) return json({ error: 'No files in version' }, { status: 400 });
			resolved = { version: v, file: pf, dependencies: [] };
		} else {
			resolved = await resolveInstall(projectId, {
				gameVersions: [server.gameVersion],
				loaders: [server.loader || server.platform]
			});
		}

		if (!allowIncompatible) {
			const { compatible, reasons } = checkCompatibility(
				resolved.version,
				server.gameVersion,
				server.loader || server.platform
			);
			if (!compatible) {
				return json({
					success: false, error: 'Incompatible install', reasons, compatible: false
				}, { status: 400 });
			}
		}

		const buffer = await downloadVersionFile(resolved.file.url);

		const installed = [];
		installed.push(resolved);

		for (const dep of resolved.version.dependencies) {
			if (dep.dependency_type === 'required' && dep.project_id) {
				try {
					const depResolved = await resolveInstall(dep.project_id, {
						gameVersions: [server.gameVersion],
						loaders: [server.loader || server.platform]
					});
					if (!allowIncompatible) {
						const depCheck = checkCompatibility(depResolved.version, server.gameVersion, server.loader || server.platform);
						if (!depCheck.compatible) continue;
					}
					const depBuffer = await downloadVersionFile(depResolved.file.url);
					installed.push(depResolved);

					const depDir = getTargetFolder(depResolved.version.project_id ? pType : 'mod');
					const depPath = depDir ? `${depDir}/${depResolved.file.filename}` : depResolved.file.filename;
					await writeToDaemon(server.nodeId, serverId, depPath, depBuffer);

					db.insert(installedMods).values({
						id: nanoid(),
						serverId,
						projectId: dep.project_id,
						projectType: pType,
						versionId: depResolved.version.id,
						versionNumber: depResolved.version.version_number,
						title: depResolved.version.name,
						installedAt: new Date(),
					}).run();
				} catch {
					// Skip unresolvable dependencies
				}
			}
		}

		const filePath = targetFolder ? `${targetFolder}/${resolved.file.filename}` : resolved.file.filename;
		await writeToDaemon(server.nodeId, serverId, filePath, buffer);

		db.insert(installedMods).values({
			id: nanoid(),
			serverId,
			projectId,
			projectType: pType,
			versionId: resolved.version.id,
			versionNumber: resolved.version.version_number,
			title: resolved.version.name,
			installedAt: new Date(),
		}).run();

		return json({
			success: true,
			file: { name: resolved.file.filename, size: resolved.file.size, targetFolder: targetFolder || 'mods' },
			version: { id: resolved.version.id, versionNumber: resolved.version.version_number, name: resolved.version.name },
			dependencies: installed.length - 1,
			size: buffer.byteLength,
		});
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Unknown error';
		return json({ success: false, error: message }, { status: 500 });
	}
};

async function writeToDaemon(nodeId: string, serverId: string, path: string, buffer: ArrayBuffer): Promise<void> {
	const daemon = getDaemon(nodeId);
	if (!daemon) {
		throw new Error(`Daemon ${nodeId} not found`);
	}
	const dir = path.substring(0, path.lastIndexOf('/'));
	if (dir) {
		const dirName = dir.split('/').pop() || 'mods';
		await daemonFetch(nodeId, `/files?server=${encodeURIComponent(serverId)}&dir=${encodeURIComponent(dir)}&action=mkdir`, {
			method: 'PATCH',
			body: JSON.stringify({ name: dirName }),
		});
	}

	const base64 = Buffer.from(buffer).toString('base64');

	const res = await daemonFetch(nodeId, `/files?server=${encodeURIComponent(serverId)}&path=${encodeURIComponent(path)}`, {
		method: 'PUT',
		body: JSON.stringify({ content: base64, encoding: 'base64' }),
	});
	if (!res.ok) {
		throw new Error(`Daemon write failed: ${res.status}`);
	}
}
