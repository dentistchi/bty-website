#!/usr/bin/env bash
set -euo pipefail

ROOT="${ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
BOARD="$ROOT/docs/CURSOR_TASK_BOARD.md"
CURRENT="$ROOT/docs/CURRENT_TASK.md"
STAMP="$(date '+%Y-%m-%d %H:%M:%S')"

[[ -f "$BOARD" ]] || { echo "missing $BOARD"; exit 1; }
[[ -f "$CURRENT" ]] || { echo "missing $CURRENT"; exit 1; }

{
  echo ""
  echo "## Completion Log"
  echo "- $STAMP wrap-ci passed"
} >> "$CURRENT"

{
  echo ""
  echo "| $STAMP | wrap-ci passed |"
} >> "$BOARD"

echo "DONE MARKED"
