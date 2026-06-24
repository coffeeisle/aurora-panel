import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listSchedules, createSchedule } from '$lib/server/schedules';

export const GET: RequestHandler = async ({ params }) => {
	const schedules = listSchedules(params.id);
	return json(schedules);
};

export const POST: RequestHandler = async ({ params, request }) => {
	const body = await request.json();
	const schedule = createSchedule(params.id, body);
	return json(schedule, { status: 201 });
};
