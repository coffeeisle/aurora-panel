import { toasts } from '$lib/stores/toast';

export interface ScheduledTask {
	id: string;
	serverId: string;
	name: string;
	description: string;
	type: 'cron' | 'interval';
	cronExpression?: string;
	intervalSeconds?: number;
	action: 'restart' | 'backup' | 'command' | 'update_check';
	payload: string;
	enabled: boolean;
	lastRunAt: string | null;
	nextRunAt: string;
	createdAt: string;
}

const schedules = new Map<string, ScheduledTask[]>();

export function listSchedules(serverId: string): ScheduledTask[] {
	return schedules.get(serverId) ?? [];
}

export function createSchedule(serverId: string, data: {
	name: string;
	description?: string;
	type: 'cron' | 'interval';
	cronExpression?: string;
	intervalSeconds?: number;
	action: ScheduledTask['action'];
	payload?: string;
}): ScheduledTask {
	const items = schedules.get(serverId) ?? [];
	const now = new Date();
	const task: ScheduledTask = {
		id: `sch_${Date.now().toString(36)}`,
		serverId,
		name: data.name,
		description: data.description ?? '',
		type: data.type,
		cronExpression: data.cronExpression,
		intervalSeconds: data.intervalSeconds,
		action: data.action,
		payload: data.payload ?? '',
		enabled: true,
		lastRunAt: null,
		nextRunAt: new Date(now.getTime() + 3600000).toISOString(),
		createdAt: now.toISOString()
	};
	items.push(task);
	schedules.set(serverId, items);
	return task;
}

export function updateSchedule(serverId: string, scheduleId: string, data: Partial<Omit<ScheduledTask, 'id' | 'serverId' | 'createdAt'>>): boolean {
	const items = schedules.get(serverId);
	if (!items) return false;
	const idx = items.findIndex((s) => s.id === scheduleId);
	if (idx === -1) return false;
	items[idx] = { ...items[idx], ...data };
	return true;
}

export function deleteSchedule(serverId: string, scheduleId: string): boolean {
	const items = schedules.get(serverId);
	if (!items) return false;
	const idx = items.findIndex((s) => s.id === scheduleId);
	if (idx === -1) return false;
	items.splice(idx, 1);
	return true;
}

export function toggleSchedule(serverId: string, scheduleId: string, enabled: boolean): boolean {
	const items = schedules.get(serverId);
	if (!items) return false;
	const task = items.find((s) => s.id === scheduleId);
	if (!task) return false;
	task.enabled = enabled;
	return true;
}
