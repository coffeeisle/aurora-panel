import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { lucia } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const POST: RequestHandler = async ({ request, cookies }) => {
	const { email, password } = await request.json();

	if (!email || !password) {
		return json({ error: 'Email and password are required' }, { status: 400 });
	}

	const user = db.select().from(users).where(eq(users.email, email)).get();
	if (!user || !user.passwordHash) {
		return json({ error: 'Invalid email or password' }, { status: 401 });
	}

	const passwordHash = user.passwordHash;
	const bcrypt = await import('bcryptjs');
	const valid = await bcrypt.compare(password, passwordHash);
	if (!valid) {
		return json({ error: 'Invalid email or password' }, { status: 401 });
	}

	const session = await lucia.createSession(user.id, {});
	const sessionCookie = lucia.createSessionCookie(session.id);
	cookies.set(sessionCookie.name, sessionCookie.value, {
		path: '.',
		...sessionCookie.attributes
	});

	return json({ success: true, user: { id: user.id, username: user.username, email: user.email, role: user.role } });
};
