#!/usr/bin/env bash
set -euo pipefail

step() { echo ""; echo "=== $1 ==="; }
fail() { echo "FAIL: $1"; exit 1; }

if [[ ! -f "package.json" ]]; then
  fail "package.json not found. Run from bty-app directory."
fi

step "0 Empty source file check"
EMPTY_FILES="$(find src -type f -size 0 2>/dev/null || true)"
if [[ -n "$EMPTY_FILES" ]]; then
  echo "FAIL: empty source files detected"
  echo "$EMPTY_FILES"
  exit 1
fi
echo "No empty source files detected."

step "1 Lint"
npm run lint

step "2 Test"
npm run test

step "3 Build"
npm run build

if [[ -n "${BASE:-}" || -n "${LOGIN_BODY:-}" ]]; then
  step "4 Workers verify"
  if [[ -z "${BASE:-}" || -z "${LOGIN_BODY:-}" ]]; then
    fail "BASE and LOGIN_BODY are both required for workers verify."
  fi
  ../scripts/verify-workers-dev.sh
else
  step "4 Workers verify skip"
  echo "Skipping workers verify because BASE/LOGIN_BODY are not set."
fi

step "5 Done notification"
../scripts/notify-done.sh

echo "CI GATE PASSED"
