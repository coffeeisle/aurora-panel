import type { EggDefinition } from '../types';
import { getVersionsForPlatform } from '../version-manifest';

const API_BASE = 'https://api.purpurmc.org/v2/purpur';

export const purpurEgg: EggDefinition = {
	id: 'purpur',
	name: 'Purpur',
	game: 'minecraft',
	description: 'Fork of Paper with more configuration options',
	icon: 'package',
	loader: 'purpur',
	platform: 'purpur',
	dockerImage: 'eclipse-temurin:21-jre',
	startupCommand: 'java -Xmx${MEMORY}M -Xms${MEMORY}M -jar server.jar nogui',
	stopCommand: 'stop',
	defaultMemory: 1024,
	defaultDisk: 10240,
	defaultCpu: 100,
	defaultPort: 25565,
	supportsMods: false,
	supportsPlugins: true,
	supportsDatapacks: true,
	versionApi: 'purpur',

	async versionList() {
		return getVersionsForPlatform('purpur');
	},

	async download(version, serverDir) {
		try {
			let mcVersion = version;
			let buildNum: string | null = null;

			const buildMatch = version.match(/^(.+)-build-(\d+)$/);
			if (buildMatch) {
				mcVersion = buildMatch[1]!;
				buildNum = buildMatch[2]!;
			}

			if (!buildNum) {
				const infoRes = await fetch(`${API_BASE}/${mcVersion}`);
				if (!infoRes.ok) return false;
				const infoData = (await infoRes.json()) as { builds: { latest: string } };
				buildNum = infoData.builds.latest;
			}

			const downloadUrl = `${API_BASE}/${mcVersion}/${buildNum}/download`;
			const jarRes = await fetch(downloadUrl);
			if (!jarRes.ok) return false;

			const buffer = Buffer.from(await jarRes.arrayBuffer());
			const { writeFileSync } = await import('node:fs');
			const { join } = await import('node:path');
			writeFileSync(join(serverDir, 'server.jar'), buffer);
			return true;
		} catch (e) {
			console.error('[Purpur] Download failed:', e);
			return false;
		}
	},
};
