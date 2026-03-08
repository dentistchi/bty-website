#!/usr/bin/env bash
# 작업 완료 시 보드 해당 행을 완료로 바꾸고 CURRENT_TASK에 1줄 추가.
# 사용: ./scripts/mark-task-complete.sh "할 일 문자열" "비고 한 줄"
# 예:   ./scripts/mark-task-complete.sh "[UI] admin/users loading skeleton 보강" "LoadingFallback 적용. lint [x] Exit."

set -euo pipefail

ROOT="${ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
BOARD="$ROOT/docs/CURSOR_TASK_BOARD.md"
CURRENT="$ROOT/docs/CURRENT_TASK.md"
STAMP="$(date '+%Y-%m-%d %H:%M:%S')"

[[ $# -ge 1 ]] || { echo "Usage: $0 \"<할 일 문자열>\" [\"비고 한 줄\"]" >&2; exit 1; }
TASK_DESC="$1"
NOTE="${2:-완료}"

[[ -f "$BOARD" ]] || { echo "missing $BOARD" >&2; exit 1; }
[[ -f "$CURRENT" ]] || { echo "missing $CURRENT" >&2; exit 1; }

# 비고에 | 가 있으면 제거 (표 열 깨짐 방지)
NOTE_CLEAN="${NOTE//|/ }"

# 보드에서 "할 일" 포함 + 대기 포함인 첫 행을 완료로 교체
if grep -q "대기" "$BOARD" && grep -qF "$TASK_DESC" "$BOARD"; then
  awk -v task="$TASK_DESC" -v note="$NOTE_CLEAN" '
    BEGIN { done=0 }
    /^\| Fix\/Polish \||^\| Feature \|/ {
      if (!done && index($0, task) && index($0, "대기")) {
        gsub(/<span style="color:red">대기<\/span>/, "<span style=\"color:blue\">완료</span>")
        # Replace fourth column: last |...| at end with | note |
        sub(/\|[^|]*\s*$/, "| " note " |")
        done=1
      }
    }
    { print }
  ' "$BOARD" > "$BOARD.tmp" && mv "$BOARD.tmp" "$BOARD"
else
  echo "WARN: no matching 대기 row for task in board" >&2
fi

# CURRENT_TASK에 완료 1줄 추가
{
  echo ""
  echo "- $STAMP \`$TASK_DESC\`: $NOTE_CLEAN"
} >> "$CURRENT"

echo "TASK_MARKED_COMPLETE"
echo "Task: $TASK_DESC"
echo "Board and CURRENT_TASK updated. Run orchestrate.sh or 검증 to pick next task."
