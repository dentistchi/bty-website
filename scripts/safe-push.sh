#!/usr/bin/env bash
# push 전 최종 확인 후 실행. 사용: ./scripts/safe-push.sh
# 파괴적 명령 없음. force push 사용 안 함.

set -euo pipefail

ROOT="${ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$ROOT"

[[ -d .git ]] || { echo "FAIL: not a git repo" >&2; exit 1; }

BRANCH="$(git branch --show-current)"
echo "Push branch: $BRANCH"
echo "Run: git push origin $BRANCH"
git push origin "$BRANCH"
echo "PUSHED: origin $BRANCH"
