import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db';
import { servers, installedMods } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { getDaemon, daemonFetch } from '$lib/server/daemon-client';

export const GET: RequestHandler = async ({ params }: { params: Record<string, string> }) => {
	const serverId = params.id;

	const row = db.select().from(servers).where(eq(servers.id, serverId)).get();
	if (!row) return json({ error: 'Server not found' }, { status: 404 });

	const installed = db.select().from(installedMods)
		.where(eq(installedMods.serverId, serverId))
		.all();

	const manifest = {
		formatVersion: 1,
		game: 'minecraft',
		versionId: `${row.slug}-${Date.now()}`,
		name: row.name,
		summary: `Exported from Aurora Panel - ${row.name}`,
		files: [] as { path: string; downloads: string[]; fileSize: number; hashes: Record<string, string> }[],
		dependencies: {} as Record<string, string>,
	};

	if (row.gameVersion) {
		manifest.dependencies['minecraft'] = row.gameVersion;
	}

	for (const mod of installed) {
		const folder = mod.projectType === 'mod' ? 'mods' : mod.projectType === 'plugin' ? 'plugins' : 'world/datapacks';
		const path = `${folder}/${mod.slug || mod.projectId}-${mod.versionNumber}.jar`;
		manifest.files.push({
			path,
			downloads: [],
			fileSize: 0,
			hashes: {},
		});
	}

	const jsonStr = JSON.stringify(manifest, null, 2);
	const encoder = new TextEncoder();
	const manifestBytes = encoder.encode(jsonStr);

	const { deflateRawSync } = await import('node:zlib');
	const compressed = deflateRawSync(manifestBytes);

	const localFileHeader = new Uint8Array(30);
	localFileHeader[0] = 0x50; localFileHeader[1] = 0x4b; localFileHeader[2] = 0x03; localFileHeader[3] = 0x04;
	localFileHeader[4] = 0x0a; localFileHeader[5] = 0x00;
	localFileHeader[8] = 0x08;
	localFileHeader[10] = 0x00; localFileHeader[11] = 0x00; localFileHeader[12] = 0x00; localFileHeader[13] = 0x00;
	const compSize = compressed.length;
	const uncompSize = manifestBytes.length;
	localFileHeader[18] = compSize & 0xff; localFileHeader[19] = (compSize >> 8) & 0xff;
	localFileHeader[20] = (compSize >> 16) & 0xff; localFileHeader[21] = (compSize >> 24) & 0xff;
	localFileHeader[22] = uncompSize & 0xff; localFileHeader[23] = (uncompSize >> 8) & 0xff;
	localFileHeader[24] = (uncompSize >> 16) & 0xff; localFileHeader[25] = (uncompSize >> 24) & 0xff;
	const nameBytes = encoder.encode('modrinth.index.json');
	localFileHeader[26] = nameBytes.length & 0xff; localFileHeader[27] = (nameBytes.length >> 8) & 0xff;

	const centralDirEntry = new Uint8Array(46);
	centralDirEntry[0] = 0x50; centralDirEntry[1] = 0x4b; centralDirEntry[2] = 0x01; centralDirEntry[3] = 0x02;
	centralDirEntry[10] = 0x0a; centralDirEntry[11] = 0x00;
	centralDirEntry[12] = 0x08; centralDirEntry[13] = 0x00;
	centralDirEntry[18] = compSize & 0xff; centralDirEntry[19] = (compSize >> 8) & 0xff;
	centralDirEntry[20] = (compSize >> 16) & 0xff; centralDirEntry[21] = (compSize >> 24) & 0xff;
	centralDirEntry[22] = uncompSize & 0xff; centralDirEntry[23] = (uncompSize >> 8) & 0xff;
	centralDirEntry[24] = (uncompSize >> 16) & 0xff; centralDirEntry[25] = (uncompSize >> 24) & 0xff;
	centralDirEntry[28] = nameBytes.length & 0xff; centralDirEntry[29] = (nameBytes.length >> 8) & 0xff;
	const localHeaderOffset = 0;
	centralDirEntry[42] = localHeaderOffset & 0xff; centralDirEntry[43] = (localHeaderOffset >> 8) & 0xff;
	centralDirEntry[44] = (localHeaderOffset >> 16) & 0xff; centralDirEntry[45] = (localHeaderOffset >> 24) & 0xff;

	const eocd = new Uint8Array(22);
	eocd[0] = 0x50; eocd[1] = 0x4b; eocd[2] = 0x05; eocd[3] = 0x06;
	eocd[8] = 0x00; eocd[9] = 0x00;
	eocd[10] = 0x01; eocd[11] = 0x00;
	eocd[12] = 0x01; eocd[13] = 0x00;
	const centralSize = centralDirEntry.length;
	const centralOffset = localFileHeader.length + nameBytes.length + compressed.length;
	eocd[16] = centralSize & 0xff; eocd[17] = (centralSize >> 8) & 0xff;
	eocd[18] = centralOffset & 0xff; eocd[19] = (centralOffset >> 8) & 0xff;
	eocd[20] = (centralOffset >> 16) & 0xff; eocd[21] = (centralOffset >> 24) & 0xff;

	const zipBytes = new Uint8Array(localFileHeader.length + nameBytes.length + compressed.length + centralDirEntry.length + eocd.length);
	let offset = 0;
	zipBytes.set(localFileHeader, offset); offset += localFileHeader.length;
	zipBytes.set(nameBytes, offset); offset += nameBytes.length;
	zipBytes.set(compressed, offset); offset += compressed.length;
	zipBytes.set(centralDirEntry, offset); offset += centralDirEntry.length;
	zipBytes.set(eocd, offset);

	const blob = new Blob([zipBytes], { type: 'application/zip' });
	const arrayBuffer = await blob.arrayBuffer();
	const uint8Array = new Uint8Array(arrayBuffer);

	return new Response(uint8Array, {
		headers: {
			'Content-Type': 'application/zip',
			'Content-Disposition': `attachment; filename="${row.slug}.mrpack"`,
		},
	});
};
