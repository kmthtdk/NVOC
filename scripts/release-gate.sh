#!/usr/bin/env bash
#
# The gate. Nothing ships to the airgapped Production PC until this exits 0.
#
#   ./scripts/release-gate.sh
#
# There is no CI on this project, so a checklist in a document would simply never
# be run. This is one command that either passes or refuses, and it is the thing
# a human runs before cutting a release.
#
# Needs Docker (the integration suite and the upgrade rehearsal both spin real
# MySQL). Run it on the Dev PC.
set -uo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

PASS=0
FAIL=0
step() { printf '\n\033[1m[%s]\033[0m %s\n' "$1" "$2"; }
ok()   { PASS=$((PASS+1)); printf '  \033[32mPASS\033[0m  %s\n' "$1"; }
bad()  { FAIL=$((FAIL+1)); printf '  \033[31mFAIL\033[0m  %s\n' "$1"; }

run() { # run <label> <cmd...>
  local label="$1"; shift
  if "$@" > /tmp/gate.out 2>&1; then ok "$label"; else bad "$label"; tail -12 /tmp/gate.out; fi
}

echo "=============================================="
echo " N-VOC release gate — v$(node -p "require('./package.json').version")"
echo "=============================================="

# ---- 1. It compiles, including the tests -----------------------------------
step 1/6 "Typecheck"
run "backend typecheck (tests included)" bash -c "cd backend && npx tsc --noEmit"
run "frontend typecheck (strict, tests + configs included)" npx tsc --noEmit

# ---- 2. Unit + integration --------------------------------------------------
step 2/6 "Tests"
run "backend unit"        bash -c "cd backend && npx vitest run"
run "backend integration (real MySQL)" bash -c "cd backend && npm run test:integration"
run "frontend"            npx vitest run

# ---- 3. The bundle must not reach for the internet --------------------------
# On the airgapped box a remote font/CDN reference does not fail loudly — it just
# never resolves, and the UI quietly degrades. Catch it here, not in production.
step 3/6 "Offline audit"
if grep -rqE "https?://(fonts\.googleapis|fonts\.gstatic|cdn\.|unpkg|jsdelivr)" src/ index.html 2>/dev/null; then
  bad "source reaches an external host"
  grep -rnE "https?://(fonts\.googleapis|fonts\.gstatic|cdn\.|unpkg|jsdelivr)" src/ index.html || true
else
  ok "no external hosts in source (build-release.sh re-checks the built image)"
fi

# ---- 4. The palette cannot drift silently ----------------------------------
# A colour scale that is not remapped in @theme renders as stock Tailwind and
# lands off-palette. That is how indigo, then red and yellow, leaked in — the
# code compiles, the tests pass, only the colour is wrong.
step 4/6 "Design tokens"
OFF="$(grep -rhoE "\b(bg|text|border)-(red|yellow|purple|fuchsia|green|cyan|orange|lime|pink)-[0-9]{2,3}" src/ 2>/dev/null | sort -u || true)"
if [ -n "$OFF" ]; then
  bad "off-palette colour classes (not remapped in src/index.css @theme):"
  echo "$OFF" | sed 's/^/        /'
else
  ok "no off-palette colour classes"
fi

# ---- 5. Production build ----------------------------------------------------
step 5/6 "Production build"
run "vite build" npx vite build
rm -rf dist

# ---- 6. Rehearse the upgrade, on a scratch stack -----------------------------
# This is the highest-value check in the whole file. The Production PC has no
# internet: a failed update there is expensive, and update.sh/rollback.sh had
# never been executed by anything but a human, once.
step 6/6 "Upgrade rehearsal"
if [ "${SKIP_REHEARSAL:-}" = "1" ]; then
  printf '  \033[33mSKIP\033[0m  upgrade rehearsal (SKIP_REHEARSAL=1)\n'
else
  if ./scripts/rehearse-upgrade.sh > /tmp/gate-rehearsal.out 2>&1; then
    ok "update + forced rollback on a scratch stack"
  else
    bad "upgrade rehearsal"
    tail -25 /tmp/gate-rehearsal.out
  fi
fi

# ---- verdict ----------------------------------------------------------------
echo
echo "=============================================="
if [ "$FAIL" -eq 0 ]; then
  printf ' \033[32mGATE PASSED\033[0m — %s checks\n' "$PASS"
  echo ' Safe to build a release bundle:  ./scripts/build-release.sh'
  echo "=============================================="
  exit 0
fi
printf ' \033[31mGATE FAILED\033[0m — %s failed, %s passed\n' "$FAIL" "$PASS"
echo ' Do NOT ship. Nothing has been released.'
echo "=============================================="
exit 1
