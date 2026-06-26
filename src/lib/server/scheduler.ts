import { db } from '$lib/server/db';
import { schedules, backups, servers } from '$lib/server/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getIO } from '$lib/server/io';
import { getDaemon, daemonFetch } from '$lib/server/daemon-client';
import { CronExpressionParser } from 'cron-parser';

const POLL_INTERVAL = 30_000;
let intervalHandle: ReturnType<typeof setInterval> | null = null;
let running = false;

export function startScheduler() {
	if (intervalHandle) return;
	console.log('[Scheduler] Starting schedule poller every 30s');
	intervalHandle = setInterval(tick, POLL_INTERVAL);
}

export function stopScheduler() {
	if (intervalHandle) {
		clearInterval(intervalHandle);
		intervalHandle = null;
	}
	console.log('[Scheduler] Stopped');
}

async function tick() {
	if (running) return;
	running = true;
	try {
		const due = db.select().from(schedules).where(
			and(
				eq(schedules.enabled, true),
				sql`${schedules.nextRunAt} <= unixepoch()`
			)
		).all();

		if (due.length > 0) {
			console.log(`[Scheduler] Executing ${due.length} schedule(s)`);
		}

		for (const schedule of due) {
			try {
				await executeSchedule(schedule);
			} catch (e) {
				console.error(`[Scheduler] Failed schedule ${schedule.id} (${schedule.name}):`, e);
			}
		}
	} catch (e) {
		console.error('[Scheduler] Poll error:', e);
	} finally {
		running = false;
	}
}

async function executeSchedule(schedule: typeof schedules.$inferSelect) {
	const server = db.select().from(servers).where(eq(servers.id, schedule.serverId)).get();
	if (!server) {
		console.warn(`[Scheduler] Schedule ${schedule.id}: server ${schedule.serverId} not found, disabling`);
		db.update(schedules).set({ enabled: false }).where(eq(schedules.id, schedule.id)).run();
		return;
	}

	switch (schedule.action) {
		case 'backup':
			await executeBackup(schedule, server);
			break;
		case 'restart':
			await executeRestart(schedule);
			break;
		case 'command':
			await executeCommand(schedule);
			break;
		case 'update_check':
			await executeUpdateCheck(schedule, server);
			break;
	}

	const now = new Date();
	const nextRun = computeNextRun(schedule);
	db.update(schedules).set({
		lastRunAt: now,
		nextRunAt: nextRun,
	}).where(eq(schedules.id, schedule.id)).run();
}

async function executeBackup(schedule: typeof schedules.$inferSelect, server: typeof servers.$inferSelect) {
	const daemonId = server.nodeId;
	const daemon = getDaemon(daemonId);
	if (!daemon || !daemon.connected) {
		console.warn(`[Scheduler] Backup schedule ${schedule.id}: daemon ${daemonId} not connected`);
		return;
	}

	const res = await daemonFetch(daemonId, '/backup', {
		method: 'POST',
		body: JSON.stringify({ serverId: schedule.serverId }),
	}, 120_000);

	if (!res.ok) throw new Error(`Daemon backup failed: ${res.status}`);

	const { name, size } = await res.json() as { name: string; size: number };
	db.insert(backups).values({
		id: `bak_${nanoid(8)}`,
		serverId: schedule.serverId,
		name: `Scheduled: ${schedule.name} - ${new Date().toLocaleDateString()}`,
		size,
		type: 'full',
		checksum: null,
		filePath: name,
		createdAt: new Date(),
	}).run();

	console.log(`[Scheduler] Backup created for ${schedule.serverId}: ${name} (${size} bytes)`);
}

async function executeRestart(schedule: typeof schedules.$inferSelect) {
	const io = getIO();
	if (!io) throw new Error('Socket.IO not available');

	const sockets = io.sockets.sockets;
	let sent = false;
	for (const [, sock] of sockets) {
		if (sock.handshake.auth.type === 'daemon') {
			sock.emit('server:restart', schedule.serverId);
			sent = true;
		}
	}
	if (!sent) throw new Error('No daemon connected via Socket.IO');
	console.log(`[Scheduler] Restart triggered for ${schedule.serverId}`);
}

async function executeCommand(schedule: typeof schedules.$inferSelect) {
	if (!schedule.payload) {
		console.warn(`[Scheduler] Command schedule ${schedule.id}: no payload`);
		return;
	}
	const io = getIO();
	if (!io) throw new Error('Socket.IO not available');

	const sockets = io.sockets.sockets;
	let sent = false;
	for (const [, sock] of sockets) {
		if (sock.handshake.auth.type === 'daemon') {
			sock.emit('console:command', { serverId: schedule.serverId, command: schedule.payload });
			sent = true;
		}
	}
	if (!sent) throw new Error('No daemon connected via Socket.IO');
	console.log(`[Scheduler] Command sent to ${schedule.serverId}: ${schedule.payload}`);
}

async function executeUpdateCheck(_schedule: typeof schedules.$inferSelect, server: typeof servers.$inferSelect) {
	try {
		const daemonId = server.nodeId;
		const serverId = server.id;
		const res = await daemonFetch(daemonId, `/modrinth/check-updates?server=${encodeURIComponent(serverId)}`);
		if (res.ok) {
			const data = await res.json();
			if (Array.isArray(data) && data.length > 0) {
				console.log(`[Scheduler] Update check for ${serverId}: ${data.length} update(s) available`);
			}
		}
	} catch (e) {
		console.warn(`[Scheduler] Update check failed for ${server.id}:`, e);
	}
}

function computeNextRun(schedule: typeof schedules.$inferSelect): Date | null {
	const now = new Date();
	if (schedule.type === 'interval' && schedule.intervalSeconds) {
		return new Date(now.getTime() + schedule.intervalSeconds * 1000);
	}
	if (schedule.type === 'cron' && schedule.cronExpression) {
		try {
			const interval = CronExpressionParser.parse(schedule.cronExpression);
			return interval.next().toDate();
		} catch (e) {
			console.warn(`[Scheduler] Invalid cron expression "${schedule.cronExpression}" for schedule ${schedule.id}:`, e);
			return null;
		}
	}
	return null;
}
