export interface ManagedServer {
	id: string;
	name: string;
	slug: string;
	status: 'installing' | 'starting' | 'running' | 'stopping' | 'restarting' | 'stopped' | 'error' | 'crashed';
	type: 'minecraft' | 'steamcmd' | 'generic';
	game: string;
	gameVersion: string;
	loader: string;
	platform: string;
	port: number;
	allocatedMemory: number;
	allocatedDisk: number;
	allocatedCpu: number;
	processType: 'docker' | 'bare';
	dockerImage: string;
	startupCommand: string;
	stopCommand: string;
	consoleLines: string[];
	crashCount: number;
	lastCrashedAt: number | null;
	stats: ServerStats;
	createdAt: number;
	updatedAt: number;
}

export interface ServerStats {
	cpuPercent: number;
	memoryBytes: number;
	diskBytes: number;
	uptime: number;
}

export interface DaemonConfig {
	id: string;
	name: string;
	host: string;
	port: number;
	version: string;
	jwtSecret: string;
	panelUrl: string;
	serversDir: string;
	dataDir: string;
	dockerNetwork: string;
	autoRestart: boolean;
	maxCrashRestarts: number;
}

export interface SystemStats {
	cpu: { load: number; cores: number };
	memory: { total: number; used: number; free: number };
	disk: { total: number; used: number; free: number };
	uptime: number;
	version: string;
	daemonId: string;
	serversCount: number;
}

export interface FileEntry {
	name: string;
	path: string;
	type: 'file' | 'directory';
	size: number;
	modifiedAt: string;
	mime?: string;
}

export interface EggDefinition {
	id: string;
	name: string;
	game: string;
	description: string;
	icon: string;
	loader: string;
	platform: string;
	dockerImage: string;
	startupCommand: string;
	stopCommand: string;
	defaultMemory: number;
	defaultDisk: number;
	defaultCpu: number;
	defaultPort: number;
	supportsMods: boolean;
	supportsPlugins: boolean;
	supportsDatapacks: boolean;
	versionApi: string;
	versionList: () => Promise<EggVersion[]>;
	download: (version: string, serverDir: string) => Promise<boolean>;
}

export interface EggVersion {
	id: string;
	name: string;
	version: string;
	releaseType: 'release' | 'snapshot' | 'beta' | 'alpha' | 'old_beta' | 'old_alpha';
	build?: number;
	isLatest?: boolean;
	isRecommended?: boolean;
}
