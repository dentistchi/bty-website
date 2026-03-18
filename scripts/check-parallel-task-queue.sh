#!/usr/bin/env bash
# 이번 런: C3·C4·C5·C6 중 표에 있는 역할이 전부 [x]인데 다른 곳에 [ ]가 있으면 exit 2.
set -eu
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BOARD="${BOARD_PATH:-$ROOT/docs/CURSOR_TASK_BOARD.md}"
[[ -f "$BOARD" ]] || { echo "check-parallel-task-queue: 없음: $BOARD" >&2; exit 1; }

set +e
OUT=$(awk -F'|' '
  /^## 이번 런/ { grab=1; next }
  /^## 이전 런/ { exit }
  !grab { next }
  NF < 4 { next }
  {
    gsub(/^[[:space:]]+|[[:space:]]+$/, "", $2)
    gsub(/^[[:space:]]+|[[:space:]]+$/, "", $3)
    gsub(/^[[:space:]]+|[[:space:]]+$/, "", $4)
    if ($2 !~ /^[0-9]+$/) next
    if ($3 !~ /^C[0-9]+$/) next
    owner = $3
    cell = $4
    rows[owner] = 1
    if (cell ~ /^\[[[:space:]]*x[[:space:]]*\]/) { }
    else if (cell ~ /^\[[[:space:]]]*\]/) {
      has_open[owner] = 1
      any_open = 1
    }
  }
  END {
    if (length(rows) == 0) { print "PARSE_FAIL"; exit 1 }
    if (!any_open) { print "ALL_DONE"; exit 0 }
    starved = ""
    split("C3 C4 C5 C6", roles, " ")
    for (i = 1; i <= 4; i++) {
      ow = roles[i]
      if (!(ow in rows)) continue
      if (!(ow in has_open)) {
        if (starved != "") starved = starved ", "
        starved = starved ow
      }
    }
    if (starved != "") { print starved; exit 2 }
    print "OK"
    exit 0
  }
' "$BOARD")
rc=$?
set -e

if [[ $rc -eq 1 ]]; then
  echo "check-parallel-task-queue: 이번 런 표 파싱 실패 ($OUT)" >&2
  exit 1
fi
if [[ $rc -eq 2 ]]; then
  echo "PARALLEL_QUEUE_REFILL_REQUIRED: $OUT"
  echo "→ docs/agent-runtime/PARALLEL_QUEUE_REFILL.md"
  exit 2
fi
if [[ "$OUT" == "ALL_DONE" ]]; then
  echo "OK: 이번 런 전부 [x]. 다음: C1 splint 10."
else
  echo "OK: 병렬 큐 정상 ($OUT)."
fi
exit 0
