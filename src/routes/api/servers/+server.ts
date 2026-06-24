import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { servers, serverPermissions } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';

const createSchema = z.object({
	name: z.string().trim().min(1, 'Name is required').max(64),
	game: z.string().min(1),
	type: z.enum(['minecraft', 'steamcmd', 'generic']).default('minecraft'),
	gameVersion: z.string().default('1.21.4'),
	loader: z.string().default(''),
	platform: z.string().default(''),
	nodeId: z.string().min(1),
	startupCommand: z.string().default('java -Xmx${MEMORY}M -jar server.jar nogui'),
	allocatedMemory: z.coerce.number().int().min(64).default(1024),
	allocatedDisk: z.coerce.number().int().min(128).default(10240),
	allocatedCpu: z.coerce.number().int().min(1).default(100),
	allocationPort: z.coerce.number().int().min(1).max(65535).default(25565),
	processType: z.enum(['docker', 'bare']).default('docker'),
	dockerImage: z.string().optional()
});

function mapServer(s: Record<string, unknown>) {
	return {
		id: s.id,
		name: s.name,
		slug: s.slug,
		type: s.type,
		game: s.game,
		gameVersion: s.gameVersion as string,
		loader: s.loader as string,
		platform: s.platform as string,
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

export const GET: RequestHandler = async () => {
	const items = db.select().from(servers).all();
	return json(items.map(mapServer));
};

export const POST: RequestHandler = async ({ request, locals }) => {
	const parsed = createSchema.safeParse(await request.json());
	if (!parsed.success) {
		return json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
	}

	const data = parsed.data;
	const userId = locals.user?.id;
	if (!userId) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const slug = `${data.name.toLowerCase().replace(/\s+/g, '-')}-${nanoid(4)}`;
	const now = new Date();
	const serverId = nanoid();

	const newServer = {
		id: serverId,
		name: data.name,
		slug,
		ownerId: userId,
		nodeId: data.nodeId,
		type: data.type,
		game: data.game,
		gameVersion: data.gameVersion,
		loader: data.loader,
		platform: data.platform,
		status: 'installing' as const,
		processType: data.processType,
		dockerImage: data.dockerImage || null,
		startupCommand: data.startupCommand,
		stopCommand: 'stop',
		allocatedMemory: data.allocatedMemory,
		allocatedCpus: String(data.allocatedCpu),
		allocatedDisk: data.allocatedDisk,
		allocationPort: data.allocationPort,
		allocationIp: '0.0.0.0',
		createdAt: now,
		updatedAt: now
	};

	db.insert(servers).values(newServer).run();

	db.insert(serverPermissions).values({
		id: nanoid(),
		serverId,
		userId,
		role: 'owner',
		createdAt: now
	}).run();

	const created = db.select().from(servers).where(eq(servers.id, serverId)).get();

	const srv = mapServer(created!);

	const io = (await import('$lib/server/io')).getIO();
	if (io) {
		const daemonSockets = io.sockets.sockets;
		for (const [, sock] of daemonSockets) {
			if (sock.handshake.auth.type === 'daemon') {
				sock.emit('server:create', {
					id: srv.id,
					name: srv.name,
					port: srv.port,
					status: srv.status,
					gameVersion: srv.gameVersion,
					loader: srv.loader,
					allocatedMemory: srv.allocatedMemory,
					allocatedDisk: srv.allocatedDisk,
					allocatedCpu: srv.allocatedCpu,
					processType: data.processType,
					dockerImage: data.dockerImage
				});
			}
		}
	}

	return json(srv, { status: 201 });
};
