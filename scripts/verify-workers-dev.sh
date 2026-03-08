#!/usr/bin/env bash
set -euo pipefail

BASE="${BASE:-https://bty-website.YOUR_SUBDOMAIN.workers.dev}"
COOKIE_JAR="${COOKIE_JAR:-/tmp/cookies.txt}"

fail() {
  local step="$1"; shift
  echo "FAIL: $step"
  echo "$@"
  exit 1
}

pass() {
  local step="$1"; shift
  echo "PASS: $step"
  [[ $# -gt 0 ]] && echo "$@"
  echo ""
}

http_call() {
  local step="$1"
  local method="$2"
  local url="$3"
  local expect="$4"
  local data="${5:-}"

  local body_file
  body_file="$(mktemp)"
  local code=""

  if [[ "$method" == "GET" ]]; then
    code="$(curl -sS -o "$body_file" -w "%{http_code}" "$url" -b "$COOKIE_JAR" || true)"
  else
    code="$(curl -sS -X "$method" -o "$body_file" -w "%{http_code}" \
      -H "Content-Type: application/json" \
      -d "$data" \
      -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
      "$url" || true)"
  fi

  if [[ "$code" != "$expect" ]]; then
    local snippet
    snippet="$(tr -d '\n' < "$body_file" | head -c 300)"
    rm -f "$body_file"
    fail "$step" "HTTP $code (expected $expect). Body snippet: $snippet"
  fi

  local snippet_ok
  snippet_ok="$(tr -d '\n' < "$body_file" | head -c 300)"
  rm -f "$body_file"
  pass "$step" "HTTP $code. Body snippet: $snippet_ok"
}

echo "=== BASE: $BASE ==="
echo "=== COOKIE_JAR: $COOKIE_JAR ==="
echo ""

if [[ "$BASE" == *"YOUR_SUBDOMAIN"* ]]; then
  fail "INPUT" "BASE가 placeholder입니다. 실제 workers.dev URL로 BASE를 설정하세요."
fi

if [[ -z "${LOGIN_BODY:-}" ]]; then
  fail "INPUT" "LOGIN_BODY가 비어있습니다. 예: LOGIN_BODY='{\"email\":\"...\",\"password\":\"...\"}'"
fi

if echo "$LOGIN_BODY" | grep -q "YOUR_EMAIL\|YOUR_PASSWORD"; then
  fail "INPUT" "LOGIN_BODY에 placeholder가 포함되어 있습니다."
fi

echo "--- 1) GET /api/debug ---"
http_call "GET /api/debug" "GET" "$BASE/api/debug" "200"

echo "--- 2) POST /api/auth/login ---"
http_call "POST /api/auth/login" "POST" "$BASE/api/auth/login" "200" "$LOGIN_BODY"

echo "--- 3) GET /api/auth/session ---"
tmp_body="$(mktemp)"
code="$(curl -sS -o "$tmp_body" -w "%{http_code}" "$BASE/api/auth/session" -b "$COOKIE_JAR" || true)"
if [[ "$code" != "200" ]]; then
  snippet="$(tr -d '\n' < "$tmp_body" | head -c 300)"
  rm -f "$tmp_body"
  fail "GET /api/auth/session" "HTTP $code (expected 200). Body snippet: $snippet"
fi

if ! grep -Eq '"user"|"email"|"authenticated"|"session"' "$tmp_body"; then
  snippet="$(tr -d '\n' < "$tmp_body" | head -c 300)"
  rm -f "$tmp_body"
  fail "GET /api/auth/session" "HTTP 200이지만 세션/유저 키워드가 없습니다. Body snippet: $snippet"
fi

snippet="$(tr -d '\n' < "$tmp_body" | head -c 300)"
rm -f "$tmp_body"
pass "GET /api/auth/session" "HTTP 200 + sanity OK. Body snippet: $snippet"

echo "ALL CHECKS PASSED ✅"
exit 0
