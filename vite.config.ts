import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
	resolve: {
		alias: {
			'lucide-svelte': '@lucide/svelte'
		}
	},
	plugins: [
		sveltekit(),
		{
			name: 'socket.io-server',
			configureServer(vite) {
				const httpServer = vite.httpServer;
				if (httpServer) {
					import('./src/lib/server/socket').then(({ createSocketServer }) => {
						createSocketServer(httpServer as any);
					});
				}
			}
		}
	]
});
