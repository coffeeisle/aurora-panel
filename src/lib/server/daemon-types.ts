export interface DaemonServer {
	id: string;
	name: string;
	status: 'installing' | 'starting' | 'running' | 'stopping' | 'restarting' | 'stopped' | 'error' | 'crashed';
	gameVersion: string;
	loader: string;
	platform: string;
	port: number;
	allocatedMemory: number;
	allocatedDisk: number;
	allocatedCpu: number;
	path: string;
	processType: 'docker' | 'bare';
	crashCount: number;
	stats: {
		cpuPercent: number;
		memoryBytes: number;
		diskBytes: number;
		uptime: number;
	};
}

export interface FileEntry {
	name: string;
	path: string;
	type: 'file' | 'directory';
	size: number;
	modifiedAt: string;
	mime?: string;
}

export interface BackupEntry {
	id: string;
	name: string;
	size: number;
	createdAt: string;
	type: 'full' | 'incremental' | 'partial';
	checksum: string;
}

export interface DaemonActionResponse {
	success: boolean;
	message?: string;
	data?: unknown;
}

export interface DaemonSystemStats {
	cpu: { load: number; cores: number };
	memory: { total: number; used: number; free: number };
	disk: { total: number; used: number; free: number };
	uptime: number;
	version: string;
	daemonId: string;
	serversCount: number;
}

export interface EggInfo {
	id: string;
	name: string;
	game: string;
	description: string;
	loader: string;
	platform: string;
	defaultMemory: number;
	defaultDisk: number;
	defaultCpu: number;
	defaultPort: number;
	supportsMods: boolean;
	supportsPlugins: boolean;
	supportsDatapacks: boolean;
}

export interface EggVersionInfo {
	id: string;
	name: string;
	version: string;
	releaseType: 'release' | 'snapshot' | 'beta' | 'alpha' | 'old_beta' | 'old_alpha';
	isLatest?: boolean;
	isRecommended?: boolean;
}
