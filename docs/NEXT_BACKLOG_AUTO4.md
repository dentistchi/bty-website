# 다음 배치 (Auto 4 — 기본 5건 완료 시 보드에 추가할 후보)

**목적**: `scripts/next-project-fill-board.sh`가 여기서 다음 작업을 읽어 보드에 추가한다.  
**기준**: `docs/NEXT_PROJECT_RECOMMENDED.md` §1·§2.  
**갱신일**: 2026-03-21 — 보드 **SPRINT 99** (TASK **1~10**) · **`SPRINT_PLAN` 305** · **First C5 TASK1** (Gate **99**) · **S98 → 아카이브** (`PARALLEL_QUEUE_REFILL` §3).

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

## 다음 배치 목록 — **SPRINT 99** (진행 중)

```
Fix/Polish|[VERIFY] C5 Gate 99 A~F|C5. S99 TASK1 [ ].
Fix/Polish|[DOCS] C1 NEXT_PHASE·BACKLOG S99/305|C1. S99 TASK2 [ ].
Fix/Polish|[DOMAIN] C3 arenaIsoTimestampFromUnknown edges|C3. S99 TASK8 [ ].
Fix/Polish|[UI] C4 bty-arena loading|C4. S99 TASK4 [ ].
Fix/Polish|[VERIFY] C6 q237 + self-healing-ci|C6. S99 TASK10 [ ].
```

---

## S100 예고 (`splint 10` · 이번 런 **전량 [x]** 후)

`CURSOR_TASK_BOARD` **SPRINT 100** 오픈 시 **`SPRINT_PLAN` 306** 과 동기. 후보 시드(복사용):

```
Fix/Polish|[VERIFY] C5 Gate 100 A~F|C5. S100 TASK1 [ ].
Fix/Polish|[DOCS] C1 NEXT_PHASE·BACKLOG S100/306|C1. S100 TASK2 [ ].
Fix/Polish|[DOMAIN] C3 Arena *FromUnknown|C3. S100 TASK8 [ ].
Fix/Polish|[UI] C4 Arena a11y|C4. S100 TASK4 [ ].
Fix/Polish|[VERIFY] C6 q237 + self-healing-ci|C6. S100 TASK10 [ ].
```

---

## 이전 스프린트 후보 보관

- S98 마감 **큐 보충** → S99 오픈 — **`SPRINT_LOG`** · **`CURSOR_TASK_BOARD`** 아카이브.
- S97 마감 **큐 보충** → S98 오픈.
