import { writable, derived } from 'svelte/store';

export interface ServerInfo {
	id: string;
	name: string;
	status: string;
	processType?: string;
	loader?: string;
	gameVersion?: string;
	stats?: { cpuPercent: number; memoryBytes: number; diskBytes: number; uptime: number };
}

export interface DaemonStatus {
	id: string;
	name: string;
	connected: boolean;
	host: string;
	port: number;
	servers: ServerInfo[];
	cpu: { load: number; cores: number };
	memory: { total: number; used: number };
	disk: { total: number; used: number };
	uptime: number;
	version: string;
	lastSeenAt: number;
}

function createDaemonStore() {
	const { subscribe, update } = writable<Map<string, DaemonStatus>>(new Map());

	function registerDaemon(info: {
		id: string;
		name?: string;
		host?: string;
		port?: number;
		cpu?: { load: number; cores: number };
		memory?: { total: number; used: number };
		disk?: { total: number; used: number };
		uptime?: number;
		version?: string;
		servers?: ServerInfo[];
	}) {
		update((m) => {
			const existing = m.get(info.id);
			if (existing) {
				existing.connected = true;
				existing.lastSeenAt = Date.now();
				if (info.cpu) existing.cpu = info.cpu;
				if (info.memory) existing.memory = info.memory;
				if (info.disk) existing.disk = info.disk;
				if (info.uptime !== undefined) existing.uptime = info.uptime;
				if (info.version) existing.version = info.version;
				if (info.servers) existing.servers = info.servers;
			} else {
				m.set(info.id, {
					id: info.id,
					name: info.name ?? info.id,
					connected: true,
					host: info.host ?? 'unknown',
					port: info.port ?? 8443,
					servers: info.servers ?? [],
					cpu: info.cpu ?? { load: 0, cores: 0 },
					memory: info.memory ?? { total: 0, used: 0 },
					disk: info.disk ?? { total: 0, used: 0 },
					uptime: info.uptime ?? 0,
					version: info.version ?? '0.0.1',
					lastSeenAt: Date.now(),
				});
			}
			return new Map(m);
		});
	}

	function updateStats(id: string, stats: { cpu?: { load: number; cores: number }; memory?: { total: number; used: number }; disk?: { total: number; used: number }; uptime?: number }) {
		update((m) => {
			const d = m.get(id);
			if (d) {
				if (stats.cpu) d.cpu = stats.cpu;
				if (stats.memory) d.memory = stats.memory;
				if (stats.disk) d.disk = stats.disk;
				if (stats.uptime !== undefined) d.uptime = stats.uptime;
				d.lastSeenAt = Date.now();
			}
			return new Map(m);
		});
	}

	function disconnectDaemon(id: string) {
		update((m) => {
			const d = m.get(id);
			if (d) {
				d.connected = false;
				d.servers = d.servers.map((s) => ({ ...s, status: 'stopped' }));
			}
			return new Map(m);
		});
	}

	function updateServerStatus(serverId: string, status: string) {
		update((m) => {
			for (const [, d] of m) {
				const srv = d.servers.find((s) => s.id === serverId);
				if (srv) srv.status = status;
			}
			return new Map(m);
		});
	}

	function registerServers(daemonId: string, servers: ServerInfo[]) {
		update((m) => {
			const d = m.get(daemonId);
			if (d) d.servers = servers;
			return new Map(m);
		});
	}

	return {
		subscribe,
		registerDaemon,
		updateStats,
		disconnectDaemon,
		updateServerStatus,
		registerServers,
	};
}

export const daemonStore = createDaemonStore();

export const connectedDaemons = derived(daemonStore, ($s) =>
	Array.from($s.values()).filter((d) => d.connected)
);

export const daemonList = derived(daemonStore, ($s) =>
	Array.from($s.values())
);

export const daemonServerStatus = derived(
	daemonStore,
	($s) => (serverId: string): string | null => {
		for (const [, d] of $s) {
			const srv = d.servers.find((s) => s.id === serverId);
			if (srv) return srv.status;
		}
		return null;
	}
);
