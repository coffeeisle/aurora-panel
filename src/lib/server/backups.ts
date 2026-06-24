export interface Backup {
	id: string;
	name: string;
	size: number;
	type: 'full' | 'partial';
	createdAt: string;
	checksum: string;
	serverId: string;
}

const backupStore = new Map<string, Backup[]>([
	['srv_01', [
		{ id: 'bak_001', name: 'Pre-update backup', size: 256000000, type: 'full', createdAt: '2026-06-20T10:00:00Z', checksum: 'a1b2c3d4', serverId: 'srv_01' },
		{ id: 'bak_002', name: 'Daily auto-backup', size: 128000000, type: 'partial', createdAt: '2026-06-23T06:00:00Z', checksum: 'e5f6g7h8', serverId: 'srv_01' },
	]],
	['srv_03', [
		{ id: 'bak_003', name: 'Modpack v1 snapshot', size: 512000000, type: 'full', createdAt: '2026-06-15T14:00:00Z', checksum: 'i9j0k1l2', serverId: 'srv_03' },
	]],
]);

export function listBackups(serverId: string): Backup[] {
	return backupStore.get(serverId) ?? [];
}

export function createBackup(serverId: string, name: string): Backup {
	const backups = backupStore.get(serverId) ?? [];
	const backup: Backup = {
		id: `bak_${Date.now().toString(36)}`,
		name,
		size: Math.floor(Math.random() * 500_000_000) + 50_000_000,
		type: 'full',
		createdAt: new Date().toISOString(),
		checksum: Math.random().toString(36).slice(2, 10),
		serverId
	};
	backups.unshift(backup);
	backupStore.set(serverId, backups);
	return backup;
}

export function deleteBackup(serverId: string, backupId: string): boolean {
	const backups = backupStore.get(serverId);
	if (!backups) return false;
	const idx = backups.findIndex((b) => b.id === backupId);
	if (idx === -1) return false;
	backups.splice(idx, 1);
	return true;
}

export function getBackupDownloadUrl(serverId: string, backupId: string): string {
	return `/api/servers/${serverId}/backups/${backupId}/download`;
}

export function formatBackupSize(bytes: number): string {
	const sizes = ['B', 'KB', 'MB', 'GB'];
	const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), sizes.length - 1);
	return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i]!;
}
