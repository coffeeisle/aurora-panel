import { db } from './index';
import { users, servers, nodes, backups, schedules, serverPermissions } from './schema';
import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';

async function seed() {
	const adminId = 'user_admin';
	const now = new Date();

	const existing = db.select().from(users).where(eq(users.id, adminId)).get();
	if (existing) {
		console.log('Database already seeded, skipping.');
		return;
	}

	db.insert(users).values({
		id: adminId,
		username: 'admin',
		email: 'admin@aurora.local',
		passwordHash: '$2b$10$PN1gbEh7qvjxFeMlB2aWvu6IshH2CSfwq29LDmIJD62.bzHAfVIgC',
		role: 'admin',
		createdAt: now,
		updatedAt: now
	}).run();

	db.insert(nodes).values({
		id: 'node-01',
		name: 'Primary Node',
		host: 'localhost',
		port: 8443,
		token: 'dev-token',
		status: 'online',
		createdAt: now,
		updatedAt: now
	}).run();

	db.insert(nodes).values({
		id: 'node-02',
		name: 'Secondary Node',
		host: '192.168.1.101',
		port: 8443,
		token: 'dev-token-2',
		status: 'offline',
		createdAt: now,
		updatedAt: now
	}).run();

	const serverData = [
		{ id: 'srv_01', name: 'Survival World', slug: 'survival-world', game: 'Minecraft', type: 'minecraft' as const, status: 'installed' as const, gameVersion: '1.21.4', loader: 'Fabric', platform: 'fabric', nodeId: 'node-01', allocatedMemory: 4096, allocatedDisk: 20480, allocatedCpu: '200', allocationPort: 25565 },
		{ id: 'srv_02', name: 'Creative Build', slug: 'creative-build', game: 'Minecraft', type: 'minecraft' as const, status: 'installed' as const, gameVersion: '1.21.4', loader: 'Paper', platform: 'paper', nodeId: 'node-01', allocatedMemory: 2048, allocatedDisk: 10240, allocatedCpu: '100', allocationPort: 25566 },
		{ id: 'srv_03', name: 'Modded Adventures', slug: 'modded-adventures', game: 'Minecraft', type: 'minecraft' as const, status: 'installed' as const, gameVersion: '1.20.1', loader: 'Forge', platform: 'forge', nodeId: 'node-02', allocatedMemory: 8192, allocatedDisk: 40960, allocatedCpu: '300', allocationPort: 25567 },
		{ id: 'srv_04', name: 'MiniGames Network', slug: 'minigames-network', game: 'Minecraft', type: 'minecraft' as const, status: 'suspended' as const, gameVersion: '1.21', loader: 'Paper', platform: 'paper', nodeId: 'node-01', allocatedMemory: 3072, allocatedDisk: 15360, allocatedCpu: '150', allocationPort: 25568 },
		{ id: 'srv_05', name: 'Palworld Server', slug: 'palworld-server', game: 'Palworld', type: 'steamcmd' as const, status: 'installed' as const, gameVersion: 'latest', loader: '', platform: 'steamcmd', nodeId: 'node-02', allocatedMemory: 8192, allocatedDisk: 30720, allocatedCpu: '200', allocationPort: 8211 }
	];

	for (const s of serverData) {
		db.insert(servers).values({
			...s,
			ownerId: adminId,
			startupCommand: 'java -Xmx${MEMORY}M -jar server.jar nogui',
			createdAt: now,
			updatedAt: now
		}).run();

		db.insert(serverPermissions).values({
			id: nanoid(),
			serverId: s.id,
			userId: adminId,
			role: 'owner',
			createdAt: now
		}).run();
	}

	db.insert(backups).values({
		id: 'bak_001', serverId: 'srv_01', name: 'Pre-update backup',
		size: 256000000, type: 'full', checksum: 'a1b2c3d4',
		createdAt: new Date('2026-06-20T10:00:00Z')
	}).run();

	db.insert(backups).values({
		id: 'bak_002', serverId: 'srv_01', name: 'Daily auto-backup',
		size: 128000000, type: 'partial', checksum: 'e5f6g7h8',
		createdAt: new Date('2026-06-23T06:00:00Z')
	}).run();

	db.insert(backups).values({
		id: 'bak_003', serverId: 'srv_03', name: 'Modpack v1 snapshot',
		size: 512000000, type: 'full', checksum: 'i9j0k1l2',
		createdAt: new Date('2026-06-15T14:00:00Z')
	}).run();

	console.log('Database seeded successfully!');
}

seed().catch(console.error);
