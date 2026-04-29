# BTY AI MULTI-AGENT MEMORY

이 문서는 BTY 프로젝트에서 모든 Cursor(C1~C5)가  
공유해야 하는 **공통 기억 저장소**이다.

**모든 Cursor는 작업 시작 전에 이 문서를 읽고, 작업 완료 후 필요한 내용을 업데이트한다.**

---

## 1. CURRENT GLOBAL MEMORY

### Project Name

BTY

### System Type

AI Swarm Development System

### Cursor Structure

- C1 Commander
- C2 Gatekeeper
- C3 Domain/API
- C4 UI
- C5 Integrator
- C6 Test/Fix

### Core Command Flow

```
START
  → C2 C3 C4 병렬 실행
  → VERIFY
  → C5 실행
  → WRAP
```

---

## 2. FIXED RULES MEMORY

### Domain Rules

- Season progress does **NOT** affect leaderboard ranking
- Core XP is permanent
- Weekly XP resets weekly
- Leaderboard uses weekly_xp only
- Domain logic lives only in `src/domain` or `src/lib/bty/arena`

### API Rules

- API does not calculate business rules
- API validates request
- API calls domain
- API returns response

### UI Rules

- UI is render-only
- UI never calculates XP
- UI never calculates ranking
- UI never calculates season logic
- UI may only format values

### Auth Rules

- Auth changes require auth safety review
- Cookie flags must not be changed casually
- middleware handles redirect/session flow only

### Gate Rules

Run Release Gate if touching: **auth**, **cookies**, **xp**, **leaderboard**, **season**, **migration**, **middleware**

---

## 3. ACTIVE DECISIONS MEMORY

이 섹션은 **이미 결정된 것**만 적는다.

### Decision Template

- Date:
- Owner:
- Decision:
- Reason:
- Affected Files:

### Decisions

- **Date:** TBD  
- **Owner:** Commander  
- **Decision:** C2, C3, C4 always run in parallel after C1 planning.  
- **Reason:** maximize throughput and reduce idle waiting.  
- **Affected Files:** docs/AI_TASK_BOARD.md, docs/COMMANDER_SHORTCUTS.md  

---

## 4. ACTIVE TASK MEMORY

### Current Objective

SPRINT 39 전량 완료. 다음 배치 미생성 — C1 splint 10 또는 계획 대기.

### First Task

없음 (Worker 할당 큐 소진). 다음: Commander가 splint 10 실행 또는 SPRINT 40 BATCH PLAN 생성 시 Worker 큐 할당.

### Current Blockers

- None

### Current Risks

- None

---

## 5. COMPLETED TASK MEMORY

최근 완료된 **중요한 작업만** 남긴다.

### Completed Template

- Date:
- Task:
- Owner:
- Result:
- Verification:

### Completed Tasks

- **Date:** 2026-03-11  
- **Task:** C6 CONTINUE (3rd) — pipeline verify; build recovered via clean .next  
- **Owner:** C6 Test/Fix  
- **Result:** Lint ✓ Test 1185 ✓. Build failed once (next-font-manifest.json); rm -rf .next && npm run build → PASS. No code changes.  
- **Verification:** AI_TASK_BOARD TASK HISTORY + FAILURE MEMORY updated.  

- **Date:** 2026-03-11  
- **Task:** C6 CONTINUE — Release Gate 39 (TASK 1) + Elite 3rd checklist (TASK 6)  
- **Owner:** C6 Test/Fix  
- **Result:** Lint ✓ (build then tsc), Test 163/1185 ✓, Build ✓. Elite 6항목 PASS.  
- **Verification:** BTY_RELEASE_GATE_CHECK, CURSOR_TASK_BOARD, CURRENT_TASK, ELITE_3RD §3, AI_TASK_BOARD 갱신.  

- **Date:** 2026-03-11  
- **Task:** C5 SPRINT 39 TASK 1 (Release Gate A~F — Foundry 39차) + TASK 6 (엘리트 3차 체크리스트 1회)  
- **Owner:** C5 Integrator  
- **Result:** Lint ✓ Test 163/1185 ✓ Build ✓. Release Gate PASS. Elite 3차 6항목 PASS.  
- **Verification:** BTY_RELEASE_GATE_CHECK, CURSOR_TASK_BOARD, CURRENT_TASK, ELITE_3RD §3, AI_TASK_BOARD 갱신.  

- **Date:** 2026-03-11  
- **Task:** C6 CONTINUE — verify lint/test (SPRINT 39)  
- **Owner:** C6 Test/Fix  
- **Result:** Lint ✓, test 163 files / 1185 passed. Assigned queue empty; no blockers; no fixes.  
- **Verification:** AI_TASK_BOARD.md updated (C6 status + TASK HISTORY).  

- **Date:** 2026-03-11  
- **Task:** C2 Gatekeeper SPRINT 39 — no task assigned; N/A exit  
- **Owner:** C2  
- **Result:** Exit (no C2 work in batch)  
- **Verification:** AI_TASK_BOARD.md updated  

- **Date:** TBD  
- **Task:** Initial multi-cursor orchestration system setup  
- **Owner:** Commander  
- **Result:** Done  
- **Verification:** docs created  

---

## 6. FAILURE MEMORY

같은 실패를 반복하지 않기 위한 기록.

### Failure Template

- Date:
- Failure:
- Cause:
- Fix:
- Prevent Next Time:

### Failures

- **Date:** 2026-03-11  
- **Failure:** `npm run build` failed with MODULE_NOT_FOUND `.next/server/next-font-manifest.json`  
- **Cause:** Stale or incomplete .next cache (e.g. partial build, interrupted run)  
- **Fix:** `rm -rf .next && npm run build` — clean rebuild succeeds.  
- **Prevent Next Time:** On build failure with missing .next artifacts, retry with clean .next before escalating.  

- **Date:** 2026-03-11  
- **Failure:** `npm run lint` (tsc --noEmit) failed with TS6053 "File '.next/types/...' not found"  
- **Cause:** .next/types stale or missing (e.g. after clean or first run)  
- **Fix:** Run `npm run build` first to regenerate .next; then lint passes.  
- **Prevent Next Time:** For Release Gate F, run build before lint if .next is missing.  

- **Date:** TBD  
- **Failure:** Lint blocked whole pipeline  
- **Cause:** project-level ESLint/ajv config issue  
- **Fix:** move global lint responsibility to C5  
- **Prevent Next Time:** do not block C3/C4 local progress on repo-wide lint  

---

## 7. FILE OWNERSHIP MEMORY

| Cursor | 소유/책임 |
|--------|------------|
| **C1 Commander** | docs/, planning only, does not directly edit implementation code |
| **C2 Gatekeeper** | docs/BTY_RELEASE_GATE_CHECK.md, rules validation, release gate review |
| **C3 Domain/API** | src/domain/, src/lib/bty/, src/app/api/, src/middleware.ts |
| **C4 UI** | src/app/[locale]/, src/components/ |
| **C5 Integrator** | scripts/, lint / test / build / verify |
| **C6 Test/Fix** | tests (*.test.ts), small regression fixes, type/lint/build blockers |

---

## 8. HANDOFF MEMORY

커서 간 인계사항 기록.

### Handoff Template

- From:
- To:
- What changed:
- What to verify next:
- Blocking issue:

### Handoffs

- **From:** C3  
- **To:** C4  
- **What changed:** API/domain contract updated  
- **What to verify next:** UI uses only returned values  
- **Blocking issue:** None  

---

## 9. MEMORY UPDATE RULES

모든 Cursor는 아래 규칙을 따른다.

1. 이미 결정된 사항은 다시 토론하지 않는다.
2. 새 결정이 생기면 **ACTIVE DECISIONS MEMORY**에 추가한다.
3. 실패 원인은 **FAILURE MEMORY**에 남긴다.
4. 완료한 큰 작업은 **COMPLETED TASK MEMORY**에 남긴다.
5. 커서 간 인계가 필요하면 **HANDOFF MEMORY**에 기록한다.

---

## 10. READ ORDER

모든 Cursor는 작업 시작 전에 아래 문서를 **순서대로** 읽는다.

1. docs/AI_PROJECT_INDEX.md
2. docs/AI_CONTEXT_LOCK.md
3. docs/AI_MEMORY_MAP.md
4. docs/AI_CODE_INDEX.md
5. docs/AI_MULTI_AGENT_MEMORY.md
6. docs/AI_TASK_BOARD.md

---

## 11. SHORT OPERATION RULE

**모든 Cursor 시작 메시지:**

> Read docs/AI_PROJECT_INDEX.md and all referenced docs, especially AI_MULTI_AGENT_MEMORY.md. Follow them strictly and update memory when decisions, failures, or handoffs happen.

---

# END
