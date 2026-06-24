<script lang="ts">
	import ModrinthSearch from '$lib/components/modrinth/ModrinthSearch.svelte';
	import { installedProjects } from '$lib/stores/installed';
	import { Trash2, Loader2, AlertCircle } from 'lucide-svelte';
	import { toasts } from '$lib/stores/toast';

	let { data } = $props();

	function removeMod(projectId: string) {
		// Implementation for removal
		toasts.info('Removal', 'Feature to be implemented');
	}
</script>

<div class="space-y-6">
	{#if $installedProjects.size > 0}
		<div class="rounded-xl border border-border bg-card p-4">
			<h2 class="mb-3 text-sm font-semibold text-foreground">Installed</h2>
			<div class="space-y-2">
				{#each Array.from($installedProjects.values()) as mod (mod.projectId)}
					<div class="flex items-center justify-between rounded-lg bg-muted/40 p-2 text-xs">
						<span class="font-medium text-foreground">{mod.title || mod.projectId}</span>
						<div class="flex items-center gap-3">
							<span class="text-muted-foreground">{mod.versionNumber}</span>
							<button class="text-muted-foreground hover:text-red-400" onclick={() => removeMod(mod.projectId)}>
								<Trash2 class="h-3.5 w-3.5" />
							</button>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<ModrinthSearch
		projectType="mod"
		title="Search Mods"
		filterOptions={{
			gameVersions: ['1.21.4', '1.21.3', '1.21.1', '1.20.4', '1.20.1', '1.19.4', '1.18.2', '1.17.1', '1.16.5'],
			loaders: ['fabric', 'forge', 'quilt', 'neoforge', 'liteloader'],
			categories: ['technology', 'magic', 'adventure', 'utility', 'decoration', 'storage', 'worldgen', 'mobs', 'food', 'armor', 'optimization', 'api', 'library', 'cosmetic', 'cursed']
		}}
	/>
</div>
