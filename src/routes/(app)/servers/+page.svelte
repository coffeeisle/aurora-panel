<script lang="ts">
	import { onMount } from 'svelte';
	import { toasts } from '$lib/stores/toast';
	import type { Server } from '$lib/types/server';
	import { cn, formatBytes } from '$lib/utils/utils';
	import {
		Server as ServerIcon, Wifi, HardDrive, MemoryStick, Loader2, Plus, Globe, ChevronRight,
		Play, Square, RotateCcw, Trash2
	} from '@lucide/svelte';

	let serversList = $state<Server[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let acting = $state<Set<string>>(new Set());
	let showDelete = $state<string | null>(null);

	onMount(async () => {
		try {
			const res = await fetch('/api/servers');
			if (!res.ok) throw new Error('Failed to load servers');
			serversList = await res.json();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load servers';
			toasts.error('Failed to load servers', error!);
		} finally { loading = false; }
	});

	const statusConfig = $derived.by(() => {
		const map: Record<string, { color: string; label: string }> = {
			installed: { color: 'text-green-500', label: 'Online' },
			running: { color: 'text-green-500', label: 'Online' },
			stopped: { color: 'text-red-500', label: 'Offline' },
			installing: { color: 'text-blue-500', label: 'Installing' },
			suspended: { color: 'text-yellow-500', label: 'Suspended' },
			error: { color: 'text-red-500', label: 'Error' },
			starting: { color: 'text-blue-500', label: 'Starting' },
			stopping: { color: 'text-yellow-500', label: 'Stopping' },
			restarting: { color: 'text-blue-500', label: 'Restarting' }
		};
		return (status: string) => map[status] || { color: 'text-muted-foreground', label: status };
	});

	function isRunning(srv: Server) {
		return srv.status === 'running' || srv.status === 'installed';
	}
	function isBusy(srv: Server) {
		return srv.status === 'starting' || srv.status === 'stopping' || srv.status === 'restarting';
	}

	async function serverAction(id: string, action: 'start' | 'stop' | 'restart') {
		acting = new Set(acting).add(`${id}:${action}`);
		try {
			const res = await fetch(`/api/servers/${id}/action`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action })
			});
			if (!res.ok) throw new Error(`Failed to ${action} server`);
			toasts.success(`Server ${action}`, `Request sent`);
			serversList = serversList.map((s: Server) =>
				s.id === id ? { ...s, status: action === 'stop' ? 'stopped' : 'running' as const } : s
			);
		} catch (e) {
			toasts.error(`Failed to ${action}`, e instanceof Error ? e.message : 'Unknown error');
		} finally {
			const next = new Set(acting);
			next.delete(`${id}:${action}`);
			acting = next;
		}
	}

	async function deleteServer(id: string) {
		acting = new Set(acting).add(`delete:${id}`);
		try {
			const res = await fetch(`/api/servers/${id}`, { method: 'DELETE' });
			if (!res.ok) throw new Error('Failed to delete server');
			serversList = serversList.filter(s => s.id !== id);
			toasts.success('Server deleted');
		} catch (e) {
			toasts.error('Delete failed', e instanceof Error ? e.message : 'Unknown error');
		} finally {
			const next = new Set(acting);
			next.delete(`delete:${id}`);
			acting = next;
			showDelete = null;
		}
	}
</script>

<div class="mx-auto max-w-6xl space-y-8">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold tracking-tight text-foreground">Servers</h1>
			<p class="mt-1 text-sm text-muted-foreground">Manage all your game servers in one place</p>
		</div>
		<a
			href="/servers/new"
			class="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 hover:brightness-110 transition-all duration-200"
		>
			<Plus class="h-4 w-4" />
			Create Server
		</a>
	</div>

	{#if loading}
		<div class="flex items-center justify-center py-24">
			<Loader2 class="h-6 w-6 animate-spin text-muted-foreground" />
		</div>
	{:else if error}
		<div class="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400">{error}</div>
	{:else if serversList.length === 0}
		<div class="flex flex-col items-center justify-center py-24 text-center">
			<div class="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
				<ServerIcon class="h-8 w-8 text-muted-foreground" />
			</div>
			<h3 class="text-lg font-semibold text-foreground">No servers yet</h3>
			<p class="mt-1 text-sm text-muted-foreground">Create your first server to get started</p>
			<a href="/servers/new" class="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:brightness-110 transition-all duration-200">
				<Plus class="h-4 w-4" />
				Create Server
			</a>
		</div>
	{:else}
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each serversList as srv}
				<div class="group relative rounded-xl border border-border bg-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5 hover:border-primary/20">
					<a href="/servers/{srv.id}/overview" class="block p-5">
						<div class="flex items-start justify-between">
							<div class="flex items-center gap-3.5">
								<div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
									<ServerIcon class="h-5 w-5" />
								</div>
								<div class="min-w-0">
									<h3 class="font-semibold text-foreground truncate">{srv.name}</h3>
									<p class="text-xs text-muted-foreground mt-0.5">
										{srv.game}{srv.gameVersion ? ` — ${srv.gameVersion}` : ''}
									</p>
								</div>
							</div>
							<div class="flex items-center gap-1.5 shrink-0">
								<div class={cn('h-2 w-2 rounded-full', statusConfig(srv.status).color)}></div>
								<span class="text-xs text-muted-foreground">{statusConfig(srv.status).label}</span>
							</div>
						</div>

						<div class="mt-4 grid grid-cols-3 gap-3 rounded-lg bg-muted/40 p-3 text-xs">
							<div class="flex items-center gap-1.5 text-muted-foreground">
								<MemoryStick class="h-3.5 w-3.5 shrink-0" />
								<span>{srv.allocatedMemory} MB</span>
							</div>
							<div class="flex items-center gap-1.5 text-muted-foreground">
								<HardDrive class="h-3.5 w-3.5 shrink-0" />
								<span>{formatBytes(srv.allocatedDisk * 1024 * 1024)}</span>
							</div>
							<div class="flex items-center gap-1.5 text-muted-foreground">
								<Wifi class="h-3.5 w-3.5 shrink-0" />
								<span>{srv.port}</span>
							</div>
						</div>

						<div class="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
							<Globe class="h-3 w-3" />
							<span class="capitalize">{srv.platform || srv.loader || 'Vanilla'}</span>
							<span class="ml-auto flex items-center gap-0.5 text-primary/60 group-hover:text-primary transition-colors">
								Manage <ChevronRight class="h-3 w-3" />
							</span>
						</div>
					</a>

					<div class="flex items-center gap-0.5 border-t border-border/50 px-3 py-2 bg-muted/20 rounded-b-xl">
						<button
							class="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-green-400 hover:bg-green-500/10 transition-colors disabled:opacity-40"
							disabled={isRunning(srv) || isBusy(srv) || acting.has(`${srv.id}:start`)}
							onclick={(e) => { e.stopPropagation(); serverAction(srv.id, 'start'); }}
						>
							{#if acting.has(`${srv.id}:start`)}
								<Loader2 class="h-3 w-3 animate-spin" />
							{:else}
								<Play class="h-3 w-3" />
							{/if}
							Start
						</button>
						<button
							class="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-yellow-400 hover:bg-yellow-500/10 transition-colors disabled:opacity-40"
							disabled={!isRunning(srv) || isBusy(srv) || acting.has(`${srv.id}:restart`)}
							onclick={(e) => { e.stopPropagation(); serverAction(srv.id, 'restart'); }}
						>
							{#if acting.has(`${srv.id}:restart`)}
								<Loader2 class="h-3 w-3 animate-spin" />
							{:else}
								<RotateCcw class="h-3 w-3" />
							{/if}
							Restart
						</button>
						<button
							class="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
							disabled={!isRunning(srv) || isBusy(srv) || acting.has(`${srv.id}:stop`)}
							onclick={(e) => { e.stopPropagation(); serverAction(srv.id, 'stop'); }}
						>
							{#if acting.has(`${srv.id}:stop`)}
								<Loader2 class="h-3 w-3 animate-spin" />
							{:else}
								<Square class="h-3 w-3" />
							{/if}
							Stop
						</button>
						<button
							class="ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
							onclick={(e) => { e.stopPropagation(); showDelete = srv.id; }}
						>
							<Trash2 class="h-3 w-3" />
							Delete
						</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

{#if showDelete}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
		onclick={() => showDelete = null}
		onkeydown={(e) => e.key === 'Escape' && (showDelete = null)}
		role="presentation"
		tabindex="0"
	>
		<!-- svelte-ignore a11y_no_static_element_interactions a11y_interactive_supports_focus -->
		<div class="w-80 rounded-xl border border-border bg-card p-6 shadow-2xl" role="dialog" tabindex="-1" onclick={(e) => e.stopPropagation()}>
			<h3 class="text-base font-semibold text-foreground">Delete Server</h3>
			<p class="mt-2 text-sm text-muted-foreground">This will permanently delete this server and all its data.</p>
			<div class="mt-4 flex items-center justify-end gap-2">
				<button class="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors" onclick={() => showDelete = null}>
					Cancel
				</button>
				<button
					class="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600 transition-colors disabled:opacity-50"
					disabled={acting.has(`delete:${showDelete}`)}
					onclick={() => deleteServer(showDelete!)}
				>
					{#if acting.has(`delete:${showDelete}`)}
						<Loader2 class="mr-1 inline h-3 w-3 animate-spin" />
					{/if}
					Delete
				</button>
			</div>
		</div>
	</button>
{/if}
