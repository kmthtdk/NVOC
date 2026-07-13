#!/usr/bin/env bash
#
# FIRST-TIME install on the Production PC (airgapped). Run from the unpacked
# release bundle:  ./scripts/install.sh
#
# Loads the bundled images, writes a .env if there isn't one, starts the stack,
# and refuses to claim success until the running system reports the version this
# bundle actually shipped.
set -euo pipefail

cd "$(dirname "$0")/.."
BUNDLE="$(pwd)"

VERSION="$(node -p "require('./MANIFEST.json').version" 2>/dev/null \
  || grep -oE '"version"[^,]*' MANIFEST.json | grep -oE '[0-9][^"]*')"

echo "=============================================="
echo " N-VOC install — v${VERSION}"
echo "=============================================="

command -v docker >/dev/null || { echo "ABORT: docker is not installed."; exit 1; }

if docker ps -a --format '{{.Names}}' | grep -qx voc-backend; then
  echo "ABORT: voc-backend already exists. This is the first-time installer."
  echo "       To upgrade an existing system, run ./scripts/update.sh instead."
  exit 1
fi

# ---- 1. Integrity ----------------------------------------------------------
echo
echo "[1/5] Verifying bundle integrity..."
if command -v sha256sum >/dev/null && [ -f SHA256SUMS ]; then
  sha256sum -c SHA256SUMS --quiet && echo "  checksums OK"
else
  echo "  (sha256sum unavailable — skipped)"
fi

# ---- 2. Images from the bundle, never from a registry -----------------------
echo
echo "[2/5] Loading images from the bundle (no registry involved)..."
gunzip -c images/voc-images.tar.gz | docker load

# ---- 3. Configuration ------------------------------------------------------
echo
echo "[3/5] Configuration..."
if [ ! -f .env ]; then
  cp env.example .env
  # Generate the secret here rather than shipping one — a secret baked into a
  # release bundle is a secret every install shares.
  SECRET="$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
  sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${SECRET}|" .env
  echo "APP_VERSION=${VERSION}" >> .env
  echo
  echo "  A .env has been created with a freshly generated JWT_SECRET."
  echo "  YOU MUST SET THESE BEFORE THE STACK IS USABLE:"
  echo "    MYSQL_ROOT_PASSWORD, DB_PASSWORD, ADMIN_EMAIL, ADMIN_PASSWORD"
  echo "  (In production the seeded demo accounts are disabled at boot, so"
  echo "   ADMIN_EMAIL/ADMIN_PASSWORD are the only way in.)"
  echo
  read -r -p "  Edit .env now, then press Enter to continue..." _
else
  echo "  .env already present — leaving it alone."
  grep -q '^APP_VERSION=' .env || echo "APP_VERSION=${VERSION}" >> .env
fi

# ---- 4. Start --------------------------------------------------------------
echo
echo "[4/5] Starting the stack..."
docker compose -f docker-compose.prod.yml up -d

# ---- 5. Prove it actually came up on the right version ----------------------
echo
echo "[5/5] Waiting for the API..."
API_PORT="$(grep -E '^API_PORT=' .env | cut -d= -f2 || true)"
API_PORT="${API_PORT:-4000}"

for i in $(seq 1 60); do
  RUNNING="$(curl -fsS "http://127.0.0.1:${API_PORT}/api/version" 2>/dev/null \
    | grep -oE '"version":"[^"]+"' | cut -d'"' -f4 || true)"
  if [ -n "$RUNNING" ]; then break; fi
  sleep 2
done

if [ "$RUNNING" != "$VERSION" ]; then
  echo
  echo "FAILED: the API is not reporting v${VERSION} (got '${RUNNING:-no response}')."
  echo "        docker compose -f docker-compose.prod.yml logs backend"
  exit 1
fi

echo
echo "=============================================="
echo " Installed. Running v${RUNNING}."
echo " Portal: http://localhost:$(grep -E '^FRONTEND_PORT=' .env | cut -d= -f2 || echo 3000)"
echo "=============================================="
