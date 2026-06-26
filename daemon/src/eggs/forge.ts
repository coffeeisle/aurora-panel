import type { EggDefinition } from '../types';
import { getVersionsForPlatform } from '../version-manifest';

const FORGE_MAVEN = 'https://maven.minecraftforge.net/net/minecraftforge/forge';

export const forgeEgg: EggDefinition = {
	id: 'forge',
	name: 'Forge',
	game: 'minecraft',
	description: 'The original Minecraft mod loader',
	icon: 'package',
	loader: 'forge',
	platform: 'forge',
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
	versionApi: 'forge',

	async versionList() {
		return getVersionsForPlatform('forge');
	},

	async download(version, serverDir) {
		try {
			const parts = version.split('-');
			const mcVersion = parts[0];
			const forgeVersion = parts.slice(1).join('-');

			const installerUrl = `${FORGE_MAVEN}/${version}/forge-${version}-installer.jar`;
			const res = await fetch(installerUrl);
			if (!res.ok) return false;

			const buffer = Buffer.from(await res.arrayBuffer());
			const { writeFileSync, existsSync } = await import('node:fs');
			const { join } = await import('node:path');
			const installerPath = join(serverDir, 'forge-installer.jar');
			writeFileSync(installerPath, buffer);

			const { execSync } = await import('node:child_process');
			execSync(
				`java -jar forge-installer.jar --installServer`,
				{ cwd: serverDir, stdio: 'pipe', timeout: 120000 }
			);

			const { unlinkSync, readdirSync, renameSync } = await import('node:fs');
			const files = readdirSync(serverDir);
			const forgeJar = files.find(f => f.startsWith(`forge-${mcVersion}`) && f.endsWith('.jar') && !f.includes('installer'));
			if (forgeJar) {
				if (existsSync(join(serverDir, 'server.jar'))) {
					unlinkSync(join(serverDir, 'server.jar'));
				}
				renameSync(join(serverDir, forgeJar), join(serverDir, 'server.jar'));
			}
			if (existsSync(installerPath)) unlinkSync(installerPath);
			const unixArgs = files.find(f => f.endsWith('-universal.jar'));
			if (unixArgs && existsSync(join(serverDir, unixArgs))) {
				unlinkSync(join(serverDir, unixArgs));
			}

			return true;
		} catch (e) {
			console.error('[Forge] Download failed:', e);
			return false;
		}
	},
};
