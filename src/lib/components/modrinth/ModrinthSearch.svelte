<script lang="ts">
	import { page } from '$app/stores';
	import AllowIncompatibleToggle from '$lib/components/modrinth/AllowIncompatibleToggle.svelte';
	import { toasts } from '$lib/stores/toast';
	import { Search, Download, ExternalLink, Users, Loader2, Check, RefreshCw, AlertTriangle, Star, Package, BookOpen } from '@lucide/svelte';

	type ModrinthProject = {
		project_id: string;
		project_type: string;
		slug: string;
		author: string;
		title: string;
		description: string;
		categories: string[];
		display_categories: string[];
		versions: string[];
		downloads: number;
		follows: number;
		icon_url: string;
		color: number;
		client_side: 'required' | 'optional' | 'unsupported' | 'unknown';
		server_side: 'required' | 'optional' | 'unsupported' | 'unknown';
		date_modified: string;
	};

	type Props = {
		projectType: string;
		filterOptions: {
			gameVersions: string[];
			loaders: string[];
			categories: string[];
		};
		title: string;
	};

	let { projectType, filterOptions, title }: Props = $props();

	let searchQuery = $state('');
	let results = $state<ModrinthProject[]>([]);
	let loading = $state(false);
	let error = $state('');
	let offset = $state(0);
	let totalResults = $state(0);
	let installing = $state<Set<string>>(new Set());
	let updatingAll = $state(false);

	let selectedVersions = $state<string[]>([]);
	let selectedLoaders = $state<string[]>([]);
	let selectedCategories = $state<string[]>([]);
	let selectedEnvironments = $state<string[]>(['server', 'client']);

	const serverId = $derived($page.params.id);
	const storageKey = $derived(`aurora:allowIncompatible:${serverId}`);
	let allowIncompatible = $state(false);

	let installedIds = $state(new Set<string>());
	let installedMap = $state<Record<string, { version: string; hasUpdate: boolean }>>({});
	let updateCheckDone = $state(false);

	let debounceTimer: ReturnType<typeof setTimeout>;

	$effect(() => {
		try {
			allowIncompatible = localStorage.getItem(storageKey) === 'true';
		} catch {}
		loadInstalledState();
	});

	async function loadInstalledState() {
		try {
			const res = await fetch(`/api/servers/${serverId}/modrinth`);
			if (res.ok) {
				const items = await res.json();
				const ids = new Set<string>(items.map((i: { projectId: string }) => i.projectId));
				const map: Record<string, { version: string; hasUpdate: boolean }> = {};
				for (const item of items) {
					map[item.projectId] = { version: item.versionNumber, hasUpdate: false };
				}
				installedIds = ids;
				installedMap = map;

				if (ids.size > 0) {
					const updateRes = await fetch(`/api/servers/${serverId}/modrinth/check-updates`, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ projectIds: Array.from(ids) }),
					});
					if (updateRes.ok) {
						const updates = await updateRes.json();
						for (const [pid, info] of Object.entries(updates as Record<string, { hasUpdate: boolean }>)) {
							if (map[pid]) map[pid].hasUpdate = info.hasUpdate;
						}
						installedMap = { ...map };
					}
					updateCheckDone = true;
				}
			}
		} catch {}
	}

	function debouncedSearch(query: string) {
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			searchQuery = query;
			offset = 0;
			results = [];
			performSearch();
		}, 300);
	}

	async function performSearch(newOffset = 0) {
		loading = true;
		error = '';
		offset = newOffset;
		const params = new URLSearchParams();
		params.set('query', searchQuery);
		params.set('type', projectType);
		params.set('offset', String(offset));

		const facets: string[][] = [];
		if (selectedVersions.length > 0) {
			facets.push(['versions:' + selectedVersions.join('|')]);
		}
		if (selectedLoaders.length > 0) {
			facets.push(selectedLoaders.map(l => 'categories:' + l));
		}
		if (selectedCategories.length > 0) {
			facets.push(selectedCategories.map(c => 'categories:' + c));
		}
		if (selectedEnvironments.length > 0 && selectedEnvironments.length < 3) {
			if (selectedEnvironments.length === 1) {
				const env = selectedEnvironments[0];
				if (env === 'server') {
					facets.push(['server_side:required', 'server_side:optional']);
				} else if (env === 'client') {
					facets.push(['client_side:required', 'client_side:optional']);
				}
			} else {
				if (!selectedEnvironments.includes('server')) {
					facets.push(['server_side:unsupported']);
				}
				if (!selectedEnvironments.includes('client')) {
					facets.push(['client_side:unsupported']);
				}
			}
		}
		params.set('facets', JSON.stringify(facets));
		params.set('limit', '20');

		try {
			const res = await fetch(`/api/modrinth/search?${params}`);
			if (!res.ok) {
				const text = await res.text();
				throw new Error(text || `Search failed (${res.status})`);
			}
			const data = await res.json();
			if (newOffset === 0) {
				results = data.hits || [];
			} else {
				results = [...results, ...(data.hits || [])];
			}
			totalResults = data.total_hits || 0;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Search failed';
			results = [];
		} finally {
			loading = false;
		}
	}

	async function installProject(project: ModrinthProject) {
		const pid = project.project_id;
		if (installing.has(pid)) return;
		installing = new Set(installing).add(pid);

		try {
			const res = await fetch(`/api/servers/${serverId}/modrinth/install`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ projectId: pid, projectType, allowIncompatible }),
			});

			const data = await res.json();

			if (!res.ok) {
				if (data.compatible === false && !allowIncompatible) {
					toasts.warning('Incompatible', data.reasons?.join('; ') || 'Version or loader mismatch. Enable "Allow Incompatible" to bypass.');
				} else {
					toasts.error('Install Failed', data.error || `HTTP ${res.status}`);
				}
				return;
			}

			toasts.success(`${project.title} installed`, `${data.version.versionNumber} → ${projectType} folder${data.dependencies > 0 ? ` (${data.dependencies} dependencies)` : ''}`);

			installedIds = new Set(installedIds).add(pid);
			installedMap = { ...installedMap, [pid]: { version: data.version.versionNumber, hasUpdate: false } };
		} catch (e) {
			toasts.error('Install Error', e instanceof Error ? e.message : 'Network error');
		} finally {
			const next = new Set(installing);
			next.delete(pid);
			installing = next;
		}
	}

	async function updateProject(project: ModrinthProject) {
		const pid = project.project_id;
		if (installing.has(pid)) return;
		installing = new Set(installing).add(pid);

		try {
			const res = await fetch(`/api/servers/${serverId}/modrinth/install`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ projectId: pid, projectType, allowIncompatible }),
			});

			const data = await res.json();
			if (!res.ok) {
				toasts.error('Update Failed', data.error || `HTTP ${res.status}`);
				return;
			}

			const oldVer = installedMap[pid]?.version || '?';
			toasts.success(`${project.title} updated`, `${oldVer} → ${data.version.versionNumber}`);

			installedMap = { ...installedMap, [pid]: { version: data.version.versionNumber, hasUpdate: false } };
		} catch (e) {
			toasts.error('Update Error', e instanceof Error ? e.message : 'Network error');
		} finally {
			const next = new Set(installing);
			next.delete(pid);
			installing = next;
		}
	}

	async function updateAll() {
		const toUpdate = Object.entries(installedMap).filter(([_, info]) => info.hasUpdate);
		if (toUpdate.length === 0) {
			toasts.info('Nothing to update', 'All installed items are up to date');
			return;
		}
		updatingAll = true;
		let updated = 0;
		let failed = 0;
		for (const [pid] of toUpdate) {
			try {
				const res = await fetch(`/api/servers/${serverId}/modrinth/install`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ projectId: pid, projectType, allowIncompatible }),
				});
				if (res.ok) {
					const data = await res.json();
					installedMap = { ...installedMap, [pid]: { version: data.version.versionNumber, hasUpdate: false } };
					updated++;
				} else failed++;
			} catch { failed++; }
		}
		updatingAll = false;
		if (updated > 0) {
			toasts.success('Update All complete', `${updated} updated, ${failed} failed`);
		}
	}

	function toggleFilter(arr: string[], value: string): string[] {
		return arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value];
	}

	function formatNumber(n: number): string {
		if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
		if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
		return String(n);
	}

	function getCategoryIcon(cat: string): string {
		const icons: Record<string, string> = {
			speed: '🚀', optimization: '⚡', performance: '⚡',
			utility: '🔧', utilities: '🔧', worldgen: '🌍', world_generation: '🌍',
			storage: '📦', tech: '🔬', magic: '🔮', adventure: '🗡️',
			rpg: '🎮', food: '🍔', decoration: '🎨', building: '🏗️',
			library: '📚', api: '🔌', fabric: '🔶', forge: '🔷',
			quilt: '🟣', neoforge: '🟠', paper: '📄', spigot: '🟡',
			datapack: '📋', mod: '🧩', plugin: '🔌', modpack: '📦',
		};
		return icons[cat.toLowerCase()] || '📦';
	}

	function getEnvIcon(side: string): string {
		if (side === 'required') return '✔️';
		if (side === 'optional') return '❓';
		return '❌';
	}

	const installedCount = $derived(Object.keys(installedMap).length);
	const hasUpdates = $derived(Object.values(installedMap).some(i => i.hasUpdate));
	const updateCount = $derived(Object.values(installedMap).filter(i => i.hasUpdate).length);
</script>

<div class="flex h-full flex-col">
	<div class="mb-4 flex items-center justify-between">
		<div>
			<h1 class="text-lg font-bold text-foreground">{title}</h1>
			<p class="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
				<span>{installedCount} installed</span>
				{#if hasUpdates}
					<button class="underline hover:text-foreground transition-colors" onclick={updateAll} disabled={updatingAll}>
						{updatingAll ? 'Updating...' : `Update All (${updateCount})`}
					</button>
				{/if}
				{#if !loading && results.length > 0}
					<span class="text-muted-foreground/50">·</span>
					<span>{Math.min(totalResults, 10000)}+ results</span>
				{/if}
			</p>
		</div>
		{#if hasUpdates}
			<button
				class="flex items-center gap-1.5 rounded-md border border-yellow-500/30 px-3 py-1.5 text-xs text-yellow-400 hover:bg-yellow-500/10 transition-colors disabled:opacity-50"
				disabled={updatingAll}
				onclick={updateAll}
			>
				{#if updatingAll}
					<Loader2 class="h-3.5 w-3.5 animate-spin" />
				{:else}
					<RefreshCw class="h-3.5 w-3.5" />
				{/if}
				Update All ({updateCount})
			</button>
		{/if}
	</div>

	<div class="flex gap-4 flex-1 overflow-hidden">
		<aside class="w-56 flex-shrink-0 space-y-4 overflow-y-auto">
			<div>
				<h3 class="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Game Version</h3>
				<div class="flex flex-wrap gap-1.5">
					{#each filterOptions.gameVersions as version}
						<button
							class="rounded-md border px-2 py-1 text-xs transition-colors {selectedVersions.includes(version) ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-muted-foreground'}"
							onclick={() => { selectedVersions = toggleFilter(selectedVersions, version); offset = 0; results = []; performSearch(); }}
						>
							{version}
						</button>
					{/each}
				</div>
			</div>
			<div>
				<h3 class="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Loader</h3>
				<div class="flex flex-wrap gap-1.5">
					{#each filterOptions.loaders as loader}
						<button
							class="rounded-md border px-2 py-1 text-xs transition-colors {selectedLoaders.includes(loader) ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-muted-foreground'}"
							onclick={() => { selectedLoaders = toggleFilter(selectedLoaders, loader); offset = 0; results = []; performSearch(); }}
						>
							{loader}
						</button>
					{/each}
				</div>
			</div>
			<div>
				<h3 class="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Category</h3>
				<div class="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
					{#each filterOptions.categories as category}
						<button
							class="rounded-md border px-2 py-1 text-xs transition-colors {selectedCategories.includes(category) ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-muted-foreground'}"
							onclick={() => { selectedCategories = toggleFilter(selectedCategories, category); offset = 0; results = []; performSearch(); }}
						>
							{getCategoryIcon(category)} {category}
						</button>
					{/each}
				</div>
			</div>
			<div>
				<h3 class="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Environment</h3>
				<div class="flex flex-wrap gap-1.5">
					<button
						class="rounded-md border px-2 py-1 text-xs transition-colors {selectedEnvironments.includes('server') ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-muted-foreground'}"
						onclick={() => { selectedEnvironments = toggleFilter(selectedEnvironments, 'server'); offset = 0; results = []; performSearch(); }}
					>
						Server
					</button>
					<button
						class="rounded-md border px-2 py-1 text-xs transition-colors {selectedEnvironments.includes('client') ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-muted-foreground'}"
						onclick={() => { selectedEnvironments = toggleFilter(selectedEnvironments, 'client'); offset = 0; results = []; performSearch(); }}
					>
						Client
					</button>
				</div>
			</div>
			<div class="border-t border-border pt-4">
				<AllowIncompatibleToggle
					enabled={allowIncompatible}
					onToggle={(v) => {
						allowIncompatible = v;
						try {
							if (v) localStorage.setItem(storageKey, 'true');
							else localStorage.removeItem(storageKey);
						} catch {}
					}}
				/>
			</div>
		</aside>

		<div class="flex-1 flex flex-col overflow-hidden">
			<div class="relative mb-4">
				<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
				<input
					type="text"
					placeholder="Search {title.toLowerCase()}..."
					class="w-full rounded-lg border border-border bg-background py-2 pl-10 pr-10 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary transition-all"
					oninput={(e) => debouncedSearch((e.target as HTMLInputElement).value)}
				/>
				{#if searchQuery}
					<button
						class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
						onclick={() => { searchQuery = ''; results = []; offset = 0; performSearch(); }}
					>
						×
					</button>
				{/if}
			</div>

			<div class="flex-1 overflow-y-auto space-y-2">
				{#if loading && results.length === 0}
					<div class="flex items-center justify-center py-12">
						<Loader2 class="h-6 w-6 animate-spin text-muted-foreground" />
					</div>
				{:else if error}
					<div class="flex items-center justify-center rounded-xl border border-red-500/20 bg-red-500/5 py-12 text-sm text-red-400">
						<AlertTriangle class="mr-2 h-4 w-4" />
						{error}
					</div>
				{:else if results.length === 0}
					<div class="flex flex-col items-center justify-center py-12 text-sm text-muted-foreground">
						<Package class="mb-3 h-10 w-10 opacity-30" />
						<p class="font-medium">{searchQuery ? 'No results found' : `Search for ${title.toLowerCase()}`}</p>
						<p class="text-xs mt-1 text-center max-w-sm">
							{searchQuery ? 'Try different search terms or adjust your filters' : `Browse Modrinth to find ${title.toLowerCase()} to install.`}
						</p>
					</div>
				{:else}
					{#each results as project (project.project_id)}
						{@const isInstalled = installedIds.has(project.project_id)}
						{@const entry = installedMap[project.project_id]}
						{@const hasUpdate = entry?.hasUpdate ?? false}
						{@const bgColor = project.color ? `#${project.color.toString(16).padStart(6, '0')}` : null}
						<div
							class="flex gap-4 rounded-xl border bg-card p-3.5 transition-all duration-200 {isInstalled ? 'border-primary/20 ring-1 ring-primary/10' : 'border-border hover:border-primary/20 hover:shadow-sm hover:shadow-primary/5'}"
							style={bgColor && !isInstalled ? `border-left: 3px solid ${bgColor}` : ''}
						>
							<div class="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg {bgColor ? '' : 'bg-muted'}">
								{#if project.icon_url}
									<img src={project.icon_url} alt={project.title} class="h-full w-full object-cover" loading="lazy" />
								{:else}
									<div class="flex h-full w-full items-center justify-center text-lg" style={bgColor ? `background: ${bgColor}20` : ''}>
										{project.title.charAt(0).toUpperCase()}
									</div>
								{/if}
							</div>
							<div class="flex-1 min-w-0">
								<div class="flex items-start justify-between gap-2">
									<div class="min-w-0">
										<div class="flex items-center gap-2">
											<h3 class="text-sm font-semibold text-foreground truncate">{project.title}</h3>
											<span class="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground uppercase">{project.project_type}</span>
											{#if isInstalled}
												<span class="shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">Installed</span>
											{/if}
										</div>
										<p class="text-xs text-muted-foreground">by <span class="text-foreground/70">{project.author}</span></p>
									</div>
									<a
										href="https://modrinth.com/{project.project_type}/{project.slug}"
										target="_blank"
										rel="noopener noreferrer"
										class="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
										title="View on Modrinth"
									>
										<ExternalLink class="h-3.5 w-3.5" />
									</a>
								</div>
								<p class="mt-1.5 text-xs leading-relaxed text-muted-foreground line-clamp-2">{project.description}</p>
								<div class="mt-2.5 flex flex-wrap items-center gap-2">
									{#each project.display_categories.slice(0, 3) as cat}
										<span class="inline-flex items-center gap-1 rounded-md bg-muted/60 px-2 py-0.5 text-[11px] text-muted-foreground">
											{getCategoryIcon(cat)} {cat}
										</span>
									{/each}
									<span class="inline-flex items-center gap-1 text-[11px] text-muted-foreground" title="Downloads">
										<Download class="h-3 w-3" />
										{formatNumber(project.downloads)}
									</span>
									<span class="inline-flex items-center gap-1 text-[11px] text-muted-foreground" title="Followers">
										<Users class="h-3 w-3" />
										{formatNumber(project.follows)}
									</span>
									<div class="flex items-center gap-1.5 ml-auto">
										<span title="Client side: {project.client_side}" class="text-[11px] {project.client_side === 'required' ? 'text-green-400' : project.client_side === 'optional' ? 'text-yellow-400' : 'text-red-400'}">
											{getEnvIcon(project.client_side)} Client
										</span>
										<span title="Server side: {project.server_side}" class="text-[11px] {project.server_side === 'required' ? 'text-green-400' : project.server_side === 'optional' ? 'text-yellow-400' : 'text-red-400'}">
											{getEnvIcon(project.server_side)} Server
										</span>
									</div>
								</div>
							</div>
							<div class="flex flex-col items-center gap-2 justify-center min-w-[80px]">
								{#if isInstalled}
									<button
										class="flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-150 {hasUpdate ? 'bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20' : 'bg-green-500/10 text-green-400 cursor-default'}"
										disabled={installing.has(project.project_id)}
										onclick={() => hasUpdate ? updateProject(project) : undefined}
									>
										{#if installing.has(project.project_id)}
											<Loader2 class="h-3.5 w-3.5 animate-spin" />
										{:else if hasUpdate}
											<RefreshCw class="h-3.5 w-3.5" />
											Update
										{:else}
											<Check class="h-3.5 w-3.5" />
											Installed
										{/if}
									</button>
									{#if hasUpdate}
										<span class="text-[10px] text-yellow-400 font-medium">v{entry?.version} → latest</span>
									{:else if entry}
										<span class="text-[10px] text-green-400/70">v{entry.version}</span>
									{/if}
								{:else}
									<button
										class="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-sm shadow-primary/20 transition-all duration-150 hover:shadow-md hover:shadow-primary/30 disabled:opacity-50 disabled:cursor-wait"
										disabled={installing.has(project.project_id)}
										onclick={() => installProject(project)}
									>
										{#if installing.has(project.project_id)}
											<Loader2 class="h-3.5 w-3.5 animate-spin" />
										{:else}
											<Download class="h-3.5 w-3.5" />
											Install
										{/if}
									</button>
								{/if}
							</div>
						</div>
					{/each}

					{#if results.length < totalResults && results.length < 10000}
						<div class="flex justify-center py-4">
							<button
								class="rounded-md border border-border px-5 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
								disabled={loading}
								onclick={() => performSearch(offset + 20)}
							>
								{loading ? 'Loading...' : `Load More (${results.length} / ${Math.min(totalResults, 10000)})`}
							</button>
						</div>
					{/if}
				{/if}
			</div>
		</div>
	</div>
</div>
