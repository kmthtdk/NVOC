#!/usr/bin/env bash
#
# Roll the Production PC back to the version it was on before the last update.
#
#   ./scripts/rollback.sh          # asks first
#   ./scripts/rollback.sh --auto   # called by update.sh when a rollout fails
#
# Restores the pre-update database dump and restarts the previous image. Both
# come from backups/, written by update.sh before it changed anything.
set -euo pipefail

cd "$(dirname "$0")/.."
BACKUP_DIR="$(pwd)/backups"
AUTO="${1:-}"

# Same overrides as update.sh, so the rollback path can be rehearsed rather than
# first executed in anger on the Production PC.
COMPOSE_FILE="${VOC_COMPOSE_FILE:-docker-compose.prod.yml}"
DB_CONTAINER="${VOC_DB_CONTAINER:-voc-db}"
COMPOSE_ARGS="-f ${COMPOSE_FILE}"
[ -n "${VOC_PROJECT:-}" ] && COMPOSE_ARGS="${COMPOSE_ARGS} -p ${VOC_PROJECT}"

[ -f .env ] || { echo "ABORT: no .env here."; exit 1; }
# shellcheck disable=SC1091
set -a; . ./.env; set +a
API_PORT="${API_PORT:-4000}"

PREV="$(cat "${BACKUP_DIR}/PREVIOUS_VERSION" 2>/dev/null || true)"
DUMP="$(cat "${BACKUP_DIR}/PREVIOUS_DUMP" 2>/dev/null || true)"

if [ -z "$PREV" ] || [ ! -s "$DUMP" ]; then
  echo "ABORT: no rollback point. backups/PREVIOUS_VERSION or the dump is missing."
  echo "       (Nothing to roll back to — this box has never been updated.)"
  exit 1
fi

echo "=============================================="
echo " N-VOC rollback -> v${PREV}"
echo "   dump: ${DUMP}"
echo "=============================================="

# The previous image has to still be on the box. If someone pruned it, say so
# plainly rather than letting compose try (and fail) to build it.
if ! docker image inspect "voc-backend:${PREV}" > /dev/null 2>&1; then
  echo "ABORT: image voc-backend:${PREV} is not on this machine."
  echo "       Load it from the v${PREV} release bundle first:"
  echo "         gunzip -c images/voc-images.tar.gz | docker load"
  exit 1
fi

if [ "$AUTO" != "--auto" ]; then
  echo
  echo "This RESTORES THE DATABASE to its pre-update state."
  echo "Anything entered since the update will be lost."
  read -r -p "Proceed? [y/N] " ok
  [ "$ok" = "y" ] || { echo "Aborted."; exit 0; }
fi

echo
echo "[1/4] Stopping the app (the DB stays up — we are about to restore into it)..."
docker compose $COMPOSE_ARGS stop backend frontend

echo
echo "[2/4] Restoring the database..."
gunzip -c "$DUMP" | docker exec -i "$DB_CONTAINER" mysql -u root -p"${MYSQL_ROOT_PASSWORD}" "${DB_NAME:-voc_system}"

echo
echo "[3/4] Starting v${PREV}..."
sed -i "s|^APP_VERSION=.*|APP_VERSION=${PREV}|" .env
# Same trap as update.sh: the .env we sourced exported APP_VERSION, and compose
# prefers the environment over the file. Without this, rollback would redeploy
# the very version it is rolling back from.
export APP_VERSION="${PREV}"
docker compose $COMPOSE_ARGS up -d --pull never backend frontend

echo
echo "[4/4] Verifying..."
RUNNING=""
for i in $(seq 1 45); do
  RUNNING="$(curl -fsS "http://127.0.0.1:${API_PORT}/api/version" 2>/dev/null \
    | grep -oE '"version":"[^"]+"' | cut -d'"' -f4 || true)"
  [ "$RUNNING" = "$PREV" ] && break
  sleep 2
done

if [ "$RUNNING" != "$PREV" ]; then
  echo
  echo "ROLLBACK FAILED: API reports '${RUNNING:-no response}', expected v${PREV}."
  echo "This needs a human. Logs:"
  echo "  docker compose $COMPOSE_ARGS logs backend"
  exit 1
fi

echo
echo "=============================================="
echo " Rolled back. Running v${RUNNING}."
echo "=============================================="
