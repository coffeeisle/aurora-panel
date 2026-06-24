import { writable } from 'svelte/store';
import type { Server } from '$lib/types/server';

export const mockServers: Server[] = [
	{
		id: 'srv_01',
		name: 'Survival World',
		slug: 'survival-world',
		type: 'minecraft',
		game: 'Minecraft',
		status: 'installed',
		gameVersion: '1.21.4',
		loader: 'Fabric',
		platform: 'fabric',
		nodeName: 'node-01',
		allocatedMemory: 4096,
		allocatedDisk: 20480,
		allocatedCpu: 200,
		port: 25565
	},
	{
		id: 'srv_02',
		name: 'Creative Build',
		slug: 'creative-build',
		type: 'minecraft',
		game: 'Minecraft',
		status: 'installed',
		gameVersion: '1.21.4',
		loader: 'Paper',
		platform: 'paper',
		nodeName: 'node-01',
		allocatedMemory: 2048,
		allocatedDisk: 10240,
		allocatedCpu: 100,
		port: 25566
	},
	{
		id: 'srv_03',
		name: 'Modded Adventures',
		slug: 'modded-adventures',
		type: 'minecraft',
		game: 'Minecraft',
		status: 'installed',
		gameVersion: '1.20.1',
		loader: 'Forge',
		platform: 'forge',
		nodeName: 'node-02',
		allocatedMemory: 8192,
		allocatedDisk: 40960,
		allocatedCpu: 300,
		port: 25567
	},
	{
		id: 'srv_04',
		name: 'MiniGames Network',
		slug: 'minigames-network',
		type: 'minecraft',
		game: 'Minecraft',
		status: 'suspended',
		gameVersion: '1.21',
		loader: 'Paper',
		platform: 'paper',
		nodeName: 'node-01',
		allocatedMemory: 3072,
		allocatedDisk: 15360,
		allocatedCpu: 150,
		port: 25568
	},
	{
		id: 'srv_05',
		name: 'Palworld Server',
		slug: 'palworld-server',
		type: 'steamcmd',
		game: 'Palworld',
		status: 'installed',
		gameVersion: 'latest',
		loader: '',
		platform: 'steamcmd',
		nodeName: 'node-02',
		allocatedMemory: 8192,
		allocatedDisk: 30720,
		allocatedCpu: 200,
		port: 8211
	}
];

export const servers = writable<Server[]>(mockServers);

export function getServerById(id: string) {
	return mockServers.find((s) => s.id === id) ?? null;
}

export function getServerBySlug(slug: string) {
	return mockServers.find((s) => s.slug === slug) ?? null;
}
