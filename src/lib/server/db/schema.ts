import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
	id: text('id').primaryKey(),
	username: text('username').notNull().unique(),
	email: text('email').notNull().unique(),
	passwordHash: text('password_hash').notNull(),
	role: text('role', { enum: ['admin', 'user'] }).notNull().default('user'),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
});

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;

export const servers = sqliteTable('servers', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	slug: text('slug').notNull().unique(),
	ownerId: text('owner_id').notNull().references(() => users.id),
	nodeId: text('node_id').notNull(),
	type: text('type', { enum: ['minecraft', 'steamcmd', 'generic'] }).notNull(),
	game: text('game').notNull(),
	gameVersion: text('game_version').notNull().default('latest'),
	loader: text('loader').notNull().default(''),
	platform: text('platform').notNull().default(''),
	status: text('status', {
		enum: ['installing', 'installed', 'suspended', 'error', 'running', 'stopped', 'starting', 'stopping', 'restarting']
	})
		.notNull()
		.default('installing'),
	processType: text('process_type', { enum: ['docker', 'bare'] }).notNull().default('docker'),
	dockerImage: text('docker_image'),
	startupCommand: text('startup_command').notNull(),
	stopCommand: text('stop_command').notNull().default('stop'),
	allocatedMemory: integer('allocated_memory').notNull().default(1024),
	allocatedCpus: text('allocated_cpus'),
	allocatedDisk: integer('allocated_disk').notNull().default(10240),
	allocationPort: integer('allocation_port').notNull(),
	allocationIp: text('allocation_ip').notNull().default('0.0.0.0'),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
});

export type Server = InferSelectModel<typeof servers>;
export type NewServer = InferInsertModel<typeof servers>;

export const nodes = sqliteTable('nodes', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	host: text('host').notNull(),
	port: integer('port').notNull().default(8443),
	token: text('token').notNull(),
	status: text('status', { enum: ['online', 'offline', 'connecting'] })
		.notNull()
		.default('connecting'),
	lastPingAt: integer('last_ping_at', { mode: 'timestamp' }),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
});

export type Node = InferSelectModel<typeof nodes>;
export type NewNode = InferInsertModel<typeof nodes>;

export const sessions = sqliteTable('sessions', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id),
	expiresAt: integer('expires_at').notNull()
});

export type Session = InferSelectModel<typeof sessions>;

export const backups = sqliteTable('backups', {
	id: text('id').primaryKey(),
	serverId: text('server_id').notNull().references(() => servers.id),
	name: text('name').notNull(),
	size: integer('size').notNull(),
	type: text('type', { enum: ['full', 'partial', 'incremental'] }).notNull().default('full'),
	checksum: text('checksum'),
	filePath: text('file_path'),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
});

export type Backup = InferSelectModel<typeof backups>;
export type NewBackup = InferInsertModel<typeof backups>;

export const schedules = sqliteTable('schedules', {
	id: text('id').primaryKey(),
	serverId: text('server_id').notNull().references(() => servers.id),
	name: text('name').notNull(),
	description: text('description').default(''),
	type: text('type', { enum: ['cron', 'interval'] }).notNull(),
	cronExpression: text('cron_expression'),
	intervalSeconds: integer('interval_seconds'),
	action: text('action', { enum: ['restart', 'backup', 'command', 'update_check'] }).notNull(),
	payload: text('payload').default(''),
	enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
	lastRunAt: integer('last_run_at', { mode: 'timestamp' }),
	nextRunAt: integer('next_run_at', { mode: 'timestamp' }),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
});

export type Schedule = InferSelectModel<typeof schedules>;
export type NewSchedule = InferInsertModel<typeof schedules>;

export const installedMods = sqliteTable('installed_mods', {
	id: text('id').primaryKey(),
	serverId: text('server_id').notNull().references(() => servers.id),
	projectId: text('project_id').notNull(),
	projectType: text('project_type').notNull(),
	versionId: text('version_id').notNull(),
	versionNumber: text('version_number').notNull(),
	title: text('title'),
	slug: text('slug'),
	iconUrl: text('icon_url'),
	installedAt: integer('installed_at', { mode: 'timestamp' }).notNull()
});

export type InstalledMod = InferSelectModel<typeof installedMods>;
export type NewInstalledMod = InferInsertModel<typeof installedMods>;

export const serverPermissions = sqliteTable('server_permissions', {
	id: text('id').primaryKey(),
	serverId: text('server_id').notNull().references(() => servers.id),
	userId: text('user_id').notNull().references(() => users.id),
	role: text('role', { enum: ['owner', 'admin', 'moderator', 'viewer'] }).notNull().default('viewer'),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
});

export type ServerPermission = InferSelectModel<typeof serverPermissions>;
export type NewServerPermission = InferInsertModel<typeof serverPermissions>;
