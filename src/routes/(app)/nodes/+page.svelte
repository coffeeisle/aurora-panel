<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { daemonStore, type DaemonStatus } from '$lib/stores/daemon';
	import { toasts } from '$lib/stores/toast';
	import { z } from 'zod';
	import {
		HardDrive, Wifi, WifiOff, Server, Cpu, MemoryStick, Activity, Plus,
		Trash2, Edit, X, Circle, ExternalLink
	} from '@lucide/svelte';

	const nodeSchema = z.object({
		name: z.string().trim().min(1, 'Name is required').max(64, 'Name too long'),
		host: z.string().trim().min(1, 'Host/IP is required').max(255, 'Host too long'),
		port: z.coerce.number().int().min(1, 'Port must be 1–65535').max(65535, 'Port must be 1–65535'),
		token: z.string().max(512, 'Token too long').optional()
	});

	let showRegisterForm = $state(false);
	let editingId = $state<string | null>(null);
	let newName = $state('');
	let newHost = $state('');
	let newPort = $state('8443');
	let newToken = $state('');
	let registering = $state(false);
	let fieldErrors = $state<Record<string, string>>({});

	function formatBytes(bytes: number): string {
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.min(Math.floor(Math.log(Math.max(bytes, 1)) / Math.log(1024)), sizes.length - 1);
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

	function formatLastSeen(ts: number): string {
		if (!ts) return 'Never';
		const diff = Date.now() - ts;
		if (diff < 60000) return 'Just now';
		if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
		if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
		return `${Math.floor(diff / 86400000)}d ago`;
	}

	async function registerNode() {
		fieldErrors = {};
		const parsed = nodeSchema.safeParse({
			name: newName,
			host: newHost,
			port: newPort || '0',
			token: newToken || undefined
		});
		if (!parsed.success) {
			const flat = parsed.error.flatten().fieldErrors;
			fieldErrors = Object.fromEntries(
				Object.entries(flat).map(([k, v]) => [k, v?.[0] || ''])
			);
			toasts.error('Validation failed', Object.values(fieldErrors).join(', '));
			return;
		}
		registering = true;
		try {
			const { name, host, port, token } = parsed.data;
			const res = await fetch('/api/nodes/register', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					id: editingId || name.toLowerCase().replace(/\s+/g, '-'),
					name,
					host,
					port,
					token: token || undefined
				})
			});
			if (!res.ok) {
				const errData = await res.json().catch(() => ({}));
				throw new Error(errData.error || `Registration failed (${res.status})`);
			}
			const data = await res.json();
			toasts.success('Node saved', data.message || `${name} registered`);
			resetForm();
		} catch (e) {
			toasts.error('Save failed', e instanceof Error ? e.message : 'Unknown error');
		} finally {
			registering = false;
		}
	}

	function editNode(node: DaemonStatus) {
		editingId = node.id;
		newName = node.name;
		newHost = node.host;
		newPort = String(node.port);
		newToken = '';
		showRegisterForm = true;
	}

	function removeNode(id: string) {
		if (!confirm(`Remove node ${id}?`)) return;
		daemonStore.disconnectDaemon(id);
		toasts.success('Node removed', `${id} removed`);
	}

	function resetForm() {
		showRegisterForm = false;
		editingId = null;
		newName = '';
		newHost = '';
		newPort = '8443';
		newToken = '';
		fieldErrors = {};
	}

	const daemons = $derived(Array.from($daemonStore.values()).sort((a, b) => a.id.localeCompare(b.id)));

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
</script>

<div class="flex h-full flex-col">
	<div class="flex items-center justify-between mb-4">
		<div>
			<h1 class="text-lg font-bold text-foreground">Nodes</h1>
			<p class="text-xs text-muted-foreground mt-0.5">Manage connected daemon nodes</p>
		</div>
		<button
			class="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
			onclick={() => { resetForm(); showRegisterForm = true; }}
		>
			<Plus class="h-3.5 w-3.5" />
			Register Node
		</button>
	</div>

	{#if showRegisterForm}
		<div class="mb-4 rounded-lg border border-border bg-card p-4">
			<h3 class="text-sm font-semibold text-foreground mb-3">{editingId ? 'Edit Node' : 'Register New Node'}</h3>
			<div class="flex flex-wrap items-end gap-3">
				<div class="flex-1 min-w-[160px]">
					<label for="node-name" class="mb-1 block text-xs text-muted-foreground">Name</label>
					<input
						id="node-name"
						bind:value={newName}
						placeholder="My Server Node"
						class="w-full rounded-md border bg-background px-3 py-1.5 text-xs text-foreground outline-none focus:ring-1 {fieldErrors.name ? 'border-red-400 focus:border-red-400 focus:ring-red-400' : 'border-border focus:border-primary focus:ring-primary'}"
					/>
					{#if fieldErrors.name}<p class="mt-1 text-[10px] text-red-400">{fieldErrors.name}</p>{/if}
				</div>
				<div class="flex-1 min-w-[160px]">
					<label for="node-host" class="mb-1 block text-xs text-muted-foreground">Host / IP</label>
					<input
						id="node-host"
						bind:value={newHost}
						placeholder="192.168.1.100"
						class="w-full rounded-md border bg-background px-3 py-1.5 text-xs text-foreground outline-none focus:ring-1 {fieldErrors.host ? 'border-red-400 focus:border-red-400 focus:ring-red-400' : 'border-border focus:border-primary focus:ring-primary'}"
					/>
					{#if fieldErrors.host}<p class="mt-1 text-[10px] text-red-400">{fieldErrors.host}</p>{/if}
				</div>
				<div class="w-24">
					<label for="node-port" class="mb-1 block text-xs text-muted-foreground">Port</label>
					<input
						id="node-port"
						bind:value={newPort}
						placeholder="8443"
						class="w-full rounded-md border bg-background px-3 py-1.5 text-xs text-foreground outline-none focus:ring-1 {fieldErrors.port ? 'border-red-400 focus:border-red-400 focus:ring-red-400' : 'border-border focus:border-primary focus:ring-primary'}"
					/>
					{#if fieldErrors.port}<p class="mt-1 text-[10px] text-red-400">{fieldErrors.port}</p>{/if}
				</div>
				<div class="flex-1 min-w-[160px]">
					<label for="node-token" class="mb-1 block text-xs text-muted-foreground">Token (optional)</label>
					<input
						id="node-token"
						bind:value={newToken}
						placeholder="auth-token"
						class="w-full rounded-md border bg-background px-3 py-1.5 text-xs text-foreground outline-none focus:ring-1 {fieldErrors.token ? 'border-red-400 focus:border-red-400 focus:ring-red-400' : 'border-border focus:border-primary focus:ring-primary'}"
					/>
					{#if fieldErrors.token}<p class="mt-1 text-[10px] text-red-400">{fieldErrors.token}</p>{/if}
				</div>
				<div class="flex gap-2">
					<button
						class="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
						disabled={registering}
						onclick={registerNode}
					>
						{registering ? 'Saving...' : editingId ? 'Update' : 'Register'}
					</button>
					<button
						class="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
						onclick={resetForm}
					>
						Cancel
					</button>
				</div>
			</div>
		</div>
	{/if}

	<div class="flex-1 overflow-y-auto space-y-3">
		{#if daemons.length === 0}
			<div class="flex flex-col items-center justify-center py-16 text-sm text-muted-foreground">
				<HardDrive class="mb-3 h-10 w-10 opacity-30" />
				<p class="font-medium">No nodes connected</p>
				<p class="text-xs mt-1">Start a daemon or register a remote node to get started.</p>
			</div>
		{:else}
			{#each daemons as node (node.id)}
				<div class="rounded-lg border border-border bg-card transition-colors hover:bg-accent/30">
					<div class="flex items-start justify-between p-4 pb-3">
						<div class="flex items-center gap-3">
							<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
								<HardDrive class="h-5 w-5 text-muted-foreground" />
							</div>
							<div>
								<div class="flex items-center gap-2">
									<h3 class="text-sm font-semibold text-foreground">{node.name}</h3>
									<span class="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium {node.connected ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}">
										<Circle class="h-1.5 w-1.5 fill-current" />
										{node.connected ? 'Online' : 'Offline'}
									</span>
								</div>
								<p class="text-xs text-muted-foreground font-mono mt-0.5">
									{node.host}:{node.port}
									<span class="text-muted-foreground/60 mx-1">·</span>
									v{node.version}
									<span class="text-muted-foreground/60 mx-1">·</span>
									Last seen: {formatLastSeen(0)}
								</p>
							</div>
						</div>
						<div class="flex items-center gap-1">
							<button
								class="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
				title="Edit"
								onclick={() => editNode(node)}
							>
								<Edit class="h-3.5 w-3.5" />
							</button>
							<button
								class="rounded-md p-1.5 text-muted-foreground hover:text-red-400 hover:bg-muted transition-colors"
				title="Remove"
								onclick={() => removeNode(node.id)}
							>
								<Trash2 class="h-3.5 w-3.5" />
							</button>
						</div>
					</div>

					<div class="grid grid-cols-4 gap-px bg-border mx-px rounded-b-lg overflow-hidden">
						<div class="bg-card p-3">
							<div class="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-1">
								<Cpu class="h-3 w-3" />
								CPU
							</div>
							<p class="text-sm font-semibold text-foreground">{node.cpu.load.toFixed(1)}%</p>
							<p class="text-[10px] text-muted-foreground">{node.cpu.cores} cores</p>
						</div>
						<div class="bg-card p-3">
							<div class="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-1">
								<MemoryStick class="h-3 w-3" />
								Memory
							</div>
							<p class="text-sm font-semibold text-foreground">{formatBytes(node.memory.used)} / {formatBytes(node.memory.total)}</p>
							<div class="mt-1 h-1 w-full rounded-full bg-muted overflow-hidden">
								<div
									class="h-full rounded-full transition-all {node.memory.total > 0 ? (node.memory.used / node.memory.total * 100 > 80 ? 'bg-red-400' : node.memory.used / node.memory.total * 100 > 50 ? 'bg-yellow-400' : 'bg-green-400') : 'bg-green-400'}"
									style="width: {node.memory.total > 0 ? (node.memory.used / node.memory.total * 100) : 0}%"
								></div>
							</div>
						</div>
						<div class="bg-card p-3">
							<div class="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-1">
								<HardDrive class="h-3 w-3" />
								Disk
							</div>
							<p class="text-sm font-semibold text-foreground">{formatBytes(node.disk.used)} / {formatBytes(node.disk.total)}</p>
							<div class="mt-1 h-1 w-full rounded-full bg-muted overflow-hidden">
								<div
									class="h-full rounded-full transition-all {node.disk.total > 0 ? (node.disk.used / node.disk.total * 100 > 80 ? 'bg-red-400' : node.disk.used / node.disk.total * 100 > 50 ? 'bg-yellow-400' : 'bg-green-400') : 'bg-green-400'}"
									style="width: {node.disk.total > 0 ? (node.disk.used / node.disk.total * 100) : 0}%"
								></div>
							</div>
						</div>
						<div class="bg-card p-3">
							<div class="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-1">
								<Activity class="h-3 w-3" />
								Servers
							</div>
							<p class="text-sm font-semibold text-foreground">{node.servers.length}</p>
							<p class="text-[10px] text-muted-foreground">{formatUptime(node.uptime)} uptime</p>
						</div>
					</div>

					{#if node.servers.length > 0}
						<div class="border-t border-border px-4 py-2.5">
							<div class="flex flex-wrap gap-1.5">
								{#each node.servers as srv}
									<a
										href="/servers/{srv.id}/overview"
										class="inline-flex items-center gap-1 rounded-md bg-muted/50 px-2 py-1 text-xs {statusColor(srv.status)} hover:bg-accent transition-colors"
									>
										<Server class="h-3 w-3" />
										{srv.name}
										<ExternalLink class="h-2.5 w-2.5 opacity-50" />
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
