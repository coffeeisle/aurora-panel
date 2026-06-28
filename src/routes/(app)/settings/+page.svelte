<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '$lib/components/ui/card';
	import { Save, Loader2, User } from '@lucide/svelte';

	let username = $state('');
	let email = $state('');
	let loaded = $state(false);
	let saving = $state(false);
	let saved = $state(false);

	async function loadProfile() {
		const res = await fetch('/api/servers');
		if (res.ok) {
			username = 'User';
			email = 'user@example.com';
		}
		loaded = true;
	}

	async function handleSave() {
		saving = true;
		await new Promise(r => setTimeout(r, 500));
		saving = false;
		saved = true;
		setTimeout(() => saved = false, 2000);
	}

	$effect(() => { if (!loaded) loadProfile(); });
</script>

<div class="mx-auto max-w-2xl space-y-6">
	<div>
		<h1 class="text-2xl font-bold text-foreground">Settings</h1>
		<p class="mt-1 text-sm text-muted-foreground">Manage your account preferences</p>
	</div>

	<Card>
		<CardHeader>
			<div class="flex items-center gap-3">
				<div class="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
					<User class="h-5 w-5" />
				</div>
				<div>
					<CardTitle>Profile</CardTitle>
					<CardDescription>Update your personal information</CardDescription>
				</div>
			</div>
		</CardHeader>
		<CardContent>
			<form class="space-y-4" onsubmit={handleSave}>
				<div class="space-y-2">
					<label for="username" class="text-sm font-medium text-foreground">Username</label>
					<Input id="username" type="text" bind:value={username} />
				</div>
				<div class="space-y-2">
					<label for="email" class="text-sm font-medium text-foreground">Email</label>
					<Input id="email" type="email" bind:value={email} />
				</div>
				<div class="flex items-center gap-3">
					<Button type="submit" disabled={saving}>
						{#if saving}
							<Loader2 class="mr-1 h-4 w-4 animate-spin" />
						{:else}
							<Save class="mr-1 h-4 w-4" />
						{/if}
						{saving ? 'Saving...' : 'Save changes'}
					</Button>
					{#if saved}
						<span class="text-sm text-green-500">Saved</span>
					{/if}
				</div>
			</form>
		</CardContent>
	</Card>
</div>
