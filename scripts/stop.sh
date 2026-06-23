#!/usr/bin/env bash
# Stop the N-VOC stack. Pass --volumes to also delete DB + uploads volumes.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ "${1:-}" = "--volumes" ] || [ "${1:-}" = "-v" ]; then
  echo "Stopping stack and REMOVING volumes (DB data + uploads will be lost)..."
  docker compose down -v
else
  echo "Stopping stack (volumes preserved)..."
  docker compose down
fi
echo "Done."
