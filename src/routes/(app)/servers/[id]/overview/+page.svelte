<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import type { Server as ServerType } from '$lib/types/server';
	import { toasts } from '$lib/stores/toast';
	import * as Card from '$lib/components/ui/card';
	import {
		Activity, Server as ServerIcon, HardDrive, MemoryStick, Wifi,
		Play, Square, RotateCcw, Circle, Loader2
	} from '@lucide/svelte';
	import { formatBytes } from '$lib/utils/utils';
	import { io, type Socket } from 'socket.io-client';

	let socket: Socket | null = null;
	let connected = $state(false);
	let serverStatus = $state<string>('stopped');
	let server = $state<ServerType | null>(null);
	let loading = $state(true);

	const serverId = $derived($page.params.id);

	onMount(() => {
		fetch(`/api/servers/${serverId}`)
			.then(async (res) => {
				if (!res.ok) throw new Error('Failed to load server');
				const srv: ServerType = await res.json();
				server = srv;
				serverStatus = srv.status === 'installed' ? 'running' : 'stopped';
			})
			.catch((e) => {
				toasts.error('Failed to load server', e instanceof Error ? e.message : 'Unknown error');
			})
			.finally(() => {
				loading = false;
			});

		socket = io({
			path: '/ws',
			auth: { token: 'dev-token', type: 'dev' },
			transports: ['websocket', 'polling']
		});

		socket.on('connect', () => {
			connected = true;
		});

		socket.on('server:status', (data: { id: string; status: string }) => {
			if (data.id === serverId) {
				serverStatus = data.status;
			}
		});

		return () => {
			socket?.disconnect();
			socket = null;
		};
	});

	function startServer() {
		socket?.emit('server:start', serverId);
		serverStatus = 'starting';
		toasts.info('Starting server', `${server?.name || serverId} is starting...`);
	}

	function stopServer() {
		socket?.emit('server:stop', serverId);
		serverStatus = 'stopping';
		toasts.info('Stopping server', `${server?.name || serverId} is stopping...`);
	}

	function restartServer() {
		socket?.emit('server:restart', serverId);
		serverStatus = 'restarting';
		toasts.info('Restarting server', `${server?.name || serverId} is restarting...`);
	}

	const isRunning = $derived(serverStatus === 'running');
	const isBusy = $derived(serverStatus === 'starting' || serverStatus === 'stopping' || serverStatus === 'restarting');

	const statusLabel = $derived(
		serverStatus === 'running' ? 'Online' :
		serverStatus === 'starting' ? 'Starting...' :
		serverStatus === 'stopping' ? 'Stopping...' :
		serverStatus === 'restarting' ? 'Restarting...' :
		serverStatus === 'stopped' ? 'Offline' : serverStatus
	);

	const statusColor = $derived(
		serverStatus === 'running' ? 'text-green-500' :
		serverStatus === 'starting' || serverStatus === 'restarting' ? 'text-blue-500' :
		serverStatus === 'stopping' ? 'text-yellow-500' :
		'text-red-500'
	);
</script>

{#if loading}
	<div class="flex items-center justify-center py-20">
		<Loader2 class="h-6 w-6 animate-spin text-muted-foreground" />
	</div>
{:else if !server}
	<div class="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
		Server not found.
	</div>
{:else}
	<div class="space-y-6">
		<div class="flex items-center justify-between rounded-lg border border-border bg-card p-4">
			<div class="flex items-center gap-3">
				<Circle class="h-3 w-3 {statusColor} fill-current {isBusy ? 'animate-pulse' : ''}" />
				<div>
					<span class="text-sm font-semibold text-foreground">{server.name}</span>
					<p class="text-xs text-muted-foreground">{statusLabel}</p>
				</div>
			</div>
			<div class="flex items-center gap-2">
				<button
					class="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
					disabled={isRunning || isBusy}
					onclick={startServer}
				>
					{#if serverStatus === 'starting'}
						<Loader2 class="h-3.5 w-3.5 animate-spin" />
					{:else}
						<Play class="h-3.5 w-3.5" />
					{/if}
					Start
				</button>
				<button
					class="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
					disabled={!isRunning || isBusy}
					onclick={restartServer}
				>
					{#if serverStatus === 'restarting'}
						<Loader2 class="h-3.5 w-3.5 animate-spin" />
					{:else}
						<RotateCcw class="h-3.5 w-3.5" />
					{/if}
					Restart
				</button>
				<button
					class="flex items-center gap-1.5 rounded-md border border-red-400/30 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
					disabled={!isRunning || isBusy}
					onclick={stopServer}
				>
					{#if serverStatus === 'stopping'}
						<Loader2 class="h-3.5 w-3.5 animate-spin" />
					{:else}
						<Square class="h-3.5 w-3.5" />
					{/if}
					Stop
				</button>
			</div>
		</div>

		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<Card.Root>
				<div class="flex items-center gap-4 p-4">
					<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
						<MemoryStick class="h-5 w-5 text-primary" />
					</div>
					<div>
						<p class="text-xs text-muted-foreground">Memory</p>
						<p class="text-xl font-bold text-foreground">{server.allocatedMemory} MB</p>
					</div>
				</div>
			</Card.Root>
			<Card.Root>
				<div class="flex items-center gap-4 p-4">
					<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
						<HardDrive class="h-5 w-5 text-primary" />
					</div>
					<div>
						<p class="text-xs text-muted-foreground">Disk</p>
						<p class="text-xl font-bold text-foreground">{formatBytes(server.allocatedDisk * 1024 * 1024)}</p>
					</div>
				</div>
			</Card.Root>
			<Card.Root>
				<div class="flex items-center gap-4 p-4">
					<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
						<Activity class="h-5 w-5 text-primary" />
					</div>
					<div>
						<p class="text-xs text-muted-foreground">CPU</p>
						<p class="text-xl font-bold text-foreground">{server.allocatedCpu}%</p>
					</div>
				</div>
			</Card.Root>
			<Card.Root>
				<div class="flex items-center gap-4 p-4">
					<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
						<Wifi class="h-5 w-5 text-primary" />
					</div>
					<div>
						<p class="text-xs text-muted-foreground">Port</p>
						<p class="text-xl font-bold text-foreground">{server.port}</p>
					</div>
				</div>
			</Card.Root>
		</div>

		<Card.Root>
			<div class="p-6 space-y-4">
				<h3 class="text-lg font-semibold text-foreground">Server Details</h3>
				<div class="grid grid-cols-2 gap-4 text-sm">
					<div>
						<span class="text-muted-foreground">Type</span>
						<p class="font-medium text-foreground capitalize">{server.type}</p>
					</div>
					<div>
						<span class="text-muted-foreground">Game</span>
						<p class="font-medium text-foreground">{server.game} {server.gameVersion}</p>
					</div>
					<div>
						<span class="text-muted-foreground">Platform</span>
						<p class="font-medium text-foreground">{server.platform || 'N/A'}</p>
					</div>
					<div>
						<span class="text-muted-foreground">Node</span>
						<p class="font-medium text-foreground">{server.nodeName}</p>
					</div>
				</div>
			</div>
		</Card.Root>
	</div>
{/if}
