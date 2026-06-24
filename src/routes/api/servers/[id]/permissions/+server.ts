import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { serverPermissions, users } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';

const createSchema = z.object({
	userId: z.string().min(1),
	role: z.enum(['admin', 'moderator', 'viewer'])
});

export const GET: RequestHandler = async ({ params }) => {
	const rows = db.select({
		id: serverPermissions.id,
		serverId: serverPermissions.serverId,
		userId: serverPermissions.userId,
		role: serverPermissions.role,
		createdAt: serverPermissions.createdAt,
		username: users.username,
		email: users.email
	}).from(serverPermissions)
		.innerJoin(users, eq(serverPermissions.userId, users.id))
		.where(eq(serverPermissions.serverId, params.id))
		.all();

	return json(rows);
};

export const POST: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	const parsed = createSchema.safeParse(await request.json());
	if (!parsed.success) {
		return json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
	}

	const { userId, role } = parsed.data;

	const existing = db.select().from(serverPermissions)
		.where(and(eq(serverPermissions.serverId, params.id), eq(serverPermissions.userId, userId)))
		.get();

	if (existing) {
		db.update(serverPermissions)
			.set({ role })
			.where(eq(serverPermissions.id, existing.id))
			.run();
		return json({ success: true, updated: true });
	}

	db.insert(serverPermissions).values({
		id: nanoid(),
		serverId: params.id,
		userId,
		role,
		createdAt: new Date()
	}).run();

	return json({ success: true, created: true }, { status: 201 });
};

export const DELETE: RequestHandler = async ({ params, url, locals }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	const permissionId = url.searchParams.get('id');
	if (!permissionId) return json({ error: 'Missing permission id' }, { status: 400 });

	db.delete(serverPermissions)
		.where(eq(serverPermissions.id, permissionId))
		.run();

	return json({ success: true });
};
