#!/usr/bin/env bash
#
# Rehearse the offline upgrade — on a scratch stack, on the Dev PC.
#
#   ./scripts/rehearse-upgrade.sh
#
# The Production PC is airgapped. A failed update there is expensive and there is
# nobody to phone. update.sh and rollback.sh were careful scripts that had never
# been executed by anything except a human, once. This exercises them for real:
#
#   install vN  ->  write a row  ->  update to vN+1  ->  the row survived
#               ->  force a BROKEN vN+2  ->  it must auto-roll-back to vN+1
#
# The failure-injection half is the point. A rehearsal that only walks the happy
# path proves nothing about the day it goes wrong.
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

PROJECT="voc_rehearsal"
DB_CONTAINER="r-voc-db"
API_PORT=4077
FE_PORT=3077
DB_PORT=33078
WORK="$(mktemp -d)"

V1="9.9.1"
V2="9.9.2"
V3_BROKEN="9.9.3"

purgeStack() {
  # Tear the scratch stack down by NAME, not via a compose file — a run that died
  # before the compose file was written would otherwise leave its DB volume behind,
  # and the next rehearsal would start on somebody else's data. (It did: the canary
  # INSERT came back "Duplicate entry".) A rehearsal has to begin from nothing, or
  # it is not rehearsing an install.
  docker rm -f "$DB_CONTAINER" r-voc-backend r-voc-frontend > /dev/null 2>&1 || true
  docker volume rm -f "${PROJECT}_voc-db-data" "${PROJECT}_voc-uploads" > /dev/null 2>&1 || true
  docker network rm "${PROJECT}_voc-net" > /dev/null 2>&1 || true
}

cleanup() {
  purgeStack
  docker rmi -f "voc-backend:${V1}" "voc-frontend:${V1}" \
                "voc-backend:${V2}" "voc-frontend:${V2}" \
                "voc-backend:${V3_BROKEN}" "voc-frontend:${V3_BROKEN}" > /dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

# Start from nothing, whatever the last run left behind.
purgeStack

say() { printf '\n\033[1m>> %s\033[0m\n' "$1"; }
die() { printf '\n\033[31mREHEARSAL FAILED: %s\033[0m\n' "$1"; exit 1; }

runningVersion() {
  curl -fsS "http://127.0.0.1:${API_PORT}/api/version" 2>/dev/null \
    | grep -oE '"version":"[^"]+"' | cut -d'"' -f4 || true
}

# ---------------------------------------------------------------------------
say "Building rehearsal bundles ${V1} and ${V2}"
./scripts/build-release.sh "$V1" > /dev/null
./scripts/build-release.sh "$V2" > /dev/null

# ---------------------------------------------------------------------------
say "Installing v${V1} on a scratch stack"
mkdir -p "${WORK}/v1" && tar -xzf "release/voc-${V1}.tar.gz" -C "${WORK}/v1"

sed -e "s/container_name: voc-db/container_name: ${DB_CONTAINER}/" \
    -e "s/container_name: voc-backend/container_name: r-voc-backend/" \
    -e "s/container_name: voc-frontend/container_name: r-voc-frontend/" \
    "${WORK}/v1/docker-compose.prod.yml" > "${WORK}/docker-compose.rehearsal.yml"
cp "${WORK}/docker-compose.rehearsal.yml" "${WORK}/v1/"

cat > "${WORK}/v1/.env" <<ENV
APP_VERSION=${V1}
MYSQL_ROOT_PASSWORD=rehearsalRoot1!
DB_NAME=voc_system
DB_USER=voc_app
DB_PASSWORD=rehearsalApp1!
DB_PORT=${DB_PORT}
API_PORT=${API_PORT}
FRONTEND_PORT=${FE_PORT}
CORS_ORIGIN=http://localhost:${FE_PORT}
JWT_SECRET=$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')
ADMIN_EMAIL=admin@rehearsal.local
ADMIN_PASSWORD=RehearsalAdmin1!
ENV

gunzip -c "${WORK}/v1/images/voc-images.tar.gz" | docker load > /dev/null
(cd "${WORK}/v1" && docker compose -f docker-compose.rehearsal.yml -p "$PROJECT" up -d > /dev/null)

for _ in $(seq 1 60); do [ -n "$(runningVersion)" ] && break; sleep 2; done
[ "$(runningVersion)" = "$V1" ] || die "v${V1} did not come up (got '$(runningVersion)')"
printf '   running v%s\n' "$V1"

# ---------------------------------------------------------------------------
say "Writing a row that must survive the upgrade"

# NOTE: do NOT send stderr to /dev/null here. It was, and when the INSERT failed
# the script died under `set -e` with no message at all — a silent failure inside
# the very tool built to catch silent failures.
# Careful with the exit status here. The obvious form —
#     docker exec ... mysql ... 2>&1 | grep -v '[Warning] Using a password'
# — is a trap: when the only output IS that warning, grep filters everything,
# finds no match, and exits 1. Under `set -o pipefail` a perfectly successful
# INSERT then reports failure. (It did, and cost a run to find.) Capture first,
# judge the status, filter only for display.
mysqlR() {
  local out status
  out="$(docker exec -i "$DB_CONTAINER" mysql -uroot -p'rehearsalRoot1!' voc_system "$@" 2>&1)"
  status=$?
  printf '%s\n' "$out" | grep -v '\[Warning\] Using a password' || true
  return $status
}

mysqlR -e "INSERT INTO devices (code, device_type, model, serial_number, status)
           VALUES ('REHEARSE-1','laptop','Canary','SN-REHEARSE-1','In Stock');" \
  || die "could not write the canary row"

canary() { mysqlR -N -e "SELECT COUNT(*) FROM devices WHERE code='REHEARSE-1';" | tr -d '[:space:]'; }

[ "$(canary)" = "1" ] || die "the canary row was not written (got '$(canary)')"

# ---------------------------------------------------------------------------
say "Updating v${V1} -> v${V2}"
mkdir -p "${WORK}/v2" && tar -xzf "release/voc-${V2}.tar.gz" -C "${WORK}/v2"
cp "${WORK}/v1/.env" "${WORK}/v2/.env"
cp "${WORK}/docker-compose.rehearsal.yml" "${WORK}/v2/"

( cd "${WORK}/v2" && env ASSUME_YES=1 \
    VOC_COMPOSE_FILE=docker-compose.rehearsal.yml \
    VOC_DB_CONTAINER="$DB_CONTAINER" \
    VOC_PROJECT="$PROJECT" \
    ./scripts/update.sh > "${WORK}/update.log" 2>&1 ) \
  || { tail -20 "${WORK}/update.log"; die "update.sh failed"; }

[ "$(runningVersion)" = "$V2" ] || die "expected v${V2}, got '$(runningVersion)'"
[ "$(canary)" = "1" ] || die "the upgrade LOST DATA — the canary row is gone"
printf '   running v%s, canary row intact\n' "$V2"

# ---------------------------------------------------------------------------
say "Forcing a BROKEN v${V3_BROKEN} — update.sh must detect it and roll back by itself"

# A backend image that starts and immediately dies — exactly how a bad release
# behaves in the wild. The frontend image is fine; only the backend is poisoned,
# so update.sh has to notice via /api/version and /api/health, not via compose.
docker build -q -t "voc-backend:${V3_BROKEN}" -f - . > /dev/null <<'DOCKERFILE'
FROM node:20-alpine
CMD ["node", "-e", "console.error('simulated bad release'); process.exit(1)"]
DOCKERFILE
docker tag "voc-frontend:${V2}" "voc-frontend:${V3_BROKEN}"

# Reuse the v2 bundle, relabelled as v3 — same scripts, broken payload.
mkdir -p "${WORK}/v3" && tar -xzf "release/voc-${V2}.tar.gz" -C "${WORK}/v3"
cp "${WORK}/v1/.env" "${WORK}/v3/.env"
sed -i "s/^APP_VERSION=.*/APP_VERSION=${V2}/" "${WORK}/v3/.env"
cp "${WORK}/docker-compose.rehearsal.yml" "${WORK}/v3/"
sed -i "s/\"version\": *\"${V2}\"/\"version\": \"${V3_BROKEN}\"/" "${WORK}/v3/MANIFEST.json"
# The bundle's own checksums no longer describe it, and update.sh is right to
# care — regenerate them so we are testing the ROLLBACK, not the checksum guard
# (that one is covered separately).
( cd "${WORK}/v3" && find . -type f ! -name SHA256SUMS -exec sha256sum {} + > SHA256SUMS )

set +e
( cd "${WORK}/v3" && env ASSUME_YES=1 \
    VOC_COMPOSE_FILE=docker-compose.rehearsal.yml \
    VOC_DB_CONTAINER="$DB_CONTAINER" \
    VOC_PROJECT="$PROJECT" \
    ./scripts/update.sh > "${WORK}/broken.log" 2>&1 )
BROKEN_EXIT=$?
set -e

[ "$BROKEN_EXIT" -ne 0 ] || die "update.sh reported SUCCESS on a broken release"
grep -q "Rolling back" "${WORK}/broken.log" || { tail -20 "${WORK}/broken.log"; die "update.sh did not roll back"; }

for _ in $(seq 1 45); do [ "$(runningVersion)" = "$V2" ] && break; sleep 2; done
[ "$(runningVersion)" = "$V2" ] || die "after rollback expected v${V2}, got '$(runningVersion)'"
[ "$(canary)" = "1" ] || die "rollback LOST DATA — the canary row is gone"

printf '   broken release refused, rolled back to v%s, canary row intact\n' "$V2"

# ---------------------------------------------------------------------------
rm -f "release/voc-${V1}.tar.gz" "release/voc-${V2}.tar.gz"

echo
echo "=============================================="
echo " REHEARSAL PASSED"
echo "   install -> update -> data survived"
echo "   broken release -> auto-rollback -> data survived"
echo "=============================================="
