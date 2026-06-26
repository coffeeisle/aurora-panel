import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { schedules } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { CronExpressionParser } from 'cron-parser';

function computeNextRun(type: string, intervalSeconds?: number | null, cronExpression?: string | null): Date | null {
	const now = new Date();
	if (type === 'interval' && intervalSeconds) {
		return new Date(now.getTime() + intervalSeconds * 1000);
	}
	if (type === 'cron' && cronExpression) {
		try {
			const interval = CronExpressionParser.parse(cronExpression);
			return interval.next().toDate();
		} catch {
			return null;
		}
	}
	return null;
}

export const PATCH: RequestHandler = async ({ params, request }) => {
	const body = await request.json();
	const existing = db.select().from(schedules).where(eq(schedules.id, params.scheduleId)).get();
	if (!existing) {
		return json({ success: false }, { status: 404 });
	}

	if (body.action === 'toggle') {
		db.update(schedules).set({ enabled: body.enabled }).where(eq(schedules.id, params.scheduleId)).run();
	} else {
		const updateData: Record<string, unknown> = {};
		if (body.name) updateData.name = body.name;
		if (body.description !== undefined) updateData.description = body.description;
		if (body.type) updateData.type = body.type;
		if (body.intervalSeconds !== undefined) updateData.intervalSeconds = body.intervalSeconds;
		if (body.cronExpression !== undefined) updateData.cronExpression = body.cronExpression;
		if (body.action) updateData.action = body.action;
		if (body.payload !== undefined) updateData.payload = body.payload;
		if (body.enabled !== undefined) updateData.enabled = body.enabled;

		const newType = body.type || existing.type;
		const newInterval = body.intervalSeconds !== undefined ? body.intervalSeconds : existing.intervalSeconds;
		const newCron = body.cronExpression !== undefined ? body.cronExpression : existing.cronExpression;
		const nextRun = computeNextRun(newType, newInterval, newCron);
		if (nextRun) updateData.nextRunAt = nextRun;

		db.update(schedules).set(updateData).where(eq(schedules.id, params.scheduleId)).run();
	}
	return json({ success: true });
};

export const DELETE: RequestHandler = async ({ params }) => {
	db.delete(schedules).where(eq(schedules.id, params.scheduleId)).run();
	return json({ success: true });
};
