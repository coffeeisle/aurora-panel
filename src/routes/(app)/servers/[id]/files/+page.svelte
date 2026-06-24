<script lang="ts">
	import { onMount } from 'svelte';
	type FileEntry = {
		name: string;
		path: string;
		type: 'file' | 'directory';
		sizeFormatted: string;
		modifiedAt: string;
	};

	type Props = {
		class?: string;
	};

	let { class: className = '' }: Props = $props();

	let currentDir = $state('/');
	let entries = $state<FileEntry[]>([]);
	let loading = $state(true);
	let error = $state('');
	let selectedFile = $state<string | null>(null);
	let fileContent = $state('');
	let editing = $state(false);
	let breadcrumbs = $state<string[]>(['/']);

	onMount(() => {
		loadDirectory('/');
	});

	async function loadDirectory(dir: string) {
		loading = true;
		error = '';
		currentDir = dir;
		selectedFile = null;
		fileContent = '';
		editing = false;

		const path = dir === '/' ? '' : dir;

		breadcrumbs = ['/', ...dir.split('/').filter(Boolean)];

		try {
			const res = await fetch(`/api/servers/dev/files?dir=${encodeURIComponent(dir)}`);
			if (!res.ok) throw new Error('Failed to list files');
			entries = await res.json();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Unknown error';
			entries = [];
		} finally {
			loading = false;
		}
	}

	function navigateToDir(dir: string) {
		loadDirectory(dir);
	}

	async function openFile(filePath: string) {
		selectedFile = filePath;
		error = '';
		try {
			const res = await fetch(`/api/servers/dev/files/...?path=${encodeURIComponent(filePath)}`);
			if (!res.ok) throw new Error('Failed to read file');
			const data = await res.json();
			fileContent = data.content || '';
			editing = false;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to read file';
			fileContent = '';
		}
	}

	async function saveFile() {
		if (!selectedFile) return;
		try {
			const res = await fetch(`/api/servers/dev/files/...?path=${encodeURIComponent(selectedFile)}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ content: fileContent })
			});
			if (!res.ok) throw new Error('Failed to save file');
			editing = false;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to save file';
		}
	}

	async function deleteEntry(filePath: string) {
		if (!confirm(`Delete ${filePath}?`)) return;
		try {
			const res = await fetch(`/api/servers/dev/files/...?path=${encodeURIComponent(filePath)}`, {
				method: 'DELETE'
			});
			if (!res.ok) throw new Error('Failed to delete');
			if (selectedFile === filePath) {
				selectedFile = null;
				fileContent = '';
			}
			loadDirectory(currentDir);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to delete';
		}
	}

	async function renameEntry(filePath: string) {
		const newName = prompt('New name:', filePath.split('/').pop()) ?? '';
		if (!newName) return;
		try {
			const res = await fetch(`/api/servers/dev/files/...?path=${encodeURIComponent(filePath)}&action=rename`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: newName })
			});
			if (!res.ok) throw new Error('Failed to rename');
			loadDirectory(currentDir);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to rename';
		}
	}

	async function createEntry(type: 'file' | 'directory') {
		const name = prompt(`New ${type} name:`) ?? '';
		if (!name) return;
		try {
			const action = type === 'directory' ? 'mkdir' : 'touch';
			const res = await fetch(`/api/servers/dev/files/...?path=${encodeURIComponent(currentDir)}&action=${action}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name })
			});
			if (!res.ok) throw new Error(`Failed to create ${type}`);
			loadDirectory(currentDir);
		} catch (e) {
			error = e instanceof Error ? e.message : `Failed to create ${type}`;
		}
	}

	function goUp() {
		const parts = currentDir.replace(/\/$/, '').split('/').filter(Boolean);
		parts.pop();
		const parent = parts.length === 0 ? '/' : '/' + parts.join('/');
		loadDirectory(parent);
	}

	const isTextFile = $derived(selectedFile ? /\.(txt|properties|json|yml|yaml|xml|log|cfg|conf|toml|md|js|ts|svelte|css|html|sh)$/i.test(selectedFile) : false);
</script>

<div class="flex h-full flex-col">
	<div class="flex items-center justify-between mb-4">
		<h1 class="text-lg font-bold text-foreground">Files</h1>
		<div class="flex items-center gap-2">
			<button
				class="rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground hover:bg-accent transition-colors"
				onclick={() => createEntry('file')}
			>
				New File
			</button>
			<button
				class="rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground hover:bg-accent transition-colors"
				onclick={() => createEntry('directory')}
			>
				New Folder
			</button>
		</div>
	</div>

	<div class="flex flex-1 gap-4 overflow-hidden">
		<div class="flex w-80 flex-shrink-0 flex-col rounded-lg border border-border overflow-hidden">
			<div class="flex items-center gap-1 border-b border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
				<button
					class="hover:text-foreground transition-colors"
					onclick={() => loadDirectory('/')}
				>
					Root
				</button>
				{#each breadcrumbs.slice(1) as crumb, i}
					<button
						class="hover:text-foreground transition-colors"
						onclick={() => loadDirectory('/' + breadcrumbs.slice(1, i + 2).join('/'))}
					>
						/ {crumb}
					</button>
				{/each}
				<div class="ml-auto">
					<button
						class="hover:text-foreground transition-colors"
						disabled={currentDir === '/'}
						onclick={goUp}
					>
						↑
					</button>
				</div>
			</div>

			<div class="flex-1 overflow-y-auto">
				{#if loading}
					<div class="flex items-center justify-center py-8 text-xs text-muted-foreground">Loading...</div>
				{:else if error}
					<div class="flex items-center justify-center py-8 text-xs text-red-400">{error}</div>
				{:else if entries.length === 0}
					<div class="flex items-center justify-center py-8 text-xs text-muted-foreground">Empty directory</div>
				{:else}
					{#each entries as entry}
						<button
							class="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-accent/50 transition-colors {selectedFile === entry.path ? 'bg-accent' : ''}"
							onclick={() => {
								if (entry.type === 'directory') navigateToDir(entry.path);
								else openFile(entry.path);
							}}
							oncontextmenu={(e) => {
								e.preventDefault();
								if (confirm(`Delete ${entry.name}?`)) deleteEntry(entry.path);
							}}
						>
							<span class="flex-shrink-0 {entry.type === 'directory' ? 'text-yellow-400' : 'text-blue-400'}">
								{entry.type === 'directory' ? '📁' : '📄'}
							</span>
							<span class="flex-1 truncate">{entry.name}</span>
							<span class="flex-shrink-0 text-muted-foreground">
								{entry.sizeFormatted || ''}
							</span>
						</button>
					{/each}
				{/if}
			</div>
		</div>

		<div class="flex-1 rounded-lg border border-border overflow-hidden flex flex-col">
			{#if selectedFile}
				<div class="flex items-center justify-between border-b border-border bg-muted/30 px-3 py-2">
					<span class="text-xs font-mono text-foreground">{selectedFile}</span>
					<div class="flex items-center gap-2">
						{#if isTextFile}
							<button
								class="text-xs text-muted-foreground hover:text-foreground transition-colors"
								onclick={() => editing = !editing}
							>
								{editing ? 'Cancel' : 'Edit'}
							</button>
							{#if editing}
								<button
									class="text-xs text-green-400 hover:text-green-300 transition-colors"
									onclick={saveFile}
								>
									Save
								</button>
							{/if}
						{/if}
						{#if selectedFile}
							<button
								class="text-xs text-red-400 hover:text-red-300 transition-colors"
								onclick={() => deleteEntry(selectedFile!)}
							>
								Delete
							</button>
							<button
								class="text-xs text-muted-foreground hover:text-foreground transition-colors"
								onclick={() => renameEntry(selectedFile!)}
							>
								Rename
							</button>
						{/if}
					</div>
				</div>

				<div class="flex-1 overflow-auto">
					{#if isTextFile}
						{#if editing}
							<textarea
								bind:value={fileContent}
								class="h-full w-full resize-none border-0 bg-transparent p-3 font-mono text-xs text-foreground outline-none"
							></textarea>
						{:else}
							<pre class="p-3 font-mono text-xs text-foreground whitespace-pre-wrap">{fileContent}</pre>
						{/if}
					{:else}
						<div class="flex items-center justify-center py-12 text-xs text-muted-foreground">
							Binary file — cannot display
						</div>
					{/if}
				</div>
			{:else}
				<div class="flex flex-1 items-center justify-center text-xs text-muted-foreground">
					Select a file to preview
				</div>
			{/if}
		</div>
	</div>
</div>
