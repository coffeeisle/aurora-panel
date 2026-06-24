export interface Server {
	id: string;
	name: string;
	slug: string;
	type: 'minecraft' | 'steamcmd' | 'generic';
	game: string;
	status: 'installing' | 'installed' | 'suspended' | 'error';
	gameVersion: string;
	loader: string;
	platform: string;
	nodeName: string;
	allocatedMemory: number;
	allocatedDisk: number;
	allocatedCpu: number;
	port: number;
}
