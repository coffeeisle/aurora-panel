<script lang="ts">
	import ModrinthSearch from '$lib/components/modrinth/ModrinthSearch.svelte';
	import InstalledContent from '$lib/components/modrinth/InstalledContent.svelte';
</script>

<div class="space-y-6">
	<InstalledContent projectType="mod" />

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
