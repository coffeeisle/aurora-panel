<script lang="ts">
	import { toastStore, type Toast } from '$lib/stores/toast';
	import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from '@lucide/svelte';

	let items = $state<Toast[]>([]);

	$effect(() => {
		const unsub = toastStore.subscribe((t) => { items = t; });
		return unsub;
	});

	const iconMap: Record<string, typeof CheckCircle> = {
		success: CheckCircle,
		error: AlertCircle,
		warning: AlertTriangle,
		info: Info,
	};

	const colorMap: Record<string, string> = {
		success: 'border-green-500/30 bg-green-500/10 text-green-400',
		error: 'border-red-500/30 bg-red-500/10 text-red-400',
		warning: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400',
		info: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
	};
</script>

<div class="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
	{#each items as toast (toast.id)}
		<div
			class="flex items-start gap-3 rounded-lg border p-3 text-sm shadow-lg transition-all {colorMap[toast.type]}"
		>
			<div class="mt-0.5 flex-shrink-0">
				{#if toast.type === 'success'}
					<CheckCircle class="h-4 w-4" />
				{:else if toast.type === 'error'}
					<AlertCircle class="h-4 w-4" />
				{:else if toast.type === 'warning'}
					<AlertTriangle class="h-4 w-4" />
				{:else if toast.type === 'info'}
					<Info class="h-4 w-4" />
				{/if}
			</div>
			<div class="flex-1 min-w-0">
				<p class="font-medium">{toast.title}</p>
				{#if toast.message}
					<p class="mt-0.5 text-xs opacity-80">{toast.message}</p>
				{/if}
			</div>
			<button
				class="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
				onclick={() => toastStore.dismiss(toast.id)}
			>
				<X class="h-3.5 w-3.5" />
			</button>
		</div>
	{/each}
</div>
