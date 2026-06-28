#!/usr/bin/env bash
set -euo pipefail

AURORA_VERSION="0.1.0"
AURORA_REPO="https://github.com/coffeeisle/aurora-panel"
AURORA_BRANCH="master"
INSTALL_DIR=""
COMPOSE_FILE=""

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
info()  { echo -e "${BLUE}[INFO]${NC}  $1"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
err()   { echo -e "${RED}[ERR]${NC}   $1"; }
header(){ echo -e "\n${BOLD}${CYAN}══ $1 ══${NC}\n"; }

cleanup() { true; }
trap cleanup EXIT

find_install_dir() {
	local dirs=("$HOME/aurora-panel" "$PWD" "/opt/aurora-panel")
	for d in "${dirs[@]}"; do
		if [[ -f "$d/docker-compose.yml" && -f "$d/.env" ]]; then
			INSTALL_DIR="$d"
			COMPOSE_FILE="$d/docker-compose.yml"
			return 0
		fi
	done
	for d in "${dirs[@]}"; do
		if [[ -f "$d/docker-compose.yml" ]]; then
			INSTALL_DIR="$d"
			COMPOSE_FILE="$d/docker-compose.yml"
			return 0
		fi
	done
	err "Could not find Aurora installation."
	err "Make sure you're in the aurora-panel directory or ~/aurora-panel"
	exit 1
}

require_install_dir() {
	if [[ -z "$INSTALL_DIR" ]]; then
		find_install_dir
	fi
	if [[ ! -f "$INSTALL_DIR/docker-compose.yml" ]]; then
		err "docker-compose.yml not found in $INSTALL_DIR"
		exit 1
	fi
}

get_compose_services() {
	require_install_dir
	grep -E '^\s{2}[a-zA-Z]' "$COMPOSE_FILE" | sed 's/://' | awk '{print $1}' | grep -v '^$' || true
}

has_service() {
	local svc="$1"
	get_compose_services | grep -qx "$svc"
}

get_env() {
	local key="$1" default="$2"
	grep -oP "${key}=\K.*" "$INSTALL_DIR/.env" 2>/dev/null || echo "$default"
}

# ── Command: help ──
cmd_help() {
	cat <<'HELP'
Usage: aurora <command> [options]

Core Commands:
  status              Show status of panel, daemon, and all running servers
  start               Start panel + daemon (and any previously running servers)
  stop                Stop panel + daemon gracefully
  restart             Restart everything

Targeted Commands:
  restart-panel       Restart only the panel service
  restart-daemon       Restart only the daemon service
  restart-all         Restart both services

Maintenance:
  update              Pull latest code and rebuild images
  backup              Create a full backup (config, database, servers)
  restore <backup>    Restore from a backup archive
  logs [service]      Show logs (panel, daemon, or a server container ID)

Danger Zone:
  uninstall           Remove Aurora completely (with confirmation)

Misc:
  help                Show this help text
HELP
}

# ── Command: status ──
cmd_status() {
	header "Aurora Status"
	require_install_dir

	local panel_port daemon_port
	panel_port=$(get_env PANEL_PORT "3000")
	daemon_port=$(get_env DAEMON_PORT "8443")

	echo -e "  ${BOLD}Install Directory:${NC} $INSTALL_DIR"
	echo -e "  ${BOLD}Version:${NC}          $AURORA_VERSION"
	echo ""

	# Check Docker
	if command -v docker &>/dev/null; then
		local containers
		containers=$(docker ps --filter "name=aurora-" --format "{{.Names}}" 2>/dev/null || true)

		local panel_running=false daemon_running=false
		echo -e "  ${BOLD}Services:${NC}"
		if echo "$containers" | grep -q "aurora-panel"; then
			panel_running=true
			echo -e "    ${GREEN}●${NC} Panel  (aurora-panel)  http://localhost:${panel_port}"
		else
			echo -e "    ${RED}○${NC} Panel  (aurora-panel)"
		fi
		if echo "$containers" | grep -q "aurora-daemon"; then
			daemon_running=true
			echo -e "    ${GREEN}●${NC} Daemon (aurora-daemon) http://localhost:${daemon_port}/health"
		else
			echo -e "    ${RED}○${NC} Daemon (aurora-daemon)"
		fi
		echo ""

		# Check daemon health
		if $daemon_running; then
			echo -e "  ${BOLD}Daemon Health:${NC}"
			local health
			health=$(curl -sf "http://localhost:${daemon_port}/health" 2>/dev/null || echo "unreachable")
			echo -e "    ${GREEN}✓${NC} $health"
			echo ""
		fi

		# Check panel health
		if $panel_running; then
			echo -e "  ${BOLD}Panel Health:${NC}"
			if curl -sf "http://localhost:${panel_port}/login" >/dev/null 2>&1; then
				echo -e "    ${GREEN}✓${NC} Responding"
			else
				echo -e "    ${YELLOW}⚠${NC} Not responding yet (may still be starting)"
			fi
			echo ""
		fi

		# Show game servers
		echo -e "  ${BOLD}Game Servers:${NC}"
		local server_containers
		server_containers=$(docker ps --filter "label=aurora-server" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || true)
		if [[ -n "$server_containers" ]]; then
			echo "$server_containers"
		else
			echo "    No servers running"
		fi

		echo ""
		# Docker disk usage
		echo -e "  ${BOLD}Disk Usage:${NC}"
		docker system df --format "table {{.Type}}\t{{.TotalCount}}\t{{.Size}}\t{{.Reclaimable}}" 2>/dev/null | head -4 | sed 's/^/  /'

	else
		warn "Docker not found"
	fi
}

# ── Command: start ──
cmd_start() {
	header "Starting Aurora"
	require_install_dir
	cd "$INSTALL_DIR"

	local services=()
	has_service "panel" && services+=("panel")
	has_service "daemon" && services+=("daemon")

	docker compose up -d "${services[@]}"
	ok "Services started"
}

# ── Command: stop ──
cmd_stop() {
	header "Stopping Aurora"
	require_install_dir
	cd "$INSTALL_DIR"

	warn "Stopping services..."
	docker compose down --timeout 30
	ok "Services stopped"
}

# ── Command: restart ──
cmd_restart() {
	cmd_stop
	sleep 2
	cmd_start
}

# ── Command: restart-panel ──
cmd_restart_panel() {
	header "Restarting Panel"
	require_install_dir
	cd "$INSTALL_DIR"
	docker compose restart panel
	ok "Panel restarted"
}

# ── Command: restart-daemon ──
cmd_restart_daemon() {
	header "Restarting Daemon"
	require_install_dir
	cd "$INSTALL_DIR"
	docker compose restart daemon
	ok "Daemon restarted"
}

# ── Command: restart-all ──
cmd_restart_all() {
	header "Restarting All Services"
	require_install_dir
	cd "$INSTALL_DIR"
	docker compose restart
	ok "All services restarted"
}

# ── Command: update ──
cmd_update() {
	header "Updating Aurora"
	require_install_dir
	cd "$INSTALL_DIR"

	if [[ ! -d ".git" ]]; then
		err "Not a git repository. Cannot auto-update."
		err "Clone the repo manually: git clone $AURORA_REPO ."
		exit 1
	fi

	# Check for uncommitted changes
	if ! git diff --quiet; then
		warn "You have uncommitted changes. Stashing them..."
		git stash --include-untracked
	fi

	info "Pulling latest code from $AURORA_REPO..."
	git pull --ff-only origin "$AURORA_BRANCH" 2>/dev/null || git pull --ff-only 2>/dev/null || {
		err "Failed to pull latest code. Check your network or resolve conflicts manually."
		exit 1
	}
	ok "Code updated to latest commit: $(git log -1 --oneline)"

	# Rebuild images
	local services=()
	has_service "panel" && services+=("panel")
	has_service "daemon" && services+=("daemon")

	info "Rebuilding images..."
	docker compose build --pull "${services[@]}"
	ok "Images rebuilt"

	# Restart
	info "Restarting services..."
	docker compose up -d --force-recreate "${services[@]}"
	ok "Update complete!"
}

# ── Command: backup ──
cmd_backup() {
	header "Creating Backup"
	require_install_dir
	cd "$INSTALL_DIR"

	local backup_name="aurora-backup-$(date +%Y%m%d-%H%M%S).tar.gz"
	local backup_dir="/tmp/aurora-backup-$$"
	mkdir -p "$backup_dir"

	info "Creating backup..."

	# Backup .env and config
	cp .env "$backup_dir/" 2>/dev/null || true
	cp docker-compose.yml "$backup_dir/" 2>/dev/null || true

	# Backup database from running panel container
	if docker ps --format "{{.Names}}" | grep -q "aurora-panel"; then
		info "Exporting database from panel container..."
		docker exec aurora-panel sh -c "cat /app/data/aurora.db" 2>/dev/null > "$backup_dir/aurora.db" || {
			warn "Could not export database from running container"
		}
	fi

	# Backup server data volume reference
	if docker volume ls --format "{{.Name}}" | grep -q "aurora-panel_server-data"; then
		info "Backing up server data..."
		docker run --rm -v aurora-panel_server-data:/data:ro -v "$backup_dir:/backup" \
			alpine:latest tar czf "/backup/servers.tar.gz" -C /data . 2>/dev/null || warn "Could not backup server data"
	fi

	# Package everything
	tar czf "/tmp/$backup_name" -C "$backup_dir" .
	rm -rf "$backup_dir"
	mv "/tmp/$backup_name" "./$backup_name"

	local size
	size=$(du -h "$backup_name" | cut -f1)
	ok "Backup created: $backup_name ($size)"
	info "To restore: aurora restore $backup_name"
}

# ── Command: restore ──
cmd_restore() {
	header "Restoring Backup"
	require_install_dir
	cd "$INSTALL_DIR"

	local backup_file="${1:-}"
	if [[ -z "$backup_file" ]]; then
		err "Usage: aurora restore <backup-file>"
		exit 1
	fi
	if [[ ! -f "$backup_file" ]]; then
		err "Backup file not found: $backup_file"
		exit 1
	fi

	warn "This will STOP all running services and restore from backup."
	read -rp "Continue? [y/N]: " confirm
	if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
		info "Restore cancelled"
		exit 0
	fi

	local restore_dir="/tmp/aurora-restore-$$"
	mkdir -p "$restore_dir"

	info "Extracting backup..."
	tar xzf "$backup_file" -C "$restore_dir"

	# Stop services
	info "Stopping services..."
	docker compose down --timeout 30 2>/dev/null || true

	# Restore .env
	if [[ -f "$restore_dir/.env" ]]; then
		cp "$restore_dir/.env" .env
		ok "Restored .env"
	fi

	# Restore database
	if [[ -f "$restore_dir/aurora.db" ]]; then
		info "Starting panel temporarily to restore database..."
		docker compose up -d panel 2>/dev/null || true
		sleep 3
		docker cp "$restore_dir/aurora.db" aurora-panel:/app/data/aurora.db 2>/dev/null || {
			warn "Could not restore database, copying to host directory instead"
			mkdir -p data
			cp "$restore_dir/aurora.db" data/aurora.db
		}
		docker compose down --timeout 15 2>/dev/null || true
		ok "Database restored"
	fi

	# Restore server data
	if [[ -f "$restore_dir/servers.tar.gz" ]]; then
		info "Restoring server data..."
		if docker volume ls --format "{{.Name}}" | grep -q "aurora-panel_server-data"; then
			docker run --rm -v aurora-panel_server-data:/data -v "$restore_dir:/restore" \
				alpine:latest tar xzf "/restore/servers.tar.gz" -C /data 2>/dev/null || warn "Could not restore server data"
		else
			warn "Server data volume not found. Create it first or restore manually."
		fi
		ok "Server data restored"
	fi

	rm -rf "$restore_dir"

	# Restart
	info "Starting services..."
	docker compose up -d
	ok "Restore complete!"
}

# ── Command: logs ──
cmd_logs() {
	local target="all"
	local follow_flag=""

	for arg in "$@"; do
		case "$arg" in
			-f|--follow) follow_flag="--follow" ;;
			-*)
				err "Unknown flag: $arg"
				exit 1
				;;
			*) target="$arg" ;;
		esac
	done

	require_install_dir
	cd "$INSTALL_DIR"

	case "$target" in
		panel|daemon)
			header "${target^} Logs"
			docker compose logs $follow_flag "$target"
			;;
		all)
			header "All Logs"
			docker compose logs $follow_flag --tail=50
			;;
		*)
			header "Server Logs: $target"
			docker logs $follow_flag "$target" 2>/dev/null || {
				err "Unknown log target: $target"
				err "Usage: aurora logs [panel|daemon|<container-id>] [--follow|-f]"
				exit 1
			}
			;;
	esac
}

# ── Command: uninstall ──
cmd_uninstall() {
	header "Aurora Uninstall"
	require_install_dir
	cd "$INSTALL_DIR"

	warn "${RED}${BOLD}DANGER ZONE${NC}"
	echo ""
	echo "This will:"
	echo "  - Stop all running containers"
	echo "  - Remove Aurora Docker images"
	echo "  - Remove Aurora volumes (databases, server files, config)"
	echo "  - Delete the installation directory"
	echo ""
	echo "Game servers managed by Aurora will be ${RED}permanently deleted${NC}."
	read -rp "Type 'yes' to confirm: " confirm1
	read -rp "Type 'I am sure' to proceed: " confirm2

	if [[ "$confirm1" != "yes" ]] || [[ "$confirm2" != "I am sure" ]]; then
		err "Confirmation failed. Uninstall cancelled."
		exit 1
	fi

	info "Stopping all services..."
	docker compose down --timeout 30 --volumes 2>/dev/null || true

	info "Removing Aurora images..."
	docker rmi aurora-panel:latest 2>/dev/null || true
	docker rmi aurora-daemon:latest 2>/dev/null || true

	# Remove the aurora CLI if it was installed
	if [[ -f /usr/local/bin/aurora ]]; then
		info "Removing /usr/local/bin/aurora..."
		rm -f /usr/local/bin/aurora
	fi

	info "Removing installation directory..."
	rm -rf "$INSTALL_DIR"

	ok "Aurora has been uninstalled."
	warn "Docker volumes may still exist. To remove them manually:"
	echo "  docker volume ls | grep aurora"
	echo "  docker volume rm <volume-name>"
}

# ── Self-install ──
cmd_install_cli() {
	if [[ $EUID -ne 0 ]]; then
		err "System-wide install requires root. Run: sudo aurora install"
		exit 1
	fi

	local script_path
	script_path="$(realpath "${BASH_SOURCE[0]}")"
	if [[ -f /usr/local/bin/aurora ]]; then
		rm -f /usr/local/bin/aurora
	fi
	cp "$script_path" /usr/local/bin/aurora
	chmod +x /usr/local/bin/aurora
	ok "aurora CLI installed to /usr/local/bin/aurora"
	info "Run 'aurora help' from anywhere to get started"
}

# ── Main ──
main() {
	find_install_dir 2>/dev/null || true

	local cmd="${1:-help}"
	shift 2>/dev/null || true

	case "$cmd" in
		help|--help|-h)
			cmd_help
			;;
		status)
			cmd_status
			;;
		start)
			cmd_start
			;;
		stop)
			cmd_stop
			;;
		restart)
			cmd_restart
			;;
		restart-panel)
			cmd_restart_panel
			;;
		restart-daemon)
			cmd_restart_daemon
			;;
		restart-all)
			cmd_restart_all
			;;
		update)
			cmd_update
			;;
		backup)
			cmd_backup
			;;
		restore)
			cmd_restore "$@"
			;;
		logs)
			cmd_logs "$@"
			;;
		uninstall)
			cmd_uninstall
			;;
		install)
			cmd_install_cli
			;;
		*)
			err "Unknown command: $cmd"
			echo "Run 'aurora help' for available commands"
			exit 1
			;;
	esac
}

main "$@"
