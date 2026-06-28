import './build/index.js';
const { server } = await import('./build/index.js');

if (typeof globalThis.__auroraSocketInit === 'function') {
	globalThis.__auroraSocketInit(server.server);
}

export { server };
