<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import type { Server } from '$lib/types/server';
	import { cn } from '$lib/utils/utils';
	import { io, type Socket } from 'socket.io-client';
	import {
		LayoutDashboard,
		Terminal,
		Folder,
		Puzzle,
		Plug,
		Package,
		BookOpen,
		HardDrive,
		Clock,
		Settings,
		Circle,
		ArrowLeft,
		Loader2
	} from '@lucide/svelte';

	const serverTabs = [
		{ href: 'overview', label: 'Overview', icon: LayoutDashboard },
		{ href: 'console', label: 'Console', icon: Terminal },
		{ href: 'files', label: 'Files', icon: Folder },
		{ href: 'mods', label: 'Mods', icon: Puzzle },
		{ href: 'plugins', label: 'Plugins', icon: Plug },
		{ href: 'modpacks', label: 'Modpacks', icon: Package },
		{ href: 'datapacks', label: 'Datapacks', icon: BookOpen },
		{ href: 'backups', label: 'Backups', icon: HardDrive },
		{ href: 'schedules', label: 'Schedules', icon: Clock },
		{ href: 'settings', label: 'Settings', icon: Settings }
	];

	let { children } = $props();

	let socket: Socket | null = null;
	let serversList = $state<Server[]>([]);
	let loading = $state(true);

	let server = $derived(serversList.find((s) => s.id === $page.params.id) ?? null);

	onMount(() => {
		fetch('/api/servers')
			.then(async (res) => {
				if (res.ok) {
					serversList = await res.json();
				}
			})
			.catch(() => {
				// Silently fail
			})
			.finally(() => {
				loading = false;
			});

		socket = io({
			path: '/ws',
			auth: { token: 'dev-token', type: 'browser' },
			transports: ['websocket', 'polling']
		});

		socket.on('server:status', (data: { id: string; status: string }) => {
			const status = data.status as Server['status'];
			serversList = serversList.map((s) =>
				s.id === data.id ? { ...s, status } : s
			);
		});

		return () => {
			socket?.disconnect();
			socket = null;
		};
	});
</script>

<div class="flex h-full flex-col">
	<div class="flex items-center gap-3 border-b border-border px-6 py-3">
		<a href="/servers" class="text-muted-foreground hover:text-foreground transition-colors">
			<ArrowLeft class="h-4 w-4" />
		</a>
		{#if loading}
			<Loader2 class="h-4 w-4 animate-spin text-muted-foreground" />
		{:else}
			<div class="flex items-center gap-2">
				<Circle
					class={cn(
						'h-2.5 w-2.5',
						server?.status === 'installed'
							? 'text-green-500 fill-green-500'
							: server?.status === 'suspended'
								? 'text-yellow-500 fill-yellow-500'
								: server?.status === 'error'
									? 'text-red-500 fill-red-500'
									: 'text-blue-500 fill-blue-500 animate-pulse'
					)}
				/>
				<h2 class="text-sm font-semibold text-foreground">{server?.name ?? $page.params.id}</h2>
				<span class="text-xs text-muted-foreground">({server?.game ?? 'Unknown'})</span>
			</div>
		{/if}
	</div>

	<div class="flex flex-1 overflow-hidden">
		<nav class="flex w-52 flex-col border-r border-border bg-sidebar p-2 overflow-y-auto scrollbar-thin">
			<div class="space-y-0.5">
				{#each serverTabs as tab}
					<a
						href="/servers/{$page.params.id}/{tab.href}"
						class={cn(
							'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
							$page.url.pathname.endsWith(tab.href)
								? 'bg-sidebar-accent/10 text-sidebar-accent'
								: 'text-sidebar-foreground/70 hover:bg-sidebar-muted hover:text-sidebar-foreground'
						)}
					>
						<tab.icon class="h-4 w-4 shrink-0" />
						{tab.label}
					</a>
				{/each}
			</div>
		</nav>
		<main class="flex-1 overflow-y-auto p-6">
			{@render children()}
		</main>
	</div>
</div>
