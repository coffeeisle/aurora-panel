# Aurora Panel — Docker Build Error Log

## Issue 1: `bun install --production=false` flag deprecated
- **File**: `Dockerfile`
- **Error**: `The argument '--production' does not take a value.`
- **Fix**: Changed `bun install --frozen-lockfile --production=false` to `bun install --frozen-lockfile`
- **Status**: Fixed

## Issue 2: Alpine-style user creation on Debian slim
- **File**: `Dockerfile` (panel + daemon)
- **Error**: `addgroup: not found` / `adduser: not found`
- **Root cause**: `oven/bun:1-slim` is Debian Trixie, not Alpine. Uses `useradd`/`groupadd` (shadow utilities) instead of `adduser`/`addgroup`.
- **Fix**: Changed `addgroup -S aurora && adduser -S aurora -G aurora` to `groupadd -r aurora && useradd -r -g aurora -d /app aurora`
- **Status**: Fixed

## Issue 3: `better-sqlite3` not supported in Bun runtime
- **File**: `Dockerfile`
- **Error**: `error: 'better-sqlite3' is not yet supported in Bun.`
- **Root cause**: `better-sqlite3` uses native Node.js addons which Bun can't load. The build (`vite build`) imports server code that opens the DB.
- **Fix**: Switched from Bun-based builder to Node.js (npm). Builder uses `node:22-slim`, runner uses `node:22-slim`. `CMD` changed from `bun ./build/index.js` to `node ./build/index.js`.
- **Status**: Fixed

## Issue 4: Node.js version mismatch for native addon
- **File**: `Dockerfile`
- **Error**: `was compiled against a different Node.js version using NODE_MODULE_VERSION 137. This version of Node.js requires NODE_MODULE_VERSION 127.`
- **Root cause**: Host's `node_modules` (with pre-compiled native addon) was copied into Docker. Host had different Node.js ABI.
- **Fix**: Added `.dockerignore` with `node_modules` to prevent host modules from overwriting Docker-installed ones. Added `npm rebuild better-sqlite3` step.
- **Status**: Fixed

## Issue 5: Database directory missing at build time
- **File**: `Dockerfile`
- **Error**: `TypeError: Cannot open database because the directory does not exist`
- **Root cause**: Vite SSR build's postbuild analysis imports the server code which opens SQLite. Directory `/app/data` didn't exist.
- **Fix**: Added `mkdir -p /app/data` before `npm run build`.
- **Status**: Fixed

## Issue 6: SvelteKit hooks `init()` called without arguments
- **File**: `src/hooks.server.ts`
- **Error**: `TypeError: Cannot destructure property 'server' of 'undefined' as it is undefined.`
- **Root cause**: SvelteKit adapter-node calls `hooks.init()` with no arguments. The code expected `init({ server })`.
- **Fix**: Changed `init({ server })` to `init()`. Store a closure on `globalThis.__auroraSocketInit` for use by a custom startup wrapper.
- **Status**: Fixed

## Issue 7: Socket.IO not initialized (no HTTP server reference)
- **Detail**: `hooks.init()` doesn't receive the HTTP server. Socket.IO wasn't being initialized.
- **Fix**: Created `start.js` that imports `build/index.js`, gets the `server.server` HTTP server from the export, and calls `globalThis.__auroraSocketInit(httpServer)`. Docker CMD changed to `node ./start.js`.
- **Files**: `start.js` (new), `Dockerfile` (CMD updated)
- **Status**: Fixed

## Issue 8: Daemon Docker socket not accessible (permission denied)
- **Detail**: Daemon ran as `app` user which couldn't read `/var/run/docker.sock` (owned by root:docker).
- **Fix**: Removed `USER app` from daemon Dockerfile — daemon now runs as root to access Docker socket.
- **File**: `daemon/Dockerfile`
- **Status**: Fixed

## Issue 9: Fresh database has no tables
- **Detail**: First startup crashes schedule poller with `SqliteError: no such table: schedules`.
- **Fix**: Added `CREATE TABLE IF NOT EXISTS ...` for all 7 tables in `db/index.ts`.
- **File**: `src/lib/server/db/index.ts`
- **Status**: Fixed
