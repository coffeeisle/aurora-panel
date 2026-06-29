<script lang="ts">
	import { page } from '$app/stores';
	import ModrinthSearch from '$lib/components/modrinth/ModrinthSearch.svelte';
	import InstalledContent from '$lib/components/modrinth/InstalledContent.svelte';
	import { toasts } from '$lib/stores/toast';
	import { Upload, Download, Loader2 } from '@lucide/svelte';

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
			const res = await fetch(`/api/servers/${serverId}/modrinth/mrpack/import`, { method: 'POST', body: formData });
			if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Import failed'); }
			const data = await res.json();
			toasts.success('Modpack imported', `${data.installed || 0} mods installed`);
		} catch (e) {
			toasts.error('Import failed', e instanceof Error ? e.message : 'Unknown error');
		} finally { importing = false; input.value = ''; }
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
		} finally { exporting = false; }
	}

	const contentTypes = [
		{ id: 'mod', label: 'Mods', icon: '🧩' },
		{ id: 'plugin', label: 'Plugins', icon: '🔌' },
		{ id: 'datapack', label: 'Datapacks', icon: '📋' },
		{ id: 'modpack', label: 'Modpacks', icon: '📦' },
	];

	let activeType = $state('mod');

	const filterOptions: Record<string, { gameVersions: string[]; loaders: string[]; categories: string[] }> = {
		mod: {
			gameVersions: ['1.21.4', '1.21.3', '1.21.1', '1.20.4', '1.20.1', '1.19.4', '1.18.2', '1.17.1', '1.16.5'],
			loaders: ['fabric', 'forge', 'quilt', 'neoforge', 'liteloader'],
			categories: ['technology', 'magic', 'adventure', 'utility', 'decoration', 'storage', 'worldgen', 'mobs', 'food', 'armor', 'optimization', 'api', 'library', 'cosmetic', 'cursed']
		},
		plugin: {
			gameVersions: ['1.21.4', '1.21.3', '1.21.1', '1.20.4', '1.20.1', '1.19.4', '1.18.2', '1.17.1', '1.16.5'],
			loaders: ['spigot', 'paper', 'purpur', 'bukkit', 'folia'],
			categories: ['administration', 'api', 'chat', 'economy', 'game-mechanics', 'magic', 'minigame', 'moderation', 'performance', 'role-playing', 'storage', 'teleportation', 'world-management', 'worldgen']
		},
		datapack: {
			gameVersions: ['1.21.4', '1.21.3', '1.21.1', '1.20.4', '1.20.1', '1.19.4', '1.18.2', '1.17.1', '1.16.5'],
			loaders: ['datapack'],
			categories: ['adventure', 'automation', 'challenge', 'combat', 'cursed', 'decoration', 'food', 'magic', 'mob', 'optimization', 'recipe', 'storage', 'structure', 'technology', 'utility', 'worldgen']
		},
		modpack: {
			gameVersions: ['1.21.4', '1.21.3', '1.21.1', '1.20.4', '1.20.1', '1.19.4', '1.18.2', '1.17.1', '1.16.5'],
			loaders: ['fabric', 'forge', 'quilt', 'neoforge'],
			categories: ['adventure', 'agrarian', 'automation', 'challenge', 'combat', 'exploration', 'hardcore', 'kitchen-sink', 'lightweight', 'magic', 'minigame', 'optimization', 'parkour', 'pve', 'pvp', 'role-playing', 'sci-fi', 'skyblock', 'tech', 'vanilla-plus', 'worldgen']
		}
	};
</script>

<div class="space-y-6">
	<div class="flex items-center border-b border-border">
		{#each contentTypes as type}
			<button
				class="flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors {activeType === type.id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}"
				onclick={() => activeType = type.id}
			>
				<span class="text-base">{type.icon}</span>
				{type.label}
			</button>
		{/each}
		{#if activeType === 'modpack'}
			<div class="ml-auto flex items-center gap-2">
				<label class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50" class:opacity-50={importing}>
					{#if importing}<Loader2 class="h-3 w-3 animate-spin" />{:else}<Upload class="h-3 w-3" />{/if}
					Import .mrpack
					<input type="file" accept=".mrpack" class="hidden" onchange={handleImport} disabled={importing} />
				</label>
				<button class="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50" disabled={exporting} onclick={handleExport}>
					{#if exporting}<Loader2 class="h-3 w-3 animate-spin" />{:else}<Download class="h-3 w-3" />{/if}
					Export .mrpack
				</button>
			</div>
		{/if}
	</div>

	<InstalledContent projectType={activeType} />

	<ModrinthSearch
		projectType={activeType}
		title="Search {contentTypes.find(t => t.id === activeType)?.label || 'Content'}"
		filterOptions={filterOptions[activeType]}
	/>
</div>
