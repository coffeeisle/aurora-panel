import { generateDaemonToken } from '$lib/server/daemon-auth';

export interface DaemonInfo {
	id: string;
	name: string;
	url: string;
	host: string;
	port: number;
	connected: boolean;
	lastSeen: number;
	health?: {
		cpu: { load: number; cores: number };
		memory: { total: number; used: number };
		disk: { total: number; used: number };
		uptime: number;
		version: string;
	} | null;
}

const knownDaemons = new Map<string, DaemonInfo>([
	['node-01', { id: 'node-01', name: 'node-01', url: process.env['DAEMON_01_URL'] ?? 'http://localhost:8443', host: 'localhost', port: 8443, connected: false, lastSeen: 0 }],
]);

let panelToken = generateDaemonToken('panel');
let lastTokenGen = Date.now();

function getOrRefreshToken(): string {
	if (Date.now() - lastTokenGen > 3600000) {
		panelToken = generateDaemonToken('panel');
		lastTokenGen = Date.now();
	}
	return panelToken;
}

export function registerDaemon(id: string, host: string, port: number) {
	const url = `http://${host}:${port}`;
	knownDaemons.set(id, { id, name: id, url, host, port, connected: true, lastSeen: Date.now() });
}

export function getDaemonUrl(daemonId: string): string | null {
	return knownDaemons.get(daemonId)?.url ?? null;
}

export function getDaemonToken(): string {
	return getOrRefreshToken();
}

export async function daemonFetch(
	daemonId: string,
	path: string,
	options?: RequestInit
): Promise<Response> {
	const info = knownDaemons.get(daemonId);
	if (!info) throw new Error(`Unknown daemon: ${daemonId}`);

	const token = getOrRefreshToken();
	const res = await fetch(`${info.url}${path}`, {
		...options,
		headers: {
			'Authorization': `Bearer ${token}`,
			'Content-Type': 'application/json',
			...(options?.headers || {})
		}
	});

	info.connected = res.ok;
	info.lastSeen = Date.now();
	return res;
}

export async function fetchDaemonHealth(daemonId: string) {
	try {
		const res = await daemonFetch(daemonId, '/health');
		if (!res.ok) {
			setConnected(daemonId, false);
			return null;
		}
		const data = await res.json();
		const info = knownDaemons.get(daemonId);
		if (info) {
			info.connected = true;
			info.health = {
				cpu: data.cpu ?? { load: 0, cores: 0 },
				memory: data.memory ?? { total: 0, used: 0 },
				disk: data.disk ?? { total: 0, used: 0 },
				uptime: data.uptime ?? 0,
				version: data.version ?? '0.0.1'
			};
		}
		return data;
	} catch {
		setConnected(daemonId, false);
		return null;
	}
}

export async function listServersFromDaemon(daemonId: string) {
	const res = await daemonFetch(daemonId, '/servers');
	if (!res.ok) throw new Error(`Failed to list servers from ${daemonId}: ${res.status}`);
	return res.json();
}

function setConnected(daemonId: string, connected: boolean) {
	const info = knownDaemons.get(daemonId);
	if (info) {
		info.connected = connected;
		info.lastSeen = Date.now();
	}
}

export function isDaemonConnected(daemonId: string): boolean {
	return knownDaemons.get(daemonId)?.connected ?? false;
}

export function getConnectedDaemons(): DaemonInfo[] {
	return Array.from(knownDaemons.values()).filter(d => d.connected);
}

export function getAllDaemons(): DaemonInfo[] {
	return Array.from(knownDaemons.values());
}

export function getDaemon(id: string): DaemonInfo | undefined {
	return knownDaemons.get(id);
}

export function removeDaemon(id: string) {
	knownDaemons.delete(id);
}

// ── File Operations ──

export async function daemonListFiles(daemonId: string, serverId: string, dir: string) {
	return daemonFetch(daemonId, `/files?server=${encodeURIComponent(serverId)}&dir=${encodeURIComponent(dir)}`);
}

export async function daemonReadFile(daemonId: string, serverId: string, filePath: string): Promise<{ content: string } | null> {
	try {
		const res = await daemonFetch(daemonId, `/files?server=${encodeURIComponent(serverId)}&path=${encodeURIComponent(filePath)}`);
		if (!res.ok) return null;
		return res.json();
	} catch { return null; }
}

export async function daemonWriteFile(daemonId: string, serverId: string, filePath: string, content: string): Promise<boolean> {
	try {
		const res = await daemonFetch(daemonId, `/files?server=${encodeURIComponent(serverId)}&path=${encodeURIComponent(filePath)}`, {
			method: 'PUT',
			body: JSON.stringify({ content })
		});
		return res.ok;
	} catch { return false; }
}

export async function daemonDeleteEntry(daemonId: string, serverId: string, filePath: string): Promise<boolean> {
	try {
		const res = await daemonFetch(daemonId, `/files?server=${encodeURIComponent(serverId)}&path=${encodeURIComponent(filePath)}`, {
			method: 'DELETE'
		});
		return res.ok;
	} catch { return false; }
}

export async function daemonRenameEntry(daemonId: string, serverId: string, oldPath: string, newName: string): Promise<boolean> {
	try {
		const res = await daemonFetch(daemonId, `/files?server=${encodeURIComponent(serverId)}&path=${encodeURIComponent(oldPath)}&action=rename`, {
			method: 'PATCH',
			body: JSON.stringify({ name: newName })
		});
		return res.ok;
	} catch { return false; }
}

export async function daemonCreateEntry(daemonId: string, serverId: string, parentDir: string, name: string, type: 'file' | 'directory'): Promise<boolean> {
	try {
		const action = type === 'directory' ? 'mkdir' : 'touch';
		const res = await daemonFetch(daemonId, `/files?server=${encodeURIComponent(serverId)}&dir=${encodeURIComponent(parentDir)}&action=${action}`, {
			method: 'PATCH',
			body: JSON.stringify({ name })
		});
		return res.ok;
	} catch { return false; }
}
