export interface FileEntry {
	name: string;
	path: string;
	type: 'file' | 'directory';
	size: number;
	modifiedAt: string;
	mime?: string;
}

const mockFiles: Record<string, FileEntry[]> = {
	'/': [
		{ name: 'server.properties', path: '/server.properties', type: 'file', size: 2840, modifiedAt: '2026-06-20T14:30:00Z', mime: 'text/plain' },
		{ name: 'ops.json', path: '/ops.json', type: 'file', size: 128, modifiedAt: '2026-06-19T10:15:00Z', mime: 'application/json' },
		{ name: 'whitelist.json', path: '/whitelist.json', type: 'file', size: 64, modifiedAt: '2026-06-18T08:00:00Z', mime: 'application/json' },
		{ name: 'banned-players.json', path: '/banned-players.json', type: 'file', size: 32, modifiedAt: '2026-06-17T12:00:00Z', mime: 'application/json' },
		{ name: 'eula.txt', path: '/eula.txt', type: 'file', size: 168, modifiedAt: '2026-06-15T09:00:00Z', mime: 'text/plain' },
		{ name: 'logs', path: '/logs', type: 'directory', size: 0, modifiedAt: '2026-06-24T12:00:00Z' },
		{ name: 'world', path: '/world', type: 'directory', size: 0, modifiedAt: '2026-06-24T12:00:00Z' },
		{ name: 'plugins', path: '/plugins', type: 'directory', size: 0, modifiedAt: '2026-06-22T16:00:00Z' },
		{ name: 'mods', path: '/mods', type: 'directory', size: 0, modifiedAt: '2026-06-22T16:00:00Z' },
	],
	'/logs': [
		{ name: 'latest.log', path: '/logs/latest.log', type: 'file', size: 45280, modifiedAt: '2026-06-24T12:30:00Z', mime: 'text/plain' },
		{ name: 'blab-1.log', path: '/logs/blab-1.log', type: 'file', size: 128000, modifiedAt: '2026-06-23T12:00:00Z', mime: 'text/plain' },
	],
	'/world': [
		{ name: 'level.dat', path: '/world/level.dat', type: 'file', size: 2048000, modifiedAt: '2026-06-24T12:29:00Z', mime: 'application/octet-stream' },
		{ name: 'region', path: '/world/region', type: 'directory', size: 0, modifiedAt: '2026-06-24T12:00:00Z' },
		{ name: 'data', path: '/world/data', type: 'directory', size: 0, modifiedAt: '2026-06-24T12:00:00Z' },
	],
	'/plugins': [
		{ name: 'EssentialsX-2.20.1.jar', path: '/plugins/EssentialsX-2.20.1.jar', type: 'file', size: 980000, modifiedAt: '2026-06-20T14:00:00Z', mime: 'application/java-archive' },
		{ name: 'LuckPerms-Bukkit-5.4.130.jar', path: '/plugins/LuckPerms-Bukkit-5.4.130.jar', type: 'file', size: 520000, modifiedAt: '2026-06-20T14:00:00Z', mime: 'application/java-archive' },
	],
	'/mods': [
		{ name: 'sodium-fabric-0.6.5.jar', path: '/mods/sodium-fabric-0.6.5.jar', type: 'file', size: 650000, modifiedAt: '2026-06-21T10:00:00Z', mime: 'application/java-archive' },
		{ name: 'lithium-fabric-0.12.1.jar', path: '/mods/lithium-fabric-0.12.1.jar', type: 'file', size: 380000, modifiedAt: '2026-06-21T10:00:00Z', mime: 'application/java-archive' },
	],
};

const fileContents = new Map<string, string>([
	['/server.properties', 'motd=Aurora Panel Server\ngamemode=survival\ndifficulty=normal\npvp=true\nmax-players=20\nview-distance=10\nserver-port=25565\nenable-command-block=false\nspawn-animals=true\nspawn-monsters=true\ngenerate-structures=true\nallow-flight=false\nenforce-whitelist=false\nonline-mode=true\n'],
	['/eula.txt', '#By changing the setting below to TRUE you are indicating your agreement to our EULA (https://account.mojang.com/documents/minecraft_eula).\n#Tue Jun 15 09:00:00 UTC 2026\neula=true\n'],
	['/ops.json', '[]'],
	['/whitelist.json', '[]'],
	['/banned-players.json', '[]'],
]);

export function listFiles(serverId: string, dirPath: string): FileEntry[] {
	const normalized = dirPath.endsWith('/') ? dirPath.slice(0, -1) : dirPath;
	const entries = mockFiles[normalized] || mockFiles[normalized + '/'];
	if (entries) return entries;
	if (normalized === '') return mockFiles['/'];
	return [];
}

export function getFileContent(serverId: string, filePath: string): string | null {
	return fileContents.get(filePath) ?? null;
}

export function saveFileContent(serverId: string, filePath: string, content: string): void {
	fileContents.set(filePath, content);
}

export function deleteEntry(serverId: string, filePath: string): boolean {
	for (const [dir, entries] of Object.entries(mockFiles)) {
		const idx = entries.findIndex((e) => e.path === filePath);
		if (idx !== -1) {
			entries.splice(idx, 1);
			fileContents.delete(filePath);
			return true;
		}
	}
	return false;
}

export function renameEntry(serverId: string, oldPath: string, newName: string): boolean {
	for (const entries of Object.values(mockFiles)) {
		const entry = entries.find((e) => e.path === oldPath);
		if (entry) {
			const parts = entry.path.split('/');
			parts[parts.length - 1] = newName;
			entry.name = newName;
			entry.path = parts.join('/');
			return true;
		}
	}
	return false;
}

export function createEntry(serverId: string, parentDir: string, name: string, type: 'file' | 'directory'): boolean {
	const dir = parentDir.endsWith('/') ? parentDir.slice(0, -1) : parentDir;
	if (!mockFiles[dir] && dir !== '/') return false;

	const path = `${dir === '/' ? '' : dir}/${name}`;
	const target = dir === '/' ? '/' : dir;

	if (!mockFiles[target]) return false;
	if (mockFiles[target].some((e) => e.name === name)) return false;

	mockFiles[target].push({
		name,
		path,
		type,
		size: 0,
		modifiedAt: new Date().toISOString(),
		mime: type === 'file' ? 'text/plain' : undefined
	});

	if (type === 'directory') {
		mockFiles[path] = [];
	}

	return true;
}

export function formatFileSize(bytes: number): string {
	if (bytes === 0) return '0 B';
	const k = 1024;
	const sizes = ['B', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
