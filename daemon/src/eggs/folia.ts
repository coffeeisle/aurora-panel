import type { EggDefinition } from '../types';
import { getVersionsForPlatform } from '../version-manifest';

const API_BASE = 'https://api.papermc.io/v2/projects/folia';

export const foliaEgg: EggDefinition = {
	id: 'folia',
	name: 'Folia',
	game: 'minecraft',
	description: 'Paper fork with regionized multithreading',
	icon: 'package',
	loader: 'folia',
	platform: 'folia',
	dockerImage: 'eclipse-temurin:21-jre',
	startupCommand: 'java -Xmx${MEMORY}M -Xms${MEMORY}M -jar server.jar nogui',
	stopCommand: 'stop',
	defaultMemory: 2048,
	defaultDisk: 20480,
	defaultCpu: 200,
	defaultPort: 25565,
	supportsMods: false,
	supportsPlugins: true,
	supportsDatapacks: true,
	versionApi: 'folia',

	async versionList() {
		return getVersionsForPlatform('folia');
	},

	async download(version, serverDir) {
		try {
			let mcVersion = version;
			let buildNum: number | null = null;

			const buildMatch = version.match(/^(.+)-build-(\d+)$/);
			if (buildMatch) {
				mcVersion = buildMatch[1]!;
				buildNum = parseInt(buildMatch[2]!);
			}

			if (!buildNum) {
				const buildRes = await fetch(`${API_BASE}/versions/${mcVersion}/builds`);
				if (!buildRes.ok) return false;
				const buildData = (await buildRes.json()) as { builds: { build: number; channel: string }[] };
				const latestBuild = buildData.builds[buildData.builds.length - 1];
				if (!latestBuild) return false;
				buildNum = latestBuild.build;
			}

			const downloadUrl = `${API_BASE}/versions/${mcVersion}/builds/${buildNum}/downloads/folia-${mcVersion}-${buildNum}.jar`;
			const jarRes = await fetch(downloadUrl);
			if (!jarRes.ok) return false;

			const buffer = Buffer.from(await jarRes.arrayBuffer());
			const { writeFileSync } = await import('node:fs');
			const { join } = await import('node:path');
			writeFileSync(join(serverDir, 'server.jar'), buffer);
			return true;
		} catch (e) {
			console.error('[Folia] Download failed:', e);
			return false;
		}
	},
};
