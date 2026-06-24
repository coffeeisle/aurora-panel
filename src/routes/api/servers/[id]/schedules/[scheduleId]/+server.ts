import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { schedules } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

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
		if (body.intervalSeconds) updateData.intervalSeconds = body.intervalSeconds;
		if (body.payload !== undefined) updateData.payload = body.payload;
		if (body.enabled !== undefined) updateData.enabled = body.enabled;
		db.update(schedules).set(updateData).where(eq(schedules.id, params.scheduleId)).run();
	}
	return json({ success: true });
};

export const DELETE: RequestHandler = async ({ params }) => {
	db.delete(schedules).where(eq(schedules.id, params.scheduleId)).run();
	return json({ success: true });
};
