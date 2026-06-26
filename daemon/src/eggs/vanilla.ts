import type { EggDefinition } from '../types';
import { getVersionsForPlatform } from '../version-manifest';

const MANIFEST_URL = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json';

export const vanillaEgg: EggDefinition = {
	id: 'vanilla',
	name: 'Vanilla',
	game: 'minecraft',
	description: 'Official vanilla Minecraft server from Mojang',
	icon: 'package',
	loader: 'vanilla',
	platform: 'vanilla',
	dockerImage: 'eclipse-temurin:21-jre',
	startupCommand: 'java -Xmx${MEMORY}M -Xms${MEMORY}M -jar server.jar nogui',
	stopCommand: 'stop',
	defaultMemory: 1024,
	defaultDisk: 10240,
	defaultCpu: 100,
	defaultPort: 25565,
	supportsMods: false,
	supportsPlugins: false,
	supportsDatapacks: true,
	versionApi: 'mojang',

	async versionList() {
		return getVersionsForPlatform('vanilla');
	},

	async download(version, serverDir) {
		try {
			const res = await fetch(MANIFEST_URL);
			if (!res.ok) return false;
			const data = (await res.json()) as { versions: { id: string; url: string }[] };
			const versionEntry = data.versions.find(v => v.id === version);
			if (!versionEntry) return false;

			const versionRes = await fetch(versionEntry.url);
			if (!versionRes.ok) return false;
			const versionData = (await versionRes.json()) as { downloads?: { server?: { url: string } } };
			const serverUrl = versionData.downloads?.server?.url;
			if (!serverUrl) return false;

			const jarRes = await fetch(serverUrl);
			if (!jarRes.ok) return false;

			const buffer = Buffer.from(await jarRes.arrayBuffer());
			const { writeFileSync } = await import('node:fs');
			const { join } = await import('node:path');
			writeFileSync(join(serverDir, 'server.jar'), buffer);
			return true;
		} catch (e) {
			console.error('[Vanilla] Download failed:', e);
			return false;
		}
	},
};
