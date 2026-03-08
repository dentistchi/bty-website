#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$ROOT/bty-app"
SUMMARY="$ROOT/docs/agent-runtime/C1_SUMMARY.md"
BOARD="$ROOT/docs/CURSOR_TASK_BOARD.md"

echo "=== AUTO AGENT LOOP START ==="

echo ""
echo "[1/5] Orchestrate next task"
cd "$ROOT"
./scripts/orchestrate.sh

if [[ -f "$SUMMARY" ]]; then
  echo ""
  echo "--- C1 SUMMARY ---"
  cat "$SUMMARY"
  echo "------------------"
fi

echo ""
echo "[2/5] Run verify loop"
./scripts/auto-verify-loop.sh

echo ""
echo "[3/5] Auto 4: 다음 할 일 선정 + 각 Cursor 명령문 생성"
# 매번: (1) 대기 없으면 보드 채우기, (2) 항상 보드 기준 C1~C5 첫 대기로 AUTO4_PROMPTS.md 갱신
./scripts/next-project-fill-board.sh

# 보드에서 C2~C5 첫 대기 수집해 표시
declare -a all_lines
while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  all_lines+=("$line")
done < <(awk -F'|' '
  BEGIN { in_table=0 }
  /## 현재 작업/ { in_table=1; next }
  in_table && /^\| Cursor 타입 / { next }
  in_table && /^\|[-| ]+$/ { next }
  in_table && /^\|/ {
    if ($0 ~ /color:red|진행 중|대기/) {
      gsub(/^ | $/,"",$3)
      t = tolower($3)
      if (t ~ /\[auth\]/)       tag = "C2"
      else if (t ~ /\[api\]|\[domain\]/)  tag = "C3"
      else if (t ~ /\[ui\]/)    tag = "C4"
      else if (t ~ /\[verify\]/) tag = "C5"
      else                      tag = "C1"
      print tag "|" $3
    }
  }
' "$BOARD")

first_c2="" first_c3="" first_c4="" first_c5=""
[[ ${#all_lines[@]} -gt 0 ]] && for line in "${all_lines[@]}"; do
  owner_tag="${line%%|*}"
  task_text="${line#*|}"
  task_text="$(echo "$task_text" | sed 's/^ *//;s/ *$//')"
  case "$owner_tag" in
    C2) [[ -z "$first_c2" ]] && first_c2="$task_text" ;;
    C3) [[ -z "$first_c3" ]] && first_c3="$task_text" ;;
    C4) [[ -z "$first_c4" ]] && first_c4="$task_text" ;;
    C5) [[ -z "$first_c5" ]] && first_c5="$task_text" ;;
  esac
done

n=0
[[ -n "$first_c2" ]] && { ((n++)); echo "  TASK $n: $first_c2 — Owner: C2 (AUTH)"; }
[[ -n "$first_c3" ]] && { ((n++)); echo "  TASK $n: $first_c3 — Owner: C3 (API/DOMAIN)"; }
[[ -n "$first_c4" ]] && { ((n++)); echo "  TASK $n: $first_c4 — Owner: C4 (UI)"; }
[[ -n "$first_c5" ]] && { ((n++)); echo "  TASK $n: $first_c5 — Owner: C5 (VERIFY)"; }
[[ $n -eq 0 ]] && echo "  (C2~C5 대기 없음. C1만 보드·AUTO4_PROMPTS 참고.)"

echo ""
echo "--- 각 Cursor에게 붙여 넣을 프롬프트 (docs/agent-runtime/AUTO4_PROMPTS.md) ---"
if [[ -f "$ROOT/docs/agent-runtime/AUTO4_PROMPTS.md" ]]; then
  cat "$ROOT/docs/agent-runtime/AUTO4_PROMPTS.md"
else
  echo "(파일 없음. next-project-fill-board.sh 실행 후 생성됨.)"
fi
echo "---"
echo "RESULT: AUTO 4 (매 실행 시 다음 할 일 선정 + C1~C5 명령문 생성)"

echo ""
echo "[4/5] Latest summary"
if [[ -f "$SUMMARY" ]]; then
  cat "$SUMMARY"
fi

echo ""
echo "[5/5] Done"
echo "AUTO AGENT LOOP COMPLETE"
