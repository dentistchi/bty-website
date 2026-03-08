#!/usr/bin/env bash
# 검증 → 통과 시 done → 다음 auto 준비
#
# 사용:
#   cd ~/Dev/btytrainingcenter
#   ./scripts/auto-verify-loop.sh
#
# Workers 검증 포함:
#   cd ~/Dev/btytrainingcenter
#   BASE="https://bty-website.<subdomain>.workers.dev" \
#   LOGIN_BODY='{"email":"you@example.com","password":"..."}' \
#   ./scripts/auto-verify-loop.sh

set -euo pipefail

ROOT="${ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
APP_DIR="$ROOT/bty-app"

echo "=== AUTO VERIFY LOOP START ==="

cd "$APP_DIR"

if [[ -n "${BASE:-}" || -n "${LOGIN_BODY:-}" ]]; then
  BASE="${BASE:-}" LOGIN_BODY="${LOGIN_BODY:-}" ../scripts/ci-gate.sh
else
  ../scripts/ci-gate.sh
fi

cd "$ROOT"
./scripts/mark-done.sh
./scripts/orchestrate.sh

echo "=== AUTO VERIFY LOOP DONE ==="
