<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { LogIn } from '@lucide/svelte';

	let email = $state('');
	let password = $state('');
	let error = $state('');
	let loading = $state(false);

	async function handleLogin() {
		loading = true;
		error = '';

		try {
			const res = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, password })
			});

			if (!res.ok) {
				const data = await res.json();
				error = data.error ?? 'Login failed';
				return;
			}

			goto('/dashboard');
		} catch {
			error = 'An unexpected error occurred';
		} finally {
			loading = false;
		}
	}
</script>

<div class="w-full max-w-sm space-y-6 px-4">
	<div class="text-center">
		<div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-xl font-bold text-primary-foreground">
			A
		</div>
		<h1 class="text-2xl font-bold text-foreground">Aurora Panel</h1>
		<p class="mt-1 text-sm text-muted-foreground">Sign in to manage your servers</p>
	</div>

	<form class="space-y-4" onsubmit={handleLogin}>
		<div class="space-y-2">
			<label for="email" class="text-sm font-medium text-foreground">Email</label>
			<Input id="email" type="email" bind:value={email} placeholder="you@example.com" required />
		</div>
		<div class="space-y-2">
			<label for="password" class="text-sm font-medium text-foreground">Password</label>
			<Input id="password" type="password" bind:value={password} placeholder="••••••••" required />
		</div>

		{#if error}
			<p class="text-sm text-destructive">{error}</p>
		{/if}

		<Button type="submit" class="w-full" disabled={loading}>
			{loading ? 'Signing in...' : 'Sign in'}
			<LogIn class="ml-2 h-4 w-4" />
		</Button>
	</form>
</div>
