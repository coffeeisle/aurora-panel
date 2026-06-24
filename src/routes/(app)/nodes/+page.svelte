<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { daemonStore, type DaemonStatus } from '$lib/stores/daemon';
	import { io, type Socket } from 'socket.io-client';
	import { toasts } from '$lib/stores/toast';
	import { HardDrive, Wifi, WifiOff, Server, Cpu, MemoryStick, HardDrive as DiskIcon, Activity, Plus } from 'lucide-svelte';

	let socket: Socket | null = null;
	let showRegisterForm = $state(false);
	let newHost = $state('');
	let newPort = $state('8443');
	let newId = $state('');
	let registering = $state(false);

	onMount(() => {
		socket = io({
			path: '/ws',
			auth: { token: 'dev-token', type: 'dev' },
			transports: ['websocket', 'polling']
		});

		socket.on('daemon:registered', (data: {
			id: string; name?: string; host?: string; port?: number;
			cpu?: { load: number; cores: number };
			memory?: { total: number; used: number };
			disk?: { total: number; used: number };
			uptime?: number; version?: string;
			servers?: { id: string; name: string; status: string }[];
		}) => {
			daemonStore.registerDaemon({
				id: data.id,
				name: data.name,
				host: data.host,
				port: data.port,
				cpu: data.cpu,
				memory: data.memory,
				disk: data.disk,
				uptime: data.uptime,
				version: data.version
			});
			if (data.servers) {
				daemonStore.registerServers(data.id, data.servers);
			}
			toasts.success('Node connected', `${data.name || data.id} registered`);
		});

		socket.on('daemon:disconnected', (data: { id: string }) => {
			daemonStore.disconnectDaemon(data.id);
			toasts.warning('Node disconnected', `${data.id} went offline`);
		});

		socket.on('server:status:global', (data: { id: string; status: string }) => {
			daemonStore.updateServerStatus(data.id, data.status);
		});

		return () => {
			socket?.disconnect();
		};
	});

	async function registerNode() {
		if (!newId.trim() || !newHost.trim()) {
			toasts.error('Validation', 'Host and ID are required');
			return;
		}
		registering = true;
		try {
			const res = await fetch('/api/nodes/register', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					id: newId.trim(),
					host: newHost.trim(),
					port: parseInt(newPort, 10) || 8443
				})
			});
			if (!res.ok) throw new Error('Registration failed');
			const data = await res.json();
			toasts.success('Node registered', data.message || `${newId} added`);
			showRegisterForm = false;
			newId = '';
			newHost = '';
			newPort = '8443';
		} catch (e) {
			toasts.error('Registration failed', e instanceof Error ? e.message : 'Unknown error');
		} finally {
			registering = false;
		}
	}

	function formatBytes(bytes: number): string {
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), sizes.length - 1);
		return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
	}

	function formatUptime(seconds: number): string {
		const d = Math.floor(seconds / 86400);
		const h = Math.floor((seconds % 86400) / 3600);
		const m = Math.floor((seconds % 3600) / 60);
		const parts: string[] = [];
		if (d > 0) parts.push(`${d}d`);
		if (h > 0) parts.push(`${h}h`);
		if (m > 0) parts.push(`${m}m`);
		return parts.join(' ') || '<1m';
	}

	function statusColor(status: string): string {
		switch (status) {
			case 'running': return 'text-green-400';
			case 'starting':
			case 'restarting': return 'text-blue-400 animate-pulse';
			case 'stopped':
			case 'error': return 'text-red-400';
			default: return 'text-muted-foreground';
		}
	}

	const daemons = $derived(Array.from($daemonStore.values()).sort((a, b) => a.id.localeCompare(b.id)));
</script>

<div class="flex h-full flex-col">
	<div class="flex items-center justify-between mb-4">
		<div>
			<h1 class="text-lg font-bold text-foreground">Nodes</h1>
			<p class="text-xs text-muted-foreground mt-0.5">Manage connected daemon nodes</p>
		</div>
		<button
			class="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
			onclick={() => showRegisterForm = !showRegisterForm}
		>
			<Plus class="h-3.5 w-3.5" />
			Register Node
		</button>
	</div>

	{#if showRegisterForm}
		<div class="mb-4 rounded-lg border border-border bg-card p-4">
			<h3 class="text-sm font-semibold text-foreground mb-3">Register New Node</h3>
			<div class="flex flex-wrap items-end gap-3">
				<div class="flex-1 min-w-[150px]">
					<label class="mb-1 block text-xs text-muted-foreground">Node ID</label>
					<input
						bind:value={newId}
						placeholder="node-02"
						class="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
					/>
				</div>
				<div class="flex-1 min-w-[150px]">
					<label class="mb-1 block text-xs text-muted-foreground">Host</label>
					<input
						bind:value={newHost}
						placeholder="192.168.1.100"
						class="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
					/>
				</div>
				<div class="w-20">
					<label class="mb-1 block text-xs text-muted-foreground">Port</label>
					<input
						bind:value={newPort}
						placeholder="8443"
						class="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
					/>
				</div>
				<div class="flex gap-2">
					<button
						class="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
						disabled={registering}
						onclick={registerNode}
					>
						{registering ? 'Registering...' : 'Register'}
					</button>
					<button
						class="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
						onclick={() => showRegisterForm = false}
					>
						Cancel
					</button>
				</div>
			</div>
		</div>
	{/if}

	<div class="flex-1 overflow-y-auto space-y-3">
		{#if daemons.length === 0}
			<div class="flex flex-col items-center justify-center py-12 text-sm text-muted-foreground">
				<HardDrive class="mb-2 h-8 w-8 opacity-40" />
				<p>No nodes connected</p>
				<p class="text-xs mt-1">Start a daemon or register a remote node to get started.</p>
			</div>
		{:else}
			{#each daemons as node (node.id)}
				<div class="rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent/30">
					<div class="flex items-start justify-between mb-3">
						<div class="flex items-center gap-3">
							<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
								<HardDrive class="h-5 w-5 text-muted-foreground" />
							</div>
							<div>
								<h3 class="text-sm font-semibold text-foreground">{node.name}</h3>
								<p class="text-xs text-muted-foreground font-mono">{node.id} · {node.host}:{node.port}</p>
							</div>
						</div>
						<div class="flex items-center gap-2">
							<span class="flex items-center gap-1 text-xs {node.connected ? 'text-green-400' : 'text-red-400'}">
								{#if node.connected}
									<Wifi class="h-3 w-3" />
									Online
								{:else}
									<WifiOff class="h-3 w-3" />
									Offline
								{/if}
							</span>
							<span class="text-xs text-muted-foreground">v{node.version}</span>
						</div>
					</div>

					<div class="grid grid-cols-4 gap-3 mb-3">
						<div class="rounded-md bg-muted/50 p-2.5">
							<div class="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
								<Cpu class="h-3 w-3" />
								CPU
							</div>
							<p class="text-sm font-semibold text-foreground">{node.cpu.load.toFixed(0)}%</p>
							<p class="text-xs text-muted-foreground">{node.cpu.cores} cores</p>
						</div>
						<div class="rounded-md bg-muted/50 p-2.5">
							<div class="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
								<MemoryStick class="h-3 w-3" />
								Memory
							</div>
							<p class="text-sm font-semibold text-foreground">{formatBytes(node.memory.used)} / {formatBytes(node.memory.total)}</p>
							<div class="mt-1 h-1.5 w-full rounded-full bg-muted overflow-hidden">
								<div
									class="h-full rounded-full transition-all {node.memory.total > 0 ? (node.memory.used / node.memory.total * 100 > 80 ? 'bg-red-400' : node.memory.used / node.memory.total * 100 > 50 ? 'bg-yellow-400' : 'bg-green-400') : 'bg-green-400'}"
									style="width: {node.memory.total > 0 ? (node.memory.used / node.memory.total * 100) : 0}%"
								></div>
							</div>
						</div>
						<div class="rounded-md bg-muted/50 p-2.5">
							<div class="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
								<DiskIcon class="h-3 w-3" />
								Disk
							</div>
							<p class="text-sm font-semibold text-foreground">{formatBytes(node.disk.used)} / {formatBytes(node.disk.total)}</p>
							<div class="mt-1 h-1.5 w-full rounded-full bg-muted overflow-hidden">
								<div
									class="h-full rounded-full transition-all {node.disk.total > 0 ? (node.disk.used / node.disk.total * 100 > 80 ? 'bg-red-400' : node.disk.used / node.disk.total * 100 > 50 ? 'bg-yellow-400' : 'bg-green-400') : 'bg-green-400'}"
									style="width: {node.disk.total > 0 ? (node.disk.used / node.disk.total * 100) : 0}%"
								></div>
							</div>
						</div>
						<div class="rounded-md bg-muted/50 p-2.5">
							<div class="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
								<Activity class="h-3 w-3" />
								Uptime
							</div>
							<p class="text-sm font-semibold text-foreground">{formatUptime(node.uptime)}</p>
							<p class="text-xs text-muted-foreground">{node.servers.length} servers</p>
						</div>
					</div>

					{#if node.servers.length > 0}
						<div class="border-t border-border pt-2">
							<p class="text-xs text-muted-foreground mb-1.5">Connected Servers</p>
							<div class="flex flex-wrap gap-1.5">
								{#each node.servers as srv}
									<a
										href="/servers/{srv.id}/overview"
										class="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs {statusColor(srv.status)} hover:bg-accent transition-colors"
									>
										<Server class="h-3 w-3" />
										{srv.name}
									</a>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			{/each}
		{/if}
	</div>
</div>
