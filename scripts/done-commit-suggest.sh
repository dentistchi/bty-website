#!/usr/bin/env bash
# done 처리 + 다음 First Task 갱신 + 커밋 메시지 제안
#
# 사용: cd ~/Dev/btytrainingcenter && ./scripts/done-commit-suggest.sh
# 성공 시: NEXT_FIRST_TASK, COMMIT_SUGGESTION 라인 출력 (C1이 RESULT: DONE 형식으로 포맷)
# 실패 시: exit 1, stderr에 원인

set -euo pipefail

ROOT="${ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$ROOT"
BOARD="$ROOT/docs/CURSOR_TASK_BOARD.md"
SUMMARY="$ROOT/docs/agent-runtime/C1_SUMMARY.md"

mark_done() {
  [[ -f "$ROOT/scripts/mark-done.sh" ]] || { echo "missing mark-done.sh" >&2; return 1; }
  "$ROOT/scripts/mark-done.sh"
}

refresh_next() {
  [[ -f "$ROOT/scripts/orchestrate.sh" ]] || { echo "missing orchestrate.sh" >&2; return 1; }
  "$ROOT/scripts/orchestrate.sh" >/dev/null 2>&1 || true
}

suggest_commit() {
  local task_line=""
  local tag="chore"
  if [[ -f "$SUMMARY" ]]; then
    task_line="$(grep -E "^Task Line:" "$SUMMARY" 2>/dev/null | sed 's/^Task Line: *//' | head -1)"
    if [[ "$task_line" == *"[AUTH]"* ]]; then tag="fix(auth)"; fi
    if [[ "$task_line" == *"[API]"* ]]; then tag="feat(api)"; fi
    if [[ "$task_line" == *"[DOMAIN]"* ]]; then tag="feat(domain)"; fi
    if [[ "$task_line" == *"[UI]"* ]]; then tag="fix(ui)"; fi
    if [[ "$task_line" == *"[DOCS]"* ]]; then tag="docs"; fi
  fi
  echo "COMMIT_SUGGESTION: $tag: wrap-ci passed"
  echo "COMMIT_SUGGESTION: chore: update task board (wrap-ci passed)"
}

echo "=== DONE COMMIT SUGGEST ==="
mark_done || { echo "FAIL: mark-done" >&2; exit 1; }
refresh_next

if [[ -f "$SUMMARY" ]]; then
  first_task="$(grep -E "^First Task:" "$SUMMARY" 2>/dev/null | sed 's/^First Task: *//' | head -1)"
  task_line="$(grep -E "^Task Line:" "$SUMMARY" 2>/dev/null | sed 's/^Task Line: *//' | head -1)"
  echo "NEXT_FIRST_TASK: ${first_task:-—}"
  echo "NEXT_TASK_LINE: ${task_line:-—}"
fi
suggest_commit
echo "DONE_COMMIT_SUGGEST_OK"
