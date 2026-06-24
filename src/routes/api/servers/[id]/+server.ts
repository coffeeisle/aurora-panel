import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { servers, serverPermissions, backups, schedules, installedMods } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

function mapServer(s: Record<string, unknown>) {
	return {
		id: s.id,
		name: s.name,
		slug: s.slug,
		type: s.type,
		game: s.game,
		gameVersion: s.gameVersion,
		loader: s.loader,
		platform: s.platform,
		status: s.status,
		nodeName: s.nodeId,
		allocatedMemory: s.allocatedMemory,
		allocatedDisk: s.allocatedDisk,
		allocatedCpu: parseInt(s.allocatedCpus as string || '100'),
		port: s.allocationPort,
		ownerId: s.ownerId,
		startupCommand: s.startupCommand,
		processType: s.processType,
		dockerImage: s.dockerImage,
		createdAt: s.createdAt,
		updatedAt: s.updatedAt
	};
}

export const GET: RequestHandler = async ({ params }) => {
	const server = db.select().from(servers).where(eq(servers.id, params.id)).get();
	if (!server) {
		return json({ error: 'Server not found' }, { status: 404 });
	}
	return json(mapServer(server));
};

export const PATCH: RequestHandler = async ({ params, request }) => {
	const existing = db.select().from(servers).where(eq(servers.id, params.id)).get();
	if (!existing) {
		return json({ error: 'Server not found' }, { status: 404 });
	}

	const body = await request.json();
	const updateData: Record<string, unknown> = { updatedAt: new Date() };

	if (body.name !== undefined) updateData.name = body.name;
	if (body.allocatedMemory !== undefined) updateData.allocatedMemory = body.allocatedMemory;
	if (body.allocatedDisk !== undefined) updateData.allocatedDisk = body.allocatedDisk;
	if (body.allocatedCpu !== undefined) updateData.allocatedCpus = String(body.allocatedCpu);
	if (body.allocationPort !== undefined) updateData.allocationPort = body.allocationPort;
	if (body.gameVersion !== undefined) updateData.gameVersion = body.gameVersion;
	if (body.loader !== undefined) updateData.loader = body.loader;
	if (body.platform !== undefined) updateData.platform = body.platform;
	if (body.startupCommand !== undefined) updateData.startupCommand = body.startupCommand;
	if (body.status !== undefined) updateData.status = body.status;

	db.update(servers).set(updateData).where(eq(servers.id, params.id)).run();
	const updated = db.select().from(servers).where(eq(servers.id, params.id)).get();

	return json({ success: true, server: mapServer(updated!) });
};

export const DELETE: RequestHandler = async ({ params }) => {
	const existing = db.select().from(servers).where(eq(servers.id, params.id)).get();
	if (!existing) {
		return json({ error: 'Server not found' }, { status: 404 });
	}

	db.delete(installedMods).where(eq(installedMods.serverId, params.id)).run();
	db.delete(schedules).where(eq(schedules.serverId, params.id)).run();
	db.delete(backups).where(eq(backups.serverId, params.id)).run();
	db.delete(serverPermissions).where(eq(serverPermissions.serverId, params.id)).run();
	db.delete(servers).where(eq(servers.id, params.id)).run();

	return json({ success: true });
};
