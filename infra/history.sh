#!/bin/bash
# ──────────────────────────────────────────────────
# Darms: Fortresses — История каток
# Читает сводки из match-logs/
# ──────────────────────────────────────────────────
set -euo pipefail

LOGS_DIR="${1:-/opt/darms-fortresses/match-logs}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

if [ ! -d "$LOGS_DIR" ] || [ -z "$(ls -A "$LOGS_DIR"/*.txt 2>/dev/null)" ]; then
  echo -e "${DIM}Каток пока не было. Логи хранятся в: ${LOGS_DIR}${RESET}"
  exit 0
fi

TXT_FILES=($(ls -1t "$LOGS_DIR"/*.txt 2>/dev/null))
TOTAL=${#TXT_FILES[@]}

echo -e "${RED}${BOLD}"
echo "  ╔══════════════════════════════════════════╗"
echo "  ║     ⚔  ИСТОРИЯ КАТОК  ⚔                ║"
echo "  ╚══════════════════════════════════════════╝"
echo -e "${RESET}"
echo -e "  ${DIM}Всего каток: ${TOTAL}${RESET}"
echo ""

# Show match list
for i in "${!TXT_FILES[@]}"; do
  FILE="${TXT_FILES[$i]}"
  BASENAME=$(basename "$FILE" .txt)
  # Try to extract date and room from filename
  echo -e "  ${CYAN}[$((i+1))]${RESET} $BASENAME"
done

echo ""

# If arg -a or --all passed, show all summaries
if [ "${2:-}" = "-a" ] || [ "${2:-}" = "--all" ]; then
  for f in "${TXT_FILES[@]}"; do
    echo ""
    cat "$f"
  done
  exit 0
fi

# Interactive: show last match by default, or pick
if [ "$TOTAL" -eq 1 ]; then
  echo -e "${GREEN}${BOLD}  Последняя катка:${RESET}"
  echo ""
  cat "${TXT_FILES[0]}"
  exit 0
fi

echo -e "  ${DIM}Нажми Enter для последней катки, или введи номер:${RESET}"
read -r CHOICE

if [ -z "$CHOICE" ]; then
  CHOICE=1
fi

IDX=$((CHOICE - 1))
if [ "$IDX" -lt 0 ] || [ "$IDX" -ge "$TOTAL" ]; then
  echo -e "${RED}Некорректный номер${RESET}"
  exit 1
fi

echo ""
cat "${TXT_FILES[$IDX]}"
