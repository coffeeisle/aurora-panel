<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import { io, type Socket } from 'socket.io-client';
	import Terminal from '$lib/components/console/Terminal.svelte';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import { Send, Play, Square, RotateCcw, Trash2, Loader2 } from 'lucide-svelte';

	let socket: Socket | null = null;
	let lines = $state<string[]>([]);
	let command = $state('');
	let connected = $state(false);
	let serverStatus = $state<'running' | 'stopped' | 'starting' | 'stopping' | 'restarting'>('running');

	const serverId = $derived($page.params.id);

	const isRunning = $derived(serverStatus === 'running');
	const isBusy = $derived(serverStatus === 'starting' || serverStatus === 'stopping' || serverStatus === 'restarting');

	onMount(() => {
		socket = io({
			path: '/ws',
			auth: { token: 'dev-token', type: 'dev' },
			transports: ['websocket', 'polling']
		});

		socket.on('connect', () => {
			connected = true;
			socket?.emit('console:subscribe', serverId);
		});

		socket.on('console:history', (history: string[]) => {
			lines = history;
		});

		socket.on('console:output', ({ line }: { line: string }) => {
			lines = [...lines, line];
		});

		socket.on('server:status', (data: { id: string; status: string }) => {
			if (data.id === serverId) {
				serverStatus = data.status as typeof serverStatus;
				if (data.status === 'running') lines = [...lines, '[INFO] Server is online'];
				else if (data.status === 'stopped') lines = [...lines, '[WARN] Server is offline'];
			}
		});

		socket.on('connect_error', (err) => {
			console.error('Socket connection error:', err.message);
			lines = [...lines, `[ERROR] Connection failed: ${err.message}`];
		});

		return () => {
			socket?.disconnect();
			socket = null;
		};
	});

	function sendCommand() {
		if (!command.trim() || !socket || !connected) return;
		socket.emit('console:command', { serverId, command: command.trim() });
		command = '';
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') sendCommand();
	}

	function clearConsole() {
		lines = [];
	}

	function startServer() {
		serverStatus = 'starting';
		lines = [...lines, '[INFO] Server starting...'];
		socket?.emit('server:start', serverId);
	}

	function stopServer() {
		serverStatus = 'stopping';
		lines = [...lines, '[WARN] Stopping server...'];
		socket?.emit('server:stop', serverId);
	}

	function restartServer() {
		serverStatus = 'restarting';
		lines = [...lines, '[INFO] Server restarting...'];
		socket?.emit('server:restart', serverId);
	}
</script>

<div class="flex h-full flex-col">
	<div class="flex items-center justify-between mb-4">
		<h1 class="text-lg font-bold text-foreground">Console</h1>
		<div class="flex items-center gap-2">
			<Button variant="outline" size="sm" onclick={startServer} disabled={isRunning || isBusy}>
				{#if serverStatus === 'starting'}
					<Loader2 class="mr-1 h-3.5 w-3.5 animate-spin" />
				{:else}
					<Play class="mr-1 h-3.5 w-3.5" />
				{/if}
				Start
			</Button>
			<Button variant="outline" size="sm" onclick={restartServer} disabled={!isRunning || isBusy}>
				{#if serverStatus === 'restarting'}
					<Loader2 class="mr-1 h-3.5 w-3.5 animate-spin" />
				{:else}
					<RotateCcw class="mr-1 h-3.5 w-3.5" />
				{/if}
				Restart
			</Button>
			<Button variant="destructive" size="sm" onclick={stopServer} disabled={!isRunning || isBusy}>
				{#if serverStatus === 'stopping'}
					<Loader2 class="mr-1 h-3.5 w-3.5 animate-spin" />
				{:else}
					<Square class="mr-1 h-3.5 w-3.5" />
				{/if}
				Stop
			</Button>
			<Button variant="ghost" size="sm" onclick={clearConsole}>
				<Trash2 class="mr-1 h-3.5 w-3.5" />
				Clear
			</Button>
		</div>
	</div>

	<div class="flex-1 rounded-lg border border-border overflow-hidden flex flex-col">
		<Terminal {lines} class="flex-1" />

		<div class="flex items-center gap-2 border-t border-border bg-muted/30 px-3 py-2">
			<span class="text-xs font-mono text-muted-foreground">&gt;</span>
			<Input
				bind:value={command}
				placeholder={connected ? 'Enter command...' : 'Connecting...'}
				disabled={!connected}
				onkeydown={handleKeydown}
				class="flex-1 border-0 bg-transparent font-mono text-sm shadow-none focus-visible:ring-0"
			/>
			<Button size="sm" onclick={sendCommand} disabled={!connected || !command.trim()}>
				<Send class="h-3.5 w-3.5" />
			</Button>
		</div>
	</div>

	{#if !connected}
		<div class="mt-2 flex items-center gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-500">
			<div class="h-2 w-2 animate-pulse rounded-full bg-yellow-500"></div>
			Connecting to console server...
		</div>
	{/if}
</div>
