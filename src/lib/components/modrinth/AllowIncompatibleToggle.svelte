<script lang="ts">
	import { AlertTriangle } from '@lucide/svelte';

	type Props = {
		enabled: boolean;
		onToggle: (value: boolean) => void;
		class?: string;
	};

	let { enabled, onToggle, class: className = '' }: Props = $props();
</script>

<div class="space-y-2 {className}">
	{#if enabled}
		<div class="flex items-center gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-400">
			<AlertTriangle class="h-3.5 w-3.5 flex-shrink-0" />
			<span>Incompatible installs are allowed. Version and loader checks are bypassed.</span>
		</div>
	{/if}

	<div class="flex items-center gap-2">
		<button
			role="switch"
			aria-checked={enabled}
			aria-label="Allow incompatible installs"
			onclick={() => onToggle(!enabled)}
			class="relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 {enabled ? 'bg-yellow-500' : 'bg-muted'}"
		>
			<span
				class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ease-in-out {enabled ? 'translate-x-4' : 'translate-x-0'}"
			></span>
		</button>
		<span class="text-xs text-muted-foreground">
			Allow Incompatible Installs
		</span>
	</div>
</div>
