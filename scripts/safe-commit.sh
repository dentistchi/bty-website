#!/usr/bin/env bash
# 안전 커밋: 메시지 한 개로 git add + git commit
# 사용: ./scripts/safe-commit.sh "fix(ui): wrap-ci passed"
# 파괴적 명령 없음. reset/clean 사용 안 함.

set -euo pipefail

ROOT="${ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$ROOT"

[[ -d .git ]] || { echo "FAIL: not a git repo" >&2; exit 1; }
[[ $# -ge 1 ]] || { echo "Usage: $0 \"<commit message>\"" >&2; exit 1; }

MSG="$1"
git add -A
git status --short
git commit -m "$MSG"
echo "COMMITTED: $MSG"
