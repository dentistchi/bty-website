# CURSOR TASK BOARD — 2026-03-23

**C5 verify (2026-03-30 · release rollout probe):** `npm run lint` ✓ · Vitest **369 / 2665** ✓ · `npm run build` ✓ · prod smoke **200/401** · deploy **SHA parity unverified** (wrangler vs `e8b848d`) · auth flows **deferred** — **보고 완료**

## SYSTEM MODE: BEHAVIOR ENGINE BUILD

**C3 (2026-03-28):** Action Contract + persistence + AIR/XP hooks — `domain/action-contract` · `lib/bty/action-contract` · migration `20260431230000` · vitest 10 · **작업 완료**

**C3 (2026-03-28):** BTY AI Routing Engine v1 — `bty-app/src/domain/routing` + vitest 11 · **작업 완료**

**C5 verify (2026-03-27 · Arena final integration gate):** `npm run lint` ✓ · Vitest **418 / 2959** ✓ · `npm run build` ✓ · PENDING-014·017·Level-first·tenure 전제 **PASS** — **작업 완료**

**C5 verify (2026-03-27 · Arena branch release gate):** `npm run lint` ✓ · Vitest **417 files / 2954 tests** ✓ · `npm run build` ✓ · PENDING-014·017 전제 **PASS** — **작업 완료**

**C5 verify (2026-03-25 · 재검증):** `next lint`+`npm run lint` **0** · Vitest **2811** · **8 FAIL** onboarding mock · build **PASS** · **NO-GO** — **보고 완료**

**C5 verify (2026-03-25):** Lab org onboarding gate — `self-healing-ci.sh` **PASS** · **397 / 2803** · `next lint` **FAIL**(툴링) · onboard 시퀀스 테스트 **MISSING** — **작업 완료**

**C5 verify (2026-03-24):** `self-healing-ci.sh` **PASS** · 368 files / 2660 tests · build ✓ — **작업 완료**

**Arena release gate (deploy smoke):** `bty-app/scripts/arena-release-gate.sh` + workflow `arena-release-gate.yml` — **작업 완료**

**Cutover readiness (C3):** **`PENDING-014`** and **`PENDING-017`** **remain open** — **must appear** on the cutover checklist (`bty-app/docs/ARENA_PIPELINE_CUTOVER.md` § C3; `bty-app/docs/CI_RELEASE_GATE_MATRIX.md` § C3; `docs/BTY_RELEASE_GATE_CHECK.md`). **Neither blocks** cutover; **both require post-cutover resolution**.

---

## 🔵 ACTIVE TASKS

### C2 — ENGINE (BACKEND / DOMAIN)

#### TASK 1: Memory Engine
- source: user_scenario_choice_history
- output:
  - repeated pattern detection
  - recall trigger ("Last time you...")
- integrate with:
  - scenario-selector
  - scenario-type-router

---

#### TASK 2: Delayed Outcome Engine
- store decisions with delayed consequences
- inject follow-up scenario after N steps
- ensure no conflict with session/next

---

#### TASK 3: Perspective Switch Engine
- expand role-based scenarios
- leader → staff view inversion
- scenario pool 확장 필요

---

### C4 — UI (ENFORCEMENT / POLISH)

#### TASK 1: Leadership Engine Display
- AIR / TII / LRI
- convert numeric → narrative/band
- integrate into dashboard (Progress or Team card)

---

#### TASK 2: Avatar Polish
- unify scale
- add visual depth (shadow / ring consistency)
- improve empty state

---

### C5 — QA / VERIFICATION

#### TASK 1: Scenario Flow Verification
- 반복 시나리오 제거 확인
- session/next 다양성 체크

#### TASK 2: Behavior Loop Check
- Arena → Foundry → Arena 흐름 확인
- memory recall trigger 작동 여부

---

## 🟡 BACKLOG

- Forced Reset (48h lockout)
- Healing / Awakening phase
- Team Index full integration
- Elite mentor flow 확장

---

## ⚫ CUTOVER — G-B09 (COMPLETE 2026-03-28)

**G-B09 — Full-repo forbidden pattern sweep** — **DONE.**

| | |
| --- | --- |
| **Normative doc** | **`bty-app/docs/terminology-locks/UX_FLOW_LOCK_V1.md`** §5 |
| **Automation** | **`bty-app/scripts/ux-flow-lock-gb09-sweep.mjs`** (`npm run lint:ux-flow-gb09` in `bty-app`) |
| **Result** | **PASS** — no high-risk §5 phrase hits in **966** `src/` files (2026-03-28 run). |
| **Evidence** | **`docs/BTY_RELEASE_GATE_CHECK.md`** — G-B09 sign-off line. |

---

## 🔴 DO NOT TOUCH

- routing 구조
- UI 시스템 (ScreenShell / InfoCard)
- XP 공식
- avatar API contract

---

## ⚫ WORKFLOW RULE

- C2 → logic
- C4 → UI reflection
- C5 → validation

---

## ONE-LINE

> 이제 Cursor의 역할은  
> “화면을 만드는 것”이 아니라  
> **행동 엔진을 연결하는 것**이다.