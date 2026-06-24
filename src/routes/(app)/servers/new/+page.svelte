<script lang="ts">
	import { onMount } from 'svelte';
	import { toasts } from '$lib/stores/toast';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import Input from '$lib/components/ui/input/input.svelte';
	import * as Card from '$lib/components/ui/card';
	import {
		ChevronLeft, ChevronRight, Check, Server, Package,
		SlidersHorizontal, Download, Search, X, Loader2,
		ArrowRight, HardDrive, MemoryStick, Globe, Cpu
	} from '@lucide/svelte';

	type Software = { id: string; name: string; loader: string; platform: string };
	type ModrinthItem = { projectId: string; title: string; slug: string; type: 'mod' | 'plugin' | 'datapack' };

	const games = [
		{ value: 'minecraft', label: 'Minecraft' },
		{ value: 'palworld', label: 'Palworld' },
		{ value: 'valheim', label: 'Valheim' },
		{ value: 'satisfactory', label: 'Satisfactory' },
		{ value: 'terraria', label: 'Terraria' },
		{ value: 'enshrouded', label: 'Enshrouded' }
	];

	const softwareOptions: Record<string, Software[]> = {
		minecraft: [
			{ id: 'vanilla', name: 'Vanilla', loader: 'vanilla', platform: 'vanilla' },
			{ id: 'paper', name: 'Paper', loader: 'paper', platform: 'paper' },
			{ id: 'purpur', name: 'Purpur', loader: 'purpur', platform: 'purpur' },
			{ id: 'fabric', name: 'Fabric', loader: 'fabric', platform: 'fabric' },
			{ id: 'forge', name: 'Forge', loader: 'forge', platform: 'forge' },
			{ id: 'neoforge', name: 'NeoForge', loader: 'neoforge', platform: 'neoforge' },
			{ id: 'quilt', name: 'Quilt', loader: 'quilt', platform: 'quilt' },
			{ id: 'spigot', name: 'Spigot', loader: 'spigot', platform: 'spigot' },
			{ id: 'bukkit', name: 'Bukkit', loader: 'bukkit', platform: 'bukkit' },
			{ id: 'folia', name: 'Folia', loader: 'folia', platform: 'folia' }
		]
	};

	const versions = ['1.21.4', '1.21.3', '1.21', '1.20.6', '1.20.4', '1.20.1', '1.19.4', '1.19.2', '1.18.2', '1.17.1', '1.16.5'];
	const gameTypeMap: Record<string, string> = {
		minecraft: 'minecraft', palworld: 'steamcmd', valheim: 'steamcmd',
		satisfactory: 'steamcmd', terraria: 'generic', enshrouded: 'steamcmd'
	};
	const modLoaderSoftware = ['fabric', 'forge', 'neoforge', 'quilt'];
	const pluginSoftware = ['paper', 'purpur', 'spigot'];

	let step = $state(1);
	let creating = $state(false);
	let nodeList = $state<{ id: string; name: string }[]>([]);
	let nodesLoading = $state(true);

	let name = $state('');
	let game = $state('minecraft');
	let node = $state('');
	let gameType = $derived(gameTypeMap[game] || 'generic');

	let software = $state<Software | null>(null);
	let version = $state('1.21.4');

	let memory = $state(1024);
	let disk = $state(10240);
	let cpu = $state(100);
	let port = $state(25565);
	let processType = $state<'docker' | 'bare'>('docker');
	let dockerImage = $state('itzg/minecraft-server:latest');

	let searchQuery = $state('');
	let searchResults = $state<ModrinthItem[]>([]);
	let searching = $state(false);
	let selectedItems = $state<ModrinthItem[]>([]);

	let nameError = $state('');
	let nodeError = $state('');
	let portError = $state('');

	const canInstallMods = $derived(software && modLoaderSoftware.includes(software.id));
	const canInstallPlugins = $derived(software && pluginSoftware.includes(software.id));
	const hasInitialContentStep = $derived(game === 'minecraft');

	const steps = [
		{ num: 1, label: 'Basic Info', icon: Server },
		{ num: 2, label: 'Software', icon: Package },
		{ num: 3, label: 'Resources', icon: SlidersHorizontal },
		{ num: 4, label: 'Content', icon: Download },
		{ num: 5, label: 'Review', icon: Check }
	];
	const visibleSteps = $derived(hasInitialContentStep ? steps : steps.slice(0, 5));
	const totalSteps = $derived(visibleSteps.length);

	onMount(async () => {
		try {
			const res = await fetch('/api/nodes');
			if (res.ok) {
				const data = await res.json();
				nodeList = data.map((n: { id: string; name?: string }) => ({ id: n.id, name: n.name || n.id }));
			}
		} catch { /* ignore */ }
		nodesLoading = false;
	});

	function validateStep1(): boolean {
		let valid = true;
		if (!name.trim()) { nameError = 'Server name is required'; valid = false; } else { nameError = ''; }
		if (!node) { nodeError = 'Select a node'; valid = false; } else { nodeError = ''; }
		return valid;
	}
	function validateStep3(): boolean {
		let valid = true;
		if (!port || port < 1 || port > 65535) { portError = 'Port must be 1–65535'; valid = false; } else { portError = ''; }
		return valid;
	}

	function nextStep() {
		if (step === 1 && !validateStep1()) return;
		if (step === 3 && !validateStep3()) return;
		if (step < totalSteps) step++;
	}
	function prevStep() { if (step > 1) step--; }

	async function searchModrinth() {
		if (!searchQuery.trim()) return;
		searching = true;
		try {
			const pType = canInstallMods ? 'mod' : canInstallPlugins ? 'plugin' : 'datapack';
			const params = new URLSearchParams({ query: searchQuery, limit: '10' });
			params.set('facets', JSON.stringify([[`project_type:${pType}`]]));
			const res = await fetch(`https://api.modrinth.com/v2/search?${params}`);
			if (!res.ok) throw new Error('Search failed');
			const data = await res.json();
			searchResults = (data.hits || []).map((h: Record<string, unknown>) => ({
				projectId: h.project_id as string,
				title: h.title as string,
				slug: h.slug as string,
				type: pType as 'mod' | 'plugin' | 'datapack'
			}));
		} catch (e) {
			toasts.error('Search failed', e instanceof Error ? e.message : 'Unknown error');
		} finally { searching = false; }
	}

	function addItem(item: ModrinthItem) {
		if (!selectedItems.find((i) => i.projectId === item.projectId)) {
			selectedItems = [...selectedItems, item];
		}
		searchQuery = '';
		searchResults = [];
	}

	function removeItem(projectId: string) {
		selectedItems = selectedItems.filter((i) => i.projectId !== projectId);
	}

	async function createServer() {
		if (step !== totalSteps) return;
		creating = true;
		try {
			const body = {
				name: name.trim(),
				game,
				type: gameType,
				gameVersion: version,
				loader: software?.loader || '',
				platform: software?.platform || '',
				nodeId: node,
				allocatedMemory: memory,
				allocatedDisk: disk,
				allocatedCpu: cpu,
				allocationPort: port,
				processType,
				dockerImage: processType === 'docker' ? dockerImage : undefined,
			};
			const res = await fetch('/api/servers', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});
			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				throw new Error(typeof err.error === 'string' ? err.error : `Creation failed (${res.status})`);
			}
			const data = await res.json();
			toasts.success('Server created', `${name} is being provisioned`);
			goto(`/servers/${data.id}/overview`);
		} catch (e) {
			toasts.error('Creation failed', e instanceof Error ? e.message : 'Unknown error');
		} finally { creating = false; }
	}

	function selectSoftware(sw: Software) {
		software = sw;
		if (sw.id !== 'vanilla' && sw.id !== 'bukkit') version = '1.21.4';
	}
</script>

<div class="mx-auto max-w-2xl space-y-8">
	<div>
		<h1 class="text-2xl font-bold tracking-tight text-foreground">Create Server</h1>
		<p class="mt-1 text-sm text-muted-foreground">Set up a new game server in a few steps</p>
	</div>

	<!-- Step Indicator -->
	<div class="flex items-center justify-center gap-0">
		{#each visibleSteps as s, i}
			<div class="flex items-center">
				<div class="flex items-center gap-2">
					<div
						class="flex h-9 w-9 items-center justify-center rounded-xl text-xs font-semibold transition-all duration-200 {step === s.num ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/30' : step > s.num ? 'bg-green-500/15 text-green-400' : 'bg-muted text-muted-foreground'}"
					>
						{#if step > s.num}
							<Check class="h-4 w-4" />
						{:else}
							<s.icon class="h-4 w-4" />
						{/if}
					</div>
					<span class="hidden text-xs font-medium text-foreground sm:inline">{s.label}</span>
				</div>
				{#if i < visibleSteps.length - 1}
					<div class="mx-3 h-px w-10 bg-border sm:w-16 {step > s.num ? 'bg-primary/30' : ''}"></div>
				{/if}
			</div>
		{/each}
	</div>

	<!-- Step 1: Basic Info -->
	{#if step === 1}
		<Card.Root class="border-border/60">
			<div class="p-6 space-y-5">
				<div>
					<Card.Title class="text-lg">Basic Information</Card.Title>
					<Card.Description>Enter the basic details for your new server.</Card.Description>
				</div>

				<div class="space-y-2">
					<label for="srv-name" class="text-xs font-medium text-foreground">Server Name <span class="text-red-400">*</span></label>
					<div class="relative">
						<Server class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
						<input
							id="srv-name"
							bind:value={name}
							placeholder="My Awesome Server"
							class="w-full rounded-lg border border-input bg-background py-2 pl-10 pr-4 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary transition-all {nameError ? 'border-red-400' : ''}"
						/>
					</div>
					{#if nameError}<p class="text-[11px] text-red-400">{nameError}</p>{/if}
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-2">
						<label for="srv-game" class="text-xs font-medium text-foreground">Game</label>
						<select
							id="srv-game"
							bind:value={game}
							class="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
						>
							{#each games as g}
								<option value={g.value}>{g.label}</option>
							{/each}
						</select>
					</div>

					<div class="space-y-2">
						<label for="srv-node" class="text-xs font-medium text-foreground">Node <span class="text-red-400">*</span></label>
						<select
							id="srv-node"
							bind:value={node}
							disabled={nodesLoading}
							class="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all disabled:opacity-50 {nodeError ? 'border-red-400' : ''}"
						>
							<option value="" disabled>{nodesLoading ? 'Loading...' : 'Select a node'}</option>
							{#each nodeList as n}
								<option value={n.id}>{n.name}</option>
							{/each}
						</select>
						{#if nodeError}<p class="text-[11px] text-red-400">{nodeError}</p>{/if}
					</div>
				</div>

				<div class="rounded-lg bg-muted/40 px-4 py-3">
					<div class="flex items-center gap-2 text-xs text-muted-foreground">
						<Globe class="h-3.5 w-3.5" />
						Game Type: <span class="font-medium text-foreground capitalize">{gameType}</span>
					</div>
				</div>
			</div>
		</Card.Root>
	{/if}

	<!-- Step 2: Software -->
	{#if step === 2}
		<Card.Root class="border-border/60">
			<div class="p-6 space-y-5">
				<div>
					<Card.Title class="text-lg">Server Software</Card.Title>
					<Card.Description>Choose the platform and version for your server.</Card.Description>
				</div>

				<div class="space-y-2">
					<p class="text-xs font-medium text-foreground">Platform</p>
					<div class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
						{#each softwareOptions[game] || [] as sw}
							<button
								class="flex flex-col items-center gap-2 rounded-xl border p-3.5 text-xs transition-all duration-150 {software?.id === sw.id ? 'border-primary bg-primary/8 text-foreground shadow-sm shadow-primary/10' : 'border-border/60 bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground hover:shadow-sm'}"
								onclick={() => selectSoftware(sw)}
							>
								<div class="flex h-8 w-8 items-center justify-center rounded-lg {software?.id === sw.id ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}">
									<Package class="h-4 w-4" />
								</div>
								<span class="font-medium">{sw.name}</span>
							</button>
						{/each}
					</div>
				</div>

				{#if game === 'minecraft'}
					<div class="space-y-2">
						<label for="srv-version" class="text-xs font-medium text-foreground">Game Version</label>
						<select
							id="srv-version"
							bind:value={version}
							class="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
						>
							{#each versions as v}
								<option value={v}>{v}</option>
							{/each}
						</select>
					</div>
				{/if}

				{#if !software}
					<div class="rounded-lg bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
						Select a platform above to continue.
					</div>
				{/if}
			</div>
		</Card.Root>
	{/if}

	<!-- Step 3: Resources -->
	{#if step === 3}
		<Card.Root class="border-border/60">
			<div class="p-6 space-y-5">
				<div>
					<Card.Title class="text-lg">Resource Allocation</Card.Title>
					<Card.Description>Configure resources, networking, and process mode.</Card.Description>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-2">
						<label for="srv-memory" class="text-xs font-medium text-foreground">
							<MemoryStick class="mr-1 inline h-3 w-3" /> Memory (MB)
						</label>
						<input
							id="srv-memory" type="number" bind:value={memory} min="128"
							class="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
						/>
					</div>
					<div class="space-y-2">
						<label for="srv-disk" class="text-xs font-medium text-foreground">
							<HardDrive class="mr-1 inline h-3 w-3" /> Disk (MB)
						</label>
						<input
							id="srv-disk" type="number" bind:value={disk} min="512"
							class="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
						/>
					</div>
					<div class="space-y-2">
						<label for="srv-cpu" class="text-xs font-medium text-foreground">
							<Cpu class="mr-1 inline h-3 w-3" /> CPU (%)
						</label>
						<input
							id="srv-cpu" type="number" bind:value={cpu} min="1" max="100"
							class="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
						/>
					</div>
					<div class="space-y-2">
						<label for="srv-port" class="text-xs font-medium text-foreground">Port <span class="text-red-400">*</span></label>
						<input
							id="srv-port" type="number" bind:value={port} min="1" max="65535"
							class="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all {portError ? 'border-red-400' : ''}"
						/>
						{#if portError}<p class="text-[11px] text-red-400">{portError}</p>{/if}
					</div>
				</div>

				<div class="rounded-lg border border-border/60 p-4 space-y-4">
					<p class="text-xs font-medium text-foreground">Process Mode</p>
					<div class="flex gap-3">
						<button
							class="flex-1 rounded-lg border p-3 text-xs transition-all duration-150 {processType === 'docker' ? 'border-primary bg-primary/8 text-foreground' : 'border-border/60 text-muted-foreground hover:border-muted-foreground/50'}"
							onclick={() => processType = 'docker'}
						>
							<span class="font-medium">Docker</span>
							<p class="mt-0.5 text-muted-foreground">Containerized isolation</p>
						</button>
						<button
							class="flex-1 rounded-lg border p-3 text-xs transition-all duration-150 {processType === 'bare' ? 'border-primary bg-primary/8 text-foreground' : 'border-border/60 text-muted-foreground hover:border-muted-foreground/50'}"
							onclick={() => processType = 'bare'}
						>
							<span class="font-medium">Bare Metal</span>
							<p class="mt-0.5 text-muted-foreground">Direct process</p>
						</button>
					</div>

					{#if processType === 'docker'}
						<div class="space-y-2">
							<label for="srv-image" class="text-xs font-medium text-foreground">Docker Image</label>
							<input
								id="srv-image" bind:value={dockerImage}
								placeholder="itzg/minecraft-server:latest"
								class="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
							/>
						</div>
					{/if}
				</div>
			</div>
		</Card.Root>
	{/if}

	<!-- Step 4: Initial Content -->
	{#if step === 4 && hasInitialContentStep}
		<Card.Root class="border-border/60">
			<div class="p-6 space-y-5">
				<div>
					<Card.Title class="text-lg">Initial Content</Card.Title>
					<Card.Description>
						{#if canInstallMods}Search and add mods to install after creation.
						{:else if canInstallPlugins}Search and add plugins to install after creation.
						{:else}Optionally add content to install after creation.{/if}
					</Card.Description>
				</div>

				<div class="flex items-center gap-2">
					<div class="relative flex-1">
						<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
						<input
							bind:value={searchQuery}
							placeholder={canInstallMods ? 'Search mods...' : canInstallPlugins ? 'Search plugins...' : 'Search datapacks...'}
							onkeydown={(e: KeyboardEvent) => { if (e.key === 'Enter') searchModrinth(); }}
							class="w-full rounded-lg border border-input bg-background py-2 pl-10 pr-4 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary transition-all"
						/>
					</div>
					<Button size="sm" onclick={searchModrinth} disabled={searching || !searchQuery.trim()} class="shrink-0">
						{#if searching}
							<Loader2 class="h-3.5 w-3.5 animate-spin" />
						{:else}
							<Search class="h-3.5 w-3.5" />
						{/if}
						Search
					</Button>
				</div>

				{#if searchResults.length > 0}
					<div class="space-y-1.5 max-h-60 overflow-y-auto">
						{#each searchResults as item}
							<div class="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-3.5 py-2.5 hover:bg-muted/40 transition-colors">
								<div class="min-w-0 flex-1">
									<p class="text-sm font-medium text-foreground truncate">{item.title}</p>
									<p class="text-[11px] text-muted-foreground capitalize">{item.type}</p>
								</div>
								<button
									class="ml-2 shrink-0 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground shadow-sm shadow-primary/20 hover:brightness-110 transition-all"
									onclick={() => addItem(item)}
								>
									Add
								</button>
							</div>
						{/each}
					</div>
				{/if}

				{#if selectedItems.length > 0}
					<div class="space-y-1.5">
						<p class="text-xs font-medium text-foreground">Selected ({selectedItems.length})</p>
						{#each selectedItems as item}
							<div class="flex items-center justify-between rounded-lg border border-border/60 bg-card px-3.5 py-2.5">
								<p class="text-sm text-foreground truncate">{item.title}</p>
								<button
									class="ml-2 shrink-0 rounded-md p-1 text-muted-foreground hover:bg-red-500/10 hover:text-red-400 transition-colors"
									onclick={() => removeItem(item.projectId)}
								>
									<X class="h-3.5 w-3.5" />
								</button>
							</div>
						{/each}
					</div>
				{/if}

				<p class="text-xs text-muted-foreground">You can always install more content later from the server dashboard.</p>
			</div>
		</Card.Root>
	{/if}

	<!-- Step 5: Review -->
	{#if step === 5}
		<Card.Root class="border-border/60">
			<div class="p-6 space-y-5">
				<div>
					<Card.Title class="text-lg">Review & Create</Card.Title>
					<Card.Description>Review your settings before creating the server.</Card.Description>
				</div>

				<div class="space-y-4">
					<div class="rounded-lg border border-border/60 divide-y divide-border/60">
						<div class="flex items-center justify-between px-4 py-3">
							<span class="text-xs text-muted-foreground">Name</span>
							<span class="text-sm font-medium text-foreground">{name}</span>
						</div>
						<div class="flex items-center justify-between px-4 py-3">
							<span class="text-xs text-muted-foreground">Game</span>
							<span class="text-sm font-medium text-foreground capitalize">{game}</span>
						</div>
						<div class="flex items-center justify-between px-4 py-3">
							<span class="text-xs text-muted-foreground">Node</span>
							<span class="text-sm font-medium text-foreground">{node}</span>
						</div>
						<div class="flex items-center justify-between px-4 py-3">
							<span class="text-xs text-muted-foreground">Software</span>
							<span class="text-sm font-medium text-foreground">{software?.name || 'Vanilla'} {version}</span>
						</div>
						<div class="flex items-center justify-between px-4 py-3">
							<span class="text-xs text-muted-foreground">Memory / Disk</span>
							<span class="text-sm font-medium text-foreground">{memory} MB / {disk} MB</span>
						</div>
						<div class="flex items-center justify-between px-4 py-3">
							<span class="text-xs text-muted-foreground">CPU / Port</span>
							<span class="text-sm font-medium text-foreground">{cpu}% / {port}</span>
						</div>
						<div class="flex items-center justify-between px-4 py-3">
							<span class="text-xs text-muted-foreground">Process</span>
							<span class="text-sm font-medium text-foreground capitalize">{processType}</span>
						</div>
						{#if selectedItems.length > 0}
							<div class="flex items-center justify-between px-4 py-3">
								<span class="text-xs text-muted-foreground">Initial Content</span>
								<span class="text-sm font-medium text-foreground">{selectedItems.length} item{selectedItems.length !== 1 ? 's' : ''}</span>
							</div>
						{/if}
					</div>
				</div>
			</div>
		</Card.Root>
	{/if}

	<!-- Navigation -->
	<div class="flex items-center justify-between">
		<div>
			{#if step > 1}
				<Button variant="outline" size="sm" onclick={prevStep}>
					<ChevronLeft class="h-3.5 w-3.5" />
					Back
				</Button>
			{/if}
		</div>
		<div class="flex items-center gap-2">
			{#if step < totalSteps}
				<Button size="sm" onclick={nextStep}>
					Continue
					<ChevronRight class="h-3.5 w-3.5" />
				</Button>
			{:else}
				<Button size="sm" onclick={createServer} disabled={creating} class="shadow-lg shadow-primary/20">
					{#if creating}
						<Loader2 class="h-3.5 w-3.5 animate-spin" />
						Creating...
					{:else}
						<ArrowRight class="h-3.5 w-3.5" />
						Create Server
					{/if}
				</Button>
			{/if}
		</div>
	</div>
</div>
