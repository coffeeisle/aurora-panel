<script lang="ts">
	import ModrinthSearch from '$lib/components/modrinth/ModrinthSearch.svelte';
	import InstalledContent from '$lib/components/modrinth/InstalledContent.svelte';
</script>

<div class="space-y-6">
	<InstalledContent projectType="datapack" />

	<ModrinthSearch
		projectType="datapack"
		title="Search Datapacks"
		filterOptions={{
			gameVersions: ['1.21.4', '1.21.3', '1.21.1', '1.20.4', '1.20.1', '1.19.4', '1.18.2', '1.17.1', '1.16.5'],
			loaders: ['datapack'],
			categories: ['adventure', 'automation', 'challenge', 'combat', 'cursed', 'decoration', 'food', 'magic', 'mob', 'optimization', 'recipe', 'storage', 'structure', 'technology', 'utility', 'worldgen']
		}}
	/>
</div>
