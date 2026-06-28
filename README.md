# Aurora Panel

A modern, self-hosted game server management panel with deep Modrinth integration. Lightweight alternative to MCSManager and Pelican Panel.

## Features

- **10 Minecraft platforms** — Vanilla, Paper, Purpur, Fabric, Forge, NeoForge, Quilt, Spigot, Folia, Bukkit
- **Modrinth integration** — Search, install, update, and remove mods/plugins/modpacks/datapacks
- **Multi-node** — One panel manages multiple daemon hosts
- **Real-time console** — WebSocket streaming with command input
- **File manager** — Browse, edit, upload, and delete server files
- **Backup system** — On-demand and scheduled backups
- **Scheduler** — Cron and interval-based automation (backups, restarts, commands)
- **Docker-first** — Containerized servers with resource limits, optional bare-metal
- **RBAC** — Role-based access control with granular permissions
- **Modern UI** — SvelteKit 5 + Tailwind CSS 4 + shadcn-svelte

## Quick Start

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/coffeeisle/aurora-panel/refs/heads/master/install.sh)
```

The interactive installer will:
1. Check prerequisites (Docker, RAM ≥4GB, disk ≥20GB, ports)
2. Let you choose Panel + Daemon, Panel only, or Daemon only
3. Clone the repo and generate secure secrets
4. Build and start Docker containers
5. Wait for the panel to be ready

Then open `http://your-server:3000/register` to create your admin account.

## Management CLI

```bash
# Install system-wide
sudo ./aurora.sh install

# Then use from anywhere:
aurora status
aurora logs panel
aurora update
```

## Manual Setup

```bash
git clone https://github.com/coffeeisle/aurora-panel.git
cd aurora-panel
cp .env.example .env
# Edit .env — set AUTH_SECRET and DAEMON_JWT_SECRET
docker compose up -d
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for full documentation.

## Architecture

```
                      Internet
                          |
                     [Caddy:443] (optional)
                          |
                   [Panel:3000]
                      /       \
              [Daemon:8443]  [Postgres:5432] (optional)
                    |
          [Docker containers]
```

- **Panel** — SvelteKit app: UI + API + orchestration
- **Daemon** — Per-host service: manages Docker containers, file system, backups
- **Communication** — JWT-authenticated Socket.IO + REST; no direct browser-to-daemon

## Documentation

- [Deployment Guide](DEPLOYMENT.md) — Full setup, configuration, troubleshooting
- [System Prompt](SYSTEM-PROMPT-AURORA.md) — Technical architecture and conventions

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | SvelteKit 5, TypeScript, Tailwind CSS 4, shadcn-svelte |
| Database | SQLite (default), PostgreSQL (optional) |
| Real-time | Socket.IO |
| Container | Docker via dockerode |
| Auth | Lucia Auth, JWT |

## Development

```bash
bun install
bun run dev        # Dev server on :5173
bun run check      # Type checking
bun run build      # Production build
```

## License

MIT
