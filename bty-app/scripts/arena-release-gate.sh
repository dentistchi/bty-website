#!/usr/bin/env bash
# Arena release gate — HTTP smoke aligned with docs/BTY_RELEASE_GATE_CHECK.md
#
# Requires:
#   BASE_URL        — deploy origin, e.g. https://example.com (no trailing slash)
#   E2E_EMAIL       — smoke user (same as Playwright E2E)
#   E2E_PASSWORD
#
# Usage (local):
#   BASE_URL=https://preview.example.com E2E_EMAIL=... E2E_PASSWORD=... ./scripts/arena-release-gate.sh
#
set -euo pipefail

BASE="${BASE_URL:-}"
BASE="${BASE%/}"
if [[ -z "$BASE" ]]; then
  echo "FAIL: BASE_URL is required"
  exit 1
fi

EMAIL="${E2E_EMAIL:-}"
PASSWORD="${E2E_PASSWORD:-}"
if [[ -z "$EMAIL" || -z "$PASSWORD" ]]; then
  echo "FAIL: E2E_EMAIL and E2E_PASSWORD are required (authenticated session/next + /run follow)"
  exit 1
fi

COOKIE_JAR="$(mktemp)"
cleanup() { rm -f "$COOKIE_JAR" /tmp/arena-gate-*.json /tmp/arena-gate-headers.txt 2>/dev/null || true; }
trap cleanup EXIT

if command -v jq >/dev/null 2>&1; then
  LOGIN_BODY="$(jq -n --arg email "$EMAIL" --arg password "$PASSWORD" '{email:$email, password:$password}')"
else
  LOGIN_BODY="$(printf '{"email":"%s","password":"%s"}' "$EMAIL" "$PASSWORD")"
fi

echo "=== BASE: $BASE ==="

echo "=== 1) POST /api/auth/login ==="
code="$(curl -sS -o /tmp/arena-gate-login.json -w "%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -d "$LOGIN_BODY" \
  -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
  "$BASE/api/auth/login" || true)"
if [[ "$code" != "200" ]]; then
  echo "FAIL: login HTTP $code"
  head -c 500 /tmp/arena-gate-login.json 2>/dev/null || true
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
