#!/bin/bash
# ──────────────────────────────────────────────────
# Darms: Fortresses — Запуск сервера
# Показывает публичную ссылку и live-логи
# ──────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE="docker compose -f $REPO_DIR/infra/docker/docker-compose.yml"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

clear

echo -e "${RED}${BOLD}"
echo "  ╔══════════════════════════════════════════╗"
echo "  ║       ⚔  DARMS: FORTRESSES  ⚔          ║"
echo "  ╚══════════════════════════════════════════╝"
echo -e "${RESET}"

# ── Build & Start ─────────────────────────────────
echo -e "${CYAN}[1/3]${RESET} Сборка контейнеров..."
$COMPOSE build --quiet 2>&1 | tail -3

echo -e "${CYAN}[2/3]${RESET} Запуск сервисов..."
$COMPOSE up -d 2>&1 | tail -3
docker image prune -f --quiet >/dev/null 2>&1 &

# ── Wait for tunnel URL ──────────────────────────
echo -e "${CYAN}[3/3]${RESET} Ожидание Cloudflare Tunnel..."

URL=""
for i in $(seq 1 20); do
  URL=$($COMPOSE logs tunnel 2>&1 | grep -oP 'https://[a-z0-9\-]+\.trycloudflare\.com' | tail -1 || true)
  if [ -n "$URL" ]; then
    break
  fi
  sleep 1
done

echo ""
echo -e "${GREEN}${BOLD}  ╔══════════════════════════════════════════════════╗${RESET}"
if [ -n "$URL" ]; then
  echo -e "${GREEN}${BOLD}  ║  🌐 ИГРА ДОСТУПНА ПО ССЫЛКЕ:                    ║${RESET}"
  echo -e "${GREEN}${BOLD}  ╠══════════════════════════════════════════════════╣${RESET}"
  echo -e "${GREEN}${BOLD}  ║${RESET}"
  echo -e "${GREEN}${BOLD}  ║  ${YELLOW}${BOLD}${URL}${RESET}"
  echo -e "${GREEN}${BOLD}  ║${RESET}"
else
  echo -e "${RED}${BOLD}  ║  ⚠  URL ещё не готов, проверь логи:             ║${RESET}"
  echo -e "${RED}${BOLD}  ║  docker compose logs tunnel                     ║${RESET}"
fi
echo -e "${GREEN}${BOLD}  ╠══════════════════════════════════════════════════╣${RESET}"
echo -e "${GREEN}${BOLD}  ║${RESET}  ${DIM}Логи каток: /opt/darms-fortresses/match-logs/${RESET}"
echo -e "${GREEN}${BOLD}  ║${RESET}  ${DIM}История:    bash infra/history.sh${RESET}"
echo -e "${GREEN}${BOLD}  ║${RESET}  ${DIM}Стоп:       bash infra/stop.sh${RESET}"
echo -e "${GREEN}${BOLD}  ╚══════════════════════════════════════════════════╝${RESET}"
echo ""

# ── Live logs ─────────────────────────────────────
echo -e "${DIM}── Live логи (Ctrl+C для выхода) ──${RESET}"
echo ""
$COMPOSE logs -f --tail=50 app 2>&1 | while IFS= read -r line; do
  # Highlight match-log lines
  if echo "$line" | grep -q "\[match-log\]"; then
    echo -e "${GREEN}${line}${RESET}"
  elif echo "$line" | grep -q "\[darms-server\]"; then
    echo -e "${CYAN}${line}${RESET}"
  else
    echo "$line"
  fi
done
