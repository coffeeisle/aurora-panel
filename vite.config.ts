import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/postcss';

export default defineConfig({
	resolve: {
		alias: {
			'lucide-svelte': '@lucide/svelte'
		}
	},
	css: {
		postcss: {
			plugins: [tailwindcss()]
		},
		transformer: 'postcss'
	},
	build: {
		cssMinify: false
	},
	plugins: [sveltekit()]
});
