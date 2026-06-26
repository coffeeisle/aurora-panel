import type { EggDefinition } from '../types';
import { getVersionsForPlatform } from '../version-manifest';

const NEO_MAVEN = 'https://maven.neoforged.net/releases/net/neoforged/neoforge';

export const neoforgeEgg: EggDefinition = {
	id: 'neoforge',
	name: 'NeoForge',
	game: 'minecraft',
	description: 'Next-gen Minecraft mod loader, fork of Forge',
	icon: 'package',
	loader: 'neoforge',
	platform: 'neoforge',
	dockerImage: 'eclipse-temurin:21-jre',
	startupCommand: 'java -Xmx${MEMORY}M -Xms${MEMORY}M -jar server.jar nogui',
	stopCommand: 'stop',
	defaultMemory: 2048,
	defaultDisk: 20480,
	defaultCpu: 100,
	defaultPort: 25565,
	supportsMods: true,
	supportsPlugins: false,
	supportsDatapacks: true,
	versionApi: 'neoforge',

	async versionList() {
		return getVersionsForPlatform('neoforge');
	},

	async download(version, serverDir) {
		try {
			let mcVersion = version;
			let neoVersion: string | null = null;

			const match = version.match(/^neoforge-(\d+\.\d+)-(.+)$/);
			if (match) {
				mcVersion = match[1]!;
				neoVersion = match[2]!;
			}

			if (!neoVersion) {
				const res = await fetch('https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge');
				if (!res.ok) return false;
				const data = (await res.json()) as { versions: string[] };
				const matchingVersions = data.versions.filter(v => v.startsWith(mcVersion));
				neoVersion = matchingVersions[matchingVersions.length - 1];
				if (!neoVersion) return false;
			}

			const installerUrl = `${NEO_MAVEN}/${neoVersion}/neoforge-${neoVersion}-installer.jar`;
			const res = await fetch(installerUrl);
			if (!res.ok) return false;

			const buffer = Buffer.from(await res.arrayBuffer());
			const { writeFileSync, existsSync } = await import('node:fs');
			const { join } = await import('node:path');
			const installerPath = join(serverDir, 'neoforge-installer.jar');
			writeFileSync(installerPath, buffer);

			const { execSync } = await import('node:child_process');
			execSync(
				`java -jar neoforge-installer.jar --installServer`,
				{ cwd: serverDir, stdio: 'pipe', timeout: 120000 }
			);

			const { unlinkSync, readdirSync, renameSync } = await import('node:fs');
			const files = readdirSync(serverDir);
			const neoJar = files.find(f => f.startsWith('neoforge-') && f.endsWith('.jar') && !f.includes('installer'));
			if (neoJar) {
				if (existsSync(join(serverDir, 'server.jar'))) {
					unlinkSync(join(serverDir, 'server.jar'));
				}
				renameSync(join(serverDir, neoJar), join(serverDir, 'server.jar'));
			}
			if (existsSync(installerPath)) unlinkSync(installerPath);

			return true;
		} catch (e) {
			console.error('[NeoForge] Download failed:', e);
			return false;
		}
	},
};
