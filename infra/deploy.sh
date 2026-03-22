#!/bin/bash
# Deploy script for Raspberry Pi 4
# Runs on the RPi itself — rebuilds and shows tunnel URL
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=== Deploying Darms: Fortresses ==="
echo "Repo: $REPO_DIR"

cd "$REPO_DIR"

# Rebuild and restart
echo "--- Rebuilding Docker containers ---"
docker compose -f infra/docker/docker-compose.yml build
docker compose -f infra/docker/docker-compose.yml up -d

# Cleanup old images
echo "--- Cleaning up old images ---"
docker image prune -f

# Show tunnel URL
echo "--- Cloudflare Tunnel ---"
echo "Waiting for tunnel to start..."
sleep 5
docker compose -f infra/docker/docker-compose.yml logs tunnel 2>&1 | grep -oP 'https://[^\s]+' | tail -1 || echo "URL not ready yet. Check: docker compose -f infra/docker/docker-compose.yml logs tunnel"

echo "=== Deploy complete ==="
