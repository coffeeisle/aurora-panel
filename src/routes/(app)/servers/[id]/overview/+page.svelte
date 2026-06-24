<script lang="ts">
	import { page } from '$app/stores';
	import { servers } from '$lib/stores/servers';
	import * as Card from '$lib/components/ui/card';
	import { Activity, Server, HardDrive, Users, MemoryStick, Wifi, Globe } from 'lucide-svelte';
	import { formatBytes } from '$lib/utils/utils';

	let server = $derived($servers.find((s) => s.id === $page.params.id));
</script>

{#if server}
	<div class="space-y-6">
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<Card.Root>
				<div class="flex items-center gap-4 p-4">
					<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
						<MemoryStick class="h-5 w-5 text-primary" />
					</div>
					<div>
						<p class="text-xs text-muted-foreground">Memory</p>
						<p class="text-xl font-bold text-foreground">{server.allocatedMemory} MB</p>
					</div>
				</div>
			</Card.Root>
			<Card.Root>
				<div class="flex items-center gap-4 p-4">
					<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
						<HardDrive class="h-5 w-5 text-primary" />
					</div>
					<div>
						<p class="text-xs text-muted-foreground">Disk</p>
						<p class="text-xl font-bold text-foreground">{formatBytes(server.allocatedDisk * 1024 * 1024)}</p>
					</div>
				</div>
			</Card.Root>
			<Card.Root>
				<div class="flex items-center gap-4 p-4">
					<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
						<Activity class="h-5 w-5 text-primary" />
					</div>
					<div>
						<p class="text-xs text-muted-foreground">CPU</p>
						<p class="text-xl font-bold text-foreground">{server.allocatedCpu}%</p>
					</div>
				</div>
			</Card.Root>
			<Card.Root>
				<div class="flex items-center gap-4 p-4">
					<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
						<Wifi class="h-5 w-5 text-primary" />
					</div>
					<div>
						<p class="text-xs text-muted-foreground">Port</p>
						<p class="text-xl font-bold text-foreground">{server.port}</p>
					</div>
				</div>
			</Card.Root>
		</div>

		<Card.Root>
			<div class="p-6 space-y-4">
				<h3 class="text-lg font-semibold text-foreground">Server Details</h3>
				<div class="grid grid-cols-2 gap-4 text-sm">
					<div>
						<span class="text-muted-foreground">Type</span>
						<p class="font-medium text-foreground capitalize">{server.type}</p>
					</div>
					<div>
						<span class="text-muted-foreground">Game</span>
						<p class="font-medium text-foreground">{server.game} {server.gameVersion}</p>
					</div>
					<div>
						<span class="text-muted-foreground">Platform</span>
						<p class="font-medium text-foreground">{server.platform || 'N/A'}</p>
					</div>
					<div>
						<span class="text-muted-foreground">Node</span>
						<p class="font-medium text-foreground">{server.nodeName}</p>
					</div>
				</div>
			</div>
		</Card.Root>
	</div>
{/if}
