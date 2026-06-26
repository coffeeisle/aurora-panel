import type { EggDefinition } from '../types';
import { getVersionsForPlatform } from '../version-manifest';

const FABRIC_META = 'https://meta.fabricmc.net/v2';
const FABRIC_MAVEN = 'https://maven.fabricmc.net';

export const fabricEgg: EggDefinition = {
	id: 'fabric',
	name: 'Fabric',
	game: 'minecraft',
	description: 'Lightweight mod loader for Minecraft',
	icon: 'package',
	loader: 'fabric',
	platform: 'fabric',
	dockerImage: 'eclipse-temurin:21-jre',
	startupCommand: 'java -Xmx${MEMORY}M -Xms${MEMORY}M -jar server.jar nogui',
	stopCommand: 'stop',
	defaultMemory: 1024,
	defaultDisk: 10240,
	defaultCpu: 100,
	defaultPort: 25565,
	supportsMods: true,
	supportsPlugins: false,
	supportsDatapacks: true,
	versionApi: 'fabric',

	async versionList() {
		return getVersionsForPlatform('fabric');
	},

	async download(version, serverDir) {
		try {
			let mcVersion = version;
			const versionMatch = version.match(/^fabric-(.+)-(.+)$/);
			if (versionMatch) {
				mcVersion = versionMatch[1]!;
			}

			const [loaderRes, installerRes] = await Promise.all([
				fetch(`${FABRIC_META}/versions/loader`).then(r => r.json()).catch(() => []),
				fetch(`${FABRIC_META}/versions/installer`).then(r => r.json()).catch(() => []),
			]);

			const loaders = loaderRes as { version: string; stable: boolean }[];
			const installerVersion = (installerRes as { version: string }[])[0]?.version || '1.0.0';
			const loaderVersion = loaders.find(l => l.stable)?.version || loaders[0]?.version;

			if (!loaderVersion) return false;

			const installerUrl = `${FABRIC_MAVEN}/net/fabricmc/fabric-installer/${installerVersion}/fabric-installer-${installerVersion}.jar`;
			const installerRes2 = await fetch(installerUrl);
			if (!installerRes2.ok) return false;

			const installerBuffer = Buffer.from(await installerRes2.arrayBuffer());
			const { writeFileSync } = await import('node:fs');
			const { join } = await import('node:path');
			const installerPath = join(serverDir, 'fabric-installer.jar');
			writeFileSync(installerPath, installerBuffer);

			const { execSync } = await import('node:child_process');
			execSync(
				`java -jar fabric-installer.jar server -mcversion ${mcVersion} -loader ${loaderVersion} -downloadMinecraft`,
				{ cwd: serverDir, stdio: 'pipe', timeout: 120000 }
			);

			const { unlinkSync, existsSync } = await import('node:fs');
			if (existsSync(join(serverDir, 'fabric-server-launch.jar'))) {
				if (existsSync(join(serverDir, 'server.jar'))) {
					unlinkSync(join(serverDir, 'server.jar'));
				}
				const { renameSync } = await import('node:fs');
				renameSync(join(serverDir, 'fabric-server-launch.jar'), join(serverDir, 'server.jar'));
			}
			if (existsSync(installerPath)) unlinkSync(installerPath);

			return true;
		} catch (e) {
			console.error('[Fabric] Download failed:', e);
			return false;
		}
	},
};
