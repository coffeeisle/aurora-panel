import type { EggDefinition } from '../types';
import { getVersionsForPlatform } from '../version-manifest';

const API_BASE = 'https://api.papermc.io/v2/projects/paper';

export const paperEgg: EggDefinition = {
	id: 'paper',
	name: 'Paper',
	game: 'minecraft',
	description: 'High-performance Minecraft server software',
	icon: 'package',
	loader: 'paper',
	platform: 'paper',
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
	versionApi: 'papermc',

	async versionList() {
		return getVersionsForPlatform('paper');
	},

	async download(version, serverDir) {
		try {
			let buildNum: number | null = null;
			let mcVersion = version;

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

			const downloadUrl = `${API_BASE}/versions/${mcVersion}/builds/${buildNum}/downloads/paper-${mcVersion}-${buildNum}.jar`;
			const jarRes = await fetch(downloadUrl);
			if (!jarRes.ok) return false;

			const buffer = Buffer.from(await jarRes.arrayBuffer());
			const { writeFileSync } = await import('node:fs');
			const { join } = await import('node:path');
			writeFileSync(join(serverDir, 'server.jar'), buffer);
			return true;
		} catch (e) {
			console.error('[Paper] Download failed:', e);
			return false;
		}
	},
};
