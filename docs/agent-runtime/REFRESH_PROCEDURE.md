# REFRESH 명령 절차 (C2~C6 각 **구현 우선순위 5줄**)

**정의**: 사용자가 **refresh** / **REFRESH** 라고 하면, 에이전트는 **C1 Commander 책임**으로 **(0)** 아래 **「C1 이중 의무」** 를 수행하고, **(1)** 서류 상태를 점검하며 **(2) 커서 C2·C3·C4·C5·C6에 대해 역할마다 `docs/CURSOR_TASK_BOARD.md`·백로그·스펙을 읽고 난 뒤, `docs/WORK_POLICY.md` 우선순위에 맞춰 **구현할 작업을 5줄씩**(총 25줄) 부여한다. **(3)** 응답 본문에 인라인하고 **(4)** `docs/SPRINT_LOG.md`·보드·**`docs/SPRINT_PLAN.md` 「C2~C6 할일」** 및 **「C1 Commander — REFRESH snapshot」** 에 반영한다.

### C1 이중 의무 (REFRESH = C1 자기 할 일 + C2~C6 서류 동시 갱신)

**REFRESH를 실행하는 에이전트는 C2~C6에게만 줄을 주고 끝내면 안 된다.** 같은 REFRESH 턴에서 다음 **둘 다** 한다.

| 의무 | 내용 |
|------|------|
| **① C1 자기 할 일** | `docs/CURSOR_TASK_BOARD.md` "이번 런" 표 **OWNER C1** 행 중 **`[ ]`** 가 있으면, **이번 턴에서 처리**한다: 범위·시간 내 완료 가능하면 **`[x]`** 로 닫고 `docs/CURRENT_TASK.md`·관련 DOCS에 반영. 한 턴에 끝나지 않으면 **`CURRENT_TASK.md` 상단**에 **다음 구체 액션**(어느 TASK, 무엇을 할지)을 남기고, **`SPRINT_PLAN` active의 「C1 Commander — REFRESH snapshot」** 잔여·블로커를 동기화한다. **C1 `[ ]`를 무시한 채 C2~C6만 갱신하면 REFRESH 절차 위반.** |
| **② C2~C6 큐** | 아래 2~4단계대로 **5줄×5역할**을 작성하고 **`docs/SPRINT_PLAN.md`「C2~C6 할일」**·`SPRINT_LOG`·보드 REFRESH 불릿에 **반드시** 기입한다. |

**권장 순서:** 1단계 점검 → **① C1 `[ ]` 1건 이상 진행 또는 다음 스텝 기록** → 2단계 C2~C6 5줄 → 4단계 서류 일괄 반영.

**REFRESH에서 하지 않는 것 (중요):** **배포 전 검증 루틴** — 전체 Release Gate 재실행, `self-healing-ci.sh`·`test:q237-smoke`를 **일상 REFRESH마다 돌리기**, `BTY_RELEASE_GATE_CHECK`를 **구현 큐처럼** 채우기 등은 **하지 않는다.** 그런 검증은 **배포 직전**에만 하며, 보드에 **C5 Gate / C6 VERIFY `[ ]`** 가 있을 때 해당 태스크로만 수행한다.

**목표:** **하루빨리 구현** — 검증·감사보다 **남은 `[ ]`·다음 기능·차단 이슈 해소**를 우선한다.

**보드와 충돌 금지:** **`docs/CURSOR_TASK_BOARD.md` "이번 런" 표**에서 해당 **OWNER 열에 `[ ]`가 하나도 없으면**, 1번 줄에 **「보드에 해당 OWNER `[ ]` 없음 → CONTINUE(구현) 중단. 다음은 새 이번 런」** 을 명시한다. 2~5번은 **다음 스프린트·백로그 후보**(비의무)로만 적는다.

**비협상**: **C2~C6 중 한 역할이라도 5줄 미만이면 REFRESH 미완료.** 또한 보드에 **C1 `[ ]`가 있는데** ① **처리·`[x]`·또는 `CURRENT_TASK` 다음 스텝** 없이 끝내면 **C1 의무 누락 = REFRESH 미완료.**

**현재 모드: 구현 단계.** C2~C6×5는 **코드 생성·기능 구현**을 우선한다. Gate·q237-smoke·self-healing-ci·엘리트 체크리스트 등 **검증 루틴**은 보드에 해당 `[ ]`가 있을 때만 그 태스크로 수행하며, **5줄을 검증만으로 채우지 않는다.**

**splint 10과 차이**: splint 10은 **TASK 1~10 한 표**. REFRESH는 **구현 우선순위 5줄 × 5역할 = 25줄**을 병렬 창에 맞춘다.

---

## 1단계: 이번 태스크 점검 (필수)

다음을 **읽고** 한 줄로 요약한다. (선택) repo 루트에서 **`bash scripts/check-parallel-task-queue.sh`** — **exit 2** 이면 요약에 **「병렬 큐 보충 필요 → PARALLEL_QUEUE_REFILL.md」** 포함.

| 문서 | 확인 |
|------|------|
| **docs/CURSOR_TASK_BOARD.md** | "이번 런" 표 TASK 1~10 — MODE(Foundry/Arena 등), **[ ] / [x]**, First Task 잠금 여부 |
| **docs/CURRENT_TASK.md** | 상단 근처 완료·진행 한 줄 |
| **docs/SPRINT_PLAN.md** | 현재 스프린트 번호, **BLOCKERS**, C2~C6 본문 열 |
| **docs/BTY_RELEASE_GATE_CHECK.md** | (배포·Gate **직후·C5/C6 태스크**일 때만) 최근 RESULT — **일상 REFRESH 필수 아님** |

**출력 예**: `이번 런: SPRINT 46 Foundry — 미완료 TASK 5·7·8·9·10. Arena: SPRINT 251, BLOCKER C5 TASK1만.`

---

## 2단계: C2~C6 각 **구현 우선순위 5줄** (필수)

아래 **형식 그대로** 응답 본문에 넣는다. **먼저 보드**에서 각 OWNER **`[ ]`** 를 읽고, **그 구현·PROMPT를 1번부터 우선순위**로 쓴다. **`[ ]`가 없으면** 1번에 **CONTINUE 중단**을 쓰고, 2~5는 **다음 스프린트·백로그에서 가져올 구현 후보**(비의무)만 적는다. **검증·감사·전체 Gate·스모크를 REFRESH 5줄로 채우지 않는다.**

### 역할별 기본 5줄 (보드에 `[ ]` 없을 때 — **구현 후보만**, 검증 아님)

| 역할 | 1 | 2 | 3 | 4 | 5 |
|------|---|---|---|---|---|
| **C2** | `IMPORT_BOUNDARY`·`bty-layer-import` 위반 후보 1건 **수정 또는 이슈** | 다음 배포 시만 Gate 문서 열람 (일상 검증 안 함) | API 계약·환경변수 깨질 곳 1곳 **구현/정리** | lib→app 역방향 import 차단 **1파일** | Auth 터치 시에만 쿠키 문서 동기 (배포 전) |
| **C3** | `NEXT_BACKLOG`·스펙에서 **Arena domain 규칙 1건 구현** 후보 | **`src/app/api`** Arena 핸들러와 맞출 **route·domain** 1건 | edges·barrel **테스트 추가 1건** (코드와 함께) | 스펙 대비 **누락 규칙 1건** 메모→구현 | 리팩터 후보 1건 (순수 함수 유지) |
| **C4** | 보드 **TASK4 `[ ]`** 있으면 그 **UI 접근성/라우트 구현** | 제외 목록 밖 **다음 화면 1곳** 구현 후보 | i18n 키·`aria` **누락 1건 채우기** | 터치 시 **Lint만** (전체 CI는 배포/Gate 때) | render-only 위반(규칙 계산) 제거 1곳 |
| **C5** | 보드 **C5 `[ ]`** 있으면 Gate/엘리트 **구현·VERIFY** (없으면 중단) | `CURRENT_TASK`·보드 동기 **한 줄** (문서) | 다음 Gate 번호·First 잠금 **메모** | Elite 화면 **데이터만** 표시 패치 1곳 후보 | (배포 전이 아니면) **Gate 전체 재실행 안 함** |
| **C6** | 보드 **TASK10 `[ ]`** 있을 때만 **q237·self-healing-ci** (VERIFY 태스크) | 그 외: **CI 빨간 테스트 1건 고치기** (구현 팀 unblock) | 플레이크·스킵 이슈 1건 | `SPRINT_LOG` 한 줄 (완료 시만) | 배포 전이 아니면 **전체 스모크 루틴을 REFRESH로 반복 안 함** |

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

1. **다른 커서(C2~C6)는 오직 `docs/SPRINT_PLAN.md`만 연다.** 이 파일만 보면 된다.  
2. **현재 active 스프린트** 안 **「C2~C6 할일 (REFRESH 시 갱신)」** 블록에서 **자기 역할(C2/C3/C4/C5/C6)의 1~5번**만 이번 창의 큐로 삼는다.  
3. **1번 완료 → 서류 [x]·CURRENT_TASK** 반영 후 2번 … 순서. **`BTY_RELEASE_GATE_CHECK` 갱신은 보드에 Gate/VERIFY `[ ]` 완료 시에만** (일상 REFRESH마다 아님).  
4. 보드 표의 OWNER(C1~C5)와 **동시에** 진행할 때는 **보드 First Task 규칙**(예: C5 Gate 먼저)을 우선하지 않고, **운영자가 연 REFRESH 배치**가 병렬 우선이면 **SPRINT_PLAN에 뿌린 1~5번**을 따른다. *(충돌 시: 운영자 지시 > 보드 First Task.)*

---

## 4단계: 서류 반영 (필수·권장)

| 서류 | 내용 |
|------|------|
| **docs/SPRINT_PLAN.md** | **필수.** **「C2~C6 할일」** 을 **구현 우선순위 5줄×5역할**로 갱신. **「C1 Commander — REFRESH snapshot」** 은 보드 C1 잔여·블로커·다음 스텝과 동기. (보드 `[ ]` → 그 PROMPT; 없으면 위 **구현 후보** 표.) **검증·Gate 루틴으로 채우지 않는다.** |
| **docs/CURSOR_TASK_BOARD.md** | "이번 런" 상단 불릿에 `[REFRESH YYYY-MM-DD]` 한 줄 — 요약 + **BLOCKER** 있으면 명시 + **C1 DOCS 진행/잔여** 한 줄 |
| **docs/CURRENT_TASK.md** | C1이 이번 REFRESH에서 처리한 DOCS **완료 한 줄** 또는 **다음 스텝 한 줄** (①과 연동) |
| **docs/SPRINT_LOG.md** | REFRESH 실행·요약 1줄 (C1 처리 + C2~C6 큐 갱신 요약) |

---

## 5단계: Cursor 규칙 연동

- **CONTINUE**: 여전히 보드 "이번 런" TASK 1~10이 단일 큐.  
- **REFRESH**: **C1** 은 **자기 보드 `[ ]`(DOCS)** 처리·기록 + **C2~C6** 각 5줄 큐를 **`docs/SPRINT_PLAN.md`** active **「C2~C6 할일」** 에 **기입**하고, 채팅·로그에도 부여. (C2~C6 커서는 **SPRINT_PLAN만** 본다.)  
- **bty-app** 워크스페이스: 동일 문서는 **`../docs/...`** 경로.

---

*참조: `docs/agent-runtime/SPLINT_10_PROCEDURE.md`, `docs/CURSOR_TASK_BOARD.md`, `docs/SPRINT_PLAN.md`*
