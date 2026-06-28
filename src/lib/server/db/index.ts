import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

const dbPath = process.env['DATABASE_URL']?.replace('file:', '') ?? './data/aurora.db';
const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

// Auto-create tables on startup
sqlite.exec(`
	CREATE TABLE IF NOT EXISTS users (
		id TEXT PRIMARY KEY,
		username TEXT NOT NULL UNIQUE,
		email TEXT NOT NULL UNIQUE,
		password_hash TEXT NOT NULL,
		role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin','user')),
		created_at INTEGER NOT NULL,
		updated_at INTEGER NOT NULL
	);
	CREATE TABLE IF NOT EXISTS servers (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		slug TEXT NOT NULL UNIQUE,
		owner_id TEXT NOT NULL REFERENCES users(id),
		node_id TEXT NOT NULL,
		type TEXT NOT NULL CHECK(type IN ('minecraft','steamcmd','generic')),
		game TEXT NOT NULL,
		game_version TEXT NOT NULL DEFAULT 'latest',
		loader TEXT NOT NULL DEFAULT '',
		platform TEXT NOT NULL DEFAULT '',
		status TEXT NOT NULL DEFAULT 'installing' CHECK(status IN ('installing','installed','suspended','error','running','stopped','starting','stopping','restarting')),
		process_type TEXT NOT NULL DEFAULT 'docker' CHECK(process_type IN ('docker','bare')),
		docker_image TEXT,
		startup_command TEXT NOT NULL,
		stop_command TEXT NOT NULL DEFAULT 'stop',
		allocated_memory INTEGER NOT NULL DEFAULT 1024,
		allocated_cpus TEXT,
		allocated_disk INTEGER NOT NULL DEFAULT 10240,
		allocation_port INTEGER NOT NULL,
		allocation_ip TEXT NOT NULL DEFAULT '0.0.0.0',
		created_at INTEGER NOT NULL,
		updated_at INTEGER NOT NULL
	);
	CREATE TABLE IF NOT EXISTS nodes (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		host TEXT NOT NULL,
		port INTEGER NOT NULL DEFAULT 8443,
		token TEXT NOT NULL,
		status TEXT NOT NULL DEFAULT 'connecting' CHECK(status IN ('online','offline','connecting')),
		last_ping_at INTEGER,
		created_at INTEGER NOT NULL,
		updated_at INTEGER NOT NULL
	);
	CREATE TABLE IF NOT EXISTS sessions (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL REFERENCES users(id),
		expires_at INTEGER NOT NULL
	);
	CREATE TABLE IF NOT EXISTS backups (
		id TEXT PRIMARY KEY,
		server_id TEXT NOT NULL REFERENCES servers(id),
		name TEXT NOT NULL,
		size INTEGER NOT NULL,
		type TEXT NOT NULL DEFAULT 'full' CHECK(type IN ('full','partial','incremental')),
		checksum TEXT,
		file_path TEXT,
		created_at INTEGER NOT NULL
	);
	CREATE TABLE IF NOT EXISTS schedules (
		id TEXT PRIMARY KEY,
		server_id TEXT NOT NULL REFERENCES servers(id),
		name TEXT NOT NULL,
		description TEXT DEFAULT '',
		type TEXT NOT NULL CHECK(type IN ('cron','interval')),
		cron_expression TEXT,
		interval_seconds INTEGER,
		action TEXT NOT NULL CHECK(action IN ('restart','backup','command','update_check')),
		payload TEXT DEFAULT '',
		enabled INTEGER NOT NULL DEFAULT 1,
		last_run_at INTEGER,
		next_run_at INTEGER,
		created_at INTEGER NOT NULL
	);
	CREATE TABLE IF NOT EXISTS installed_mods (
		id TEXT PRIMARY KEY,
		server_id TEXT NOT NULL REFERENCES servers(id),
		project_id TEXT NOT NULL,
		project_type TEXT NOT NULL,
		version_id TEXT NOT NULL,
		version_number TEXT NOT NULL,
		title TEXT,
		slug TEXT,
		icon_url TEXT,
		installed_at INTEGER NOT NULL
	);
	CREATE TABLE IF NOT EXISTS server_permissions (
		id TEXT PRIMARY KEY,
		server_id TEXT NOT NULL REFERENCES servers(id),
		user_id TEXT NOT NULL REFERENCES users(id),
		role TEXT NOT NULL DEFAULT 'viewer' CHECK(role IN ('owner','admin','moderator','viewer')),
		created_at INTEGER NOT NULL
	);
`);

export const db = drizzle(sqlite, { schema });
