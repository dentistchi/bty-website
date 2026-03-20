# 다른 컴퓨터·다른 Cursor용 — REFRESH / 병렬 큐 프롬프트

**용도:** 이 저장소를 클론한 **다른 PC**에서 Cursor에게 **같은 운영 방식**으로 일하게 할 때, 아래 **「복사 블록」** 을 새 채팅에 그대로 붙여 넣는다.

**단일 진실:** 루트 `docs/CURSOR_TASK_BOARD.md` 의 **「이번 런」** 표. (bty-app만 열면 `../docs/CURSOR_TASK_BOARD.md`.)

---

## 복사 블록 (이 아래부터 끝까지)

```
너는 이 repo의 C1 Commander 역할로 동작한다. 사용자가 "refresh" 또는 "REFRESH" 또는 "다른 커서 할 일 없음"이라고 하면 아래를 **한 턴 안에서** 수행한다.

## 필수 절차 (순서)
1. **읽기:** `docs/CURSOR_TASK_BOARD.md` "이번 런" TASK 1~10 표 · `docs/CURRENT_TASK.md` 상단 · active `docs/SPRINT_PLAN.md` (보통 맨 위 스프린트 섹션).
2. **병렬 큐 점검:** repo 루트에서 `bash scripts/check-parallel-task-queue.sh` 실행.
   - **exit 2** 이면: `docs/agent-runtime/PARALLEL_QUEUE_REFILL.md` **§3** 대로 **새 이번 런**(표 전부 `[ ]`)을 연다 — 현재 런은 아카이브로 내리고, 보드·`SPRINT_PLAN`·`docs/agent-runtime/AUTO4_PROMPTS.md`·`docs/NEXT_BACKLOG_AUTO4.md`·`docs/SPRINT_LOG.md`·`docs/CURRENT_TASK.md`·(있으면) `bty-app/docs/AI_TASK_BOARD.md` 까지 동기. First Task 관행: **C5 TASK1 (Release Gate)**.
   - **exit 0** 이면: refill 생략.
3. **C1 이중 의무 (`docs/agent-runtime/REFRESH_PROCEDURE.md` § C1 이중 의무):**
   - 보드 **OWNER C1** 행 **`[ ]`**(주로 DOCS)를 이번 턴에서 **진행·`[x]`** 하거나, 불가하면 **`docs/CURRENT_TASK.md` 상단**에 **다음 구체 스텝**을 남긴다. **C2~C6만 갱신하고 C1을 무시하면 안 된다.**
4. **C2~C6 큐:** `docs/SPRINT_PLAN.md` 의 **「C2~C6 할일」** 블록을 **구현 우선순위 5줄 × 5역할**로 갱신한다. 보드에 해당 OWNER **`[ ]`** 가 있으면 그 PROMPT를 1번에 둔다. 없으면 1번에 **CONTINUE 중단**을 명시하고 2~5는 백로그 후보만.
5. **REFRESH에서 하지 않는 것:** 일상마다 전체 Release Gate 재실행, `self-healing-ci`·`test:q237-smoke`를 "REFRESH 루틴"으로 매번 돌리기 — **하지 않는다.** (보드에 C5 Gate / C6 VERIFY `[ ]` 가 있을 때만 해당 태스크로 수행.)
6. **응답:** 채팅에 (a) 1단계 한 줄 요약 (b) C2~C6 표 또는 5줄씩 (c) 서류에 쓴 파일 경로 목록.

## 금지
- `SPRINT_PLAN`만 보고 보드 `[ ]`를 추측하지 말 것.
- Arena/Center/Foundry **시스템 경계** 위반 수정 금지 (`docs/architecture/DOMAIN_LAYER_TARGET_MAP.md` 준수).

작업 시작해. 먼저 보드 "이번 런" 표와 `check-parallel-task-queue.sh` 결과부터.
```

---

## 짧은 버전 (응급)

```
REFRESH 실행: REFRESH_PROCEDURE.md + 보드 이번 런 표. `bash scripts/check-parallel-task-queue.sh` → exit 2면 PARALLEL_QUEUE_REFILL.md §3로 새 런 오픈. C1 DOCS `[ ]` 처리와 C2~C6 SPRINT_PLAN「할일」동시 갱신. 배포 전 전체 Gate/스모크는 REFRESH마다 돌리지 말 것.
```

*참조: `docs/agent-runtime/REFRESH_PROCEDURE.md`, `docs/agent-runtime/HOW_TO_READ_TASKS.md`*
