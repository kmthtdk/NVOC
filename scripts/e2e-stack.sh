#!/usr/bin/env bash
#
# Run the E2E suite against the CODE IN THIS TREE, on a stack of its own.
#
#   ./scripts/e2e-stack.sh
#
# The suite used to be pointed at whatever happened to be running on the Dev PC.
# That stack is a container image built two weeks ago: it does not have the routes
# the current backend serves (it 404s on /api/version, which this branch added), so
# every workflow test failed on the API long before it could say anything about the
# UI. A green or red run against it means nothing.
#
# It is also NOT safe to point a from-source backend at the Dev PC's database:
# bootstrapAuth() provisions the env admin and neutralises the seeded demo
# credentials — the very accounts these tests log in with, and the ones the human
# uses. So this brings up its own MySQL, seeded from database/init, and its own
# backend and dev server on ports nothing else uses. Nothing here touches the
# running voc-db / voc-backend / voc-frontend containers or their data.
set -uo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

CONTAINER=voc_e2e_db
DB_PORT=33062
API_PORT=4098
WEB_PORT=5200
DB_NAME=voc_e2e

cleanup() {
  echo
  echo ">> Tearing down the E2E stack"
  [ -n "${BACKEND_PID:-}" ] && kill "$BACKEND_PID" 2>/dev/null
  [ -n "${VITE_PID:-}" ] && kill "$VITE_PID" 2>/dev/null
  docker rm -f "$CONTAINER" > /dev/null 2>&1
}
trap cleanup EXIT

# A run that is interrupted (Ctrl-C, a killed CI step) never reaches the trap, so its
# backend keeps holding :4098 and the NEXT run dies on EADDRINUSE — looking, from the
# outside, exactly like a broken app. Take the port back first.
freePort() {
  local port="$1" pid
  if command -v netstat > /dev/null 2>&1; then
    pid="$(netstat -ano 2>/dev/null | grep ":${port} " | grep -i listening | awk '{print $NF}' | head -1)"
    if [ -n "${pid:-}" ]; then
      echo ">> Port ${port} still held by pid ${pid} from an earlier run — reclaiming"
      taskkill //PID "$pid" //F > /dev/null 2>&1 || kill -9 "$pid" 2>/dev/null || true
      sleep 1
    fi
  fi
}
freePort "$API_PORT"
freePort "$WEB_PORT"

echo ">> MySQL 8.4 on :${DB_PORT} (throwaway)"
docker rm -f "$CONTAINER" > /dev/null 2>&1
docker run -d --name "$CONTAINER" \
  -e MYSQL_ALLOW_EMPTY_PASSWORD=1 \
  -e "MYSQL_DATABASE=${DB_NAME}" \
  -p "${DB_PORT}:3306" \
  mysql:8.4 > /dev/null

# The container logs "ready" once during its own init and then restarts, so the
# first match is a lie. Poll the protocol instead.
for _ in $(seq 1 90); do
  if docker exec "$CONTAINER" mysqladmin ping -uroot --silent > /dev/null 2>&1; then
    sleep 2
    docker exec "$CONTAINER" mysql -uroot -e "SELECT 1" "$DB_NAME" > /dev/null 2>&1 && break
  fi
  sleep 2
done

echo ">> Loading schema + seed from database/init"
for f in database/init/*.sql; do
  printf '   %-28s' "$(basename "$f")"
  if docker exec -i "$CONTAINER" mysql -uroot "$DB_NAME" < "$f" > /dev/null 2>&1; then
    echo ok
  else
    echo FAILED
    exit 1
  fi
done

echo ">> Backend from source on :${API_PORT}"
(
  cd backend
  # A secret long enough and random enough that the weak-secret guard does not
  # trip; NODE_ENV=development so the seeded demo logins the suite uses survive.
  NODE_ENV=development \
  PORT="$API_PORT" \
  DB_HOST=127.0.0.1 DB_PORT="$DB_PORT" DB_NAME="$DB_NAME" DB_USER=root DB_PASSWORD= \
  JWT_SECRET="$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')" \
  CORS_ORIGIN="http://localhost:${WEB_PORT}" \
  ADMIN_EMAIL=e2e-admin@n-voc.local \
  ADMIN_PASSWORD='E2eAdminPass1!' \
  npx tsx src/index.ts > "${ROOT}/.e2e-backend.log" 2>&1
) &
BACKEND_PID=$!

for _ in $(seq 1 60); do
  curl -fsS "http://127.0.0.1:${API_PORT}/api/health" > /dev/null 2>&1 && break
  sleep 2
done
if ! curl -fsS "http://127.0.0.1:${API_PORT}/api/health" > /dev/null 2>&1; then
  echo "ABORT: backend never came up. Last lines:"
  tail -20 "${ROOT}/.e2e-backend.log"
  exit 1
fi
echo "   healthy: $(curl -s "http://127.0.0.1:${API_PORT}/api/health")"
echo "   version: $(curl -s "http://127.0.0.1:${API_PORT}/api/version")"

echo ">> Vite on :${WEB_PORT}, proxying /api to :${API_PORT}"
VITE_DEV_API_TARGET="http://127.0.0.1:${API_PORT}" \
  npx vite --port "$WEB_PORT" --strictPort > "${ROOT}/.e2e-vite.log" 2>&1 &
VITE_PID=$!

for _ in $(seq 1 30); do
  curl -fsS "http://127.0.0.1:${WEB_PORT}/" > /dev/null 2>&1 && break
  sleep 1
done

echo
echo ">> Running the E2E suite"
rm -rf tests/e2e/.auth test-results
E2E_BASE_URL="http://localhost:${WEB_PORT}" \
E2E_API_BASE="http://localhost:${API_PORT}/api" \
  npx playwright test ${E2E_SPEC:-} --reporter=list
STATUS=$?

echo; echo ">> backend log (last 30):"; tail -30 "${ROOT}/.e2e-backend.log"
exit $STATUS
