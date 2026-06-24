<script lang="ts">
	import { page } from '$app/stores';
	import { toasts } from '$lib/stores/toast';
	import { Download, Trash2, RotateCcw, Plus, Archive, Loader2 } from '@lucide/svelte';

	type Backup = {
		id: string;
		name: string;
		sizeFormatted: string;
		type: 'full' | 'partial';
		createdAt: string;
		checksum: string;
	};

	let backups = $state<Backup[]>([]);
	let loading = $state(true);
	let error = $state('');
	let creating = $state(false);
	let deleting = $state<Set<string>>(new Set());
	let restoring = $state<string | null>(null);

	const serverId = $derived($page.params.id);

	async function loadBackups() {
		loading = true;
		error = '';
		try {
			const res = await fetch(`/api/servers/${serverId}/backups`);
			if (!res.ok) throw new Error('Failed to load backups');
			backups = await res.json();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Unknown error';
		} finally {
			loading = false;
		}
	}

	async function createBackup() {
		creating = true;
		try {
			const res = await fetch(`/api/servers/${serverId}/backups`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: `Backup ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}` })
			});
			if (!res.ok) throw new Error('Failed to create backup');
			const backup = await res.json();
			backups = [backup, ...backups];
			toasts.success('Backup created', `${backup.name} (${backup.sizeFormatted})`);
		} catch (e) {
			toasts.error('Backup failed', e instanceof Error ? e.message : 'Unknown error');
		} finally {
			creating = false;
		}
	}

	async function deleteBackup(backupId: string) {
		if (!confirm('Delete this backup? This cannot be undone.')) return;
		deleting = new Set(deleting).add(backupId);
		try {
			const res = await fetch(`/api/servers/${serverId}/backups/${backupId}`, {
				method: 'DELETE'
			});
			if (!res.ok) throw new Error('Failed to delete backup');
			backups = backups.filter((b) => b.id !== backupId);
			toasts.success('Backup deleted');
		} catch (e) {
			toasts.error('Delete failed', e instanceof Error ? e.message : 'Unknown error');
		} finally {
			const next = new Set(deleting);
			next.delete(backupId);
			deleting = next;
		}
	}

	async function restoreBackup(backupId: string) {
		if (!confirm('Restore this backup? The server will be stopped and current data will be overwritten.')) return;
		restoring = backupId;
		try {
			const res = await fetch(`/api/daemon/backup/restore`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ serverId, backupId })
			});
			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				throw new Error(err.error || 'Restore failed');
			}
			toasts.success('Backup restored', 'Server has been restored to the selected backup.');
		} catch (e) {
			toasts.error('Restore failed', e instanceof Error ? e.message : 'Unknown error');
		} finally {
			restoring = null;
		}
	}

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString('en-US', {
			year: 'numeric', month: 'short', day: 'numeric',
			hour: '2-digit', minute: '2-digit'
		});
	}

	$effect(() => {
		loadBackups();
	});
</script>

<div class="flex h-full flex-col">
	<div class="flex items-center justify-between mb-4">
		<div>
			<h1 class="text-lg font-bold text-foreground">Backups</h1>
			<p class="text-xs text-muted-foreground mt-0.5">Manage server backups</p>
		</div>
		<button
			class="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
			disabled={creating}
			onclick={createBackup}
		>
			{#if creating}
				<Loader2 class="h-3.5 w-3.5 animate-spin" />
			{:else}
				<Plus class="h-3.5 w-3.5" />
			{/if}
			Create Backup
		</button>
	</div>

	<div class="flex-1 overflow-y-auto">
		{#if loading}
			<div class="flex items-center justify-center py-12">
				<div class="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
			</div>
		{:else if error}
			<div class="flex items-center justify-center py-12 text-sm text-red-400">{error}</div>
		{:else if backups.length === 0}
			<div class="flex flex-col items-center justify-center py-12 text-sm text-muted-foreground">
				<Archive class="mb-2 h-8 w-8 opacity-40" />
				<p>No backups yet</p>
				<p class="text-xs mt-1">Create your first backup to protect your server data.</p>
			</div>
		{:else}
			<div class="space-y-2">
				{#each backups as backup (backup.id)}
					<div class="flex items-center gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent/30">
						<div class="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
							<Archive class="h-5 w-5 text-muted-foreground" />
						</div>
						<div class="flex-1 min-w-0">
							<h3 class="text-sm font-medium text-foreground truncate">{backup.name}</h3>
							<div class="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
								<span>{backup.sizeFormatted}</span>
								<span class="capitalize">({backup.type})</span>
								<span>{formatDate(backup.createdAt)}</span>
								<span class="font-mono">SHA1:{backup.checksum}</span>
							</div>
						</div>
						<div class="flex items-center gap-1.5 flex-shrink-0">
							<a
								href={`/api/servers/${serverId}/backups/${backup.id}?download=1`}
								class="flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
							>
								<Download class="h-3.5 w-3.5" />
								Download
							</a>
							<button
								class="flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
								disabled={restoring === backup.id}
								onclick={() => restoreBackup(backup.id)}
							>
								{#if restoring === backup.id}
									<Loader2 class="h-3.5 w-3.5 animate-spin" />
								{:else}
									<RotateCcw class="h-3.5 w-3.5" />
								{/if}
								Restore
							</button>
							<button
								class="flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
								disabled={deleting.has(backup.id)}
								onclick={() => deleteBackup(backup.id)}
							>
								{#if deleting.has(backup.id)}
									<Loader2 class="h-3.5 w-3.5 animate-spin" />
								{:else}
									<Trash2 class="h-3.5 w-3.5" />
								{/if}
								Delete
							</button>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
