import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
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
