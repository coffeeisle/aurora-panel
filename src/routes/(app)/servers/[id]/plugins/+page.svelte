<script lang="ts">
	import ModrinthSearch from '$lib/components/modrinth/ModrinthSearch.svelte';
</script>

<ModrinthSearch
	projectType="plugin"
	title="Plugins"
	filterOptions={{
		gameVersions: ['1.21.4', '1.21.3', '1.21.1', '1.20.4', '1.20.1', '1.19.4', '1.18.2', '1.17.1', '1.16.5'],
		loaders: ['spigot', 'paper', 'purpur', 'bukkit', 'folia'],
		categories: ['administration', 'api', 'chat', 'economy', 'game-mechanics', 'magic', 'minigame', 'moderation', 'performance', 'role-playing', 'storage', 'teleportation', 'world-management', 'worldgen']
	}}
/>
