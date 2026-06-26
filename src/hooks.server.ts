import type { Handle } from '@sveltejs/kit';
import type { Server as HttpServer } from 'node:http';
import { lucia } from '$lib/server/auth';
import { startScheduler } from '$lib/server/scheduler';
import { createSocketServer } from '$lib/server/socket';
import { setIO } from '$lib/server/io';

startScheduler();

let ioInitialized = false;

export function init({ server }: { server: HttpServer }) {
	if (ioInitialized) return;
	ioInitialized = true;
	const io = createSocketServer(server);
	setIO(io);
	console.log('[Server] Socket.IO initialized on /ws');
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
