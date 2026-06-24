import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { schedules } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export const GET: RequestHandler = async ({ params }) => {
	const items = db.select().from(schedules).where(eq(schedules.serverId, params.id)).all();
	return json(items);
};

export const POST: RequestHandler = async ({ params, request }) => {
	const body = await request.json();
	const now = new Date();
	const schedule = {
		id: `sch_${nanoid(8)}`,
		serverId: params.id,
		name: body.name,
		description: body.description || '',
		type: body.type || 'interval',
		intervalSeconds: body.intervalSeconds || null,
		action: body.action || 'backup',
		payload: body.payload || '',
		enabled: true,
		lastRunAt: null,
		nextRunAt: new Date(now.getTime() + 3600000),
		createdAt: now
	};
	db.insert(schedules).values(schedule).run();
	return json(schedule, { status: 201 });
};
