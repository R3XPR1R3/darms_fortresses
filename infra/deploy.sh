#!/bin/bash
# Deploy script for Raspberry Pi 4
# Runs on the RPi itself — rebuilds and shows tunnel URL
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$REPO_DIR/.env"
if [ -f "$ENV_FILE" ]; then
  COMPOSE=(docker compose --env-file "$ENV_FILE" -f infra/docker/docker-compose.yml)
else
  COMPOSE=(docker compose -f infra/docker/docker-compose.yml)
fi

echo "=== Deploying Darms: Fortresses ==="
echo "Repo: $REPO_DIR"

cd "$REPO_DIR"

# Ensure match-logs directory exists on host
mkdir -p /opt/darms-fortresses/match-logs

# Rebuild and restart
echo "--- Rebuilding Docker containers ---"
"${COMPOSE[@]}" build
"${COMPOSE[@]}" up -d

# Cleanup old images
echo "--- Cleaning up old images ---"
docker image prune -f

# Show tunnel URL
echo "--- Cloudflare Tunnel ---"
echo "Waiting for tunnel to start..."
sleep 5
"${COMPOSE[@]}" logs tunnel 2>&1 | grep -oP 'https://[^\s]+' | tail -1 || echo "URL not ready yet. Check: ${COMPOSE[*]} logs tunnel"

echo ""
echo "=== Deploy complete ==="
echo "Для красивого терминала: bash infra/start.sh"
echo "История каток: bash infra/history.sh"
