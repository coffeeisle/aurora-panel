import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db';
import { servers, installedMods } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { resolveInstall, downloadVersionFile, getTargetFolder } from '$lib/server/modrinth';
import { getDaemon, daemonFetch } from '$lib/server/daemon-client';

export const POST: RequestHandler = async ({ params, request }: { params: Record<string, string>; request: Request }) => {
	const serverId = params.id;
	const row = db.select().from(servers).where(eq(servers.id, serverId)).get();
	if (!row) return json({ error: 'Server not found' }, { status: 404 });

	const formData = await request.formData();
	const file = formData.get('file') as File | null;
	if (!file) return json({ error: 'No file uploaded' }, { status: 400 });

	if (!file.name.endsWith('.mrpack')) {
		return json({ error: 'File must be a .mrpack' }, { status: 400 });
	}

	try {
		const buffer = await file.arrayBuffer();
		const uint8 = new Uint8Array(buffer);

		let binary = '';
		for (let i = 0; i < uint8.length; i++) {
			binary += String.fromCharCode(uint8[i]);
		}

		const { unzipSync } = await import('node:zlib');

		const { inflateSync, gunzipSync } = await import('node:zlib');

		let zipData: Uint8Array;
		try {
			zipData = gunzipSync(uint8);
		} catch {
			zipData = uint8;
		}

		const { Blob } = await import('node:buffer');

		const decoder = new TextDecoder('utf-8');

		const manifestIndex = findInZip(zipData, 'modrinth.index.json');
		if (!manifestIndex) return json({ error: 'Invalid .mrpack: missing modrinth.index.json' }, { status: 400 });

		const manifest = JSON.parse(decoder.decode(manifestIndex)) as {
			game: string;
			formatVersion: number;
			versionId: string;
			name: string;
			summary?: string;
			files: { path: string; downloads: string[]; fileSize: number; hashes: Record<string, string> }[];
			dependencies: Record<string, string>;
		};

		const installed = [];
		const daemon = row.nodeId ? getDaemon(row.nodeId) : null;

		for (const modFile of manifest.files) {
			if (modFile.downloads.length === 0) continue;
			const url = modFile.downloads[0];

			try {
				const modRes = await fetch(url);
				if (!modRes.ok) continue;
				const modBuffer = await modRes.arrayBuffer();

				if (daemon && daemon.connected) {
					const path = modFile.path;
					const dir = path.substring(0, path.lastIndexOf('/'));
					if (dir) {
						const { daemonCreateEntry } = await import('$lib/server/daemon-client');
						await daemonCreateEntry(row.nodeId!, serverId, `/${dir}`, path.split('/').pop() || '', 'directory').catch(() => {});
					}

					const uint8_2 = new Uint8Array(modBuffer);
					let b64 = '';
					for (let i = 0; i < uint8_2.length; i++) {
						b64 += String.fromCharCode(uint8_2[i]);
					}
					const base64 = btoa(b64);

					await daemonFetch(row.nodeId!, `/files?server=${encodeURIComponent(serverId)}&path=${encodeURIComponent('/' + path)}`, {
						method: 'PUT',
						body: JSON.stringify({ content: base64, encoding: 'base64' }),
					}).catch(() => {});
				}

				installed.push({ path: modFile.path, url, size: modFile.fileSize });
			} catch { /* skip failed downloads */ }
		}

		const now = new Date();
		for (const [depId, depVer] of Object.entries(manifest.dependencies)) {
			if (depId === 'minecraft') continue;
			db.insert(installedMods).values({
				id: nanoid(),
				serverId,
				projectId: depId,
				projectType: 'modpack',
				versionId: depVer,
				versionNumber: depVer,
				title: depId,
				installedAt: now,
			}).run();
		}

		db.insert(installedMods).values({
			id: nanoid(),
			serverId,
			projectId: `mrpack-${nanoid(4)}`,
			projectType: 'modpack',
			versionId: manifest.versionId,
			versionNumber: manifest.versionId,
			title: manifest.name,
			installedAt: now,
		}).run();

		return json({
			success: true,
			name: manifest.name,
			version: manifest.versionId,
			files: installed.length,
			message: `Imported modpack "${manifest.name}" with ${installed.length} mods`,
		});
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : 'Failed to import mrpack' }, { status: 500 });
	}
};

function findInZip(data: Uint8Array, fileName: string): Uint8Array | null {
	try {
		const text = new TextDecoder('utf-8', { fatal: false }).decode(data);
		const idx = text.indexOf(fileName);
		if (idx === -1) return null;

		const { inflateRawSync } = require('node:zlib') as typeof import('node:zlib');

		const headerStart = Math.max(0, idx - 30);
		const localHeader = data.slice(headerStart, headerStart + 30);
		if (localHeader[0] !== 0x50 || localHeader[1] !== 0x4b) return null;

		const compMethod = localHeader[8] | (localHeader[9] << 8);
		const compSize = (localHeader[18] | (localHeader[19] << 8) | (localHeader[20] << 16) | (localHeader[21] << 24)) >>> 0;
		const uncompSize = (localHeader[22] | (localHeader[23] << 8) | (localHeader[24] << 16) | (localHeader[25] << 24)) >>> 0;
		const nameLen = localHeader[26] | (localHeader[27] << 8);
		const extraLen = localHeader[28] | (localHeader[29] << 8);

		const dataStart = headerStart + 30 + nameLen + extraLen;
		const fileData = data.slice(dataStart, dataStart + compSize);

		if (compMethod === 0) {
			return fileData;
		} else if (compMethod === 8) {
			try {
				return inflateRawSync(fileData);
			} catch {
				return fileData;
			}
		}
		return fileData;
	} catch {
		return null;
	}
}
