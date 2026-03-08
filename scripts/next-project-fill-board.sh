#!/usr/bin/env bash
# Auto 4 매번: (1) 대기 없으면 보드 채우기 (기본/NEXT_BACKLOG/폴백), (2) 항상 보드 기준 C1~C5 첫 대기로 AUTO4_PROMPTS.md 생성.
set -euo pipefail
export LC_ALL=en_US.UTF-8

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BOARD="$ROOT/docs/CURSOR_TASK_BOARD.md"
RUNTIME="$ROOT/docs/agent-runtime"
PROMPTS="$RUNTIME/AUTO4_PROMPTS.md"
NEXT_BACKLOG="$ROOT/docs/NEXT_BACKLOG_AUTO4.md"

mkdir -p "$RUNTIME"

# 다음 후보 기반 대기 행 (C2·C3·C4·C5 각 1건 이상 되도록 태그 포함)
# 형식: "Fix/Polish|할 일 한 줄(태그 포함)|비고"
DEFAULT_TASKS=(
  "Fix/Polish|[AUTH] 로그인·세션 문서 1줄 점검 (BTY_RELEASE_GATE_CHECK 반영)|다음 후보. C2."
  "Fix/Polish|[DOMAIN] 단위 테스트 1개 추가 (미커버 1모듈, 비즈니스/XP 미변경)|다음 후보. C3."
  "Fix/Polish|[UI] 로딩/스켈레톤 1곳 보강|다음 후보. C4."
  "Fix/Polish|[DOCS] 문서 점검 2~3건 (백로그 + Release Gate)|다음 후보. C1."
  "Fix/Polish|[VERIFY] Release Gate 체크리스트 1회 실행 후 서류 반영|다음 후보. C5."
)

# 보드에서 이미 완료된 "할 일" 텍스트(컬럼 2) 수집 — 동일 텍스트는 대기로 다시 넣지 않음
get_completed_descriptions() {
  awk -F'|' '
    /## 현재 작업/ { in_table=1; next }
    in_table && /^\| Cursor 타입 / { next }
    in_table && /^\|[-| ]+$/ { next }
    in_table && /^\|/ {
      if ($0 !~ /완료|color:blue/) next
      gsub(/^ *| *$/, "", $3)
      if ($3 != "") print $3
    }
  ' "$BOARD"
}

# 보드에서 이미 대기 중인 "할 일" 텍스트 수집 — 상태 컬럼($4)이 대기인 행만 (비고 "대기" 제외)
get_waiting_descriptions() {
  awk -F'|' '
    /## 현재 작업/ { in_table=1; next }
    in_table && /^\| Cursor 타입 / { next }
    in_table && /^\|[-| ]+$/ { next }
    in_table && /^\|/ {
      if ($4 !~ /color:red|대기|진행 중/) next
      gsub(/^ *| *$/, "", $3)
      if ($3 != "") print $3
    }
  ' "$BOARD"
}

# 이미 완료 또는 이미 대기인 할 일은 제외하고 넣을 대기 목록만 필터
filter_tasks_not_completed() {
  local skip_list
  skip_list=$(get_completed_descriptions; get_waiting_descriptions)
  local task
  for task in "${DEFAULT_TASKS[@]}"; do
    IFS='|' read -r _ desc _ <<< "$task"
    desc_trimmed=$(echo "$desc" | sed 's/^ *//;s/ *$//')
    if echo "$skip_list" | grep -qFx "$desc_trimmed"; then
      continue
    fi
    echo "$task"
  done
}

# docs/NEXT_BACKLOG_AUTO4.md 에서 "다음 배치 목록" 블록 파싱 — 한 줄이 "타입|할 일|비고"
load_next_backlog_tasks() {
  [[ ! -f "$NEXT_BACKLOG" ]] && return
  awk '
    /^```$/ { block++; next }
    block == 1 && /^(Fix\/Polish|Feature)\|/ { print; next }
  ' "$NEXT_BACKLOG"
}

# 후보 목록(한 줄씩 타입|할 일|비고)에서 이미 완료/대기 제외해 출력
filter_backlog_not_on_board() {
  local skip_list
  skip_list=$(get_completed_descriptions; get_waiting_descriptions)
  local line
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    if ! echo "$line" | grep -qE '^\s*(Fix/Polish|Feature)\|'; then
      continue
    fi
    IFS='|' read -r _ desc _ <<< "$line"
    desc_trimmed=$(echo "$desc" | sed 's/^ *//;s/ *$//')
    if echo "$skip_list" | grep -qFx "$desc_trimmed"; then
      continue
    fi
    echo "$line"
  done
}

# 보드 표에서 헤더 구분선 다음에 삽입할 새 행 추가 (TASKS_TO_ADD 사용)
insert_lines() {
  local sep='|-------------|----------------|------|------|'
  local first=1
  while IFS= read -r line; do
    if [[ "$line" == *"$sep"* ]] && [[ $first -eq 1 ]]; then
      echo "$line"
      for task in "${TASKS_TO_ADD[@]}"; do
        IFS='|' read -r type desc note <<< "$task"
        printf '| %s | %s | <span style="color:red">대기</span> | %s |\n' "$type" "$desc" "$note"
      done
      first=0
    else
      echo "$line"
    fi
  done < "$BOARD"
}

# NEXT_BACKLOG_AUTO4.md에서 차수(N차)를 1 올려 다음 배치로 전환. 성공 시 0.
advance_next_backlog() {
  [[ ! -f "$NEXT_BACKLOG" ]] && return 1
  local round batch
  round=$(grep -oE '\([0-9]+차\)' "$NEXT_BACKLOG" | head -1 | grep -oE '[0-9]+')
  batch=$(grep -oE '— [0-9]+차 신규' "$NEXT_BACKLOG" | head -1 | grep -oE '[0-9]+')
  [[ -z "$round" ]] && return 1
  local next_round=$((round + 1))
  local next_batch=$(( (${batch:-0}) + 1 ))
  if [[ "$(uname -s)" == "Darwin" ]]; then
    sed -i.bak -e "s/(${round}차)/(${next_round}차)/g" "$NEXT_BACKLOG" 2>/dev/null || true
    [[ -n "$batch" ]] && sed -i.bak -e "s/— ${batch}차 신규/— ${next_batch}차 신규/g" "$NEXT_BACKLOG" 2>/dev/null || true
  else
    sed -i -e "s/(${round}차)/(${next_round}차)/g" "$NEXT_BACKLOG" 2>/dev/null || true
    [[ -n "$batch" ]] && sed -i -e "s/— ${batch}차 신규/— ${next_batch}차 신규/g" "$NEXT_BACKLOG" 2>/dev/null || true
  fi
  rm -f "${NEXT_BACKLOG}.bak"
  echo "BOARD_FILL: 대기 없음 → NEXT_BACKLOG_AUTO4 차수 ${round}차 → ${next_round}차로 자동 전환. 보드에 새 할 일 추가."
  return 0
}

# 기존 보드에 C2/C3/C4/C5 배정 가능한 대기 행이 있는지 확인 (상태 컬럼 $4만 봄 — 비고에 "대기" 있으면 제외)
has_assignable_waiting() {
  awk -F'|' '
    BEGIN { in_table=0; count=0 }
    /## 현재 작업/ { in_table=1; next }
    in_table && /^\| Cursor 타입 / { next }
    in_table && /^\|[-| ]+$/ { next }
    in_table && /^\|/ {
      if ($4 ~ /color:red|대기|진행 중/) {
        t = tolower($0)
        if (t ~ /\[auth\]/ || t ~ /\[api\]|\[domain\]/ || t ~ /\[ui\]/ || t ~ /\[verify\]/) count++
      }
    }
    END { exit (count > 0 ? 0 : 1) }
  ' "$BOARD"
}

if has_assignable_waiting 2>/dev/null; then
  echo "BOARD_FILL: 대기 작업 있음. 보드 추가 생략. 아래에서 현재 대기 기준으로 AUTO4_PROMPTS 갱신."
else
  TASKS_TO_ADD=()
  while IFS= read -r task; do
    [[ -n "$task" ]] && TASKS_TO_ADD+=("$task")
  done < <(filter_tasks_not_completed)

  FILL_SOURCE="기본 후보"
  # 기본 5건이 모두 완료/대기면 → NEXT_BACKLOG_AUTO4.md에서 다음 배치 추가
  if [[ ${#TASKS_TO_ADD[@]} -eq 0 ]] && [[ -f "$NEXT_BACKLOG" ]]; then
    while IFS= read -r task; do
      [[ -n "$task" ]] && TASKS_TO_ADD+=("$task")
    done < <(load_next_backlog_tasks | filter_backlog_not_on_board)
    FILL_SOURCE="NEXT_BACKLOG_AUTO4"
  fi

  # 그래도 없으면 → 할 일 없을 때 다음 프로젝트로 바로 넘어감: NEXT_BACKLOG 차수 자동 전환 후 새 할 일 보드에 추가
  if [[ ${#TASKS_TO_ADD[@]} -eq 0 ]] && [[ -f "$NEXT_BACKLOG" ]]; then
    if advance_next_backlog; then
      TASKS_TO_ADD=()
      while IFS= read -r task; do
        [[ -n "$task" ]] && TASKS_TO_ADD+=("$task")
      done < <(load_next_backlog_tasks | filter_backlog_not_on_board)
      FILL_SOURCE="NEXT_BACKLOG_AUTO4(자동 전환)"
    fi
  fi

  # 자동 전환 후에도 없으면 → [DOCS] "다음 배치 선정" 1건 폴백 (NEXT_BACKLOG에 차수 패턴이 없을 때 등)
  if [[ ${#TASKS_TO_ADD[@]} -eq 0 ]]; then
    fallback_desc="[DOCS] 다음 배치 선정: NEXT_PROJECT_RECOMMENDED·로드맵 기준 다음 작업을 NEXT_BACKLOG_AUTO4.md에 갱신 후 보드 반영"
    waiting_now=$(get_waiting_descriptions)
    if ! echo "$waiting_now" | grep -qFx "$fallback_desc"; then
      TASKS_TO_ADD=(
        "Fix/Polish|${fallback_desc}|대기 0건 시 폴백. C1이 NEXT_BACKLOG 갱신 후 보드에 새 대기 추가."
      )
      FILL_SOURCE="다음 배치 선정(폴백)"
      echo "BOARD_FILL: 대기 없음·자동 전환 실패 → [DOCS] 다음 배치 선정 1건 대기로 추가."
    else
      echo "BOARD_FILL: 대기 없음. [DOCS] 다음 배치 선정이 이미 대기 중 → 추가 생략."
    fi
  fi

if [[ ${#TASKS_TO_ADD[@]} -gt 0 ]]; then
  echo "BOARD_FILL: C2/C3/C4/C5 배정 가능한 대기 없음 → ${FILL_SOURCE:-기본 후보} 기준 ${#TASKS_TO_ADD[@]}건 대기 행 추가."
  insert_lines > "${BOARD}.tmp" && mv "${BOARD}.tmp" "$BOARD"
fi
fi

# 태그별 "첫 대기" 선택: 상태 컬럼($4)이 대기/진행 중인 행만 보고, 이미 완료된 할 일($3)과 동일한 건 제외
get_first_by_tag() {
  local want="$1"
  awk -F'|' -v want="$want" '
    FNR==1 { pass++; if (pass==2) in_table=0; next }
    pass==1 {
      if (/## 현재 작업/) { in_table=1; next }
      if (!in_table) next
      if (/^\| Cursor 타입 / || /^\|[-| ]+$/) next
      if (/^\|/ && $4 ~ /완료|color:blue/) { gsub(/^ *| *$/, "", $3); if ($3 != "") done[$3]=1 }
      next
    }
    pass==2 && /## 현재 작업/ { in_table=1; next }
    pass==2 && in_table && /^\| Cursor 타입 / { next }
    pass==2 && in_table && /^\|[-| ]+$/ { next }
    pass==2 && in_table && /^\|/ {
      if ($4 !~ /color:red|대기|진행 중/) next
      t = tolower($0)
      if (t ~ /\[auth\]/)       tag = "C2"
      else if (t ~ /\[api\]|\[domain\]/)  tag = "C3"
      else if (t ~ /\[ui\]/)    tag = "C4"
      else if (t ~ /\[verify\]/) tag = "C5"
      else                      tag = "C1"
      if (tag != want) next
      gsub(/^ *| *$/, "", $3)
      if ($3 in done) next
      print $3
      exit
    }
  ' "$BOARD" "$BOARD"
}

first_c1="$(get_first_by_tag C1)"
first_c2="$(get_first_by_tag C2)"
first_c3="$(get_first_by_tag C3)"
first_c4="$(get_first_by_tag C4)"
first_c5="$(get_first_by_tag C5)"

# 폴백: 태그별 대기가 있는데 get_first_by_tag가 비어 있으면 대기 목록에서 해당 태그 첫 줄 사용
fallback_by_tag() {
  local want="$1"
  local pat=""
  case "$want" in C1) pat="\[DOCS\]" ;; C2) pat="\[AUTH\]" ;; C3) pat="\[API\]|\[DOMAIN\]" ;; C4) pat="\[UI\]" ;; C5) pat="\[VERIFY\]" ;; *) return ;; esac
  get_waiting_descriptions | grep -E "$pat" | head -1 || true
}
[[ -z "$first_c1" ]] && first_c1="$(fallback_by_tag C1)"
[[ -z "$first_c2" ]] && first_c2="$(fallback_by_tag C2)"
[[ -z "$first_c3" ]] && first_c3="$(fallback_by_tag C3)"
[[ -z "$first_c4" ]] && first_c4="$(fallback_by_tag C4)"
[[ -z "$first_c5" ]] && first_c5="$(fallback_by_tag C5)"

# 대기 없을 때 C2~C5: 같은 기본 할 일 반복 대신 "해당 없음" 문구 사용
set_c_prompt() {
  local var="$1" label="$2"
  if [[ -z "${!var}" ]]; then
    printf -v "$var" '[%s] 보드 대기 없음. 해당 없음 Exit.' "$label"
  fi
}
set_c_prompt first_c1 "C1"
set_c_prompt first_c2 "C2(AUTH)"
set_c_prompt first_c3 "C3(Domain/API)"
set_c_prompt first_c4 "C4(UI)"
set_c_prompt first_c5 "C5(VERIFY)"

# C1만 실제 할 일이 있으면 완료 지시문, 없으면 Exit 안내
c1_footer="**완료 시 반드시**: (1) docs/CURSOR_TASK_BOARD.md에서 해당 행 상태를 대기 → 완료, 비고 한 줄 (2) docs/CURRENT_TASK.md에 완료 1줄 추가 (3) 끝나면 \"작업 완료. 보드·CURRENT_TASK 반영했습니다.\"라고 해줘."
if [[ "$first_c1" == *"대기 없음"* ]]; then
  c1_footer="**완료 시**: 작업·보드 갱신 없이 종료."
fi
default_footer="**완료 시 반드시**: (1) 보드 해당 행 완료·비고 (2) docs/CURRENT_TASK.md 완료 1줄 (3) \"작업 완료. 보드·CURRENT_TASK 반영했습니다.\""
exit_footer="**완료 시**: 작업·보드 갱신 없이 종료."
c2_footer="$default_footer"; [[ "$first_c2" == *"대기 없음"* ]] && c2_footer="$exit_footer"
c3_footer="$default_footer"; [[ "$first_c3" == *"대기 없음"* ]] && c3_footer="$exit_footer"
c4_footer="$default_footer"; [[ "$first_c4" == *"대기 없음"* ]] && c4_footer="$exit_footer"
c5_footer="$default_footer"; [[ "$first_c5" == *"대기 없음"* ]] && c5_footer="$exit_footer"

# AUTO4_PROMPTS.md 생성 (매번 실행 시 보드 기준 C1~C5 첫 대기로 갱신)
# C1~C5는 복사용 문장만 노출(코드블록 없음) — 그대로 복사해 붙여넣기 가능
cat > "$PROMPTS" << PROMPTS_EOF
# Auto 4 — 각 Cursor에게 붙여 넣을 프롬프트

**생성 시점**: 매 실행 시 보드(및 로드맵) 기준 **다음 할 일**을 정한 뒤 생성됨.  
**사용법**: 아래 C1~C5 중 해당 Cursor에 **복사용 문장**을 그대로 복사해 붙여 넣기. 할 일이 "대기 없음"이면 작업 없이 종료. 할 일이 있으면 완료 시 보드 해당 행 **완료** + \`docs/CURRENT_TASK.md\` 완료 1줄 추가 후 **「작업 완료. 보드·CURRENT_TASK 반영했습니다.»** 라고 하면 됨.

---

## C1 (Commander / 문서)

**복사용 (아래 문장 전체를 그대로 복사):**

다음 작업 해줘.

**할 일**: $first_c1

$c1_footer

---

## C2 (Gatekeeper / AUTH)

**복사용 (아래 문장 전체를 그대로 복사):**

다음 작업 해줘.

**할 일**: $first_c2

$c2_footer

---

## C3 (Domain/API)

**복사용 (아래 문장 전체를 그대로 복사):**

다음 작업 해줘.

**할 일**: $first_c3

$c3_footer

---

## C4 (UI)

**복사용 (아래 문장 전체를 그대로 복사):**

다음 작업 해줘.

**할 일**: $first_c4

$c4_footer

---

## C5 (VERIFY)

**복사용 (아래 문장 전체를 그대로 복사):**

다음 작업 해줘.

**할 일**: $first_c5

$c5_footer

---

*출처: scripts/next-project-fill-board.sh — docs/NEXT_PHASE_AUTO4.md 다음 후보·NEXT_PROJECT_RECOMMENDED.md 기준.*
PROMPTS_EOF

echo "BOARD_FILL: AUTO4_PROMPTS.md 작성 완료 (매번 보드 기준 다음 할 일 반영) → $PROMPTS"
