<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { toasts } from '$lib/stores/toast';
	import { Clock, Plus, RefreshCw, Trash2, Loader2, Terminal, HardDrive, Search, Pencil } from '@lucide/svelte';

	type ScheduledTask = {
		id: string;
		serverId: string;
		name: string;
		description: string;
		type: 'cron' | 'interval';
		cronExpression?: string;
		intervalSeconds?: number;
		action: 'restart' | 'backup' | 'command' | 'update_check';
		payload: string;
		enabled: boolean;
		lastRunAt: string | null;
		nextRunAt: string;
		createdAt: string;
	};

	let schedules = $state<ScheduledTask[]>([]);
	let loading = $state(true);
	let error = $state('');
	let showCreate = $state(false);
	let editingId = $state<string | null>(null);

	const serverId = $derived($page.params.id);

	let formName = $state('');
	let formDesc = $state('');
	let formType: 'cron' | 'interval' = $state('interval');
	let formInterval = $state('3600');
	let formCron = $state('0 0 * * *');
	let formAction: ScheduledTask['action'] = $state('backup');
	let formPayload = $state('');

	function resetForm() {
		formName = '';
		formDesc = '';
		formType = 'interval';
		formInterval = '3600';
		formCron = '0 0 * * *';
		formAction = 'backup';
		formPayload = '';
		editingId = null;
	}

	function fillForm(s: ScheduledTask) {
		formName = s.name;
		formDesc = s.description;
		formType = s.type;
		formInterval = String(s.intervalSeconds ?? 3600);
		formCron = s.cronExpression || '0 0 * * *';
		formAction = s.action;
		formPayload = s.payload;
		editingId = s.id;
		showCreate = true;
	}

	onMount(() => loadSchedules());

	async function loadSchedules() {
		loading = true;
		error = '';
		try {
			const res = await fetch(`/api/servers/${serverId}/schedules`);
			if (!res.ok) throw new Error('Failed to load schedules');
			schedules = await res.json();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Unknown error';
		} finally {
			loading = false;
		}
	}

	async function saveSchedule() {
		if (!formName.trim()) { toasts.error('Name required'); return; }
		const isEdit = editingId !== null;
		try {
			const body: Record<string, unknown> = {
				name: formName.trim(),
				description: formDesc.trim(),
				type: formType,
				action: formAction,
				payload: formPayload.trim(),
			};
			if (formType === 'interval') {
				body.intervalSeconds = parseInt(formInterval, 10);
			} else {
				body.cronExpression = formCron.trim();
			}

			const url = isEdit
				? `/api/servers/${serverId}/schedules/${editingId}`
				: `/api/servers/${serverId}/schedules`;
			const res = await fetch(url, {
				method: isEdit ? 'PATCH' : 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
			});
			if (!res.ok) throw new Error(isEdit ? 'Failed to update' : 'Failed to create');
			toasts.success(isEdit ? 'Schedule updated' : 'Schedule created');
			showCreate = false;
			resetForm();
			loadSchedules();
		} catch (e) {
			toasts.error(isEdit ? 'Update failed' : 'Create failed', e instanceof Error ? e.message : '');
		}
	}

	async function toggleSchedule(id: string, enabled: boolean) {
		try {
			const res = await fetch(`/api/servers/${serverId}/schedules/${id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'toggle', enabled })
			});
			if (!res.ok) throw new Error('Failed to toggle');
			loadSchedules();
		} catch (e) {
			toasts.error('Toggle failed', e instanceof Error ? e.message : '');
		}
	}

	async function deleteSchedule(id: string) {
		if (!confirm('Delete this schedule?')) return;
		try {
			const res = await fetch(`/api/servers/${serverId}/schedules/${id}`, { method: 'DELETE' });
			if (!res.ok) throw new Error('Failed to delete');
			toasts.success('Schedule deleted');
			loadSchedules();
		} catch (e) {
			toasts.error('Delete failed', e instanceof Error ? e.message : '');
		}
	}

	function actionIcon(action: string) {
		if (action === 'restart') return RefreshCw;
		if (action === 'backup') return HardDrive;
		if (action === 'command') return Terminal;
		return Search;
	}

	function actionColor(action: string) {
		if (action === 'restart') return 'text-orange-400';
		if (action === 'backup') return 'text-blue-400';
		if (action === 'command') return 'text-purple-400';
		return 'text-green-400';
	}

	function formatDate(iso: string | null): string {
		if (!iso) return '—';
		return new Date(iso).toLocaleString();
	}

	function formatInterval(sec?: number): string {
		if (!sec) return '';
		if (sec < 60) return `${sec}s`;
		if (sec < 3600) return `${Math.floor(sec / 60)}m`;
		return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
	}
</script>

<div class="flex h-full flex-col">
	<div class="flex items-center justify-between mb-4">
		<div>
			<h1 class="text-lg font-bold text-foreground">Schedules</h1>
			<p class="text-xs text-muted-foreground mt-0.5">Automate server tasks</p>
		</div>
		<button
			class="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
			onclick={() => { resetForm(); showCreate = !showCreate; }}
		>
			<Plus class="h-3.5 w-3.5" />
			New Schedule
		</button>
	</div>

	{#if showCreate}
		<div class="mb-4 rounded-lg border border-border bg-card p-4">
			<h3 class="text-sm font-semibold text-foreground mb-3">
				{editingId ? 'Edit Schedule' : 'Create Schedule'}
			</h3>
			<div class="grid grid-cols-2 gap-3">
				<div class="col-span-2">
					<label for="sched-name" class="mb-1 block text-xs text-muted-foreground">Name</label>
					<input id="sched-name" bind:value={formName} placeholder="Daily backup" class="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary" />
				</div>
				<div class="col-span-2">
					<label for="sched-desc" class="mb-1 block text-xs text-muted-foreground">Description</label>
					<input id="sched-desc" bind:value={formDesc} placeholder="Optional description" class="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary" />
				</div>
				<div>
					<label for="sched-type" class="mb-1 block text-xs text-muted-foreground">Type</label>
					<select id="sched-type" bind:value={formType} class="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary">
						<option value="interval">Interval</option>
						<option value="cron">Cron</option>
					</select>
				</div>
				<div>
					<label for="sched-action" class="mb-1 block text-xs text-muted-foreground">Action</label>
					<select id="sched-action" bind:value={formAction} class="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary">
						<option value="backup">Backup</option>
						<option value="restart">Restart</option>
						<option value="command">Command</option>
						<option value="update_check">Update Check</option>
					</select>
				</div>
				{#if formType === 'interval'}
					<div>
						<label for="sched-interval" class="mb-1 block text-xs text-muted-foreground">Interval (seconds)</label>
						<input id="sched-interval" bind:value={formInterval} placeholder="3600" type="number" class="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary" />
					</div>
				{:else}
					<div>
						<label for="sched-cron" class="mb-1 block text-xs text-muted-foreground">Cron Expression</label>
						<input id="sched-cron" bind:value={formCron} placeholder="0 0 * * *" class="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary" />
					</div>
				{/if}
				<div>
					<label for="sched-payload" class="mb-1 block text-xs text-muted-foreground">Payload</label>
					<input id="sched-payload" bind:value={formPayload} placeholder="/say Restarting..." class="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary" />
				</div>
			</div>
			<div class="flex gap-2 mt-3">
				<button class="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90" onclick={saveSchedule}>
					{editingId ? 'Update' : 'Create'}
				</button>
				<button class="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground" onclick={() => { showCreate = false; resetForm(); }}>Cancel</button>
			</div>
		</div>
	{/if}

	<div class="flex-1 overflow-y-auto space-y-2">
		{#if loading}
			<div class="flex justify-center py-12"><div class="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div></div>
		{:else if error}
			<div class="flex justify-center py-12 text-sm text-red-400">{error}</div>
		{:else if schedules.length === 0}
			<div class="flex flex-col items-center justify-center py-12 text-sm text-muted-foreground">
				<Clock class="mb-2 h-8 w-8 opacity-40" />
				<p>No schedules</p>
				<p class="text-xs mt-1">Create a schedule to automate backups, restarts, and more.</p>
			</div>
		{:else}
			{#each schedules as sched (sched.id)}
				{@const Icon = actionIcon(sched.action)}
				<div class="flex items-center gap-4 rounded-lg border border-border bg-card p-4 {!sched.enabled ? 'opacity-50' : ''}">
					<div class="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
						<Icon class="h-5 w-5 {actionColor(sched.action)}" />
					</div>
					<div class="flex-1 min-w-0">
						<h3 class="text-sm font-medium text-foreground">{sched.name}</h3>
						<p class="text-xs text-muted-foreground mt-0.5">
							{sched.type === 'interval'
								? `Every ${formatInterval(sched.intervalSeconds)}`
								: sched.cronExpression
							}
							· {sched.action.replace('_', ' ')}
							{sched.payload ? `· "${sched.payload}"` : ''}
						</p>
						<p class="text-xs text-muted-foreground mt-0.5">
							Last: {formatDate(sched.lastRunAt)}
							· Next: {formatDate(sched.nextRunAt)}
						</p>
					</div>
					<div class="flex items-center gap-1.5">
						<button
							class="rounded-md border border-border px-2 py-1.5 text-xs hover:text-foreground text-muted-foreground"
							onclick={() => { fillForm(sched); }}
							title="Edit"
						>
							<Pencil class="h-3.5 w-3.5" />
						</button>
						<button
							class="rounded-md border border-border px-2 py-1.5 text-xs {sched.enabled ? 'text-green-400' : 'text-muted-foreground'} hover:text-foreground"
							onclick={() => toggleSchedule(sched.id, !sched.enabled)}
						>
							{sched.enabled ? 'Active' : 'Paused'}
						</button>
						<button
							class="rounded-md border border-border px-2 py-1.5 text-xs text-red-400 hover:text-red-300"
							onclick={() => deleteSchedule(sched.id)}
						>
							<Trash2 class="h-3.5 w-3.5" />
						</button>
					</div>
				</div>
			{/each}
		{/if}
	</div>
</div>
