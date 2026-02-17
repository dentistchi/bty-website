#!/usr/bin/env bash
# workers.dev 최종 검증 — BASE를 본인 URL로 바꾼 뒤 실행
# 사용법: BASE="https://bty-website.계정서브도메인.workers.dev" ./scripts/verify-workers-dev.sh

set -e
BASE="${BASE:-https://bty-website.YOUR_SUBDOMAIN.workers.dev}"

echo "=== BASE: $BASE ==="
echo ""

echo "--- 1) GET /api/debug ---"
curl -s -w "\nHTTP %{http_code}\n" "$BASE/api/debug"
echo ""

echo "--- 2) POST /api/auth/login (이메일/비밀번호를 환경변수나 아래에서 치환) ---"
curl -s -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "${LOGIN_BODY:-{\"email\":\"YOUR_EMAIL\",\"password\":\"YOUR_PASSWORD\"}}" \
  -c /tmp/cookies.txt -b /tmp/cookies.txt -w "\nHTTP %{http_code}\n" || true
echo ""

echo "--- 3) GET /api/auth/session (쿠키 포함) ---"
curl -s "$BASE/api/auth/session" -b /tmp/cookies.txt
echo ""

echo "--- 4) 브라우저 수동 확인 ---"
echo "브라우저에서: $BASE/admin/login → 로그인 → /admin/debug 리다이렉트 확인"
