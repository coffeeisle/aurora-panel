import type { Handle } from '@sveltejs/kit';
import { lucia } from '$lib/server/auth';
import { startScheduler } from '$lib/server/scheduler';
import { createSocketServer } from '$lib/server/socket';
import { setIO } from '$lib/server/io';
import { hydrateDaemonsFromDb } from '$lib/server/daemon-client';

startScheduler();
hydrateDaemonsFromDb();

export function init() {
	(globalThis as any).__auroraSocketInit = () => {
		const io = createSocketServer();
		setIO(io);
		console.log('[Server] Socket.IO initialized');
	};
	console.log('[Server] Initialized');
}

export const handle: Handle = async ({ event, resolve }) => {
	const sessionId = event.cookies.get(lucia.sessionCookieName);
	if (!sessionId) {
		event.locals.user = null;
		event.locals.session = null;
		return resolve(event);
	}

	const { session, user } = await lucia.validateSession(sessionId);
	if (session && session.fresh) {
		const sessionCookie = lucia.createSessionCookie(session.id);
		event.cookies.set(sessionCookie.name, sessionCookie.value, {
			path: '.',
			...sessionCookie.attributes
		});
	}
	if (!session) {
		const sessionCookie = lucia.createBlankSessionCookie();
		event.cookies.set(sessionCookie.name, sessionCookie.value, {
			path: '.',
			...sessionCookie.attributes
		});
	}
	event.locals.user = user;
	event.locals.session = session;
	return resolve(event);
};
