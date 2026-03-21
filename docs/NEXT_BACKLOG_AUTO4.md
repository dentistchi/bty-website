# 다음 배치 (Auto 4 — 기본 5건 완료 시 보드에 추가할 후보)

**목적**: `scripts/next-project-fill-board.sh`가 여기서 다음 작업을 읽어 보드에 추가한다.  
**기준**: `docs/NEXT_PROJECT_RECOMMENDED.md` §1·§2.  
**갱신일**: 2026-03-21 — 보드 **SPRINT 151** (TASK **1~10**) · **`SPRINT_PLAN` 357** · **MODE ARENA** · **Gate 151** **`[x]`** · **C5** TASK1·6 **`[x]`** · **First** C1 **TASK5** · **S150** 잔여 흡수 · **S104** 미완 **TASK14·15** 참고.

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

## 다음 배치 목록 — **SPRINT 151** (진행 중)

```
Fix/Polish|[VERIFY] C5 Gate 151 A~F|C5. S151 TASK1 [x].
Fix/Polish|[DOCS] C1 NEXT_PHASE·BACKLOG S151/357|C1. S151 TASK2 [x].
Fix/Polish|[DOCS] C1 223·224차|C1. S151 TASK3 [x].
Fix/Polish|[DOCS] C1 다음 배치 S152/358|C1. S151 TASK5 [ ].
Fix/Polish|[DOMAIN] C3 arenaScenarioIdFromUnknown|C3. S151 TASK8 [x].
Fix/Polish|[UI] C4 bty-arena wireframe a11y|C4. S151 TASK4 [x].
Fix/Polish|[VERIFY] C6 q237 + self-healing-ci|C6. S151 TASK10 [x].
Fix/Polish|[VERIFY] C5 Elite §3|C5. S151 TASK6 [x].
Fix/Polish|[TEST] C3 POST /api/arena/beginner-complete runId bigint|C3. S151 TASK9 [x].
```

---

## S152 예고 (`splint 10` · 이번 런 **전량 [x]** 후)

`CURSOR_TASK_BOARD` **SPRINT 152** 오픈 시 **`SPRINT_PLAN` 358** 과 동기. 후보 시드(복사용):

```
Fix/Polish|[VERIFY] C5 Gate 152 A~F|C5. S152 TASK1 [ ].
Fix/Polish|[DOCS] C1 NEXT_PHASE·BACKLOG S152/358|C1. S152 TASK2 [ ].
Fix/Polish|[DOMAIN] C3 Arena *FromUnknown|C3. S152 TASK8 [ ].
Fix/Polish|[UI] C4 Arena a11y|C4. S152 TASK4 [ ].
Fix/Polish|[VERIFY] C6 q237 + self-healing-ci|C6. S152 TASK10 [ ].
```

---

## 이전 스프린트 후보 보관

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
