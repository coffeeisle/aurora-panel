<script lang="ts">
	import { servers } from '$lib/stores/servers';
	import * as Card from '$lib/components/ui/card';
	import { cn } from '$lib/utils/utils';
	import { formatBytes } from '$lib/utils/utils';
	import { Circle, Server as ServerIcon, Wifi, HardDrive, MemoryStick } from 'lucide-svelte';
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold text-foreground">Servers</h1>
	</div>

	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
		{#each $servers as srv}
			<a href="/servers/{srv.id}/overview" class="block transition-colors hover:opacity-80">
				<Card.Root class="h-full">
					<div class="p-4">
						<div class="flex items-start justify-between">
							<div class="flex items-center gap-3">
								<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
									<ServerIcon class="h-5 w-5 text-primary" />
								</div>
								<div>
									<h3 class="font-semibold text-foreground">{srv.name}</h3>
									<p class="text-xs text-muted-foreground">{srv.game} — {srv.gameVersion}</p>
								</div>
							</div>
							<div class="flex items-center gap-1.5">
								<Circle
									class={cn(
										'h-2.5 w-2.5',
										srv.status === 'installed' || srv.status === 'running'
											? 'text-green-500 fill-green-500'
											: srv.status === 'suspended'
												? 'text-yellow-500 fill-yellow-500'
												: srv.status === 'error' || srv.status === 'stopped'
													? 'text-red-500 fill-red-500'
													: 'text-blue-500 fill-blue-500 animate-pulse'
									)}
								/>
								<span class="text-xs capitalize text-muted-foreground">{srv.status}</span>
							</div>
						</div>
						<div class="mt-4 grid grid-cols-3 gap-3 rounded-lg bg-muted/50 p-3 text-xs">
							<div class="flex items-center gap-1.5 text-muted-foreground">
								<MemoryStick class="h-3.5 w-3.5" />
								<span>{srv.allocatedMemory} MB</span>
							</div>
							<div class="flex items-center gap-1.5 text-muted-foreground">
								<HardDrive class="h-3.5 w-3.5" />
								<span>{formatBytes(srv.allocatedDisk * 1024 * 1024)}</span>
							</div>
							<div class="flex items-center gap-1.5 text-muted-foreground">
								<Wifi class="h-3.5 w-3.5" />
								<span>{srv.port}</span>
							</div>
						</div>
					</div>
				</Card.Root>
			</a>
		{/each}
	</div>
</div>

