#!/bin/bash
# Deploy script for Raspberry Pi 4
# Runs on the RPi itself — pulls latest main and rebuilds
set -euo pipefail

REPO_DIR="${REPO_DIR:-/opt/darms-fortresses}"
BRANCH="main"

echo "=== Deploying Darms: Fortresses ==="
echo "Repo: $REPO_DIR"
echo "Branch: $BRANCH"

cd "$REPO_DIR"

# Pull latest changes
echo "--- Pulling latest changes ---"
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

# Rebuild and restart
echo "--- Rebuilding Docker containers ---"
docker compose -f infra/docker/docker-compose.yml build --no-cache
docker compose -f infra/docker/docker-compose.yml up -d

# Cleanup old images
echo "--- Cleaning up old images ---"
docker image prune -f

echo "=== Deploy complete ==="
