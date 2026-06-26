<script lang="ts">
	import { page } from '$app/stores';
	import { toasts } from '$lib/stores/toast';
	import { Download, Trash2, RefreshCw, Loader2, Package, AlertTriangle, CheckCircle } from '@lucide/svelte';

	export type InstalledItem = {
		id: string;
		projectId: string;
		projectType: string;
		versionId: string;
		versionNumber: string;
		title: string;
		slug: string | null;
		iconUrl: string | null;
		installedAt: string | Date;
	};

	type Props = {
		projectType: string;
	};

	let { projectType }: Props = $props();

	let items = $state<InstalledItem[]>([]);
	let loading = $state(true);
	let error = $state('');
	let removing = $state<Set<string>>(new Set());
	let updating = $state<Set<string>>(new Set());
	let updates = $state<Record<string, { currentVersion: string; latestVersion: string | null; hasUpdate: boolean }>>({});
	let checkingUpdates = $state(false);
	let refreshing = $state(false);

	const serverId = $derived($page.params.id);
	const typedItems = $derived(items.filter(i => i.projectType === projectType));
	const updatingAny = $derived(updating.size > 0 || removing.size > 0);

	async function loadInstalled() {
		loading = true;
		error = '';
		try {
			const res = await fetch(`/api/servers/${serverId}/modrinth`);
			if (!res.ok) throw new Error('Failed to load');
			items = await res.json();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Unknown error';
		} finally {
			loading = false;
		}
	}

	async function checkUpdates() {
		checkingUpdates = true;
		try {
			const res = await fetch(`/api/servers/${serverId}/modrinth/check-updates`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ projectIds: typedItems.map(i => i.projectId) }),
			});
			if (!res.ok) throw new Error('Check failed');
			updates = await res.json();
			const count = Object.values(updates).filter(u => u.hasUpdate).length;
			if (count > 0) {
				toasts.info('Updates available', `${count} project${count > 1 ? 's' : ''} have updates`);
			} else {
				toasts.success('Up to date', 'All installed content is up to date');
			}
		} catch (e) {
			toasts.error('Check failed', e instanceof Error ? e.message : 'Unknown error');
		} finally {
			checkingUpdates = false;
		}
	}

	async function updateItem(item: InstalledItem) {
		if (updating.has(item.projectId)) return;
		updating = new Set(updating).add(item.projectId);
		try {
			const res = await fetch(`/api/servers/${serverId}/modrinth/install`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ projectId: item.projectId, projectType: item.projectType }),
			});
			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				throw new Error(err.error || 'Update failed');
			}
			const data = await res.json();
			toasts.success(`${item.title} updated`, `${item.versionNumber} → ${data.version.versionNumber}`);
			await loadInstalled();
		} catch (e) {
			toasts.error('Update failed', e instanceof Error ? e.message : 'Unknown error');
		} finally {
			const next = new Set(updating);
			next.delete(item.projectId);
			updating = next;
		}
	}

	async function removeItem(item: InstalledItem) {
		if (!confirm(`Remove ${item.title}?`)) return;
		removing = new Set(removing).add(item.projectId);
		try {
			const res = await fetch(`/api/servers/${serverId}/modrinth/${item.projectId}/remove`, {
				method: 'POST',
			});
			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				throw new Error(err.error || 'Remove failed');
			}
			toasts.success('Removed', `${item.title} removed from server`);
			items = items.filter(i => i.projectId !== item.projectId);
		} catch (e) {
			toasts.error('Remove failed', e instanceof Error ? e.message : 'Unknown error');
		} finally {
			const next = new Set(removing);
			next.delete(item.projectId);
			removing = next;
		}
	}

	async function refresh() {
		refreshing = true;
		await loadInstalled();
		refreshing = false;
	}

	function formatDate(d: string | Date): string {
		const date = new Date(d);
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	}

	function timeAgo(d: string | Date): string {
		const diff = Date.now() - new Date(d).getTime();
		if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
		if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
		return `${Math.floor(diff / 86400000)}d ago`;
	}

	$effect(() => {
		loadInstalled();
	});
</script>

{#if loading}
	<div class="flex items-center justify-center py-4">
		<Loader2 class="h-4 w-4 animate-spin text-muted-foreground" />
	</div>
{:else if typedItems.length > 0}
	<div class="rounded-xl border border-border bg-card">
		<div class="flex items-center justify-between px-4 py-3 border-b border-border">
			<h2 class="text-sm font-semibold text-foreground">
				Installed <span class="text-muted-foreground font-normal">({typedItems.length})</span>
			</h2>
			<div class="flex items-center gap-2">
				<button
					class="flex items-center gap-1 rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
					disabled={checkingUpdates || typedItems.length === 0}
					onclick={checkUpdates}
				>
					{#if checkingUpdates}
						<Loader2 class="h-3 w-3 animate-spin" />
					{:else}
						<RefreshCw class="h-3 w-3" />
					{/if}
					Check Updates
				</button>
				<button
					class="flex items-center gap-1 rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
					disabled={refreshing}
					onclick={refresh}
				>
					<RefreshCw class="h-3 w-3 {refreshing ? 'animate-spin' : ''}" />
				</button>
			</div>
		</div>
		<div class="divide-y divide-border">
			{#each typedItems as item (item.projectId)}
				{@const updateInfo = updates[item.projectId]}
				{@const hasUpdate = updateInfo?.hasUpdate ?? false}
				<div class="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/30">
					<div class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-muted">
						<Package class="h-4 w-4 text-muted-foreground" />
					</div>
					<div class="flex-1 min-w-0">
						<div class="flex items-center gap-2">
							<span class="text-sm font-medium text-foreground truncate">{item.title}</span>
							{#if hasUpdate}
								<span class="inline-flex items-center gap-1 rounded-full bg-yellow-500/10 px-2 py-0.5 text-[10px] font-medium text-yellow-400">
									<AlertTriangle class="h-2.5 w-2.5" />
									Update available
								</span>
							{:else if updateInfo && !updateInfo.hasUpdate}
								<span class="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-400">
									<CheckCircle class="h-2.5 w-2.5" />
									Latest
								</span>
							{/if}
						</div>
						<div class="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
							<span class="font-mono">v{item.versionNumber}</span>
							<span>·</span>
							<span>Installed {timeAgo(item.installedAt)}</span>
							{#if hasUpdate && updateInfo?.latestVersion}
								<span>·</span>
								<span class="text-yellow-400">v{updateInfo.latestVersion} available</span>
							{/if}
						</div>
					</div>
					<div class="flex items-center gap-1.5 flex-shrink-0">
						{#if hasUpdate}
							<button
								class="flex items-center gap-1 rounded-md bg-primary/10 px-2.5 py-1.5 text-[11px] font-medium text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
								disabled={updating.has(item.projectId)}
								onclick={() => updateItem(item)}
							>
								{#if updating.has(item.projectId)}
									<Loader2 class="h-3 w-3 animate-spin" />
								{:else}
									<Download class="h-3 w-3" />
								{/if}
								Update
							</button>
						{/if}
						<button
							class="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
							disabled={removing.has(item.projectId)}
							onclick={() => removeItem(item)}
						>
							{#if removing.has(item.projectId)}
								<Loader2 class="h-3 w-3 animate-spin" />
							{:else}
								<Trash2 class="h-3 w-3" />
							{/if}
							Remove
						</button>
					</div>
				</div>
			{/each}
		</div>
	</div>
{/if}
