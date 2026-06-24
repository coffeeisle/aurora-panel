console.log('Aurora Daemon starting...');

const port = parseInt(process.env['DAEMON_PORT'] ?? '8443', 10);

const server = Bun.serve({
	port,
	async fetch(req) {
		const url = new URL(req.url);

		if (url.pathname === '/health') {
			return new Response(JSON.stringify({ status: 'ok', uptime: process.uptime() }), {
				headers: { 'Content-Type': 'application/json' }
			});
		}

		return new Response('Not Found', { status: 404 });
	}
});

console.log(`Daemon listening on port ${port}`);
