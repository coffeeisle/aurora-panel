<script lang="ts">
	import { onMount } from 'svelte';
	import { toasts } from '$lib/stores/toast';
	import { Button } from '$lib/components/ui/button';
	import Input from '$lib/components/ui/input/input.svelte';
	import * as Card from '$lib/components/ui/card';
	import Badge from '$lib/components/ui/badge/badge.svelte';
	import {
		Users, Settings, Plus, Trash2, Shield, ShieldAlert,
		UserCog, X, Server, HardDrive, Database, Info
	} from '@lucide/svelte';

	type AdminUser = {
		id: string;
		username: string;
		email: string;
		role: string;
		createdAt: number;
	};

	type SystemInfo = {
		dbPath: string;
		serverCount: number;
		nodeCount: number;
		userCount: number;
		version: string;
	};

	let activeTab = $state<'users' | 'general'>('users');
	let usersList = $state<AdminUser[]>([]);
	let systemInfo = $state<SystemInfo | null>(null);
	let loading = $state(true);

	let showAddUser = $state(false);
	let addUsername = $state('');
	let addEmail = $state('');
	let addPassword = $state('');
	let addRole = $state('user');
	let adding = $state(false);

	let editingRole = $state<string | null>(null);
	let editRoleValue = $state('user');

	onMount(() => {
		loadData();
	});

	async function loadData() {
		loading = true;
		try {
			const res = await fetch('/admin/users');
			if (res.ok) usersList = await res.json();
		} catch (e) {
			toasts.error('Failed to load', e instanceof Error ? e.message : 'Unknown error');
		} finally {
			loading = false;
		}
	}

	async function loadUsers() {
		try {
			const res = await fetch('/admin/users');
			if (res.ok) usersList = await res.json();
		} catch (e) {
			toasts.error('Failed to load users', e instanceof Error ? e.message : 'Unknown error');
		}
	}

	async function addUser() {
		if (!addUsername.trim() || !addEmail.trim() || !addPassword) {
			toasts.error('Validation', 'Username, email, and password are required');
			return;
		}
		adding = true;
		try {
			const res = await fetch('/admin/users', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					username: addUsername.trim(),
					email: addEmail.trim(),
					password: addPassword,
					role: addRole
				})
			});
			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				throw new Error(err.error || `Failed (${res.status})`);
			}
			toasts.success('User created', `${addUsername} added`);
			resetAddForm();
			loadUsers();
		} catch (e) {
			toasts.error('Failed to add user', e instanceof Error ? e.message : 'Unknown error');
		} finally {
			adding = false;
		}
	}

	function resetAddForm() {
		showAddUser = false;
		addUsername = '';
		addEmail = '';
		addPassword = '';
		addRole = 'user';
	}

	async function changeRole(userId: string) {
		try {
			const res = await fetch(`/admin/users?id=${userId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ role: editRoleValue })
			});
			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				throw new Error(err.error || 'Failed to update role');
			}
			toasts.success('Role updated');
			editingRole = null;
			loadUsers();
		} catch (e) {
			toasts.error('Failed to update role', e instanceof Error ? e.message : 'Unknown error');
		}
	}

	async function deleteUser(userId: string, username: string) {
		if (!confirm(`Delete user "${username}"? This cannot be undone.`)) return;
		try {
			const res = await fetch(`/admin/users?id=${userId}`, { method: 'DELETE' });
			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				throw new Error(err.error || 'Failed to delete user');
			}
			toasts.success('User deleted', `${username} removed`);
			loadUsers();
		} catch (e) {
			toasts.error('Failed to delete user', e instanceof Error ? e.message : 'Unknown error');
		}
	}

	function formatDate(ts: number): string {
		return new Date(ts).toLocaleDateString('en-US', {
			year: 'numeric', month: 'short', day: 'numeric'
		});
	}
</script>

<div class="mx-auto max-w-5xl space-y-8">
	<div>
		<h1 class="text-2xl font-bold tracking-tight text-foreground">Administration</h1>
		<p class="mt-1 text-sm text-muted-foreground">Manage users and view system information</p>
	</div>

	<div class="flex gap-1 rounded-lg border border-border bg-card p-1 w-fit">
		<button
			class="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors {activeTab === 'users' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}"
			onclick={() => activeTab = 'users'}
		>
			<Users class="h-3.5 w-3.5" />
			Users
		</button>
		<button
			class="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors {activeTab === 'general' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}"
			onclick={() => activeTab = 'general'}
		>
			<Settings class="h-3.5 w-3.5" />
			General
		</button>
	</div>

	{#if activeTab === 'users'}
		<Card.Root>
			<div class="p-0">
				<div class="flex items-center justify-between border-b border-border px-4 py-3">
					<p class="text-sm font-semibold text-foreground">Users ({usersList.length})</p>
					<Button size="sm" onclick={() => { showAddUser = true; }}>
						<Plus class="h-3.5 w-3.5" />
						Add User
					</Button>
				</div>

				{#if showAddUser}
					<div class="border-b border-border bg-muted/20 p-4">
						<div class="flex items-center justify-between mb-3">
							<p class="text-sm font-medium text-foreground">New User</p>
							<button onclick={resetAddForm} class="text-muted-foreground hover:text-foreground transition-colors">
								<X class="h-4 w-4" />
							</button>
						</div>
						<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
							<div class="space-y-1">
								<label for="add-username" class="text-[10px] text-muted-foreground">Username</label>
								<Input id="add-username" bind:value={addUsername} placeholder="username" />
							</div>
							<div class="space-y-1">
								<label for="add-email" class="text-[10px] text-muted-foreground">Email</label>
								<Input id="add-email" bind:value={addEmail} type="email" placeholder="user@example.com" />
							</div>
							<div class="space-y-1">
								<label for="add-password" class="text-[10px] text-muted-foreground">Password</label>
								<Input id="add-password" bind:value={addPassword} type="password" placeholder="••••••••" />
							</div>
							<div class="space-y-1">
								<label for="add-role" class="text-[10px] text-muted-foreground">Role</label>
								<select
									id="add-role"
									bind:value={addRole}
									class="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-ring focus:ring-ring/50 focus:ring-3"
								>
									<option value="user">User</option>
									<option value="admin">Admin</option>
								</select>
							</div>
						</div>
						<div class="mt-3 flex justify-end gap-2">
							<Button variant="outline" size="sm" onclick={resetAddForm}>Cancel</Button>
							<Button size="sm" onclick={addUser} disabled={adding}>
								{adding ? 'Adding...' : 'Add User'}
							</Button>
						</div>
					</div>
				{/if}

				<div class="overflow-x-auto">
					<table class="w-full text-left text-sm">
						<thead>
							<tr class="border-b border-border text-xs text-muted-foreground">
								<th class="px-4 py-2.5 font-medium">Username</th>
								<th class="px-4 py-2.5 font-medium">Email</th>
								<th class="px-4 py-2.5 font-medium">Role</th>
								<th class="px-4 py-2.5 font-medium">Created</th>
								<th class="px-4 py-2.5 font-medium text-right">Actions</th>
							</tr>
						</thead>
						<tbody>
							{#each usersList as user}
								<tr class="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
									<td class="px-4 py-3">
										<div class="flex items-center gap-2">
											<span class="font-medium text-foreground">{user.username}</span>
											{#if user.role === 'admin'}
												<Badge variant="outline" class="text-[10px]">Admin</Badge>
											{/if}
										</div>
									</td>
									<td class="px-4 py-3 text-muted-foreground">{user.email}</td>
									<td class="px-4 py-3">
										{#if editingRole === user.id}
											<div class="flex items-center gap-1.5">
												<select
													bind:value={editRoleValue}
													class="rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground outline-none"
												>
													<option value="user">User</option>
													<option value="admin">Admin</option>
												</select>
												<button
													class="rounded p-1 text-green-400 hover:text-green-300 transition-colors"
													onclick={() => changeRole(user.id)}
												>
													<Shield class="h-3.5 w-3.5" />
												</button>
												<button
													class="rounded p-1 text-muted-foreground hover:text-foreground transition-colors"
													onclick={() => editingRole = null}
												>
													<X class="h-3.5 w-3.5" />
												</button>
											</div>
										{:else}
											<span class="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
												{#if user.role === 'admin'}
													<ShieldAlert class="h-3 w-3" />
												{:else}
													<UserCog class="h-3 w-3" />
												{/if}
												{user.role}
											</span>
										{/if}
									</td>
									<td class="px-4 py-3 text-muted-foreground text-xs">{formatDate(user.createdAt)}</td>
									<td class="px-4 py-3 text-right">
										<div class="flex items-center justify-end gap-1">
											<button
												class="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
												title="Edit Role"
												onclick={() => { editingRole = user.id; editRoleValue = user.role; }}
											>
												<Shield class="h-3.5 w-3.5" />
											</button>
											<button
												class="rounded-md p-1.5 text-muted-foreground hover:text-red-400 hover:bg-muted transition-colors"
												title="Delete"
												onclick={() => deleteUser(user.id, user.username)}
											>
												<Trash2 class="h-3.5 w-3.5" />
											</button>
										</div>
									</td>
								</tr>
							{/each}
							{#if usersList.length === 0 && !loading}
								<tr>
									<td colspan="5" class="px-4 py-8 text-center text-sm text-muted-foreground">
										No users found.
									</td>
								</tr>
							{/if}
						</tbody>
					</table>
				</div>
			</div>
		</Card.Root>
	{/if}

	{#if activeTab === 'general'}
		<div class="grid gap-4 md:grid-cols-2">
			<Card.Root>
				<div class="p-6">
					<div class="flex items-center gap-2 mb-4">
						<Info class="h-4 w-4 text-primary" />
						<h2 class="text-sm font-semibold text-foreground">System Information</h2>
					</div>
					<div class="space-y-3">
						<div class="flex items-center justify-between border-b border-border pb-2">
							<span class="text-xs text-muted-foreground">Database</span>
							<span class="text-xs font-mono text-foreground">{systemInfo?.dbPath || 'Loading...'}</span>
						</div>
						<div class="flex items-center justify-between border-b border-border pb-2">
							<span class="text-xs text-muted-foreground">Servers</span>
							<span class="text-xs font-mono text-foreground">{systemInfo?.serverCount ?? '...'}</span>
						</div>
						<div class="flex items-center justify-between border-b border-border pb-2">
							<span class="text-xs text-muted-foreground">Nodes</span>
							<span class="text-xs font-mono text-foreground">{systemInfo?.nodeCount ?? '...'}</span>
						</div>
						<div class="flex items-center justify-between border-b border-border pb-2">
							<span class="text-xs text-muted-foreground">Users</span>
							<span class="text-xs font-mono text-foreground">{systemInfo?.userCount ?? '...'}</span>
						</div>
						<div class="flex items-center justify-between">
							<span class="text-xs text-muted-foreground">Panel Version</span>
							<span class="text-xs font-mono text-foreground">{systemInfo?.version || '1.0.0'}</span>
						</div>
					</div>
				</div>
			</Card.Root>

			<Card.Root>
				<div class="p-6">
					<div class="flex items-center gap-2 mb-4">
						<Database class="h-4 w-4 text-primary" />
						<h2 class="text-sm font-semibold text-foreground">Quick Stats</h2>
					</div>
					<div class="grid grid-cols-2 gap-3">
						<div class="rounded-lg bg-muted/30 p-3">
							<div class="flex items-center gap-1.5 text-muted-foreground mb-1">
								<Server class="h-3.5 w-3.5" />
								<span class="text-[10px]">Servers</span>
							</div>
							<p class="text-lg font-bold text-foreground">{systemInfo?.serverCount ?? '—'}</p>
						</div>
						<div class="rounded-lg bg-muted/30 p-3">
							<div class="flex items-center gap-1.5 text-muted-foreground mb-1">
								<HardDrive class="h-3.5 w-3.5" />
								<span class="text-[10px]">Nodes</span>
							</div>
							<p class="text-lg font-bold text-foreground">{systemInfo?.nodeCount ?? '—'}</p>
						</div>
						<div class="rounded-lg bg-muted/30 p-3">
							<div class="flex items-center gap-1.5 text-muted-foreground mb-1">
								<Users class="h-3.5 w-3.5" />
								<span class="text-[10px]">Users</span>
							</div>
							<p class="text-lg font-bold text-foreground">{systemInfo?.userCount ?? '—'}</p>
						</div>
						<div class="rounded-lg bg-muted/30 p-3">
							<div class="flex items-center gap-1.5 text-muted-foreground mb-1">
								<Database class="h-3.5 w-3.5" />
								<span class="text-[10px]">DB Type</span>
							</div>
							<p class="text-lg font-bold text-foreground">SQLite</p>
						</div>
					</div>
				</div>
			</Card.Root>
		</div>
	{/if}
</div>
