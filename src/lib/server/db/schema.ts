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
	status: text('status', {
		enum: ['installing', 'installed', 'suspended', 'error']
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
