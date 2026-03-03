#!/usr/bin/env bash
# bty-app C5 게이트 실행 (today-me에서 호출 시)
# 사용: ./scripts/orchestrate.sh
# bty-app이 today-me와 형제(../bty-app)에 있다고 가정. BTY_APP env로 덮어쓰기 가능.

set -euo pipefail
MY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BTY_APP="${BTY_APP:-$MY_DIR/../../bty-app}"
if [[ ! -x "$BTY_APP/scripts/orchestrate.sh" ]]; then
  echo "bty-app을 찾을 수 없거나 orchestrate.sh가 없습니다: $BTY_APP/scripts/orchestrate.sh"
  exit 1
fi
exec "$BTY_APP/scripts/orchestrate.sh"
