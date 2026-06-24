<script lang="ts">
	import { cn } from '$lib/utils/utils';
	import { page } from '$app/stores';
	import { servers } from '$lib/stores/servers';
	import { Server, LayoutDashboard, HardDrive, Settings, Users, ChevronDown, ChevronRight, Cable, Circle } from 'lucide-svelte';

	let serversExpanded = $state(true);

	const navItems = [
		{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
		{ href: '/nodes', label: 'Nodes', icon: HardDrive },
		{ href: '/admin', label: 'Administration', icon: Users },
		{ href: '/settings', label: 'Settings', icon: Settings }
	];

	function isActive(href: string) {
		return $page.url.pathname === href || $page.url.pathname.startsWith(href + '/');
	}

	function isServerActive(id: string) {
		return $page.url.pathname.startsWith('/servers/' + id);
	}
</script>

<aside class="flex h-full w-64 flex-col border-r border-sidebar-border bg-sidebar">
	<div class="flex h-14 items-center gap-2 border-b border-sidebar-border px-5">
		<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
			A
		</div>
		<span class="text-base font-semibold text-sidebar-foreground">Aurora Panel</span>
	</div>

	<nav class="flex-1 space-y-1 overflow-y-auto px-3 py-3 scrollbar-thin">
		{#each navItems as item}
			<a
				href={item.href}
				class={cn(
					'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
					isActive(item.href)
						? 'bg-sidebar-accent/10 text-sidebar-accent'
						: 'text-sidebar-foreground/70 hover:bg-sidebar-muted hover:text-sidebar-foreground'
				)}
			>
				<item.icon class="h-4 w-4 shrink-0" />
				{item.label}
			</a>
		{/each}

		<div class="my-2 border-t border-sidebar-border"></div>

		<button
			class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/70 hover:bg-sidebar-muted transition-colors"
			onclick={() => (serversExpanded = !serversExpanded)}
		>
			{#if serversExpanded}
				<ChevronDown class="h-3.5 w-3.5" />
			{:else}
				<ChevronRight class="h-3.5 w-3.5" />
			{/if}
			Servers
		</button>

		{#if serversExpanded}
			<div class="space-y-0.5">
				{#each $servers as srv}
					<a
						href="/servers/{srv.id}/overview"
						class={cn(
							'flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm transition-colors',
							isServerActive(srv.id)
								? 'bg-sidebar-accent/10 text-sidebar-accent'
								: 'text-sidebar-foreground/70 hover:bg-sidebar-muted hover:text-sidebar-foreground'
						)}
					>
						<Circle
							class={cn(
								'h-2 w-2 shrink-0 fill-current',
								srv.status === 'installed'
									? 'text-green-500'
									: srv.status === 'suspended'
										? 'text-yellow-500'
										: srv.status === 'error'
											? 'text-red-500'
											: 'text-blue-500 animate-pulse'
							)}
						/>
						<span class="truncate">{srv.name}</span>
					</a>
				{/each}
			</div>
		{/if}
	</nav>

	<div class="border-t border-sidebar-border px-3 py-4">
		<div class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/70">
			<div class="flex h-7 w-7 items-center justify-center rounded-full bg-sidebar-muted text-xs font-medium">
				A
			</div>
			<span class="truncate">Admin</span>
		</div>
	</div>
</aside>
