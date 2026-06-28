#!/usr/bin/env bash
set -euo pipefail

AURORA_VERSION="0.1.0"
AURORA_REPO="https://github.com/coffeeisle/aurora-panel.git"
AURORA_BRANCH="master"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()  { echo -e "${BLUE}[INFO]${NC} $1"; }
ok()    { echo -e "${GREEN}[OK]${NC}   $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()   { echo -e "${RED}[ERR]${NC}  $1"; }

info "Aurora Panel v${AURORA_VERSION} Installer"
echo "----------------------------------------"

# ── Pre-flight checks ──
PREFLIGHT_PASS=true

command -v docker &>/dev/null || { err "Docker is not installed. Install Docker first: https://docs.docker.com/engine/install/"; PREFLIGHT_PASS=false; }

if command -v docker &>/dev/null; then
	docker compose version &>/dev/null || { err "Docker Compose v2 is required. Update Docker."; PREFLIGHT_PASS=false; }
fi

ARCH=$(uname -m)
if [[ "$ARCH" != "x86_64" && "$ARCH" != "aarch64" ]]; then
	warn "Architecture $ARCH is not officially supported (use x86_64 or aarch64)."
fi

TOTAL_RAM_MB=$(free -m 2>/dev/null | awk '/^Mem:/{print $2}' || echo 0)
if [[ $TOTAL_RAM_MB -gt 0 && $TOTAL_RAM_MB -lt 4000 ]]; then
	warn "Only ${TOTAL_RAM_MB}MB RAM detected. Minimum 4GB recommended for running game servers."
fi

ROOT_AVAIL_GB=$(df -BG / 2>/dev/null | awk 'NR==2{gsub(/G/,"",$4); print $4}' || echo 0)
if [[ $ROOT_AVAIL_GB -gt 0 && $ROOT_AVAIL_GB -lt 20 ]]; then
	warn "Only ${ROOT_AVAIL_GB}GB disk available. Minimum 20GB recommended."
fi

if ! command -v git &>/dev/null && ! command -v curl &>/dev/null && ! command -v wget &>/dev/null; then
	err "One of git, curl, or wget is required."
	PREFLIGHT_PASS=false
fi

check_port() {
	ss -tlnp "sport = :$1" 2>/dev/null | grep -q . || ! nc -z localhost "$1" 2>/dev/null
}
PORT_80=false; PORT_443=false; PORT_3000=false
check_port 80   || PORT_80=true
check_port 443  || PORT_443=true
check_port 3000 || PORT_3000=true

if ! $PREFLIGHT_PASS; then
	err "Pre-flight checks failed. Please fix the issues above and re-run."
	exit 1
fi

ok "All pre-flight checks passed"

# ── Install mode ──
echo ""
echo "Select installation mode:"
echo "  1) Panel + Daemon (recommended)"
echo "  2) Panel only"
echo "  3) Daemon only"
read -rp "Choice [1-3]: " INSTALL_MODE </dev/tty
INSTALL_MODE="${INSTALL_MODE:-1}"

case "$INSTALL_MODE" in
	1) info "Installing Panel + Daemon" ;;
	2) info "Installing Panel only" ;;
	3) info "Installing Daemon only" ;;
	*) err "Invalid choice"; exit 1 ;;
esac

# ── Installation directory ──
DEFAULT_DIR="$HOME/aurora-panel"
read -rp "Installation directory [${DEFAULT_DIR}]: " INSTALL_DIR </dev/tty
INSTALL_DIR="${INSTALL_DIR:-$DEFAULT_DIR}"
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

# ── Clone or download ──
if [[ -d ".git" ]]; then
	ok "Already a git repository, pulling latest..."
	git pull --ff-only 2>/dev/null || warn "Could not git pull (continuing with existing)"
elif command -v git &>/dev/null; then
	info "Cloning repository..."
	git clone --depth=1 --branch "$AURORA_BRANCH" "$AURORA_REPO" . 2>/dev/null || { err "Failed to clone. Check your connection or install manually."; exit 1; }
	ok "Repository cloned"
else
	err "git not available and no existing installation found."
	exit 1
fi

# ── Environment config ──
if [[ ! -f ".env" ]]; then
	info "Generating .env configuration..."
	cp .env.example .env
	AUTH_SECRET=$(openssl rand -hex 32 2>/dev/null || bun -e "console.log(require('crypto').randomBytes(32).toString('hex'))" 2>/dev/null || echo "change-me-$(date +%s)")
	DAEMON_SECRET=$(openssl rand -hex 32 2>/dev/null || bun -e "console.log(require('crypto').randomBytes(32).toString('hex'))" 2>/dev/null || echo "change-me-$(date +%s)")

	if [[ "$OSTYPE" == "darwin"* ]]; then
		sed -i '' "s/AUTH_SECRET=.*/AUTH_SECRET=${AUTH_SECRET}/" .env
		sed -i '' "s/DAEMON_JWT_SECRET=.*/DAEMON_JWT_SECRET=${DAEMON_SECRET}/" .env
	else
		sed -i "s/AUTH_SECRET=.*/AUTH_SECRET=${AUTH_SECRET}/" .env
		sed -i "s/DAEMON_JWT_SECRET=.*/DAEMON_JWT_SECRET=${DAEMON_SECRET}/" .env
	fi
	ok "Secrets generated in .env"
else
	info ".env already exists, skipping"
fi

# ── Port configuration prompts ──
if [[ "$INSTALL_MODE" == "1" || "$INSTALL_MODE" == "2" ]]; then
	if $PORT_3000; then
		warn "Port 3000 is in use. Enter a different panel port:"
		read -rp "Panel port [3001]: " PANEL_PORT </dev/tty
		PANEL_PORT="${PANEL_PORT:-3001}"
		if [[ "$OSTYPE" == "darwin"* ]]; then
			sed -i '' "s/PANEL_PORT=.*/PANEL_PORT=${PANEL_PORT}/" .env
		else
			sed -i "s/PANEL_PORT=.*/PANEL_PORT=${PANEL_PORT}/" .env
		fi
	fi
fi

# ── Docker Compose build and start ──
echo ""
info "Building and starting containers..."
COMPOSE_CMD="docker compose --progress plain"

SERVICES="panel"
[[ "$INSTALL_MODE" == "1" ]] && SERVICES="panel daemon"
[[ "$INSTALL_MODE" == "3" ]] && SERVICES="daemon"

# Build
info "Building images (this may take a few minutes)..."
$COMPOSE_CMD build $SERVICES 2>&1 | tail -5
ok "Build complete"

# Start
info "Starting services..."
$COMPOSE_CMD up -d $SERVICES 2>&1 | tail -5

# Wait for panel to be ready
if [[ "$INSTALL_MODE" == "1" || "$INSTALL_MODE" == "2" ]]; then
	PANEL_PORT_VAL=$(grep -oP 'PANEL_PORT=\K.*' .env 2>/dev/null || echo "3000")
	echo ""
	info "Waiting for panel to be ready..."
	for i in $(seq 1 30); do
		if curl -sf "http://localhost:${PANEL_PORT_VAL}/login" >/dev/null 2>&1; then
			ok "Panel is ready!"
			break
		fi
		sleep 2
	done
fi

# ── Summary ──
echo ""
echo "=========================================="
ok "Aurora Panel v${AURORA_VERSION} installed!"
echo ""

if [[ "$INSTALL_MODE" == "1" || "$INSTALL_MODE" == "2" ]]; then
	PANEL_PORT_VAL=$(grep -oP 'PANEL_PORT=\K.*' .env 2>/dev/null || echo "3000")
	echo "  Panel:   http://localhost:${PANEL_PORT_VAL}"
	echo "  Register: http://localhost:${PANEL_PORT_VAL}/register"
fi
if [[ "$INSTALL_MODE" == "1" || "$INSTALL_MODE" == "3" ]]; then
	DAEMON_PORT_VAL=$(grep -oP 'DAEMON_PORT=\K.*' .env 2>/dev/null || echo "8443")
	echo "  Daemon:  http://localhost:${DAEMON_PORT_VAL}/health"
fi

echo ""
echo "  Directory: ${INSTALL_DIR}"
echo "  View logs: docker compose logs -f"
echo "  Stop:      docker compose down"
echo ""
echo "  After registering, create a node in the panel pointing to:"
echo "  http://aurora-daemon:8443 with the DAEMON_JWT_SECRET from your .env"
echo "=========================================="
