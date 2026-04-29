#!/usr/bin/env bash
# C5 원클릭 게이트 — ci-gate.sh 실행
# 사용: ./scripts/orchestrate.sh
# Workers 검증: BASE="https://..." LOGIN_BODY='{"email":"...","password":"..."}' ./scripts/orchestrate.sh

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$SCRIPT_DIR/ci-gate.sh"
