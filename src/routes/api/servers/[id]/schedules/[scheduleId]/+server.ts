import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { updateSchedule, deleteSchedule, toggleSchedule } from '$lib/server/schedules';

export const PATCH: RequestHandler = async ({ params, request }) => {
	const body = await request.json();
	const { action, ...data } = body;

	if (action === 'toggle') {
		return json({ success: toggleSchedule(params.id, params.scheduleId, data.enabled) });
	}

	return json({ success: updateSchedule(params.id, params.scheduleId, body) });
};

export const DELETE: RequestHandler = async ({ params }) => {
	return json({ success: deleteSchedule(params.id, params.scheduleId) });
};
