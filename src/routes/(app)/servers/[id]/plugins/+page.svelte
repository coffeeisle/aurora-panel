<script lang="ts">
	import { redirect } from '@sveltejs/kit';
	import { page } from '$app/stores';
	redirect(308, `/servers/${$page.params.id}/mods`);
</script>