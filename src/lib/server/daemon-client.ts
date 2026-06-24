import { generateDaemonToken } from '$lib/server/daemon-auth';
import type { DaemonStatus } from '$lib/stores/daemon';

const DAEMON_JWT = generateDaemonToken('panel');

interface DaemonInfo {
	id: string;
	name: string;
	url: string;
	host: string;
	port: number;
	connected: boolean;
}

const knownDaemons = new Map<string, DaemonInfo>([
	['node-01', { id: 'node-01', name: 'node-01', url: process.env['DAEMON_01_URL'] ?? 'http://localhost:8443', host: 'localhost', port: 8443, connected: false }],
]);

export function registerDaemonUrl(id: string, host: string, port: number) {
	const url = `http://${host}:${port}`;
	knownDaemons.set(id, { id, name: id, url, host, port, connected: true });
}

export function getDaemonUrl(daemonId: string): string | null {
	return knownDaemons.get(daemonId)?.url ?? null;
}

export function getDaemonToken(): string {
	return DAEMON_JWT;
}

export async function daemonFetch(
	daemonId: string,
	path: string,
	options?: RequestInit
): Promise<Response> {
	const baseUrl = getDaemonUrl(daemonId);
	if (!baseUrl) throw new Error(`Unknown daemon: ${daemonId}`);

	return fetch(`${baseUrl}${path}`, {
		...options,
		headers: {
			'Authorization': `Bearer ${DAEMON_JWT}`,
			'Content-Type': 'application/json',
			...(options?.headers || {})
		}
	});
}

export async function fetchDaemonHealth(daemonId: string): Promise<{
	status: string;
	daemonId: string;
	cpu: { load: number; cores: number };
	memory: { total: number; used: number };
	disk: { total: number; used: number };
	uptime: number;
	version: string;
} | null> {
	try {
		const res = await daemonFetch(daemonId, '/health');
		if (!res.ok) return null;
		return res.json();
	} catch {
		return null;
	}
}

export async function listServersFromDaemon(daemonId: string) {
	const res = await daemonFetch(daemonId, '/servers');
	if (!res.ok) throw new Error(`Failed to list servers: ${res.status}`);
	return res.json();
}

export function isDaemonConnected(daemonId: string): boolean {
	return knownDaemons.get(daemonId)?.connected ?? false;
}

export function setDaemonConnected(daemonId: string, connected: boolean) {
	const info = knownDaemons.get(daemonId);
	if (info) info.connected = connected;
}

export function getConnectedDaemons(): DaemonInfo[] {
	return Array.from(knownDaemons.values()).filter(d => d.connected);
}

export function getAllDaemons(): DaemonInfo[] {
	return Array.from(knownDaemons.values());
}
