import { generateDaemonToken } from '$lib/server/daemon-auth';
import { db } from '$lib/server/db';
import { nodes } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export interface DaemonInfo {
	id: string;
	name: string;
	url: string;
	host: string;
	port: number;
	connected: boolean;
	lastSeen: number;
	version: string;
	health?: {
		cpu: { load: number; cores: number };
		memory: { total: number; used: number };
		disk: { total: number; used: number };
		uptime: number;
		version: string;
		serversCount: number;
	} | null;
}

const knownDaemons = new Map<string, DaemonInfo>();

let panelToken = generateDaemonToken('panel');
let lastTokenGen = Date.now();

function getOrRefreshToken(): string {
	if (Date.now() - lastTokenGen > 3600000) {
		panelToken = generateDaemonToken('panel');
		lastTokenGen = Date.now();
	}
	return panelToken;
}

export function hydrateDaemonsFromDb() {
	const rows = db.select().from(nodes).all();
	for (const row of rows) {
		const url = `http://${row.host}:${row.port}`;
		knownDaemons.set(row.id, {
			id: row.id,
			name: row.name,
			url,
			host: row.host,
			port: row.port,
			connected: row.status === 'online',
			lastSeen: row.lastPingAt?.getTime() ?? 0,
			version: '0.2.0',
		});
	}
}

export function registerDaemon(id: string, host: string, port: number, name?: string) {
	const url = `http://${host}:${port}`;
	const existing = knownDaemons.get(id);
	if (existing) {
		existing.connected = true;
		existing.lastSeen = Date.now();
		return;
	}
	knownDaemons.set(id, {
		id, name: name ?? id, url, host, port, connected: true, lastSeen: Date.now(), version: '0.2.0',
	});
}

export function persistDaemon(id: string, host: string, port: number, name?: string) {
	const now = new Date();
	const existing = db.select({ id: nodes.id }).from(nodes).where(eq(nodes.id, id)).get();
	if (existing) {
		db.update(nodes).set({ host, port, name: name ?? id, status: 'online', updatedAt: now }).where(eq(nodes.id, id)).run();
	} else {
		db.insert(nodes).values({ id, name: name ?? id, host, port, token: '', status: 'online', createdAt: now, updatedAt: now }).run();
	}
	registerDaemon(id, host, port, name);
}

export function markDaemonOffline(id: string) {
	const info = knownDaemons.get(id);
	if (info) {
		info.connected = false;
		info.lastSeen = Date.now();
	}
	db.update(nodes).set({ status: 'offline', updatedAt: new Date() }).where(eq(nodes.id, id)).run();
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
	options?: RequestInit,
	timeout: number = 10000
): Promise<Response> {
	const info = knownDaemons.get(daemonId);
	if (!info) throw new Error(`Unknown daemon: ${daemonId}`);

	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeout);

	const token = getOrRefreshToken();
	try {
		const res = await fetch(`${info.url}${path}`, {
			...options,
			signal: controller.signal,
			headers: {
				'Authorization': `Bearer ${token}`,
				'Content-Type': 'application/json',
				...(options?.headers || {}),
			},
		});
		info.connected = true;
		info.lastSeen = Date.now();
		return res;
	} catch (e) {
		info.connected = false;
		info.lastSeen = Date.now();
		throw e;
	} finally {
		clearTimeout(timeoutId);
	}
}

export async function fetchDaemonHealth(daemonId: string) {
	try {
		const res = await daemonFetch(daemonId, '/health', {}, 5000);
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
				version: data.version ?? '0.0.1',
				serversCount: data.serversCount ?? 0,
			};
			info.version = data.version ?? info.version;
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

export async function fetchEggList(daemonId: string) {
	try {
		const res = await daemonFetch(daemonId, '/eggs', {}, 5000);
		if (!res.ok) return null;
		return res.json();
	} catch {
		return null;
	}
}

export async function fetchEggVersions(daemonId: string, eggId: string) {
	try {
		const res = await daemonFetch(daemonId, '/eggs/versions', {
			method: 'POST',
			body: JSON.stringify({ eggId }),
		});
		if (!res.ok) return null;
		return res.json();
	} catch {
		return null;
	}
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

export function updateDaemonStats(data: { id: string; cpu?: { load: number; cores: number }; memory?: { total: number; used: number }; disk?: { total: number; used: number }; version?: string }) {
	const info = knownDaemons.get(data.id);
	if (!info) return;
	if (!info.health) {
		info.health = { cpu: { load: 0, cores: 0 }, memory: { total: 0, used: 0 }, disk: { total: 0, used: 0 }, uptime: 0, version: '0.0.1', serversCount: 0 };
	}
	if (data.cpu) info.health.cpu = data.cpu;
	if (data.memory) info.health.memory = data.memory;
	if (data.disk) info.health.disk = data.disk;
	if (data.version) info.version = data.version;
}

export async function daemonListFiles(daemonId: string, serverId: string, dir: string) {
	return daemonFetch(daemonId, `/files?server=${encodeURIComponent(serverId)}&dir=${encodeURIComponent(dir)}`);
}

export async function daemonReadFile(daemonId: string, serverId: string, filePath: string): Promise<{ content: string; isTextFile: boolean } | null> {
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
			body: JSON.stringify({ content }),
		});
		return res.ok;
	} catch { return false; }
}

export async function daemonDeleteEntry(daemonId: string, serverId: string, filePath: string): Promise<boolean> {
	try {
		const res = await daemonFetch(daemonId, `/files?server=${encodeURIComponent(serverId)}&path=${encodeURIComponent(filePath)}`, {
			method: 'DELETE',
		});
		return res.ok;
	} catch { return false; }
}

export async function daemonRenameEntry(daemonId: string, serverId: string, oldPath: string, newName: string): Promise<boolean> {
	try {
		const res = await daemonFetch(daemonId, `/files?server=${encodeURIComponent(serverId)}&path=${encodeURIComponent(oldPath)}&action=rename`, {
			method: 'PATCH',
			body: JSON.stringify({ name: newName }),
		});
		return res.ok;
	} catch { return false; }
}

export async function daemonCreateEntry(daemonId: string, serverId: string, parentDir: string, name: string, type: 'file' | 'directory'): Promise<boolean> {
	try {
		const action = type === 'directory' ? 'mkdir' : 'touch';
		const res = await daemonFetch(daemonId, `/files?server=${encodeURIComponent(serverId)}&dir=${encodeURIComponent(parentDir)}&action=${action}`, {
			method: 'PATCH',
			body: JSON.stringify({ name }),
		});
		return res.ok;
	} catch { return false; }
}
