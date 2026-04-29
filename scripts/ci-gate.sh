#!/usr/bin/env bash
# 로컬/프리뷰 통합 게이트 — 원클릭
#
# 사용법 (로컬 게이트만: lint + test + build):
#   ./scripts/ci-gate.sh
#
# 사용법 (Workers 검증까지 포함):
#   BASE="https://bty-website.<subdomain>.workers.dev" \
#   LOGIN_BODY='{"email":"you@example.com","password":"..."}' \
#   ./scripts/ci-gate.sh
#
# 동작:
#   1) npm run lint → 실패 시 단계명 출력 후 exit 1
#   2) npm run test → 동일
#   3) npm run build → 동일
#   4) BASE·LOGIN_BODY 둘 다 있으면 ./scripts/verify-workers-dev.sh 실행
#   5) 모두 성공 시 ./scripts/notify-done.sh 실행
#   (jq 등 외부 의존성 없음)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

fail() {
  local step="$1"; shift
  echo "FAIL: $step"
  [[ $# -gt 0 ]] && echo "$@"
  exit 1
}

step() {
  echo ""
  echo "=== $1 ==="
}

step "1) Lint"
npm run lint || fail "1) Lint"

step "1b) Terminology lint (G-B11)"
node scripts/terminology-lint.mjs || fail "1b) Terminology lint (G-B11)"

step "2) Test"
npm run test || fail "2) Test"

step "3) Build"
npm run build || fail "3) Build"

# Workers 검증: BASE·LOGIN_BODY 중 하나만 설정된 경우 실패
if [[ -n "${BASE:-}" && -z "${LOGIN_BODY:-}" ]] || [[ -z "${BASE:-}" && -n "${LOGIN_BODY:-}" ]]; then
  fail "4) Workers verify" "Workers verify를 실행하려면 BASE와 LOGIN_BODY 둘 다 필요합니다."
fi
# 둘 다 설정되어 있고 placeholder 없을 때만 실행
if [[ -n "${BASE:-}" && -n "${LOGIN_BODY:-}" ]]; then
  step "4) Workers verify"
  if [[ "$BASE" == *"YOUR_SUBDOMAIN"* ]]; then
    fail "4) Workers verify" "BASE가 placeholder입니다. 실제 workers.dev URL을 설정하세요."
  fi
  if echo "${LOGIN_BODY:-}" | grep -q "YOUR_EMAIL\|YOUR_PASSWORD"; then
    fail "4) Workers verify" "LOGIN_BODY에 placeholder(YOUR_EMAIL/YOUR_PASSWORD)가 있습니다. 실제 값으로 설정하세요."
  fi
  ./scripts/verify-workers-dev.sh || fail "4) Workers verify"
else
  step "4) Workers verify (skip)"
  echo "BASE와 LOGIN_BODY 둘 다 설정하면 workers 검증을 실행합니다."
fi

step "5) Done notification"
./scripts/notify-done.sh

echo ""
echo "CI GATE PASSED ✅"
