# REFRESH 명령 절차 (C2~C6 각 5작업)

**정의**: 사용자가 **refresh** / **REFRESH** 라고 하면, 에이전트는 **(1) 이번 태스크·서류 상태를 점검**하고 **(2) C2·C3·C4·C5·C6에 대해 각각 구체 작업 5개**를 만들어 **(3) 응답 본문에 인라인**으로 붙이고, 가능하면 **보드·로그에 한 줄 반영**한다.  
**목적**: 커서 5창(C2~C6)이 **같은 서류**(`CURSOR_TASK_BOARD.md`, `CURRENT_TASK.md`, `SPRINT_PLAN.md`)를 읽은 뒤 **자기 열(Cn)의 TASK 1~5**만 순서대로 진행하게 한다.

**splint 10과 차이**: splint 10은 **TASK 1~10 한 표** + C1~C5 복사 문장 중심. REFRESH는 **역할별 5개씩(총 25줄)** 을 **역할 단위로 쪼개** 병렬 창에 맞춘다.

---

## 1단계: 이번 태스크 점검 (필수)

다음을 **읽고** 한 줄로 요약한다. (선택) repo 루트에서 **`bash scripts/check-parallel-task-queue.sh`** — **exit 2** 이면 요약에 **「병렬 큐 보충 필요 → PARALLEL_QUEUE_REFILL.md」** 포함.

| 문서 | 확인 |
|------|------|
| **docs/CURSOR_TASK_BOARD.md** | "이번 런" 표 TASK 1~10 — MODE(Foundry/Arena 등), **[ ] / [x]**, First Task 잠금 여부 |
| **docs/CURRENT_TASK.md** | 상단 근처 완료·진행 한 줄 |
| **docs/SPRINT_PLAN.md** | 현재 스프린트 번호, **BLOCKERS**, C2~C6 본문 열 |
| **docs/BTY_RELEASE_GATE_CHECK.md** | (배포·Gate 직후면) 최근 RESULT 한 줄 |

**출력 예**: `이번 런: SPRINT 46 Foundry — 미완료 TASK 5·7·8·9·10. Arena: SPRINT 251, BLOCKER C5 TASK1만.`

---

## 2단계: C2~C6 각 작업 5개 (필수)

아래 **형식 그대로** 응답 본문에 넣는다. 내용은 **1단계 결과**와 `SPRINT_PLAN`·백로그·보드 **[ ]** 행에서만 뽑는다. **추측으로 빈 작업 채우지 않음** — 없으면 `대기: C1 splint 또는 BLOCKER 해소 후 재REFRESH`.

### C2 (Gatekeeper / 배포·계약·import)

1. …  
2. …  
3. …  
4. …  
5. …  

### C3 (Domain / 순수 규칙·테스트)

1. …  
2. …  
3. …  
4. …  
5. …  

### C4 (API / service·route)

1. …  
2. …  
3. …  
4. …  
5. …  

### C5 (UI / render-only)

1. …  
2. …  
3. …  
4. …  
5. …  

### C6 (VERIFY / smoke·통합·Gate)

1. …  
2. …  
3. …  
4. …  
5. …  

**표로 한 번에 보여줄 때 (복사용)**:

| # | C2 | C3 | C4 | C5 | C6 |
|---|----|----|----|----|-----|
| 1 | | | | | |
| 2 | | | | | |
| 3 | | | | | |
| 4 | | | | | |
| 5 | | | | | |

---

## 3단계: 각 커서(C2~C6) 행동 규칙

1. **docs/CURSOR_TASK_BOARD.md** "이번 런" + **docs/CURRENT_TASK.md** + **docs/SPRINT_PLAN.md** 를 연다.  
2. **REFRESH 응답에 적힌 자기 섹션(Cn)의 1~5번**만 이번 창의 큐로 삼는다.  
3. **1번 완료 → 서류 [x]·CURRENT_TASK·필요 시 BTY_RELEASE_GATE_CHECK** 반영 후 2번 … 순서.  
4. 보드 표의 OWNER(C1~C5)와 **동시에** 진행할 때는 **보드 First Task 규칙**(예: C5 Gate 먼저)을 우선하지 않고, **운영자가 연 REFRESH 배치**가 병렬 우선이면 REFRESH 열을 따른다. *(충돌 시: 운영자 지시 > 보드 First Task.)*

---

## 4단계: 서류 반영 (권장)

| 서류 | 내용 |
|------|------|
| **docs/CURSOR_TASK_BOARD.md** | "이번 런" 상단 불릿에 `[REFRESH YYYY-MM-DD]` 한 줄 — 요약 + **BLOCKER** 있으면 명시 |
| **docs/SPRINT_LOG.md** | REFRESH 실행·요약 1줄 |

---

## 5단계: Cursor 규칙 연동

- **CONTINUE**: 여전히 보드 "이번 런" TASK 1~10이 단일 큐.  
- **REFRESH**: **추가로** C2~C6 각 5줄 큐를 **채팅·로그**에 부여.  
- **bty-app** 워크스페이스: 동일 문서는 **`../docs/...`** 경로.

---

*참조: `docs/agent-runtime/SPLINT_10_PROCEDURE.md`, `docs/CURSOR_TASK_BOARD.md`, `docs/SPRINT_PLAN.md`*
