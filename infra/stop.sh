#!/bin/bash
# Остановка Darms: Fortresses
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "⏹  Остановка Darms: Fortresses..."
docker compose -f "$REPO_DIR/infra/docker/docker-compose.yml" down
echo "✓  Остановлено."
