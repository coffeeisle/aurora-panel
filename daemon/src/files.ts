import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, unlinkSync, renameSync, statSync, rmSync, copyFileSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import type { FileEntry } from './types';

const MIME_TYPES: Record<string, string> = {
	'.txt': 'text/plain',
	'.properties': 'text/plain',
	'.json': 'application/json',
	'.yml': 'text/yaml',
	'.yaml': 'text/yaml',
	'.xml': 'text/xml',
	'.log': 'text/plain',
	'.cfg': 'text/plain',
	'.conf': 'text/plain',
	'.toml': 'text/plain',
	'.md': 'text/markdown',
	'.js': 'text/javascript',
	'.ts': 'text/typescript',
	'.css': 'text/css',
	'.html': 'text/html',
	'.sh': 'text/x-shellscript',
	'.jar': 'application/java-archive',
	'.zip': 'application/zip',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.gif': 'image/gif',
	'.svg': 'image/svg+xml',
	'.dat': 'application/octet-stream',
	'.lock': 'application/octet-stream',
};

function getMimeType(fileName: string): string {
	const ext = '.' + fileName.split('.').pop()?.toLowerCase();
	return MIME_TYPES[ext] || 'application/octet-stream';
}

function ensureServerDir(serversDir: string, serverId: string): string {
	const dir = join(serversDir, serverId);
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}
	return dir;
}

export function listFiles(serversDir: string, serverId: string, dirPath: string): FileEntry[] {
	const baseDir = ensureServerDir(serversDir, serverId);
	const targetDir = join(baseDir, dirPath === '/' ? '' : dirPath);

	if (!existsSync(targetDir)) {
		return [];
	}

	try {
		const entries = readdirSync(targetDir, { withFileTypes: true });
		return entries.map(entry => {
			const fullPath = join(targetDir, entry.name);
			const stats = statSync(fullPath);
			const relativePath = dirPath === '/' ? `/${entry.name}` : `${dirPath}/${entry.name}`;
			return {
				name: entry.name,
				path: relativePath,
				type: entry.isDirectory() ? 'directory' : 'file',
				size: stats.size,
				modifiedAt: stats.mtime.toISOString(),
				mime: entry.isFile() ? getMimeType(entry.name) : undefined,
			};
		});
	} catch {
		return [];
	}
}

export function readFile(serversDir: string, serverId: string, filePath: string): string | null {
	const baseDir = ensureServerDir(serversDir, serverId);
	const fullPath = join(baseDir, filePath);

	if (!existsSync(fullPath)) return null;
	try {
		return readFileSync(fullPath, 'utf-8');
	} catch {
		return null;
	}
}

export function writeFile_(serversDir: string, serverId: string, filePath: string, content: string): boolean {
	const baseDir = ensureServerDir(serversDir, serverId);
	const fullPath = join(baseDir, filePath);

	try {
		const parentDir = dirname(fullPath);
		if (!existsSync(parentDir)) {
			mkdirSync(parentDir, { recursive: true });
		}
		writeFileSync(fullPath, content, 'utf-8');
		return true;
	} catch {
		return false;
	}
}

export function deleteEntry(serversDir: string, serverId: string, filePath: string): boolean {
	const baseDir = ensureServerDir(serversDir, serverId);
	const fullPath = join(baseDir, filePath);

	if (!existsSync(fullPath)) return false;
	try {
		const stats = statSync(fullPath);
		if (stats.isDirectory()) {
			rmSync(fullPath, { recursive: true, force: true });
		} else {
			unlinkSync(fullPath);
		}
		return true;
	} catch {
		return false;
	}
}

export function renameEntry(serversDir: string, serverId: string, oldPath: string, newName: string): boolean {
	const baseDir = ensureServerDir(serversDir, serverId);
	const fullOldPath = join(baseDir, oldPath);

	if (!existsSync(fullOldPath)) return false;
	try {
		const parentDir = dirname(fullOldPath);
		const fullNewPath = join(parentDir, newName);
		renameSync(fullOldPath, fullNewPath);
		return true;
	} catch {
		return false;
	}
}

export function createEntry(serversDir: string, serverId: string, parentDir: string, name: string, type: 'file' | 'directory'): boolean {
	const baseDir = ensureServerDir(serversDir, serverId);
	const fullParentDir = join(baseDir, parentDir === '/' ? '' : parentDir);

	if (!existsSync(fullParentDir)) return false;
	try {
		const fullPath = join(fullParentDir, name);
		if (existsSync(fullPath)) return false;
		if (type === 'directory') {
			mkdirSync(fullPath, { recursive: true });
		} else {
			writeFileSync(fullPath, '', 'utf-8');
		}
		return true;
	} catch {
		return false;
	}
}

export function createServerDirectory(serversDir: string, serverId: string): void {
	const dir = join(serversDir, serverId);
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
		mkdirSync(join(dir, 'mods'), { recursive: true });
		mkdirSync(join(dir, 'plugins'), { recursive: true });
		mkdirSync(join(dir, 'world'), { recursive: true });
		mkdirSync(join(dir, 'world/datapacks'), { recursive: true });
		mkdirSync(join(dir, 'logs'), { recursive: true });
		mkdirSync(join(dir, 'backups'), { recursive: true });
	}
}

export function ensureEula(serversDir: string, serverId: string): void {
	const baseDir = ensureServerDir(serversDir, serverId);
	const eulaPath = join(baseDir, 'eula.txt');
	if (!existsSync(eulaPath)) {
		writeFileSync(eulaPath, 'eula=false\n', 'utf-8');
	}
}

export function readEula(serversDir: string, serverId: string): boolean {
	const eulaPath = join(ensureServerDir(serversDir, serverId), 'eula.txt');
	try {
		return existsSync(eulaPath) && readFileSync(eulaPath, 'utf-8').trim().endsWith('eula=true');
	} catch {
		return false;
	}
}

export function acceptEula(serversDir: string, serverId: string): void {
	const eulaPath = join(ensureServerDir(serversDir, serverId), 'eula.txt');
	writeFileSync(eulaPath, 'eula=true\n', 'utf-8');
}

export function getServerDirectorySize(serversDir: string, serverId: string): number {
	const baseDir = join(serversDir, serverId);
	if (!existsSync(baseDir)) return 0;
	try {
		let totalSize = 0;
		function walk(dir: string) {
			const entries = readdirSync(dir, { withFileTypes: true });
			for (const entry of entries) {
				const fullPath = join(dir, entry.name);
				if (entry.isDirectory()) {
					walk(fullPath);
				} else if (entry.isFile()) {
					totalSize += statSync(fullPath).size;
				}
			}
		}
		walk(baseDir);
		return totalSize;
	} catch {
		return 0;
	}
}

export function readBinaryFile(serversDir: string, serverId: string, filePath: string): Buffer | null {
	const baseDir = ensureServerDir(serversDir, serverId);
	const fullPath = join(baseDir, filePath);
	if (!existsSync(fullPath)) return null;
	try {
		return readFileSync(fullPath);
	} catch {
		return null;
	}
}

export function writeBinaryFile(serversDir: string, serverId: string, filePath: string, data: Buffer): boolean {
	const baseDir = ensureServerDir(serversDir, serverId);
	const fullPath = join(baseDir, filePath);
	try {
		const parentDir = dirname(fullPath);
		if (!existsSync(parentDir)) mkdirSync(parentDir, { recursive: true });
		writeFileSync(fullPath, data);
		return true;
	} catch {
		return false;
	}
}

export function copyFile(serversDir: string, serverId: string, srcPath: string, destPath: string): boolean {
	const baseDir = ensureServerDir(serversDir, serverId);
	const srcFull = join(baseDir, srcPath);
	const destFull = join(baseDir, destPath);
	if (!existsSync(srcFull)) return false;
	try {
		const parentDir = dirname(destFull);
		if (!existsSync(parentDir)) mkdirSync(parentDir, { recursive: true });
		copyFileSync(srcFull, destFull);
		return true;
	} catch {
		return false;
	}
}
