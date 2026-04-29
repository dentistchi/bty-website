#!/usr/bin/env bash
# Arena release gate — HTTP smoke aligned with docs/BTY_RELEASE_GATE_CHECK.md
#
# Requires:
#   BASE_URL        — deploy origin, e.g. https://example.com (no trailing slash)
#
# Credentials (defaults match seedFixtureUser() in src/engine/integration/e2e-test-fixtures.service.ts):
#   E2E_EMAIL       — optional; default e2e-fixture+bty@local.test
#   E2E_PASSWORD    — optional; default E2eFixture-local-smoke-32chars-min!!
#
# Fixture DB state (onboarding complete, arena profile, scenario pool) — run before gate when possible:
#   If NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL is set AND SUPABASE_SERVICE_ROLE_KEY is set,
#   runs: npx tsx scripts/seed-arena-release-gate-fixture.ts
#   Set SKIP_SEED_FIXTURE=1 to skip (e.g. DB already seeded; no service role in shell).
#
# Usage (local):
#   cd bty-app && BASE_URL=https://preview.example.com ./scripts/arena-release-gate.sh
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BTY_APP_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$BTY_APP_ROOT" || exit 1

BASE="${BASE_URL:-}"
BASE="${BASE%/}"
if [[ -z "$BASE" ]]; then
  echo "FAIL: BASE_URL is required"
  exit 1
fi

# Default fixture account — must match seedFixtureUser / ensureFixtureAuthUser (same Supabase project as BASE_URL).
DEFAULT_FIXTURE_EMAIL="e2e-fixture+bty@local.test"
DEFAULT_FIXTURE_PASSWORD="E2eFixture-local-smoke-32chars-min!!"
# Treat empty string (e.g. unset GitHub secret) as unset so defaults apply.
EMAIL="${E2E_EMAIL:-$DEFAULT_FIXTURE_EMAIL}"
PASSWORD="${E2E_PASSWORD:-$DEFAULT_FIXTURE_PASSWORD}"
[[ -z "$EMAIL" ]] && EMAIL="$DEFAULT_FIXTURE_EMAIL"
[[ -z "$PASSWORD" ]] && PASSWORD="$DEFAULT_FIXTURE_PASSWORD"

SUPABASE_URL_EFFECTIVE="${NEXT_PUBLIC_SUPABASE_URL:-${SUPABASE_URL:-}}"
if [[ -z "${SKIP_SEED_FIXTURE:-}" ]] && [[ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]] && [[ -n "$SUPABASE_URL_EFFECTIVE" ]]; then
  echo "=== 0) seedFixtureUser (fixture DB state for session/next + /bty-arena, not auth) ==="
  export NEXT_PUBLIC_SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-$SUPABASE_URL_EFFECTIVE}"
  export SUPABASE_URL="${SUPABASE_URL:-$SUPABASE_URL_EFFECTIVE}"
  npx --yes tsx scripts/seed-arena-release-gate-fixture.ts
elif [[ -z "${SKIP_SEED_FIXTURE:-}" ]] && [[ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  echo "=== 0) seedFixtureUser skipped (no SUPABASE_SERVICE_ROLE_KEY; set it or SKIP_SEED_FIXTURE=1) ==="
fi

COOKIE_JAR="$(mktemp)"
cleanup() { rm -f "$COOKIE_JAR" /tmp/arena-gate-*.json /tmp/arena-gate-headers.txt /tmp/arena-gate-login-headers.txt 2>/dev/null || true; }
trap cleanup EXIT

if command -v jq >/dev/null 2>&1; then
  LOGIN_BODY="$(jq -n --arg email "$EMAIL" --arg password "$PASSWORD" '{email:$email, password:$password}')"
else
  LOGIN_BODY="$(printf '{"email":"%s","password":"%s"}' "$EMAIL" "$PASSWORD")"
fi

echo "=== BASE: $BASE ==="

echo "=== 1) POST /api/auth/login ==="
code="$(curl -sS -D /tmp/arena-gate-login-headers.txt -o /tmp/arena-gate-login.json -w "%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -d "$LOGIN_BODY" \
  -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
  "$BASE/api/auth/login" || true)"
if [[ "$code" != "200" ]]; then
  echo "FAIL: login HTTP $code"
  head -c 500 /tmp/arena-gate-login.json 2>/dev/null || true
  exit 1
fi
if ! grep -qi '^set-cookie:' /tmp/arena-gate-login-headers.txt 2>/dev/null; then
  echo "FAIL: login 200 but no Set-Cookie header (auth contract requires session cookie on success)"
  head -20 /tmp/arena-gate-login-headers.txt 2>/dev/null || true
  exit 1
fi

echo "=== 2) GET /api/arena/session/next?locale=en ==="
code="$(curl -sS -o /tmp/arena-gate-next.json -w "%{http_code}" \
  -b "$COOKIE_JAR" \
  "$BASE/api/arena/session/next?locale=en" || true)"
body="$(cat /tmp/arena-gate-next.json 2>/dev/null || true)"
if [[ "$code" != "200" ]]; then
  echo "FAIL: session/next HTTP $code body (first 500 chars): ${body:0:500}"
  exit 1
fi
if echo "$body" | grep -q "no_scenario_available"; then
  echo "FAIL: session/next returned no_scenario_available (empty pool / selection failure)"
  exit 1
fi
if ! echo "$body" | grep -qE '"ok"[[:space:]]*:[[:space:]]*true'; then
  echo "FAIL: session/next expected JSON with ok:true"
  echo "${body:0:500}"
  exit 1
fi

echo "=== 3) HEAD /en/bty-arena/run — first hop must be 308 → canonical (Location contains /bty-arena, not /run) ==="
curl -sS -I --max-redirs 0 -o /tmp/arena-gate-headers.txt "$BASE/en/bty-arena/run" || true
first_line="$(head -1 /tmp/arena-gate-headers.txt | tr -d '\r')"
if ! echo "$first_line" | grep -qE '(HTTP/1\.[01]|HTTP/2) 308'; then
  echo "FAIL: expected HTTP 308 on /en/bty-arena/run, first line: $first_line"
  head -20 /tmp/arena-gate-headers.txt
  exit 1
fi
LOC="$(grep -i '^location:' /tmp/arena-gate-headers.txt | tail -1 | tr -d '\r' | sed 's/^[Ll]ocation:[[:space:]]*//')"
if [[ -z "$LOC" ]]; then
  echo "FAIL: 308 without Location header"
  exit 1
fi
if ! echo "$LOC" | grep -qi 'bty-arena'; then
  echo "FAIL: Location must contain bty-arena, got: $LOC"
  exit 1
fi
if echo "$LOC" | grep -qiE 'bty-arena/run'; then
  echo "FAIL: Location must not keep deprecated /run path, got: $LOC"
  exit 1
fi

echo "=== 4) GET /en/bty-arena/run with session (follow redirects) → canonical Arena, not /bty/login ==="
# curl resolves relative Location against request URL; -L follows 308 then loads page
effective="$(curl -sS -o /tmp/arena-gate-run.html -w "%{url_effective}" -L \
  -b "$COOKIE_JAR" \
  "$BASE/en/bty-arena/run" || true)"
if echo "$effective" | grep -q '/bty/login'; then
  echo "FAIL: deprecated /run with auth landed on login (session not applied on follow-up): $effective"
  exit 1
fi
if ! echo "$effective" | grep -qE '/bty-arena(/beginner)?(\?|$|#)'; then
  echo "FAIL: expected final URL on canonical Arena (/en/bty-arena or /beginner), got: $effective"
  exit 1
fi

echo ""
echo "ARENA RELEASE GATE PASSED ✅"
