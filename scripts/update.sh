#!/usr/bin/env bash
#
# Upgrade the system ALREADY RUNNING on the Production PC (airgapped).
# Run from the unpacked NEW release bundle:  ./scripts/update.sh
#
# Order matters and is deliberate:
#   backup FIRST  -> load images -> migrate DB -> switch app -> verify -> (rollback)
#
# The DB is the only thing here that cannot be recreated from the bundle, so it
# is backed up before anything is touched. Migrations run BEFORE the new app
# starts: the new code assumes the new schema, and a new app on an old schema
# fails in ways that corrupt data, whereas the old app on the new schema keeps
# working (every migration is additive). That asymmetry is what makes rollback
# safe.
set -euo pipefail

cd "$(dirname "$0")/.."
BUNDLE="$(pwd)"

# Overridable so the update path itself can be exercised against a scratch stack
# instead of only ever being run for the first time in production. Defaults are
# the real thing.
COMPOSE_FILE="${VOC_COMPOSE_FILE:-docker-compose.prod.yml}"
DB_CONTAINER="${VOC_DB_CONTAINER:-voc-db}"
COMPOSE_ARGS="-f ${COMPOSE_FILE}"
[ -n "${VOC_PROJECT:-}" ] && COMPOSE_ARGS="${COMPOSE_ARGS} -p ${VOC_PROJECT}"

NEW_VERSION="$(grep -oE '"version": *"[^"]+"' MANIFEST.json | head -1 | grep -oE '[0-9][^"]*')"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
BACKUP_DIR="${BUNDLE}/backups"

echo "=============================================="
echo " N-VOC update -> v${NEW_VERSION}"
echo "=============================================="

command -v docker >/dev/null || { echo "ABORT: docker is not installed."; exit 1; }
[ -f .env ] || { echo "ABORT: no .env here. Copy it from the current install."; exit 1; }

# shellcheck disable=SC1091
set -a; . ./.env; set +a
API_PORT="${API_PORT:-4000}"

CURRENT="$(curl -fsS "http://127.0.0.1:${API_PORT}/api/version" 2>/dev/null \
  | grep -oE '"version":"[^"]+"' | cut -d'"' -f4 || true)"

if [ -z "$CURRENT" ]; then
  echo "ABORT: nothing is running on :${API_PORT}. Use ./scripts/install.sh for a fresh box."
  exit 1
fi

echo "  currently running : v${CURRENT}"
echo "  updating to       : v${NEW_VERSION}"
if [ "$CURRENT" = "$NEW_VERSION" ]; then
  echo
  echo "NOT DEPLOYED: the running system is already v${NEW_VERSION}."
  echo
  echo "  This is almost always a forgotten version bump: package.json still says"
  echo "  ${NEW_VERSION}, so build-release.sh stamped a NEW bundle with an OLD version"
  echo "  and this script cannot tell them apart. Nothing has been installed."
  echo
  echo "  Bump the version, rebuild, and copy the new bundle across."
  # Exit non-zero. This used to `exit 0`, so an operator saw a green run and
  # believed the release had landed when nothing had been deployed at all.
  exit 2
fi

# The bundle crossed to this box on a USB stick — the one place silent corruption
# actually happens. install.sh verifies the checksums; this did not, and then fed
# the unverified 300MB tarball straight into `docker load`.
echo
echo "[0/6] Verifying bundle integrity..."
if [ ! -f SHA256SUMS ]; then
  echo "ABORT: no SHA256SUMS in this bundle. Refusing to install unverified images."
  exit 1
fi
if ! command -v sha256sum >/dev/null; then
  echo "ABORT: sha256sum is not available, so the bundle cannot be verified."
  echo "       On the release path a missing checksum tool is a stop, not a shrug."
  exit 1
fi
if ! sha256sum -c SHA256SUMS --quiet; then
  echo "ABORT: bundle checksum mismatch — the copy is corrupt or tampered with."
  exit 1
fi
echo "  checksums OK"

echo
read -r -p "Proceed? [y/N] " ok
[ "$ok" = "y" ] || { echo "Aborted."; exit 0; }

# ---- 1. Back up the one thing that cannot be rebuilt ------------------------
echo
echo "[1/6] Backing up the database..."
mkdir -p "$BACKUP_DIR"
DUMP="${BACKUP_DIR}/voc-db-${CURRENT}-${STAMP}.sql.gz"
docker exec "$DB_CONTAINER" mysqldump \
  -u root -p"${MYSQL_ROOT_PASSWORD}" \
  --single-transaction --routines --triggers \
  "${DB_NAME:-voc_system}" | gzip > "$DUMP"

# An empty/failed dump must not be mistaken for a good one.
if [ ! -s "$DUMP" ] || [ "$(gunzip -c "$DUMP" | head -c 100 | wc -c)" -lt 10 ]; then
  echo "ABORT: the backup is empty. Refusing to update without a restorable DB."
  rm -f "$DUMP"
  exit 1
fi
echo "  $(du -h "$DUMP" | cut -f1)  ->  ${DUMP}"

echo "${CURRENT}" > "${BACKUP_DIR}/PREVIOUS_VERSION"
echo "${DUMP}"    > "${BACKUP_DIR}/PREVIOUS_DUMP"

# ---- 2. New images, from the bundle ----------------------------------------
echo
echo "[2/6] Loading v${NEW_VERSION} images..."
gunzip -c images/voc-images.tar.gz | docker load

# ---- 3. Schema ------------------------------------------------------------
# Every migration is guarded on information_schema, so re-running an already
# applied one is a no-op. That is what lets this be safely repeatable.
echo
echo "[3/6] Applying migrations..."
for f in $(ls database/migrations/*.sql 2>/dev/null | sort); do
  printf "  %-52s" "$(basename "$f")"
  if docker exec -i "$DB_CONTAINER" mysql -u root -p"${MYSQL_ROOT_PASSWORD}" \
      "${DB_NAME:-voc_system}" < "$f" > /dev/null 2>&1; then
    echo "ok"
  else
    echo "FAILED"
    echo
    echo "Migration failed. The old app (v${CURRENT}) is still running and the"
    echo "DB is unchanged past this point. Restore with:"
    echo "  ./scripts/rollback.sh"
    exit 1
  fi
done

# ---- 4. Swap the app ------------------------------------------------------
echo
echo "[4/6] Switching to v${NEW_VERSION}..."
sed -i "s|^APP_VERSION=.*|APP_VERSION=${NEW_VERSION}|" .env
grep -q '^APP_VERSION=' .env || echo "APP_VERSION=${NEW_VERSION}" >> .env

# `set -a; . ./.env` above exported the OLD APP_VERSION into this shell, and
# docker compose reads the environment in preference to the .env file. Editing
# the file alone therefore does nothing — compose would redeploy the version we
# are trying to leave. Overwrite the exported value too.
export APP_VERSION="${NEW_VERSION}"

docker compose $COMPOSE_ARGS up -d --pull never backend frontend

# ---- 5. Verify -------------------------------------------------------------
echo
echo "[5/6] Verifying..."
RUNNING=""
for i in $(seq 1 45); do
  RUNNING="$(curl -fsS "http://127.0.0.1:${API_PORT}/api/version" 2>/dev/null \
    | grep -oE '"version":"[^"]+"' | cut -d'"' -f4 || true)"
  [ "$RUNNING" = "$NEW_VERSION" ] && break
  sleep 2
done

if [ "$RUNNING" != "$NEW_VERSION" ]; then
  echo
  echo "  FAILED: API reports '${RUNNING:-no response}', expected v${NEW_VERSION}."
  echo "  Rolling back automatically..."
  ./scripts/rollback.sh --auto
  exit 1
fi

HEALTH="$(curl -fsS "http://127.0.0.1:${API_PORT}/api/health" 2>/dev/null || true)"
case "$HEALTH" in
  *'"status":"ok"'*) : ;;
  *)
    echo
    echo "  FAILED: health check is not ok (${HEALTH:-no response}). Rolling back..."
    ./scripts/rollback.sh --auto
    exit 1
    ;;
esac

# ---- 6. Done ---------------------------------------------------------------
echo
echo "[6/6] Cleaning up old images..."
docker image prune -f > /dev/null 2>&1 || true

echo
echo "=============================================="
echo " Updated: v${CURRENT}  ->  v${RUNNING}"
echo " Backup kept at: ${DUMP}"
echo " If something looks wrong: ./scripts/rollback.sh"
echo "=============================================="
