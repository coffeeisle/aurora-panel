import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	if (!event.locals.user) redirect(302, '/login');
	if (event.locals.user.role !== 'admin') redirect(302, '/dashboard');
	return { user: event.locals.user };
};
