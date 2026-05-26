#!/usr/bin/env bash
# Single-command launch for the local test stack.
# Builds + starts api + web, waits for /api/health, prints access URLs.

set -euo pipefail

# Move to repo root regardless of where the script was invoked from.
cd "$(dirname "$0")/.."

GREEN=$(printf '\033[0;32m')
YELLOW=$(printf '\033[0;33m')
RED=$(printf '\033[0;31m')
RESET=$(printf '\033[0m')

# --- Preflight ---------------------------------------------------------------

if ! command -v docker >/dev/null 2>&1; then
  echo "${RED}✗ Docker is not installed.${RESET} Get it from https://www.docker.com/products/docker-desktop"
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "${RED}✗ Docker daemon is not running.${RESET} Start Docker Desktop and retry."
  exit 1
fi

if [ ! -f .env ]; then
  echo "${YELLOW}⚠  .env not found.${RESET} Copying from .env.example — you MUST edit GEMINI_API_KEY before continuing."
  cp .env.example .env
  echo "   → edit .env, then rerun 'npm run docker:up'"
  exit 1
fi

if ! grep -q '^GEMINI_API_KEY=.\{20,\}' .env; then
  echo "${RED}✗ GEMINI_API_KEY in .env is missing or too short.${RESET}"
  echo "   Get a free key at https://aistudio.google.com/ and paste it into .env"
  exit 1
fi

# --- Build & start -----------------------------------------------------------

echo "${GREEN}🐳 Building UK Energy stack...${RESET}"
docker compose up --build -d

# --- Wait for /api/health to flip healthy ------------------------------------

echo ""
echo "⏳ Waiting for API to be healthy (up to 60s)..."
attempts=0
max_attempts=60
until [ "$attempts" -ge "$max_attempts" ]; do
  if curl -sf http://localhost:3000/api/health >/dev/null 2>&1; then
    echo ""
    echo "${GREEN}✅ Stack is ready!${RESET}"
    echo ""
    echo "   📱 Dashboard:   http://localhost:5173"
    echo "   🔌 API:         http://localhost:3000/api/health"
    echo "   📊 AI metrics:  http://localhost:3000/api/metrics/ai"
    echo ""
    echo "   View logs:      npm run docker:logs"
    echo "   Stop stack:     npm run docker:down"
    echo "   Rebuild:        npm run docker:rebuild"
    echo ""
    exit 0
  fi
  attempts=$((attempts + 1))
  printf '.'
  sleep 1
done

echo ""
echo "${RED}✗ API failed to become healthy within ${max_attempts}s.${RESET}"
echo "   Showing last 30 lines of api logs:"
echo ""
docker compose logs --tail=30 api
exit 1
