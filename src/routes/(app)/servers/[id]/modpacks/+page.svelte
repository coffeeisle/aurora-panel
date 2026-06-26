<script lang="ts">
	import { page } from '$app/stores';
	import ModrinthSearch from '$lib/components/modrinth/ModrinthSearch.svelte';
	import InstalledContent from '$lib/components/modrinth/InstalledContent.svelte';
	import { toasts } from '$lib/stores/toast';
	import { Upload, Download, Loader2, FileArchive } from '@lucide/svelte';

	let importing = $state(false);
	let exporting = $state(false);

	const serverId = $derived($page.params.id);

	async function handleImport(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		if (!file.name.endsWith('.mrpack')) {
			toasts.error('Invalid file', 'Please select a .mrpack file');
			input.value = '';
			return;
		}

		importing = true;
		try {
			const formData = new FormData();
			formData.append('file', file);
			const res = await fetch(`/api/servers/${serverId}/modrinth/mrpack/import`, {
				method: 'POST',
				body: formData,
			});
			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				throw new Error(err.error || 'Import failed');
			}
			const data = await res.json();
			toasts.success('Modpack imported', `${data.installed || 0} mods installed`);
		} catch (e) {
			toasts.error('Import failed', e instanceof Error ? e.message : 'Unknown error');
		} finally {
			importing = false;
			input.value = '';
		}
	}

	async function handleExport() {
		exporting = true;
		try {
			const res = await fetch(`/api/servers/${serverId}/modrinth/mrpack/export`);
			if (!res.ok) throw new Error('Export failed');
			const blob = await res.blob();
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `server-${serverId}-modpacks.mrpack`;
			a.click();
			URL.revokeObjectURL(url);
			toasts.success('Modpack exported');
		} catch (e) {
			toasts.error('Export failed', e instanceof Error ? e.message : 'Unknown error');
		} finally {
			exporting = false;
		}
	}
</script>

<div class="space-y-6">
	<div class="flex items-center gap-2">
		<label
			class="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:brightness-110 transition-all duration-200 cursor-pointer disabled:opacity-50"
			class:opacity-50={importing}
		>
			{#if importing}
				<Loader2 class="h-4 w-4 animate-spin" />
			{:else}
				<Upload class="h-4 w-4" />
			{/if}
			Import .mrpack
			<input type="file" accept=".mrpack" class="hidden" onchange={handleImport} disabled={importing} />
		</label>
		<button
			class="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted transition-all duration-200 disabled:opacity-50"
			disabled={exporting}
			onclick={handleExport}
		>
			{#if exporting}
				<Loader2 class="h-4 w-4 animate-spin" />
			{:else}
				<Download class="h-4 w-4" />
			{/if}
			Export .mrpack
		</button>
	</div>

	<InstalledContent projectType="modpack" />

	<ModrinthSearch
		projectType="modpack"
		title="Search Modpacks"
		filterOptions={{
			gameVersions: ['1.21.4', '1.21.3', '1.21.1', '1.20.4', '1.20.1', '1.19.4', '1.18.2', '1.17.1', '1.16.5'],
			loaders: ['fabric', 'forge', 'quilt', 'neoforge'],
			categories: ['adventure', 'agrarian', 'automation', 'challenge', 'combat', 'exploration', 'hardcore', 'kitchen-sink', 'lightweight', 'magic', 'minigame', 'optimization', 'parkour', 'pve', 'pvp', 'role-playing', 'sci-fi', 'skyblock', 'tech', 'vanilla-plus', 'worldgen']
		}}
	/>
</div>
