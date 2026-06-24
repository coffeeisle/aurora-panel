import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

export const GET: RequestHandler = async () => {
	const allUsers = db.select({
		id: users.id,
		username: users.username,
		email: users.email,
		role: users.role,
		createdAt: users.createdAt
	}).from(users).all();
	return json(allUsers);
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { username, email, password, role } = await request.json();
		if (!username || !email || !password) {
			return json({ error: 'Username, email, and password are required' }, { status: 400 });
		}
		const existing = db.select({ id: users.id }).from(users).where(
			eq(users.username, username)
		).get();
		if (existing) {
			return json({ error: 'Username already taken' }, { status: 409 });
		}
		const passwordHash = await bcrypt.hash(password, 10);
		const id = crypto.randomUUID();
		const now = new Date();
		db.insert(users).values({
			id,
			username,
			email,
			passwordHash,
			role: role || 'user',
			createdAt: now,
			updatedAt: now
		}).run();
		return json({ id, username, email, role: role || 'user' }, { status: 201 });
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : 'Failed to create user' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ url }) => {
	try {
		const id = url.searchParams.get('id');
		if (!id) {
			return json({ error: 'User id is required' }, { status: 400 });
		}
		db.delete(users).where(eq(users.id, id)).run();
		return json({ success: true });
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : 'Failed to delete user' }, { status: 500 });
	}
};

export const PATCH: RequestHandler = async ({ request, url }) => {
	try {
		const id = url.searchParams.get('id');
		if (!id) {
			return json({ error: 'User id is required' }, { status: 400 });
		}
		const { role } = await request.json();
		if (!role || !['admin', 'user'].includes(role)) {
			return json({ error: 'Role must be admin or user' }, { status: 400 });
		}
		db.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, id)).run();
		return json({ success: true });
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : 'Failed to update user' }, { status: 500 });
	}
};
