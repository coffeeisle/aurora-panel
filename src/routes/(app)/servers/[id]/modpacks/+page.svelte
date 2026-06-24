<script lang="ts">
	import ModrinthSearch from '$lib/components/modrinth/ModrinthSearch.svelte';
</script>

<ModrinthSearch
	projectType="modpack"
	title="Modpacks"
	filterOptions={{
		gameVersions: ['1.21.4', '1.21.3', '1.21.1', '1.20.4', '1.20.1', '1.19.4', '1.18.2', '1.17.1', '1.16.5'],
		loaders: ['fabric', 'forge', 'quilt', 'neoforge'],
		categories: ['adventure', 'agrarian', 'automation', 'challenge', 'combat', 'exploration', 'hardcore', 'kitchen-sink', 'lightweight', 'magic', 'minigame', 'optimization', 'parkour', 'pve', 'pvp', 'role-playing', 'sci-fi', 'skyblock', 'tech', 'vanilla-plus', 'worldgen']
	}}
/>
