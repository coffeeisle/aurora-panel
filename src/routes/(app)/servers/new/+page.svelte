<script lang="ts">
	import { toasts } from '$lib/stores/toast';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import Input from '$lib/components/ui/input/input.svelte';
	import * as Card from '$lib/components/ui/card';
	import {
		ChevronLeft, ChevronRight, Check, Server, Package,
		SlidersHorizontal, Download, Search, X, Loader2
	} from 'lucide-svelte';

	type Software = {
		id: string;
		name: string;
		loader: string;
		platform: string;
	};

	type ModrinthItem = {
		projectId: string;
		title: string;
		slug: string;
		type: 'mod' | 'plugin' | 'datapack';
	};

	const games = [
		{ value: 'minecraft', label: 'Minecraft' },
		{ value: 'palworld', label: 'Palworld' },
		{ value: 'valheim', label: 'Valheim' },
		{ value: 'satisfactory', label: 'Satisfactory' },
		{ value: 'terraria', label: 'Terraria' },
		{ value: 'enshrouded', label: 'Enshrouded' }
	];

	const nodes = ['node-01', 'node-02'];

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

	const versions = ['1.21.4', '1.21.3', '1.21', '1.20.4', '1.20.1', '1.19.4', '1.19.2', '1.18.2', '1.17.1', '1.16.5'];

	const gameTypeMap: Record<string, string> = {
		minecraft: 'minecraft',
		palworld: 'steamcmd',
		valheim: 'steamcmd',
		satisfactory: 'steamcmd',
		terraria: 'generic',
		enshrouded: 'steamcmd'
	};

	const modLoaderSoftware = ['fabric', 'forge', 'neoforge', 'quilt'];
	const pluginSoftware = ['paper', 'purpur', 'spigot'];
	const datapackSoftware = ['vanilla'];

	let step = $state(1);
	let creating = $state(false);

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
	const canInstallDatapacks = $derived(software && datapackSoftware.includes(software.id));

	const hasInitialContentStep = $derived(game === 'minecraft');

	const steps = [
		{ num: 1, label: 'Basic Info', icon: Server },
		{ num: 2, label: 'Software', icon: Package },
		{ num: 3, label: 'Resources', icon: SlidersHorizontal },
		{ num: 4, label: 'Content', icon: Download }
	];

	const visibleSteps = $derived(hasInitialContentStep ? steps : steps.slice(0, 3));
	const totalSteps = $derived(visibleSteps.length);

	function validateStep1(): boolean {
		let valid = true;
		if (!name.trim()) { nameError = 'Server name is required'; valid = false; }
		else { nameError = ''; }
		if (!node) { nodeError = 'Select a node'; valid = false; }
		else { nodeError = ''; }
		return valid;
	}

	function validateStep3(): boolean {
		let valid = true;
		if (!port || port < 1 || port > 65535) { portError = 'Port must be 1–65535'; valid = false; }
		else { portError = ''; }
		return valid;
	}

	function nextStep() {
		if (step === 1 && !validateStep1()) return;
		if (step === 3 && !validateStep3()) return;
		if (step < totalSteps) step++;
	}

	function prevStep() {
		if (step > 1) step--;
	}

	async function searchModrinth() {
		if (!searchQuery.trim()) return;
		searching = true;
		try {
			let facets: Record<string, string[]> = {};
			if (canInstallMods) facets = { project_type: ['mod'] };
			else if (canInstallPlugins) facets = { project_type: ['plugin'] };
			else if (canInstallDatapacks) facets = { project_type: ['datapack'] };

			const params = new URLSearchParams({ query: searchQuery, limit: '10' });
			if (facets.project_type) params.set('facets', JSON.stringify([Object.entries(facets).map(([k, v]) => `${k}:${v}`)]));

			const res = await fetch(`https://api.modrinth.com/v2/search?${params}`);
			if (!res.ok) throw new Error('Search failed');
			const data = await res.json();
			searchResults = (data.hits || []).map((h: Record<string, unknown>) => ({
				projectId: h.project_id as string,
				title: h.title as string,
				slug: h.slug as string,
				type: (facets.project_type?.[0] || 'mod') as 'mod' | 'plugin' | 'datapack'
			}));
		} catch (e) {
			toasts.error('Search failed', e instanceof Error ? e.message : 'Unknown error');
		} finally {
			searching = false;
		}
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
		if (!validateStep1() || !validateStep3()) return;
		creating = true;
		try {
			const body = {
				name: name.trim(),
				game,
				nodeId: node,
				type: gameType,
				software: software?.id || 'vanilla',
				gameVersion: version,
				allocatedMemory: memory,
				allocatedDisk: disk,
				allocatedCpus: cpu,
				allocationPort: port,
				processType,
				dockerImage: processType === 'docker' ? dockerImage : undefined,
				initialContent: selectedItems
			};
			const res = await fetch('/api/servers', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});
			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				throw new Error(err.error || `Creation failed (${res.status})`);
			}
			const data = await res.json();
			toasts.success('Server created', `${name} is being provisioned`);
			goto(`/servers/${data.id}/overview`);
		} catch (e) {
			toasts.error('Creation failed', e instanceof Error ? e.message : 'Unknown error');
		} finally {
			creating = false;
		}
	}

	function selectSoftware(sw: Software) {
		software = sw;
		if (sw.id !== 'vanilla' && sw.id !== 'bukkit') {
			version = '1.21.4';
		}
	}
</script>

<div class="mx-auto max-w-2xl space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold text-foreground">Create Server</h1>
	</div>

	<div class="flex items-center justify-center gap-0">
		{#each visibleSteps as s, i}
			<div class="flex items-center">
				<div class="flex items-center gap-2">
					<div
						class="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors {step === s.num ? 'bg-primary text-primary-foreground' : step > s.num ? 'bg-green-500/20 text-green-400' : 'bg-muted text-muted-foreground'}"
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
					<div class="mx-3 h-px w-12 bg-border sm:w-20"></div>
				{/if}
			</div>
		{/each}
	</div>

	{#if step === 1}
		<Card.Root>
			<div class="p-6 space-y-4">
				<Card.Title>Basic Information</Card.Title>
				<Card.Description>Enter the basic details for your new server.</Card.Description>

				<div class="space-y-2">
					<label for="srv-name" class="text-xs font-medium text-foreground">Server Name <span class="text-red-400">*</span></label>
					<Input id="srv-name" bind:value={name} placeholder="My Awesome Server" />
					{#if nameError}<p class="text-[10px] text-red-400">{nameError}</p>{/if}
				</div>

				<div class="space-y-2">
					<label for="srv-game" class="text-xs font-medium text-foreground">Game</label>
					<select
						id="srv-game"
						bind:value={game}
						class="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-ring focus:ring-ring/50 focus:ring-3"
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
						class="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-ring focus:ring-ring/50 focus:ring-3"
					>
						<option value="" disabled>Select a node</option>
						{#each nodes as n}
							<option value={n}>{n}</option>
						{/each}
					</select>
					{#if nodeError}<p class="text-[10px] text-red-400">{nodeError}</p>{/if}
				</div>

				<div class="space-y-2">
					<label for="srv-type" class="text-xs font-medium text-foreground">Game Type</label>
					<input
						id="srv-type"
						value={gameType}
						disabled
						class="w-full rounded-lg border border-input bg-muted/50 px-2.5 py-1.5 text-sm text-muted-foreground outline-none"
					/>
				</div>
			</div>
		</Card.Root>
	{/if}

	{#if step === 2}
		<Card.Root>
			<div class="p-6 space-y-4">
				<Card.Title>Server Software</Card.Title>
				<Card.Description>Choose the software and version for your server.</Card.Description>

				<div class="space-y-2">
					<p class="text-xs font-medium text-foreground">Software</p>
					<div class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
						{#each softwareOptions[game] || [] as sw}
							<button
								class="flex flex-col items-center gap-1 rounded-lg border p-3 text-xs transition-colors {software?.id === sw.id ? 'border-primary bg-primary/10 text-foreground' : 'border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground'}"
								onclick={() => selectSoftware(sw)}
							>
								<Package class="h-5 w-5 {software?.id === sw.id ? 'text-primary' : ''}" />
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
							class="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-ring focus:ring-ring/50 focus:ring-3"
						>
							{#each versions as v}
								<option value={v}>{v}</option>
							{/each}
						</select>
					</div>
				{/if}

				{#if !software}
					<p class="text-xs text-muted-foreground">Select a software to continue.</p>
				{/if}
			</div>
		</Card.Root>
	{/if}

	{#if step === 3}
		<Card.Root>
			<div class="p-6 space-y-4">
				<Card.Title>Resource Allocation</Card.Title>
				<Card.Description>Configure the resources and networking for your server.</Card.Description>

				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-2">
						<label for="srv-memory" class="text-xs font-medium text-foreground">Memory (MB)</label>
						<Input id="srv-memory" type="number" bind:value={memory} min="128" />
					</div>
					<div class="space-y-2">
						<label for="srv-disk" class="text-xs font-medium text-foreground">Disk (MB)</label>
						<Input id="srv-disk" type="number" bind:value={disk} min="512" />
					</div>
					<div class="space-y-2">
						<label for="srv-cpu" class="text-xs font-medium text-foreground">CPU (%)</label>
						<Input id="srv-cpu" type="number" bind:value={cpu} min="1" max="100" />
					</div>
					<div class="space-y-2">
						<label for="srv-port" class="text-xs font-medium text-foreground">Port <span class="text-red-400">*</span></label>
						<Input id="srv-port" type="number" bind:value={port} min="1" max="65535" />
						{#if portError}<p class="text-[10px] text-red-400">{portError}</p>{/if}
					</div>
				</div>

				<div class="space-y-2">
					<label for="srv-proc" class="text-xs font-medium text-foreground">Process Type</label>
					<select
						id="srv-proc"
						bind:value={processType}
						class="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-ring focus:ring-ring/50 focus:ring-3"
					>
						<option value="docker">Docker</option>
						<option value="bare">Bare Metal</option>
					</select>
				</div>

				{#if processType === 'docker'}
					<div class="space-y-2">
						<label for="srv-image" class="text-xs font-medium text-foreground">Docker Image</label>
						<Input id="srv-image" bind:value={dockerImage} placeholder="itzg/minecraft-server:latest" />
					</div>
				{/if}
			</div>
		</Card.Root>
	{/if}

	{#if step === 4 && hasInitialContentStep}
		<Card.Root>
			<div class="p-6 space-y-4">
				<Card.Title>Initial Content</Card.Title>
				<Card.Description>
					{#if canInstallMods}
						Search and select mods to install after server creation.
					{:else if canInstallPlugins}
						Search and select plugins to install after server creation.
					{:else if canInstallDatapacks}
						Search and select datapacks to install after server creation.
					{:else}
						Optionally add content to install after creation.
					{/if}
				</Card.Description>

				<div class="flex items-center gap-2">
					<Input
						bind:value={searchQuery}
						placeholder={
							canInstallMods ? 'Search mods...' :
							canInstallPlugins ? 'Search plugins...' :
							'Search datapacks...'
						}
						onkeydown={(e: KeyboardEvent) => { if (e.key === 'Enter') searchModrinth(); }}
					/>
					<Button size="sm" onclick={searchModrinth} disabled={searching}>
						{#if searching}
							<Loader2 class="h-3.5 w-3.5 animate-spin" />
						{:else}
							<Search class="h-3.5 w-3.5" />
						{/if}
						Search
					</Button>
				</div>

				{#if searchResults.length > 0}
					<div class="space-y-1.5">
						{#each searchResults as item}
							<div class="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2">
								<div class="min-w-0 flex-1">
									<p class="text-sm font-medium text-foreground truncate">{item.title}</p>
									<p class="text-[10px] text-muted-foreground">{item.type}</p>
								</div>
								<button
									class="ml-2 shrink-0 rounded-md bg-primary px-2 py-1 text-[10px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
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
							<div class="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2">
								<p class="text-sm text-foreground truncate">{item.title}</p>
								<button
									class="ml-2 shrink-0 text-muted-foreground hover:text-red-400 transition-colors"
									onclick={() => removeItem(item.projectId)}
								>
									<X class="h-3.5 w-3.5" />
								</button>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</Card.Root>
	{/if}

	<div class="flex items-center justify-between">
		<div>
			{#if step > 1}
				<Button variant="outline" size="sm" onclick={prevStep}>
					<ChevronLeft class="h-3.5 w-3.5" />
					Back
				</Button>
			{/if}
		</div>
		<div>
			{#if step < totalSteps}
				<Button size="sm" onclick={nextStep}>
					Continue
					<ChevronRight class="h-3.5 w-3.5" />
				</Button>
			{:else}
				<Button size="sm" onclick={createServer} disabled={creating}>
					{#if creating}
						<Loader2 class="h-3.5 w-3.5 animate-spin" />
						Creating...
					{:else}
						Create Server
					{/if}
				</Button>
			{/if}
		</div>
	</div>
</div>
