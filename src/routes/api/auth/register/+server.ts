import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { lucia } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { z } from 'zod';

const registerSchema = z.object({
	username: z.string().trim().min(3, 'Username must be at least 3 characters').max(32),
	email: z.string().email('Invalid email'),
	password: z.string().min(6, 'Password must be at least 6 characters')
});

export const POST: RequestHandler = async ({ request, cookies }) => {
	const parsed = registerSchema.safeParse(await request.json());
	if (!parsed.success) {
		return json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
	}

	const { username, email, password } = parsed.data;

	const existingUser = db.select().from(users).where(eq(users.username, username)).get();
	if (existingUser) {
		return json({ error: 'Username already taken' }, { status: 409 });
	}

	const existingEmail = db.select().from(users).where(eq(users.email, email)).get();
	if (existingEmail) {
		return json({ error: 'Email already registered' }, { status: 409 });
	}

	const passwordHash = bcrypt.hashSync(password, 10);
	const now = new Date();
	const userId = nanoid();

	db.insert(users).values({
		id: userId,
		username,
		email,
		passwordHash,
		role: 'user',
		createdAt: now,
		updatedAt: now
	}).run();

	const session = await lucia.createSession(userId, {});
	const sessionCookie = lucia.createSessionCookie(session.id);
	cookies.set(sessionCookie.name, sessionCookie.value, {
		path: '.',
		...sessionCookie.attributes
	});

	return json({
		success: true,
		user: { id: userId, username, email, role: 'user' }
	});
};
