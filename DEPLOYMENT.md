# Aurora Panel — Deployment Guide

## Prerequisites

- **Server**: Linux (Ubuntu 22.04+, Debian 12+, or similar)
- **Docker** & **Docker Compose** (v2.20+)
- **Minimum**: 2 CPU cores, 4GB RAM, 20GB disk
- **Recommended**: 4 CPU cores, 8GB RAM, 50GB+ SSD

## Quick Start (Docker Compose)

```bash
# 1. Clone the repository
git clone https://github.com/your-org/aurora-panel.git
cd aurora-panel

# 2. Copy and configure environment
cp .env.example .env
# Edit .env — set AUTH_SECRET and DAEMON_JWT_SECRET (use openssl rand -hex 32)

# 3. Start the panel
docker compose up -d panel daemon

# 4. Access at http://your-server:3000
# Register the first admin account at /register
```

## With PostgreSQL (Recommended for Production)

```bash
# Set DATABASE_URL in .env:
DATABASE_URL=postgres://aurora:your-password@postgres:5432/aurora
POSTGRES_PASSWORD=your-password

docker compose --profile with-postgres up -d
```

## With Caddy (Automatic SSL)

```bash
# Set DOMAIN in .env to your real domain (e.g., panel.yourdomain.com)
# Ensure DNS points to your server

docker compose --profile with-caddy up -d
# Or combine with PostgreSQL:
docker compose --profile with-postgres --profile with-caddy up -d
```

## Configuration Reference

### Required Environment Variables

| Variable | Description |
|---|---|
| `AUTH_SECRET` | Session encryption key (generate with `openssl rand -hex 32`) |
| `DAEMON_JWT_SECRET` | Daemon communication secret (generate with `openssl rand -hex 32`) |

### Optional Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PUBLIC_APP_URL` | `http://localhost:3000` | Public URL of the panel |
| `PANEL_PORT` | `3000` | Panel HTTP port |
| `DAEMON_PORT` | `8443` | Daemon HTTP port |
| `DATABASE_URL` | `file:./data/aurora.db` | Database connection string |
| `DAEMON_ID` | `node-01` | Unique daemon identifier |
| `DAEMON_NAME` | `Primary Node` | Human-readable daemon name |
| `AUTO_RESTART` | `true` | Auto-restart crashed servers |
| `MAX_CRASH_RESTARTS` | `3` | Max crash restarts before manual intervention |
| `DOMAIN` | `panel.example.com` | Domain for Caddy SSL |

## Architecture

```
                          Internet
                             |
                          [Caddy:443] (optional, with SSL)
                             |
                     [Panel:3000] (SvelteKit)
                        /          \
                 [Daemon:8443]   [Postgres:5432] (optional)
                       |
              [Docker Engine]
              /     |     \
          Server1 Server2 ServerN
```

- **Panel**: SvelteKit app — serves the UI and API
- **Daemon**: Node.js service on each host — manages Docker containers
- **Communication**: Panel ↔ Daemon via JWT-authenticated Socket.IO + REST
- **Security**: No direct browser access to daemon; everything proxied through the panel

## Server Lifecycle

1. **Create**: Panel creates DB record → emits `server:create` to daemon
2. **Install**: Daemon creates directory, downloads server jar via egg system, sets up eula
3. **Start**: Daemon creates Docker container with resource limits, port mapping
4. **Run**: Console streaming, resource monitoring, crash detection
5. **Stop**: Graceful stop (stop command → 10s timeout → force remove)
6. **Auto-Restart**: On crash, daemon auto-restarts up to `MAX_CRASH_RESTARTS` times

## Supported Server Software

- **Vanilla** — Mojang official server (via Mojang version manifest)
- **Paper** — High-performance (via PaperMC API)
- **Purpur** — Fork of Paper with more options (via Purpur API)
- **Fabric** — Lightweight mod loader (via Fabric meta API)
- **Forge** — Original mod loader (via Forge maven)
- **NeoForge** — Next-gen Forge fork (via NeoForge maven)
- **Quilt** — Modern Fabric fork (via Quilt meta API)
- **Spigot** — Widely-used (via BuildTools)
- **Folia** — Regionized multithreading (via PaperMC API)

## Security Considerations

- Run everything behind Caddy with automatic SSL in production
- Change `AUTH_SECRET` and `DAEMON_JWT_SECRET` immediately
- Use non-root users in containers (set `user: "1000:1000"`)
- Restrict `/var/run/docker.sock` access to only the daemon container
- Use PostgreSQL for multi-instance deployments
- Enable fail2ban or similar on the host
- Regularly update the panel and daemon

## Monitoring

- **Daemon health**: Available at `GET /health` on the daemon port
- **System stats**: CPU, memory, disk usage sent to panel every 5 seconds
- **Crash alerts**: When a server crashes, the panel shows a toast notification
- **Container health**: Checked every 10 seconds

## Troubleshooting

**Daemon won't connect to panel**:
- Check `PANEL_URL` in daemon env (use `http://panel:3000` for Docker)
- Verify `DAEMON_JWT_SECRET` matches between panel and daemon
- Check network: both services must be on the same Docker network

**Server fails to start**:
- Check daemon logs: `docker compose logs daemon`
- Verify the server jar was downloaded (check server directory)
- Ensure the Docker image is available (temurin JRE images)

**File operations fail**:
- Check permissions on the server data volume
- Verify the server directory exists in `/servers/<serverId>/`

## Upgrading

```bash
git pull
docker compose build --no-cache
docker compose up -d
```
