<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { daemonStore, type DaemonStatus } from '$lib/stores/daemon';
	import { toasts } from '$lib/stores/toast';
	import { io, type Socket } from 'socket.io-client';
	import {
		HardDrive, Server, Cpu, MemoryStick, Activity, Plus,
		Trash2, Edit, Circle, Check, Loader2
	} from '@lucide/svelte';

	type DbNode = { id: string; name: string; host: string; port: number; status: string };

	let loading = $state(true);
	let socket: Socket | null = null;
	let dbNodes = $state<DbNode[]>([]);

	let showForm = $state(false);
	let formId = $state<string | null>(null);
	let formName = $state('');
	let formHost = $state('');
	let formPort = $state('8443');
	let formError = $state('');
	let saving = $state(false);

	onMount(async () => {
		await loadNodes();
		loading = false;
		connectSocket();
	});

	onDestroy(() => {
		socket?.close();
	});

	function connectSocket() {
		try {
			socket = io(`${location.protocol}//${location.hostname}:3001`, {
				path: '/ws',
				auth: { type: 'browser', token: '' },
			});
			socket.on('daemon:registered', (data: { id: string; name?: string; host?: string; port?: number }) => {
				daemonStore.registerDaemon(data);
			});
			socket.on('daemon:stats', (data: { id: string; cpu?: { load: number; cores: number }; memory?: { total: number; used: number }; disk?: { total: number; used: number }; uptime?: number; version?: string }) => {
				daemonStore.updateStats(data.id, { cpu: data.cpu, memory: data.memory, disk: data.disk, uptime: data.uptime });
			});
			socket.on('daemon:disconnected', (data: { id: string }) => {
				daemonStore.disconnectDaemon(data.id);
			});
		} catch { /* socket will reconnect */ }
	}

	const daemons = $derived(Array.from($daemonStore.values()).sort((a, b) => a.id.localeCompare(b.id)));

	const visibleNodes = $derived.by(() => {
		const ids = new Set<string>();
		const all: (DaemonStatus | DbNode)[] = [];
		for (const d of daemons) { all.push(d); ids.add(d.id); }
		for (const n of dbNodes) if (!ids.has(n.id)) all.push(n);
		return all.sort((a, b) => a.id.localeCompare(b.id));
	});

	function isOnline(n: DaemonStatus | DbNode): boolean {
		return 'connected' in n ? n.connected : n.status === 'online';
	}

	function nodeHost(n: DaemonStatus | DbNode): string { return n.host; }
	function nodePort(n: DaemonStatus | DbNode): number { return n.port; }
	function nodeVersion(n: DaemonStatus | DbNode): string { return 'version' in n ? n.version : '-'; }
	function nodeUptime(n: DaemonStatus | DbNode): number { return 'uptime' in n ? n.uptime : 0; }
	function nodeServers(n: DaemonStatus | DbNode) { return 'servers' in n ? n.servers : []; }
	function nodeCpu(n: DaemonStatus | DbNode) { return 'cpu' in n ? n.cpu : { load: 0, cores: 0 }; }
	function nodeMemory(n: DaemonStatus | DbNode) { return 'memory' in n ? n.memory : { total: 0, used: 0 }; }
	function nodeDisk(n: DaemonStatus | DbNode) { return 'disk' in n ? n.disk : { total: 0, used: 0 }; }

	function isRegistered(id: string): boolean {
		return dbNodes.some(n => n.id === id);
	}

	async function loadNodes() {
		try {
			const res = await fetch('/api/nodes');
			if (res.ok) dbNodes = await res.json();
		} catch {
			toasts.error('Failed to load nodes');
		}
	}

	function openForm(node?: DaemonStatus) {
		if (node) {
			formId = node.id;
			formName = node.name;
			formHost = node.host;
			formPort = String(node.port);
		} else {
			formId = null;
			formName = '';
			formHost = '';
			formPort = '8443';
		}
		formError = '';
		showForm = true;
	}

	async function saveNode() {
		formError = '';
		const name = formName.trim();
		const host = formHost.trim();
		const port = parseInt(formPort, 10);
		if (!name) { formError = 'Name is required'; return; }
		if (!host) { formError = 'Host/IP is required'; return; }
		if (!port || port < 1 || port > 65535) { formError = 'Port must be 1-65535'; return; }

		saving = true;
		try {
			const id = formId || name.toLowerCase().replace(/\s+/g, '-');
			const res = await fetch('/api/nodes/register', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id, name, host, port }),
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data.error || `Registration failed (${res.status})`);
			toasts.success('Node saved', `${name} registered`);
			await loadNodes();
			showForm = false;
		} catch (e) {
			formError = e instanceof Error ? e.message : 'Unknown error';
		} finally {
			saving = false;
		}
	}

	async function removeNode(id: string) {
		if (!confirm(`Remove "${id}"?`)) return;
		try {
			const res = await fetch(`/api/nodes?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
			if (!res.ok) throw new Error(`Removal failed (${res.status})`);
			daemonStore.disconnectDaemon(id);
			await loadNodes();
			toasts.success('Node removed', id);
		} catch (e) {
			toasts.error('Failed to remove node', e instanceof Error ? e.message : '');
		}
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

	function formatBytes(bytes: number): string {
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.min(Math.floor(Math.log(Math.max(bytes, 1)) / Math.log(1024)), sizes.length - 1);
		return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
	}
</script>

<div class="flex h-full flex-col">
	<div class="flex items-center justify-between mb-4">
		<div>
			<h1 class="text-lg font-bold text-foreground">Nodes</h1>
			<p class="text-xs text-muted-foreground mt-0.5">Manage connected daemon nodes</p>
		</div>
		<button
			class="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
			onclick={() => openForm()}
		>
			<Plus class="h-3.5 w-3.5" />
			Add Node
		</button>
	</div>

	{#if showForm}
		<div class="mb-4 rounded-lg border border-border bg-card p-4">
			<h3 class="text-sm font-semibold text-foreground mb-3">{formId ? 'Edit Node' : 'Add Node'}</h3>
			<div class="space-y-3">
				<div>
					<label for="f-name" class="mb-1 block text-xs text-muted-foreground">Name</label>
					<input id="f-name" bind:value={formName} placeholder="My Server Node"
						class="w-full rounded-md border bg-background px-3 py-1.5 text-xs text-foreground outline-none focus:ring-1 border-border focus:border-primary focus:ring-primary"
					/>
				</div>
				<div class="flex gap-3">
					<div class="flex-1">
						<label for="f-host" class="mb-1 block text-xs text-muted-foreground">Host / IP</label>
						<input id="f-host" bind:value={formHost} placeholder="192.168.1.100"
							class="w-full rounded-md border bg-background px-3 py-1.5 text-xs text-foreground outline-none focus:ring-1 border-border focus:border-primary focus:ring-primary"
						/>
					</div>
					<div class="w-24">
						<label for="f-port" class="mb-1 block text-xs text-muted-foreground">Port</label>
						<input id="f-port" bind:value={formPort} placeholder="8443"
							class="w-full rounded-md border bg-background px-3 py-1.5 text-xs text-foreground outline-none focus:ring-1 border-border focus:border-primary focus:ring-primary"
						/>
					</div>
				</div>
				{#if formError}
					<p class="text-xs text-red-400">{formError}</p>
				{/if}
				<div class="flex gap-2">
					<button
						class="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
						disabled={saving} onclick={saveNode}
					>{saving ? 'Saving...' : formId ? 'Update' : 'Add'}</button>
					<button
						class="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
						onclick={() => showForm = false}
					>Cancel</button>
				</div>
			</div>
		</div>
	{/if}

	<div class="flex-1 overflow-y-auto space-y-3">
		{#if loading}
			<div class="flex items-center justify-center py-16 text-sm text-muted-foreground">
				<Loader2 class="mr-2 h-4 w-4 animate-spin" />
				Loading nodes...
			</div>
		{:else if visibleNodes.length === 0}
			<div class="flex flex-col items-center justify-center py-16 text-sm text-muted-foreground">
				<HardDrive class="mb-3 h-10 w-10 opacity-30" />
				<p class="font-medium">No nodes configured</p>
				<p class="text-xs mt-1 max-w-sm text-center">
					Nodes are the machines that run your game servers.
					If you installed Panel + Daemon together, the daemon should connect automatically.
				</p>
				<button
					class="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors mt-6"
					onclick={() => openForm()}
				>
					<Plus class="h-3.5 w-3.5" />
					Add Node
				</button>
			</div>
		{:else}
			{#each visibleNodes as node (node.id)}
				{@const isStore = 'connected' in node}
				<div class="rounded-lg border border-border bg-card transition-colors hover:bg-accent/30">
					<div class="flex items-start justify-between p-4 pb-3">
						<div class="flex items-center gap-3">
							<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
								<HardDrive class="h-5 w-5 text-muted-foreground" />
							</div>
							<div>
								<div class="flex items-center gap-2">
									<h3 class="text-sm font-semibold text-foreground">{node.name}</h3>
									<span class="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium {isOnline(node) ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}">
										<Circle class="h-1.5 w-1.5 fill-current" />
										{isOnline(node) ? 'Online' : 'Offline'}
									</span>
									{#if !isRegistered(node.id) && isStore && node.connected}
										<span class="rounded-full bg-yellow-500/10 px-2 py-0.5 text-[10px] font-medium text-yellow-400">New</span>
									{/if}
								</div>
								<p class="text-xs text-muted-foreground font-mono mt-0.5">
									{nodeHost(node)}:{nodePort(node)}
									<span class="text-muted-foreground/60 mx-1">·</span>
									v{nodeVersion(node)}
								</p>
							</div>
						</div>
						<div class="flex items-center gap-1">
							{#if !isRegistered(node.id) && isStore && node.connected}
								<button
									class="rounded-md bg-primary px-2 py-1 text-[10px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
									onclick={() => openForm(node as DaemonStatus)}
								>Register</button>
							{/if}
							<button
								class="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
								title="Edit" onclick={() => openForm(node as DaemonStatus)}
							><Edit class="h-3.5 w-3.5" /></button>
							<button
								class="rounded-md p-1.5 text-muted-foreground hover:text-red-400 hover:bg-muted transition-colors"
								title="Remove" onclick={() => removeNode(node.id)}
							><Trash2 class="h-3.5 w-3.5" /></button>
						</div>
					</div>

					{#if isStore}
						{@const store = node as DaemonStatus}
						<div class="grid grid-cols-4 gap-px bg-border mx-px rounded-b-lg overflow-hidden">
							<div class="bg-card p-3">
								<div class="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-1">
									<Cpu class="h-3 w-3" /> CPU
								</div>
								<p class="text-sm font-semibold text-foreground">{store.cpu.load.toFixed(1)}%</p>
								<p class="text-[10px] text-muted-foreground">{store.cpu.cores} cores</p>
							</div>
							<div class="bg-card p-3">
								<div class="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-1">
									<MemoryStick class="h-3 w-3" /> Memory
								</div>
								<p class="text-sm font-semibold text-foreground">{formatBytes(store.memory.used)} / {formatBytes(store.memory.total)}</p>
								{#if store.memory.total > 0}
									{@const pct = store.memory.used / store.memory.total * 100}
									<div class="mt-1 h-1 w-full rounded-full bg-muted overflow-hidden">
										<div class="h-full rounded-full transition-all {pct > 80 ? 'bg-red-400' : pct > 50 ? 'bg-yellow-400' : 'bg-green-400'}" style="width: {pct}%"></div>
									</div>
								{/if}
							</div>
							<div class="bg-card p-3">
								<div class="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-1">
									<HardDrive class="h-3 w-3" /> Disk
								</div>
								<p class="text-sm font-semibold text-foreground">{formatBytes(store.disk.used)} / {formatBytes(store.disk.total)}</p>
								{#if store.disk.total > 0}
									{@const pct = store.disk.used / store.disk.total * 100}
									<div class="mt-1 h-1 w-full rounded-full bg-muted overflow-hidden">
										<div class="h-full rounded-full transition-all {pct > 80 ? 'bg-red-400' : pct > 50 ? 'bg-yellow-400' : 'bg-green-400'}" style="width: {pct}%"></div>
									</div>
								{/if}
							</div>
							<div class="bg-card p-3">
								<div class="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-1">
									<Activity class="h-3 w-3" /> Servers
								</div>
								<p class="text-sm font-semibold text-foreground">{store.servers.length}</p>
								<p class="text-[10px] text-muted-foreground">{formatUptime(store.uptime)} uptime</p>
							</div>
						</div>

						{#if store.servers.length > 0}
							<div class="border-t border-border px-4 py-2.5">
								<div class="flex flex-wrap gap-1.5">
									{#each store.servers as srv}
										<a href="/servers/{srv.id}/overview"
											class="inline-flex items-center gap-1 rounded-md bg-muted/50 px-2 py-1 text-xs hover:bg-accent transition-colors">
											<Server class="h-3 w-3" /> {srv.name}
										</a>
									{/each}
								</div>
							</div>
						{/if}
					{/if}
				</div>
			{/each}
		{/if}
	</div>
</div>
