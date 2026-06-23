#!/usr/bin/env bash
# Tail logs for all services, or a single one:  ./scripts/logs.sh backend
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -n "${1:-}" ]; then docker compose logs -f "$1"; else docker compose logs -f; fi
