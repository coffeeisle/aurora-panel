import type { EggDefinition } from '../types';
import { getVersionsForPlatform } from '../version-manifest';

const BUILD_TOOLS_URL = 'https://hub.spigotmc.org/jenkins/job/BuildTools/lastSuccessfulBuild/artifact/target/BuildTools.jar';

export const spigotEgg: EggDefinition = {
	id: 'spigot',
	name: 'Spigot',
	game: 'minecraft',
	description: 'Most widely-used Minecraft server software',
	icon: 'package',
	loader: 'spigot',
	platform: 'spigot',
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
	versionApi: 'spigot',

	async versionList() {
		return getVersionsForPlatform('spigot');
	},

	async download(version, serverDir) {
		try {
			const buildToolsRes = await fetch(BUILD_TOOLS_URL);
			if (!buildToolsRes.ok) return false;

			const buildToolsBuffer = Buffer.from(await buildToolsRes.arrayBuffer());
			const { writeFileSync, existsSync } = await import('node:fs');
			const { join } = await import('node:path');
			const btPath = join(serverDir, 'BuildTools.jar');
			writeFileSync(btPath, buildToolsBuffer);

			const { execSync } = await import('node:child_process');
			execSync(
				`java -jar BuildTools.jar --rev ${version}`,
				{ cwd: serverDir, stdio: 'pipe', timeout: 300000 }
			);

			const { unlinkSync, renameSync } = await import('node:fs');
			if (existsSync(join(serverDir, `spigot-${version}.jar`))) {
				if (existsSync(join(serverDir, 'server.jar'))) {
					unlinkSync(join(serverDir, 'server.jar'));
				}
				renameSync(join(serverDir, `spigot-${version}.jar`), join(serverDir, 'server.jar'));
			} else if (existsSync(join(serverDir, 'spigot.jar'))) {
				if (existsSync(join(serverDir, 'server.jar'))) {
					unlinkSync(join(serverDir, 'server.jar'));
				}
				renameSync(join(serverDir, 'spigot.jar'), join(serverDir, 'server.jar'));
			}
			if (existsSync(btPath)) unlinkSync(btPath);

			return true;
		} catch (e) {
			console.error('[Spigot] Download failed:', e);
			return false;
		}
	},
};
