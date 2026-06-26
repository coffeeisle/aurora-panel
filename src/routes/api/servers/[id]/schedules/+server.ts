import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { schedules } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
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

export const GET: RequestHandler = async ({ params }) => {
	const items = db.select().from(schedules).where(eq(schedules.serverId, params.id)).all();
	return json(items);
};

export const POST: RequestHandler = async ({ params, request }) => {
	const body = await request.json();
	const now = new Date();
	const type: string = body.type || 'interval';
	const intervalSeconds = type === 'interval' ? (body.intervalSeconds || 3600) : null;
	const cronExpression = type === 'cron' ? (body.cronExpression || null) : null;
	const nextRun = computeNextRun(type, intervalSeconds, cronExpression);

	const schedule = {
		id: `sch_${nanoid(8)}`,
		serverId: params.id,
		name: body.name,
		description: body.description || '',
		type: type as 'cron' | 'interval',
		intervalSeconds,
		cronExpression,
		action: body.action || 'backup',
		payload: body.payload || '',
		enabled: true,
		lastRunAt: null,
		nextRunAt: nextRun,
		createdAt: now,
	};
	db.insert(schedules).values(schedule).run();
	return json(schedule, { status: 201 });
};
