<script lang="ts">
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Badge } from '$lib/components/ui/badge';
	import * as Card from '$lib/components/ui/card';
	import { Search, Download, Loader2, X, ChevronLeft, ChevronRight, Puzzle, User, Server as ServerIcon, Star } from 'lucide-svelte';
	import { searchMods } from '$lib/server/modrinth';
	import type { ModrinthProject } from '$lib/types/modrinth';
	import { cn } from '$lib/utils/utils';

	const GAME_VERSIONS = ['1.21.4', '1.21', '1.20.6', '1.20.4', '1.20.1', '1.19.4', '1.19.2', '1.18.2', '1.16.5'];
	const LOADERS = ['fabric', 'forge', 'quilt', 'neoforge', 'liteloader'];
	const CATEGORIES = [
		'technology', 'magic', 'adventure', 'utility', 'decoration',
		'storage', 'worldgen', 'mobs', 'food', 'armor',
		'optimization', 'api', 'library', 'cosmetic', 'cursed'
	];

	let query = $state('');
	let selectedVersions = $state<string[]>([]);
	let selectedLoaders = $state<string[]>([]);
	let selectedCategories = $state<string[]>([]);
	let environment = $state<'client' | 'server' | 'both' | ''>('');
	let results = $state<ModrinthProject[]>([]);
	let totalHits = $state(0);
	let loading = $state(false);
	let error = $state('');
	let offset = $state(0);
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	async function doSearch(resetOffset = true) {
		if (resetOffset) offset = 0;
		loading = true;
		error = '';
		try {
			const res = await searchMods({
				query,
				projectType: 'mod',
				gameVersions: selectedVersions,
				loaders: selectedLoaders,
				categories: selectedCategories,
				environment: environment || undefined,
				offset,
				limit: 24
			});
			if (resetOffset) {
				results = res.hits;
			} else {
				results = [...results, ...res.hits];
			}
			totalHits = res.total_hits;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Search failed';
			results = [];
		} finally {
			loading = false;
		}
	}

	function onSearchInput() {
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => doSearch(true), 300);
	}

	function toggleVersion(v: string) {
		selectedVersions = selectedVersions.includes(v)
			? selectedVersions.filter((x) => x !== v)
			: [...selectedVersions, v];
		doSearch(true);
	}

	function toggleLoader(l: string) {
		selectedLoaders = selectedLoaders.includes(l)
			? selectedLoaders.filter((x) => x !== l)
			: [...selectedLoaders, l];
		doSearch(true);
	}

	function toggleCategory(c: string) {
		selectedCategories = selectedCategories.includes(c)
			? selectedCategories.filter((x) => x !== c)
			: [...selectedCategories, c];
		doSearch(true);
	}

	function setEnvironment(e: 'client' | 'server' | 'both' | '') {
		environment = environment === e ? '' : e;
		doSearch(true);
	}

	function clearFilters() {
		selectedVersions = [];
		selectedLoaders = [];
		selectedCategories = [];
		environment = '';
		doSearch(true);
	}

	function nextPage() {
		offset += 24;
		doSearch(false);
	}

	function prevPage() {
		offset = Math.max(0, offset - 24);
		doSearch(true);
	}

	function formatDownloads(n: number): string {
		if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
		if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
		return String(n);
	}

	const hasAnyFilter = $derived(
		selectedVersions.length > 0 || selectedLoaders.length > 0 ||
		selectedCategories.length > 0 || environment !== ''
	);

	const totalPages = $derived(Math.ceil(totalHits / 24));
	const currentPage = $derived(Math.floor(offset / 24) + 1);

</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold text-foreground">Mods</h1>
	</div>

	<div class="space-y-4">
		<div class="relative">
			<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
			<Input
				class="pl-10"
				placeholder="Search mods..."
				bind:value={query}
				oninput={onSearchInput}
			/>
		</div>

		<div class="flex flex-wrap gap-4">
			<div class="space-y-2">
				<p class="text-xs font-medium text-muted-foreground">Game Version</p>
				<div class="flex flex-wrap gap-1.5">
					{#each GAME_VERSIONS as v}
						<Badge
							variant={selectedVersions.includes(v) ? 'default' : 'outline'}
							class="cursor-pointer select-none"
							onclick={() => toggleVersion(v)}
						>
							{v}
						</Badge>
					{/each}
				</div>
			</div>

			<div class="space-y-2">
				<p class="text-xs font-medium text-muted-foreground">Loader</p>
				<div class="flex flex-wrap gap-1.5">
					{#each LOADERS as l}
						<Badge
							variant={selectedLoaders.includes(l) ? 'default' : 'outline'}
							class="cursor-pointer select-none capitalize"
							onclick={() => toggleLoader(l)}
						>
							{l}
						</Badge>
					{/each}
				</div>
			</div>

			<div class="space-y-2">
				<p class="text-xs font-medium text-muted-foreground">Environment</p>
				<div class="flex flex-wrap gap-1.5">
					<Badge
						variant={environment === 'client' ? 'default' : 'outline'}
						class="cursor-pointer select-none"
						onclick={() => setEnvironment('client')}
					>
						Client
					</Badge>
					<Badge
						variant={environment === 'server' ? 'default' : 'outline'}
						class="cursor-pointer select-none"
						onclick={() => setEnvironment('server')}
					>
						Server
					</Badge>
					<Badge
						variant={environment === 'both' ? 'default' : 'outline'}
						class="cursor-pointer select-none"
						onclick={() => setEnvironment('both')}
					>
						Both
					</Badge>
				</div>
			</div>
		</div>

		{#if selectedCategories.length > 0}
			<div class="flex flex-wrap items-center gap-1.5">
				<p class="text-xs font-medium text-muted-foreground">Categories:</p>
				{#each selectedCategories as c}
					<Badge variant="secondary" class="cursor-pointer" onclick={() => toggleCategory(c)}>
						{c}
						<X class="ml-1 h-3 w-3" />
					</Badge>
				{/each}
			</div>
		{/if}

		{#if hasAnyFilter}
			<Button variant="ghost" size="sm" onclick={clearFilters}>
				<X class="mr-1 h-3 w-3" />
				Clear filters
			</Button>
		{/if}
	</div>

	{#if error}
		<div class="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
			{error}
		</div>
	{/if}

	{#if loading && results.length === 0}
		<div class="flex items-center justify-center py-20">
			<Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
		</div>
	{:else if results.length === 0 && !loading}
		<div class="py-20 text-center text-muted-foreground">
			<Puzzle class="mx-auto h-12 w-12 mb-4 opacity-50" />
			<p class="text-lg font-medium">No mods found</p>
			<p class="text-sm">Try adjusting your search or filters</p>
		</div>
	{:else}
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
			{#each results as mod}
				<Card.Root class="group relative flex flex-col overflow-hidden">
					<div class="flex items-start gap-3 p-4 pb-3">
						{#if mod.icon_url}
							<img
								src={mod.icon_url}
								alt={mod.title}
								class="h-12 w-12 shrink-0 rounded-lg object-cover"
								loading="lazy"
							/>
						{:else}
							<div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted">
								<Puzzle class="h-5 w-5 text-muted-foreground" />
							</div>
						{/if}
						<div class="min-w-0 flex-1">
							<h3 class="truncate text-sm font-semibold text-foreground">{mod.title}</h3>
							<p class="truncate text-xs text-muted-foreground">{mod.author}</p>
						</div>
					</div>
					<div class="px-4 pb-2">
						<p class="line-clamp-2 text-xs text-muted-foreground">{mod.description}</p>
					</div>
					<div class="flex flex-wrap gap-1 px-4 pb-3">
						{#if mod.loaders}
							{#each mod.loaders.slice(0, 3) as loader}
								<Badge variant="outline" class="text-[10px] capitalize">{loader}</Badge>
							{/each}
						{/if}
						{#if mod.game_versions}
							<Badge variant="secondary" class="text-[10px]">{mod.game_versions[0]}</Badge>
						{/if}
					</div>
					<div class="mt-auto flex items-center gap-3 border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
						<div class="flex items-center gap-1">
							<Download class="h-3 w-3" />
							{formatDownloads(mod.downloads)}
						</div>
						<div class="flex items-center gap-1">
							<Star class="h-3 w-3" />
							{mod.follows}
						</div>
						<div class="ml-auto flex gap-1">
							{#if mod.client_side === 'required'}
								<User class="h-3 w-3 text-green-500" aria-label="Client-side required" />
							{:else if mod.client_side === 'optional'}
								<User class="h-3 w-3 text-muted-foreground/50" aria-label="Client-side optional" />
							{/if}
							{#if mod.server_side === 'required'}
								<ServerIcon class="h-3 w-3 text-green-500" aria-label="Server-side required" />
							{:else if mod.server_side === 'optional'}
								<ServerIcon class="h-3 w-3 text-muted-foreground/50" aria-label="Server-side optional" />
							{/if}
						</div>
					</div>
					<div class="p-4 pt-0">
						<Button class="w-full" size="sm" onclick={() => {/* install */}}>
							<Download class="mr-1.5 h-3.5 w-3.5" />
							Install
						</Button>
					</div>
				</Card.Root>
			{/each}
		</div>

		{#if totalPages > 1}
			<div class="flex items-center justify-center gap-4 py-4">
				<Button variant="outline" size="sm" disabled={offset === 0} onclick={prevPage}>
					<ChevronLeft class="mr-1 h-4 w-4" />
					Previous
				</Button>
				<span class="text-sm text-muted-foreground">
					Page {currentPage} of {totalPages}
				</span>
				<Button variant="outline" size="sm" disabled={offset + 24 >= totalHits} onclick={nextPage}>
					Next
					<ChevronRight class="ml-1 h-4 w-4" />
				</Button>
			</div>
		{/if}
	{/if}
</div>
