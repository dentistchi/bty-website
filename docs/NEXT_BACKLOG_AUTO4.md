# 다음 배치 (Auto 4 — 기본 5건 완료 시 보드에 추가할 후보)

**목적**: `scripts/next-project-fill-board.sh`가 여기서 다음 작업을 읽어 보드에 추가한다.  
**기준**: `docs/NEXT_PROJECT_RECOMMENDED.md` §1·§2.  
**갱신일**: 2026-03-21 — 보드 **SPRINT 154** (TASK **1~10**) · **`SPRINT_PLAN` 360** · **MODE ARENA** · **Gate 154** **`[ ]`** · **First** **C5 TASK1** · **S153** `PARALLEL_QUEUE_REFILL` · **S104** 미완 **TASK14·15** 참고.

---

## MASTER PLAN 연결

```text
MASTER_PLAN  →  NEXT_BACKLOG_AUTO4  →  CURSOR_TASK_BOARD
```

---

## 작업 행 형식

- **타입**: `Fix/Polish` 또는 `Feature`
- **할 일**: `[AUTH]`, `[API]`, `[DOMAIN]`, `[UI]`, `[DOCS]`, `[VERIFY]` 중 하나 포함.

---

## 다음 배치 목록 — **SPRINT 154** (진행 중)

```
Fix/Polish|[VERIFY] C5 Gate 154 A~F|C5. S154 TASK1 [ ].
Fix/Polish|[DOCS] C1 NEXT_PHASE·BACKLOG S154/360|C1. S154 TASK2 [ ].
Fix/Polish|[DOCS] C1 227·228차|C1. S154 TASK3 [ ].
Fix/Polish|[DOCS] C1 다음 배치 S155/361|C1. S154 TASK5 [ ].
Fix/Polish|[DOMAIN] C3 arenaScenarioIdFromUnknown|C3. S154 TASK8 [ ].
Fix/Polish|[UI] C4 bty-arena play a11y|C4. S154 TASK4 [ ].
Fix/Polish|[VERIFY] C6 q237 + self-healing-ci|C6. S154 TASK10 [ ].
Fix/Polish|[VERIFY] C5 Elite §3|C5. S154 TASK6 [ ].
Fix/Polish|[TEST] C3 POST /api/arena/sub-name scenarioOutcomes bigint|C3. S154 TASK9 [ ].
```

---

## S155 예고 (`splint 10` · 이번 런 **전량 [x]** 후)

`CURSOR_TASK_BOARD` **SPRINT 155** 오픈 시 **`SPRINT_PLAN` 361** 과 동기. 후보 시드(복사용):

```
Fix/Polish|[VERIFY] C5 Gate 155 A~F|C5. S155 TASK1 [ ].
Fix/Polish|[DOCS] C1 NEXT_PHASE·BACKLOG S155/361|C1. S155 TASK2 [ ].
Fix/Polish|[DOMAIN] C3 Arena *FromUnknown|C3. S155 TASK8 [ ].
Fix/Polish|[UI] C4 Arena a11y|C4. S155 TASK4 [ ].
Fix/Polish|[VERIFY] C6 q237 + self-healing-ci|C6. S155 TASK10 [ ].
```

---

## 이전 스프린트 후보 보관

- S153 마감 **큐 보충** → S154 오픈 — **`SPRINT_LOG`** · **`CURSOR_TASK_BOARD`** 아카이브.
- S152 마감 **큐 보충** → S153 오픈 — **`SPRINT_LOG`** · **`CURSOR_TASK_BOARD`** 아카이브.
- S151 마감 **큐 보충** → S152 오픈 — **`SPRINT_LOG`** · **`CURSOR_TASK_BOARD`** 아카이브.
- S150 마감 **큐 보충** → S151 오픈 — **`SPRINT_LOG`** · **`CURSOR_TASK_BOARD`** 아카이브.
- S149 마감 **큐 보충** → S150 오픈 — **`SPRINT_LOG`** · **`CURSOR_TASK_BOARD`** 아카이브.
- S148 마감 **큐 보충** → S149 오픈 — **`SPRINT_LOG`** · **`CURSOR_TASK_BOARD`** 아카이브.
- S147 마감 **큐 보충** → S148 오픈 — **`SPRINT_LOG`** · **`CURSOR_TASK_BOARD`** 아카이브.
- S146 마감 **큐 보충** → S147 오픈 — **`SPRINT_LOG`** · **`CURSOR_TASK_BOARD`** 아카이브.
- S145 마감 **큐 보충** → S146 오픈 — **`SPRINT_LOG`** · **`CURSOR_TASK_BOARD`** 아카이브.
- S144 마감 **큐 보충** → S145 오픈 — **`SPRINT_LOG`** · **`CURSOR_TASK_BOARD`** 아카이브.
- S143 마감 **큐 보충** → S144 오픈 — **`SPRINT_LOG`** · **`CURSOR_TASK_BOARD`** 아카이브.
- S142 마감 **큐 보충** → S143 오픈 — **`SPRINT_LOG`** · **`CURSOR_TASK_BOARD`** 아카이브.
- S141 마감 **큐 보충** → S142 오픈 — **`SPRINT_LOG`** · **`CURSOR_TASK_BOARD`** 아카이브.
- S140 마감 **큐 보충** → S141 오픈 — **`SPRINT_LOG`** · **`CURSOR_TASK_BOARD`** 아카이브.
- S139 마감 **큐 보충** → S140 오픈.
- S138 마감 **큐 보충** → S139 오픈.

---

## S104 백로그 (참고)

- **TASK14·15**: `NEXT_PROJECT_RECOMMENDED` · 보드 **C3/C4** 시드와 중복 시 한 줄로 합침.
