#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BOARD="$ROOT/docs/CURSOR_TASK_BOARD.md"
RUNTIME="$ROOT/docs/agent-runtime"

mkdir -p "$RUNTIME"

if [[ ! -f "$BOARD" ]]; then
  echo "FAIL: task board missing"
  exit 1
fi

TASK_LINE="$(
  awk '
    BEGIN { in_table=0 }
    /## 현재 작업/ { in_table=1; next }
    in_table && /^\| Cursor 타입 / { next }
    in_table && /^\|[-| ]+$/ { next }
    in_table && /^\|/ {
      if ($0 ~ /color:red|진행 중|대기/) {
        print
        exit
      }
    }
  ' "$BOARD"
)"

if [[ -z "$TASK_LINE" ]]; then
  FIRST_TASK="AUTH"
else
  LOWER_LINE="$(printf '%s\n' "$TASK_LINE" | tr '[:upper:]' '[:lower:]')"

  case "$LOWER_LINE" in
    *"[auth]"*)
      FIRST_TASK="AUTH"
      ;;
    *"[api]"*)
      FIRST_TASK="API"
      ;;
    *"[domain]"*)
      FIRST_TASK="DOMAIN"
      ;;
    *"[ui]"*)
      FIRST_TASK="UI"
      ;;
    *"[docs]"*)
      FIRST_TASK="DOCS"
      ;;
    *)
      FIRST_TASK="DOCS"
      ;;
  esac
fi

cat > "$RUNTIME/C1_SUMMARY.md" <<EOF
# C1 Auto Summary

First Task: $FIRST_TASK
Task Line: $TASK_LINE
EOF

echo "AUTO READY"
echo "First Task: $FIRST_TASK"
echo "Open:"
echo "  docs/agent-runtime/C1_SUMMARY.md"
