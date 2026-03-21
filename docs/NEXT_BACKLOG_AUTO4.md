# 다음 배치 (Auto 4 — 기본 5건 완료 시 보드에 추가할 후보)

**목적**: `scripts/next-project-fill-board.sh`가 여기서 다음 작업을 읽어 보드에 추가한다.  
**기준**: `docs/NEXT_PROJECT_RECOMMENDED.md` §1·§2.  
**갱신일**: 2026-03-21 — 보드 **SPRINT 137** (TASK **1~10**) · **`SPRINT_PLAN` 343** · **Gate 137** **`[ ]`** · **First** **C5 TASK1** · **S136** 잔여 흡수 · **S104** 미완 **TASK14·15** 참고.

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

## 다음 배치 목록 — **SPRINT 137** (진행 중)

```
Fix/Polish|[VERIFY] C5 Gate 137 A~F|C5. S137 TASK1 [ ].
Fix/Polish|[DOCS] C1 NEXT_PHASE·BACKLOG S137/343|C1. S137 TASK2 [ ].
Fix/Polish|[DOCS] C1 221·222차|C1. S137 TASK3 [ ].
Fix/Polish|[DOCS] C1 다음 배치 S138/344|C1. S137 TASK5 [ ].
Fix/Polish|[DOMAIN] C3 arenaOutcomeMetaFromUnknown|C3. S137 TASK8 [ ].
Fix/Polish|[UI] C4 dojo loading|C4. S137 TASK4 [ ].
Fix/Polish|[VERIFY] C6 q237 + self-healing-ci|C6. S137 TASK10 [ ].
Fix/Polish|[VERIFY] C5 Elite §3|C5. S137 TASK6 [ ].
Fix/Polish|[TEST] C3 POST /api/arena/membership-request submitted_at|C3. S137 TASK9 [ ].
```

---

## S138 예고 (`splint 10` · 이번 런 **전량 [x]** 후)

`CURSOR_TASK_BOARD` **SPRINT 138** 오픈 시 **`SPRINT_PLAN` 344** 과 동기. 후보 시드(복사용):

```
Fix/Polish|[VERIFY] C5 Gate 138 A~F|C5. S138 TASK1 [ ].
Fix/Polish|[DOCS] C1 NEXT_PHASE·BACKLOG S138/344|C1. S138 TASK2 [ ].
Fix/Polish|[DOMAIN] C3 Arena *FromUnknown|C3. S138 TASK8 [ ].
Fix/Polish|[UI] C4 Foundry a11y|C4. S138 TASK4 [ ].
Fix/Polish|[VERIFY] C6 q237 + self-healing-ci|C6. S138 TASK10 [ ].
```

---

## 이전 스프린트 후보 보관

- S136 마감 **큐 보충** → S137 오픈 — **`SPRINT_LOG`** · **`CURSOR_TASK_BOARD`** 아카이브.
- S135 마감 **큐 보충** → S136 오픈.

---

## S104 백로그 (참고)

- **TASK14·15**: `NEXT_PROJECT_RECOMMENDED` · 보드 **C3/C4** 시드와 중복 시 한 줄로 합침.
