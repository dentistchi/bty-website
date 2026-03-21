# 다음 배치 (Auto 4 — 기본 5건 완료 시 보드에 추가할 후보)

**목적**: `scripts/next-project-fill-board.sh`가 여기서 다음 작업을 읽어 보드에 추가한다.  
**기준**: `docs/NEXT_PROJECT_RECOMMENDED.md` §1·§2.  
**갱신일**: 2026-03-21 — 보드 **SPRINT 147** (TASK **1~10**) · **`SPRINT_PLAN` 353** · **MODE ARENA** · **Gate 147** **`[ ]`** · **First** **C5 TASK1** · **S146** 잔여 흡수 · **S104** 미완 **TASK14·15** 참고.

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

## 다음 배치 목록 — **SPRINT 147** (진행 중)

```
Fix/Polish|[VERIFY] C5 Gate 147 A~F|C5. S147 TASK1 [ ].
Fix/Polish|[DOCS] C1 NEXT_PHASE·BACKLOG S147/353|C1. S147 TASK2 [x].
Fix/Polish|[DOCS] C1 221·222차|C1. S147 TASK3 [ ].
Fix/Polish|[DOCS] C1 다음 배치 S148/354|C1. S147 TASK5 [ ].
Fix/Polish|[DOMAIN] C3 arenaMissionChoiceShapeFromUnknown|C3. S147 TASK8 [x].
Fix/Polish|[UI] C4 bty-arena play a11y|C4. S147 TASK4 [ ].
Fix/Polish|[VERIFY] C6 q237 + self-healing-ci|C6. S147 TASK10 [ ].
Fix/Polish|[VERIFY] C5 Elite §3|C5. S147 TASK6 [ ].
Fix/Polish|[TEST] C3 POST /api/arena/membership-request|C3. S147 TASK9 [x].
```

---

## S148 예고 (`splint 10` · 이번 런 **전량 [x]** 후)

`CURSOR_TASK_BOARD` **SPRINT 148** 오픈 시 **`SPRINT_PLAN` 354** 과 동기. 후보 시드(복사용):

```
Fix/Polish|[VERIFY] C5 Gate 148 A~F|C5. S148 TASK1 [ ].
Fix/Polish|[DOCS] C1 NEXT_PHASE·BACKLOG S148/354|C1. S148 TASK2 [ ].
Fix/Polish|[DOMAIN] C3 Arena *FromUnknown|C3. S148 TASK8 [ ].
Fix/Polish|[UI] C4 Arena a11y|C4. S148 TASK4 [ ].
Fix/Polish|[VERIFY] C6 q237 + self-healing-ci|C6. S148 TASK10 [ ].
```

---

## 이전 스프린트 후보 보관

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
