<script lang="ts">
	import { onMount } from 'svelte';

	type Props = {
		lines: string[];
		class?: string;
	};

	let { lines, class: className = '' }: Props = $props();

	let container: HTMLDivElement;
	let autoScroll = $state(true);

	function parseAnsi(text: string): string {
		return text
			.replace(/\[(\d+)m/g, (_m, code: string) => {
				const n = parseInt(code, 10);
				if (n === 0) return '</span>';
				if (n === 30) return '<span class="text-gray-500">';
				if (n === 31) return '<span class="text-red-400">';
				if (n === 32) return '<span class="text-green-400">';
				if (n === 33) return '<span class="text-yellow-400">';
				if (n === 34) return '<span class="text-blue-400">';
				if (n === 35) return '<span class="text-purple-400">';
				if (n === 36) return '<span class="text-cyan-400">';
				if (n === 37) return '<span class="text-gray-200">';
				if (n === 90) return '<span class="text-gray-500">';
				if (n === 91) return '<span class="text-red-300">';
				if (n === 92) return '<span class="text-green-300">';
				if (n === 93) return '<span class="text-yellow-300">';
				if (n === 94) return '<span class="text-blue-300">';
				if (n === 95) return '<span class="text-purple-300">';
				if (n === 96) return '<span class="text-cyan-300">';
				return '<span>';
			})
			.replace(/\x1b\[/g, '')
			.replace(/<\/span><span class="[^"]*">/g, '')
			.replace(/<\/span><\/span>/g, '</span>');
	}

	function handleScroll() {
		if (!container) return;
		const threshold = 40;
		autoScroll = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
	}

	$effect(() => {
		if (lines && autoScroll && container) {
			queueMicrotask(() => {
				container.scrollTop = container.scrollHeight;
			});
		}
	});
</script>

<div class="relative flex flex-col {className}">
	<div class="flex items-center justify-between border-b border-border bg-muted/30 px-3 py-1.5">
		<span class="text-xs text-muted-foreground">Console Output</span>
		<div class="flex items-center gap-2">
			<button
				class="text-xs text-muted-foreground hover:text-foreground transition-colors"
				onclick={() => (autoScroll = !autoScroll)}
			>
				{autoScroll ? 'Auto-scroll ON' : 'Auto-scroll OFF'}
			</button>
		</div>
	</div>
	<div
		bind:this={container}
		onscroll={handleScroll}
		class="flex-1 overflow-y-auto bg-black/40 p-3 font-mono text-xs leading-relaxed scrollbar-thin"
	>
		{#each lines as line, i}
			<div class="whitespace-pre-wrap break-all">
				{@html parseAnsi(line)}
			</div>
		{/each}
	</div>
</div>
