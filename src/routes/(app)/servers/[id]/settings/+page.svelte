<script lang="ts">
	import { page } from '$app/stores';
	import { servers } from '$lib/stores/servers';
	import type { Server } from '$lib/types/server';
	import { toasts } from '$lib/stores/toast';
	import { daemonList } from '$lib/stores/daemon';
	import { Save } from 'lucide-svelte';

	let name = $state('');
	let startupCommand = $state('');
	let memory = $state(1024);
	let disk = $state(10240);
	let cpu = $state(100);
	let port = $state(25565);
	let nodeId = $state('node-01');
	let processType: 'docker' | 'bare' = $state('docker');
	let dockerImage = $state('ghcr.io/pterodactyl/yolks:java_21');
	let gameVersion = $state('1.21.4');
	let loader = $state('fabric');

	const serverId = $derived($page.params.id);
	const server = $derived($servers.find((s: Server) => s.id === serverId) ?? null);

	$effect(() => {
		if (server) {
			name = server.name;
			startupCommand = `java -Xmx${server.allocatedMemory}M -jar server.jar nogui`;
			memory = server.allocatedMemory;
			disk = server.allocatedDisk;
			cpu = server.allocatedCpu;
			port = server.port;
			nodeId = server.nodeName || 'node-01';
			gameVersion = server.gameVersion;
			loader = server.loader;
		}
	});

	let saving = $state(false);

	async function save() {
		saving = true;
		try {
			const res = await fetch(`/api/servers/${serverId}/settings`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name, startupCommand, allocatedMemory: memory, allocatedDisk: disk,
					allocatedCpu: cpu, port: Number(port), nodeName: nodeId,
					gameVersion, loader
				})
			});
			if (!res.ok) throw new Error('Save failed');
			toasts.success('Settings saved', 'Server configuration updated.');
		} catch (e) {
			toasts.error('Save failed', e instanceof Error ? e.message : 'Unknown error');
		} finally {
			saving = false;
		}
	}
</script>

<div class="flex h-full flex-col">
	<div class="mb-4">
		<h1 class="text-lg font-bold text-foreground">Settings</h1>
		<p class="text-xs text-muted-foreground mt-0.5">Configure server settings</p>
	</div>

	<div class="flex-1 overflow-y-auto max-w-2xl space-y-4">
		<div class="rounded-lg border border-border bg-card p-4">
			<h3 class="text-sm font-semibold text-foreground mb-3">General</h3>
			<div class="space-y-3">
				<div>
					<label class="mb-1 block text-xs text-muted-foreground">Server Name</label>
					<input bind:value={name} class="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
				</div>
				<div>
					<label class="mb-1 block text-xs text-muted-foreground">Startup Command</label>
					<input bind:value={startupCommand} class="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs font-mono text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
				</div>
			</div>
		</div>

		<div class="rounded-lg border border-border bg-card p-4">
			<h3 class="text-sm font-semibold text-foreground mb-3">Resource Limits</h3>
			<div class="grid grid-cols-3 gap-3">
				<div>
					<label class="mb-1 block text-xs text-muted-foreground">Memory (MB)</label>
					<input bind:value={memory} type="number" class="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary" />
				</div>
				<div>
					<label class="mb-1 block text-xs text-muted-foreground">Disk (MB)</label>
					<input bind:value={disk} type="number" class="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary" />
				</div>
				<div>
					<label class="mb-1 block text-xs text-muted-foreground">CPU (%)</label>
					<input bind:value={cpu} type="number" class="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary" />
				</div>
			</div>
		</div>

		<div class="rounded-lg border border-border bg-card p-4">
			<h3 class="text-sm font-semibold text-foreground mb-3">Runtime</h3>
			<div class="space-y-3">
				<div class="grid grid-cols-2 gap-3">
					<div>
						<label class="mb-1 block text-xs text-muted-foreground">Process Type</label>
						<select bind:value={processType} class="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary">
							<option value="docker">Docker</option>
							<option value="bare">Bare Metal</option>
						</select>
					</div>
					<div>
						<label class="mb-1 block text-xs text-muted-foreground">Docker Image</label>
						<input bind:value={dockerImage} class="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs font-mono text-foreground outline-none focus:border-primary" />
					</div>
				</div>
				<div class="grid grid-cols-2 gap-3">
					<div>
						<label class="mb-1 block text-xs text-muted-foreground">Assignment</label>
						<select bind:value={nodeId} class="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary">
							<option value="">— Select Node —</option>
							{#each $daemonList as d}
								<option value={d.id}>{d.name} {d.connected ? '(online)' : '(offline)'}</option>
							{/each}
						</select>
					</div>
					<div>
						<label class="mb-1 block text-xs text-muted-foreground">Port</label>
						<input bind:value={port} type="number" class="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary" />
					</div>
				</div>
			</div>
		</div>

		<div class="rounded-lg border border-border bg-card p-4">
			<h3 class="text-sm font-semibold text-foreground mb-3">Modrinth Defaults</h3>
			<div class="grid grid-cols-2 gap-3">
				<div>
					<label class="mb-1 block text-xs text-muted-foreground">Game Version</label>
					<select bind:value={gameVersion} class="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary">
						<option value="1.21.4">1.21.4</option>
						<option value="1.21.3">1.21.3</option>
						<option value="1.20.1">1.20.1</option>
						<option value="1.19.4">1.19.4</option>
						<option value="1.18.2">1.18.2</option>
						<option value="1.16.5">1.16.5</option>
					</select>
				</div>
				<div>
					<label class="mb-1 block text-xs text-muted-foreground">Default Loader</label>
					<select bind:value={loader} class="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary">
						<option value="fabric">Fabric</option>
						<option value="forge">Forge</option>
						<option value="neoforge">NeoForge</option>
						<option value="quilt">Quilt</option>
						<option value="paper">Paper</option>
						<option value="purpur">Purpur</option>
					</select>
				</div>
			</div>
		</div>

		<div class="flex justify-end pb-4">
			<button
				class="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
				onclick={save}
			>
				<Save class="h-3.5 w-3.5" />
				Save Settings
			</button>
		</div>
	</div>
</div>
