<script lang="ts">
	import { onMount } from 'svelte';
	import { cn } from '$lib/utils/utils';
	import { page } from '$app/stores';
	import type { Server } from '$lib/types/server';
	import { Server as ServerIcon, LayoutDashboard, HardDrive, Settings, Users, ChevronDown, Circle, Plus, PanelRightClose, PanelRightOpen } from '@lucide/svelte';

	let serversExpanded = $state(true);
	let collapsed = $state(false);
	let serversList = $state<Server[]>([]);

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

	onMount(async () => {
		try {
			const res = await fetch('/api/servers');
			if (res.ok) serversList = await res.json();
		} catch { /* ignore */ }
	});
</script>

<aside class={cn(
	'flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-200',
	collapsed ? 'w-16' : 'w-56'
)}>
	<div class="flex h-14 items-center gap-2.5 border-b border-sidebar-border px-4">
		<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-sm shadow-primary/20">
			A
		</div>
		{#if !collapsed}
			<span class="text-sm font-semibold text-sidebar-foreground tracking-tight">Aurora</span>
		{/if}
		<button onclick={() => (collapsed = !collapsed)} class="ml-auto flex h-6 w-6 items-center justify-center rounded-md text-sidebar-foreground/40 hover:bg-sidebar-muted hover:text-sidebar-foreground transition-colors">
			{#if collapsed}
				<PanelRightOpen class="h-3.5 w-3.5" />
			{:else}
				<PanelRightClose class="h-3.5 w-3.5" />
			{/if}
		</button>
	</div>

	<nav class="flex-1 space-y-0.5 overflow-y-auto px-2 py-3 scrollbar-thin">
		{#each navItems as item}
			<a
				href={item.href}
				class={cn(
					'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150',
					isActive(item.href)
						? 'bg-primary/10 text-primary'
						: 'text-sidebar-foreground/60 hover:bg-sidebar-muted hover:text-sidebar-foreground'
				)}
				title={collapsed ? item.label : undefined}
			>
				<item.icon class="h-4 w-4 shrink-0" />
				{#if !collapsed}
					{item.label}
				{/if}
			</a>
		{/each}

		{#if !collapsed}
			<div class="my-2 border-t border-sidebar-border"></div>

			<button
				class="flex w-full items-center gap-3 rounded-lg px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-sidebar-foreground/50 hover:bg-sidebar-muted hover:text-sidebar-foreground/80 transition-colors"
				onclick={() => (serversExpanded = !serversExpanded)}
			>
				<ChevronDown class={cn('h-3 w-3 transition-transform duration-150', serversExpanded ? '' : '-rotate-90')} />
				Servers
			</button>

			{#if serversExpanded}
				<div class="space-y-0.5">
					{#each serversList as srv}
						<a
							href="/servers/{srv.id}/overview"
							class={cn(
								'flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm transition-all duration-150',
								isServerActive(srv.id)
									? 'bg-primary/10 text-primary'
									: 'text-sidebar-foreground/60 hover:bg-sidebar-muted hover:text-sidebar-foreground'
							)}
						>
							<Circle
								class={cn(
									'h-2 w-2 shrink-0 fill-current',
									srv.status === 'installed' ? 'text-green-500' :
									srv.status === 'suspended' ? 'text-yellow-500' :
									srv.status === 'error' ? 'text-red-500' :
									'text-blue-500 animate-pulse'
								)}
							/>
							<span class="truncate">{srv.name}</span>
						</a>
					{/each}
					<a
						href="/servers/new"
						class="flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm text-sidebar-foreground/40 hover:bg-sidebar-muted hover:text-sidebar-foreground transition-colors"
					>
						<Plus class="h-3.5 w-3.5" />
						<span>Create Server</span>
					</a>
				</div>
			{/if}
		{/if}
	</nav>

	{#if !collapsed}
		<div class="border-t border-sidebar-border px-3 py-3">
			<div class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/60 hover:bg-sidebar-muted transition-colors cursor-default">
				<div class="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
					A
				</div>
				<span class="truncate">Admin</span>
			</div>
		</div>
	{/if}
</aside>
