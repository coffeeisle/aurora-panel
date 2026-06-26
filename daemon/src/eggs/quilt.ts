import type { EggDefinition } from '../types';
import { getVersionsForPlatform } from '../version-manifest';

const QUILT_META = 'https://meta.quiltmc.org/v3';

export const quiltEgg: EggDefinition = {
	id: 'quilt',
	name: 'Quilt',
	game: 'minecraft',
	description: 'Modern mod loader, fork of Fabric',
	icon: 'package',
	loader: 'quilt',
	platform: 'quilt',
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
	versionApi: 'quilt',

	async versionList() {
		return getVersionsForPlatform('quilt');
	},

	async download(version, serverDir) {
		try {
			let mcVersion = version;
			const match = version.match(/^quilt-(.+)-(.+)$/);
			if (match) {
				mcVersion = match[1]!;
			}

			const [gameRes, loaderRes, installerRes] = await Promise.all([
				fetch(`${QUILT_META}/versions/game`).then(r => r.json()).catch(() => []),
				fetch(`${QUILT_META}/versions/loader`).then(r => r.json()).catch(() => []),
				fetch(`${QUILT_META}/versions/installer`).then(r => r.json()).catch(() => []),
			]);

			const gameVersions = gameRes as { version: string }[];
			const loaders = loaderRes as { version: string }[];
			const installers = installerRes as { version: string }[];

			if (!gameVersions.find((g: { version: string }) => g.version === mcVersion)) return false;
			const loaderVersion = loaders[0]?.version;
			const installerVersion = installers[0]?.version;
			if (!loaderVersion || !installerVersion) return false;

			const installerUrl = `https://maven.quiltmc.org/repository/release/org/quiltmc/quilt-installer/${installerVersion}/quilt-installer-${installerVersion}.jar`;
			const installerRes2 = await fetch(installerUrl);
			if (!installerRes2.ok) return false;

			const installerBuffer = Buffer.from(await installerRes2.arrayBuffer());
			const { writeFileSync, existsSync } = await import('node:fs');
			const { join } = await import('node:path');
			const installerPath = join(serverDir, 'quilt-installer.jar');
			writeFileSync(installerPath, installerBuffer);

			const { execSync } = await import('node:child_process');
			execSync(
				`java -jar quilt-installer.jar install server ${mcVersion} --loader=${loaderVersion}`,
				{ cwd: serverDir, stdio: 'pipe', timeout: 120000 }
			);

			const { unlinkSync, renameSync } = await import('node:fs');
			const { readdirSync } = await import('node:fs');
			const files = readdirSync(serverDir);
			const quiltJar = files.find(f => f.startsWith('quilt-server-launch') && f.endsWith('.jar'));
			if (quiltJar) {
				if (existsSync(join(serverDir, 'server.jar'))) {
					unlinkSync(join(serverDir, 'server.jar'));
				}
				renameSync(join(serverDir, quiltJar), join(serverDir, 'server.jar'));
			}
			if (existsSync(installerPath)) unlinkSync(installerPath);

			return true;
		} catch (e) {
			console.error('[Quilt] Download failed:', e);
			return false;
		}
	},
};
