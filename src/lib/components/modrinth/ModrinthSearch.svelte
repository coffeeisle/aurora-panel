<script lang="ts">
	import { page } from '$app/stores';
	import AllowIncompatibleToggle from '$lib/components/modrinth/AllowIncompatibleToggle.svelte';
	import { toasts } from '$lib/stores/toast';
	import { installedProjects } from '$lib/stores/installed';
	import { Search, Download, ExternalLink, Users, Loader2, RefreshCw, Check } from '@lucide/svelte';

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

	let latestVersions = $state<Map<string, string>>(new Map());

	$effect(() => {
		try {
			allowIncompatible = localStorage.getItem(storageKey) === 'true';
		} catch {}
		loadInstalledFromStorage();
	});

	const storageInstalledKey = $derived(`aurora:installed:${serverId}:${projectType}`);

	function loadInstalledFromStorage() {
		try {
			const stored = localStorage.getItem(storageInstalledKey);
			if (stored) {
				const parsed = JSON.parse(stored) as Record<string, import('$lib/stores/installed').InstalledEntry>;
				installedProjects.fromJSON(parsed);
			}
		} catch {}
	}

	function saveInstalledToStorage() {
		try {
			const current = $installedProjects;
			localStorage.setItem(storageInstalledKey, JSON.stringify(installedProjects.toJSON(current)));
		} catch {}
	}

	function addInstalled(projectId: string, versionId: string, versionNumber: string, title?: string) {
		installedProjects.addEntry(projectId, versionId, versionNumber, title);
		saveInstalledToStorage();
	}

	async function checkLatestVersion(projectId: string): Promise<string | null> {
		try {
			const res = await fetch(`/api/modrinth/project/${projectId}/latest`);
			if (!res.ok) return null;
			const data = await res.json();
			return data.version_number ?? null;
		} catch {
			return null;
		}
	}

	function needsUpdate(entry: import('$lib/stores/installed').InstalledEntry): boolean {
		const latest = latestVersions.get(entry.projectId);
		if (!latest) return false;
		return latest !== entry.versionNumber;
	}

	async function refreshLatestVersions() {
		const installed = Array.from($installedProjects.values());
		const versionMap = new Map<string, string>();
		for (const entry of installed) {
			const latest = await checkLatestVersion(entry.projectId);
			if (latest) versionMap.set(entry.projectId, latest);
		}
		latestVersions = versionMap;
	}

	let debounceTimer: ReturnType<typeof setTimeout>;

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
		const projectId = project.project_id;
		if (installing.has(projectId)) return;

		installing = new Set(installing).add(projectId);

		try {
			const res = await fetch(`/api/servers/${serverId}/modrinth/install`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ projectId, projectType, allowIncompatible })
			});

			const data = await res.json();

			if (!res.ok) {
				if (data.compatible === false && !allowIncompatible) {
					toasts.warning(
						'Incompatible Install Blocked',
						data.reasons?.join('; ') || 'Version or loader mismatch. Enable "Allow Incompatible Installs" to bypass.'
					);
				} else {
					toasts.error('Install Failed', data.error || `HTTP ${res.status}`);
				}
				return;
			}

			addInstalled(projectId, data.version?.id || '', data.version?.versionNumber || '', project.title);
			refreshLatestVersions();
			toasts.success(
				`${project.title} installed`,
				`${data.version?.versionNumber || data.file.name} → ${data.file.targetFolder}/${data.file.name}${data.dependencies > 0 ? ` (${data.dependencies} dependencies resolved)` : ''}`
			);
		} catch (e) {
			toasts.error('Install Error', e instanceof Error ? e.message : 'Network error');
		} finally {
			const next = new Set(installing);
			next.delete(projectId);
			installing = next;
		}
	}

	async function updateAll() {
		const installed = Array.from($installedProjects.values());
		if (installed.length === 0) {
			toasts.info('Nothing to update', 'No installed items to check.');
			return;
		}
		updatingAll = true;
		let updated = 0;
		let failed = 0;
		for (const entry of installed) {
			try {
				const res = await fetch(`/api/servers/${serverId}/modrinth/install`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ projectId: entry.projectId, projectType, allowIncompatible })
				});
				if (res.ok) {
					const data = await res.json();
					addInstalled(entry.projectId, data.version?.id || '', data.version?.versionNumber || '', entry.title);
					updated++;
				} else failed++;
			} catch {
				failed++;
			}
		}
		updatingAll = false;
		refreshLatestVersions();
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
			datapack: '📋', mod: '🧩', plugin: '🔌', modpack: '📦'
		};
		return icons[cat.toLowerCase()] || '📦';
	}

	function getEnvIcon(side: string): string {
		if (side === 'required') return '✔️';
		if (side === 'optional') return '❓';
		return '❌';
	}
</script>

<div class="flex h-full flex-col">
	<div class="mb-4 flex items-center justify-between">
		<div>
			<h1 class="text-lg font-bold text-foreground">{title}</h1>
			<p class="text-xs text-muted-foreground mt-0.5">
				{$installedProjects.size} installed
				{#if $installedProjects.size > 1}
					· <button class="underline hover:text-foreground transition-colors" onclick={updateAll} disabled={updatingAll}>
						{updatingAll ? 'Updating...' : 'Update All'}
					</button>
				{/if}
			</p>
		</div>
		{#if $installedProjects.size > 1}
			<button
				class="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
				disabled={updatingAll}
				onclick={updateAll}
			>
				{#if updatingAll}
					<Loader2 class="h-3.5 w-3.5 animate-spin" />
				{:else}
					<RefreshCw class="h-3.5 w-3.5" />
				{/if}
				Update All ({$installedProjects.size})
			</button>
		{/if}
	</div>

	<div class="flex gap-4 flex-1 overflow-hidden">
		<aside class="w-56 flex-shrink-0 space-y-4">
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
				<div class="flex flex-wrap gap-1.5">
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
					class="w-full rounded-lg border border-border bg-background py-2 pl-10 pr-4 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary transition-all"
					oninput={(e) => debouncedSearch((e.target as HTMLInputElement).value)}
				/>
			</div>

			<div class="flex-1 overflow-y-auto space-y-2">
				{#if loading && results.length === 0}
					<div class="flex items-center justify-center py-12">
						<div class="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
					</div>
				{:else if error}
					<div class="flex items-center justify-center py-12 text-sm text-red-400">{error}</div>
				{:else if results.length === 0}
					<div class="flex items-center justify-center py-12 text-sm text-muted-foreground">
						{searchQuery ? 'No results found' : 'Start typing to search'}
					</div>
				{:else}
				{#each results as project (project.project_id)}
					{@const isInstalled = $installedProjects.has(project.project_id)}
					{@const entry = isInstalled ? $installedProjects.get(project.project_id) : null}
					{@const hasUpdate = entry ? needsUpdate(entry) : false}
					<div class="flex gap-4 rounded-xl border border-border bg-card p-3.5 transition-all duration-200 hover:border-primary/20 hover:shadow-sm hover:shadow-primary/5">
						<img
							src={project.icon_url || '/placeholder-icon.png'}
							alt={project.title}
							class="h-14 w-14 flex-shrink-0 rounded-lg object-cover"
						/>
						<div class="flex-1 min-w-0">
							<div class="flex items-start justify-between gap-2">
								<div class="min-w-0">
									<div class="flex items-center gap-2">
										<h3 class="text-sm font-semibold text-foreground truncate">{project.title}</h3>
										<span class="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground uppercase">{project.project_type}</span>
									</div>
									<p class="text-xs text-muted-foreground">by <span class="text-foreground/70">{project.author}</span></p>
								</div>
								<a
									href="https://modrinth.com/{project.project_type}/{project.slug}"
									target="_blank"
									rel="noopener noreferrer"
									class="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
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
								<span class="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
									<Download class="h-3 w-3" />
									{formatNumber(project.downloads)}
								</span>
								<span class="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
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
						<div class="flex flex-col items-center gap-2 justify-center">
							<button
								class="rounded-lg px-4 py-2 text-xs font-semibold transition-all duration-150 {isInstalled ? 'bg-muted text-muted-foreground cursor-default' : installing.has(project.project_id) ? 'bg-muted text-muted-foreground cursor-wait' : 'bg-primary text-primary-foreground shadow-sm shadow-primary/20 hover:shadow-md hover:shadow-primary/30 hover:brightness-110'}"
								disabled={isInstalled || installing.has(project.project_id)}
								onclick={() => installProject(project)}
							>
								{#if installing.has(project.project_id)}
									<Loader2 class="h-3.5 w-3.5 animate-spin" />
								{:else if isInstalled}
									<Check class="h-3.5 w-3.5" />
								{:else}
									Install
								{/if}
							</button>
							{#if isInstalled}
								{#if hasUpdate}
									<span class="inline-flex items-center gap-1 rounded-md bg-yellow-500/10 px-2 py-0.5 text-[10px] text-yellow-400">
										Update available
									</span>
								{:else}
									<span class="text-[10px] text-green-400">Latest</span>
								{/if}
							{/if}
						</div>
					</div>
				{/each}

					{#if results.length < totalResults}
						<div class="flex justify-center py-4">
							<button
								class="rounded-md border border-border px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
								disabled={loading}
								onclick={() => performSearch(offset + 20)}
							>
								{loading ? 'Loading...' : `Load More (${results.length} / ${totalResults})`}
							</button>
						</div>
					{/if}
				{/if}
			</div>
		</div>
	</div>
</div>
