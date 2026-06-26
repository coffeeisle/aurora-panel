import type { EggDefinition } from '../types';
import { getVersionsForPlatform } from '../version-manifest';

const BUILD_TOOLS_URL = 'https://hub.spigotmc.org/jenkins/job/BuildTools/lastSuccessfulBuild/artifact/target/BuildTools.jar';

export const bukkitEgg: EggDefinition = {
	id: 'bukkit',
	name: 'Bukkit',
	game: 'minecraft',
	description: 'Original Bukkit server software',
	icon: 'package',
	loader: 'bukkit',
	platform: 'bukkit',
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
	versionApi: 'bukkit',

	async versionList() {
		return getVersionsForPlatform('bukkit');
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
			if (existsSync(join(serverDir, `craftbukkit-${version}.jar`))) {
				if (existsSync(join(serverDir, 'server.jar'))) {
					unlinkSync(join(serverDir, 'server.jar'));
				}
				renameSync(join(serverDir, `craftbukkit-${version}.jar`), join(serverDir, 'server.jar'));
			} else if (existsSync(join(serverDir, 'craftbukkit.jar'))) {
				if (existsSync(join(serverDir, 'server.jar'))) {
					unlinkSync(join(serverDir, 'server.jar'));
				}
				renameSync(join(serverDir, 'craftbukkit.jar'), join(serverDir, 'server.jar'));
			}
			if (existsSync(btPath)) unlinkSync(btPath);

			return true;
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			if (msg.includes('timeout')) {
				console.error('[Bukkit] BuildTools timed out (5 min limit). Java may need more memory or the server is slow.');
			} else if (msg.includes('java: not found') || msg.includes('ENOENT')) {
				console.error('[Bukkit] Java is required to run BuildTools. Install a JDK (temurin-21 recommended).');
			} else if (msg.includes('exit code')) {
				console.error(`[Bukkit] BuildTools failed for MC ${version}. This version may not be supported by BuildTools.`);
			} else {
				console.error(`[Bukkit] Download failed for ${version}:`, e);
			}
			return false;
		}
	},
};
