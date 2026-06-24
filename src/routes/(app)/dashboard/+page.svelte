<script lang="ts">
	import { page } from '$app/stores';
	import { Activity, Server, HardDrive, Users } from 'lucide-svelte';
	import * as Card from '$lib/components/ui/card';

	const stats = [
		{ label: 'Total Servers', value: '0', icon: Server },
		{ label: 'Nodes Online', value: '0', icon: HardDrive },
		{ label: 'Active Users', value: '0', icon: Users },
		{ label: 'CPU Usage', value: '0%', icon: Activity }
	];
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold text-foreground">Dashboard</h1>
	</div>

	<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
		{#each stats as stat}
			<Card.Root class="p-0">
				<div class="flex items-center gap-4 p-4">
					<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
						<stat.icon class="h-5 w-5 text-primary" />
					</div>
					<div>
						<p class="text-sm text-muted-foreground">{stat.label}</p>
						<p class="text-2xl font-bold text-foreground">{stat.value}</p>
					</div>
				</div>
			</Card.Root>
		{/each}
	</div>

	<Card.Root>
		<div class="p-6">
			<h2 class="text-lg font-semibold text-foreground">Welcome to Aurora Panel</h2>
			<p class="mt-2 text-sm text-muted-foreground">
				Your self-hosted game server management panel. Get started by creating your first server or connecting a node.
			</p>
		</div>
	</Card.Root>
</div>
