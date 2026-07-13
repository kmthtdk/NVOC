#!/usr/bin/env bash
#
# Build an offline release bundle. RUN ON THE DEV PC (needs internet + Docker).
#
# The Production PC is airgapped: it cannot pull an image, install an npm
# package, or fetch a font. So everything it will ever need is baked in here and
# shipped as one file. Nothing in the bundle reaches the network at run time.
#
#   ./scripts/build-release.sh            # version from package.json
#   ./scripts/build-release.sh 1.2.0      # explicit version
#
# Output: release/voc-<version>.tar.gz
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

VERSION="${1:-$(node -p "require('./package.json').version")}"
BUILD_TIME="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
GIT_COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"

# The DB image the Production PC will run. Pinned: an airgapped box cannot
# resolve a floating tag later.
MYSQL_IMAGE="mysql:8.4"

STAGE="$ROOT/release/staging"
OUT="$ROOT/release/voc-${VERSION}.tar.gz"

echo "=============================================="
echo " N-VOC offline release"
echo "   version : ${VERSION}"
echo "   built   : ${BUILD_TIME}"
echo "   commit  : ${GIT_COMMIT}"
echo "=============================================="

rm -rf "$STAGE"
mkdir -p "$STAGE/images" "$STAGE/database" "$STAGE/scripts"

# ---- 1. Build the images (this is the only step that needs the internet) ----
echo
echo "[1/5] Building images..."
docker build \
  --build-arg APP_VERSION="$VERSION" \
  --build-arg BUILD_TIME="$BUILD_TIME" \
  --build-arg GIT_COMMIT="$GIT_COMMIT" \
  -f backend/Dockerfile -t "voc-backend:${VERSION}" backend/

docker build \
  --build-arg VITE_APP_VERSION="$VERSION" \
  --build-arg VITE_BUILD_TIME="$BUILD_TIME" \
  -f Dockerfile.frontend -t "voc-frontend:${VERSION}" .

docker pull "$MYSQL_IMAGE"

# ---- 1b. Refuse to ship anything that phones home --------------------------
# Checked against the BUILT bundle inside the image, not the source — the source
# can talk about fonts.googleapis.com in a comment; what matters is whether the
# shipped JS/CSS actually fetches from it. On an airgapped box such a request
# does not fail loudly, it silently never resolves and the UI quietly degrades.
echo
echo "[1b] Auditing the built bundle for network calls..."
LEAK="$(docker run --rm --entrypoint sh "voc-frontend:${VERSION}" -c \
  "grep -rlE 'https?://(fonts\.googleapis|fonts\.gstatic|cdn\.|unpkg|jsdelivr|ajax\.googleapis)' /usr/share/nginx/html 2>/dev/null || true")"
if [ -n "$LEAK" ]; then
  echo "  ABORT: the built frontend still reaches out to the internet:"
  echo "$LEAK"
  echo "  Self-host it (node scripts/vendor-fonts.mjs) and rebuild."
  exit 1
fi
FONTS="$(docker run --rm --entrypoint sh "voc-frontend:${VERSION}" -c \
  "ls /usr/share/nginx/html/fonts 2>/dev/null | wc -l")"
echo "  no external hosts; ${FONTS} font files bundled."

# ---- 2. Freeze the images into the bundle ----------------------------------
echo
echo "[2/5] Exporting images (docker save)..."
docker save "voc-backend:${VERSION}" "voc-frontend:${VERSION}" "$MYSQL_IMAGE" \
  | gzip -1 > "$STAGE/images/voc-images.tar.gz"
echo "  $(du -h "$STAGE/images/voc-images.tar.gz" | cut -f1)"

# ---- 3. Everything the Production PC needs to run and upgrade ---------------
echo
echo "[3/5] Staging compose, schema, migrations, scripts..."
# The PROD compose — no `build:` blocks. The dev one would try to build on a box
# that has no npm registry.
cp docker-compose.prod.yml "$STAGE/"
cp .env.example "$STAGE/env.example"
cp -r database/init "$STAGE/database/"
cp -r database/migrations "$STAGE/database/"
cp scripts/install.sh scripts/update.sh scripts/rollback.sh "$STAGE/scripts/"
chmod +x "$STAGE/scripts/"*.sh

# ---- 4. Manifest — what this bundle is, and what it must be able to prove ---
echo
echo "[4/5] Writing manifest..."
cat > "$STAGE/MANIFEST.json" <<JSON
{
  "product": "n-voc-system-service-portal",
  "version": "${VERSION}",
  "builtAt": "${BUILD_TIME}",
  "commit": "${GIT_COMMIT}",
  "images": ["voc-backend:${VERSION}", "voc-frontend:${VERSION}", "${MYSQL_IMAGE}"],
  "offline": true
}
JSON

(cd "$STAGE" && find . -type f ! -name SHA256SUMS -exec sha256sum {} + > SHA256SUMS)

# ---- 5. Seal ---------------------------------------------------------------
echo
echo "[5/5] Packing..."
mkdir -p "$ROOT/release"
tar -czf "$OUT" -C "$STAGE" .
rm -rf "$STAGE"

echo
echo "=============================================="
echo " ${OUT}"
echo " $(du -h "$OUT" | cut -f1)"
echo
echo " Copy to the Production PC, then:"
echo "   tar -xzf voc-${VERSION}.tar.gz"
echo "   ./scripts/install.sh      # first time"
echo "   ./scripts/update.sh       # upgrade a running system"
echo "=============================================="
