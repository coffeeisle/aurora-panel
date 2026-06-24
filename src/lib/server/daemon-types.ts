export interface DaemonServer {
	id: string;
	name: string;
	status: 'starting' | 'running' | 'stopping' | 'stopped' | 'error';
	gameVersion: string;
	loader: string;
	platform: string;
	port: number;
	allocatedMemory: number;
	allocatedDisk: number;
	allocatedCpu: number;
	path: string;
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
