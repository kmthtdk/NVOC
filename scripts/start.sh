#!/usr/bin/env bash
# Start the full N-VOC stack (build + detached). Creates .env from template if missing.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "No .env found — creating from .env.example. EDIT IT before production use."
  cp .env.example .env
fi

echo "Building and starting voc-db, voc-backend, voc-frontend..."
docker compose up -d --build

echo
echo "Stack is starting. Frontend: http://localhost:3000   API: http://localhost:4000/health"
echo "Follow logs:  docker compose logs -f"
