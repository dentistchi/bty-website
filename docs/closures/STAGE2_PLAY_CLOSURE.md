# STAGE 2 PLAY — Closure

**Sprint**: Stage 2 step 3 (Play) — BTY Arena Cursor pipeline
**Closure date**: 2026-05-14
**Closure type**: Verification-only — Play surface is already v1.1 §8-compliant post-2D-1; no inner refactor needed
**Mutation scope this doc**: outer-only, 3 files (this closure + 2 board updates), 0 code changes
**Stage 2 LOCKED order**: Lobby → Resolve → **Play** ← step 3/6 — Center → Foundry → Hub (per v1.1 §11, [BTY_ARENA_STAGE1_FRAME_MAPPING_REPORT.md](../BTY_ARENA_STAGE1_FRAME_MAPPING_REPORT.md))
**Inner commit reference**: `b92bd0d9` (2D-1) — unchanged this sub-phase
**Outer HEAD at closure entry**: `4406ced` (Stage 2 Resolve closure); this commit advances outer by 1

---

## 1. Context — why Play step 3 is verification-only

Per v1.1 §5.2, **Play** is the in-scenario interaction container — 3 modes (primary / tradeoff / action) + 1 re-exposure mode. Per v1.1 §2, Play owns rows 1/2/3 (`PRIMARY_CHOICE_ACTIVE` / `TRADEOFF_ACTIVE` / `ACTION_DECISION_ACTIVE`) and row 7 (`REEXPOSURE_DUE` as Play mode flag — the only row where Trigger Authority ≠ Render Authority per v1.1 §0 C-A5).

The pre-Resolve state of `BtyArenaRunPageClient.tsx` rendered both Play and Resolve domain content from the same client component — a §8-2 surface-invariant violation. **2D-1 (`b92bd0d9`)** already removed the production Resolve render branch (L987-1066 pre-2D-1) and added a navigation `useEffect` that pushes to `/play/resolve` on `s.arenaActionBlocking` false→true. After 2D-1, the only Play-domain content `BtyArenaRunPageClient.tsx` renders is what v1.1 §2 says it should own — rows 1/2/3 (via `s.playUiSegment` switching in the main return) and row 7 (via `<ArenaReexposurePanel>` inside the Play `<ScreenShell>`).

Phase 1 read-only inventory verified Play is already §8-compliant for its home rows. **Play step 3 = closure, not refactor.** This is an honest finding: 2D-1 absorbed the work that would have been Play step 3. Inventing new scope inside Play would push into D1-blocked (Hub) or Center-scope territory, both of which are deferred per the §8-Open backlog below.

---

## 2. BtyArenaRunPageClient.tsx render-branch map (post-2D-1, 1440 lines, 15 return paths)

| # | Lines | Branch | Domain | testid | v1.1 mapping |
|---|---|---|---|---|---|
| 1 | L514-907 | `if (currentScenario && jsonCatalogDevMode)` — full JSON-engine dev catalog page (incl. inline ACTION_REQUIRED L643-844, REEXPOSURE_DUE L846-866, NEXT_SCENARIO_READY L868-903) | JSON-engine dev catalog | `arena-dev-json-only-root` + 14 children | **OUT OF v1.1 §2** — non-production, `jsonCatalogDevMode`-gated; the inline ACTION_REQUIRED is the deferred 2D-2 backlog item per [Resolve closure §3.2](STAGE2_RESOLVE_CLOSURE.md#32-json-engine-path--explicitly-out-of-8-user-facing-scope) — NOT a Play §8-2 issue to re-scope |
| 2 | L909-922 | `if (jsonCatalogDevMode && !currentScenario)` | JSON-engine loading | `arena-dev-json-only-loading` | OUT OF v1.1 §2 |
| 3 | L924-942 | `if (!s.levelChecked)` | Loading infra | `arena-play-loading` | infrastructure |
| 4 | L944-957 | `if (s.requiresBeginnerPath)` | Beginner-path gate | `arena-play-gate-beginner` | infrastructure |
| 5 | L959-967 | `if (staleReexposureRecoveryActive)` | Re-exposure recovery loader | `arena-reexposure-stale-recovery` | re-exposure infra (§7) |
| 6 | L969-982 | `if (s.scenarioLoading)` | Aligning loader | `arena-play-loading-scenario` | infrastructure |
| **7** | **L985-1010** | **`if (effectiveReexposureShell)`** → `<ArenaReexposurePanel>` | **Play (REEXPOSURE_DUE mode flag)** | `arena-play-snapshot-reexposure` | **v1.1 §2 row 7 + FD-4 / §7** |
| 8 | L1027-1029 | `if (s.arenaActionBlocking) return null;` (2D-1 navigation handoff) | Resolve handoff (no render) | (none) | §2 rows 4/5/6 handed off to `/play/resolve` |
| 9 | L1031-1065 | `if (gateSnapshot?.runtime_state === "FORCED_RESET_PENDING")` — Play gate page with `<Link href={/center}>` | Center handoff gate | `arena-play-snapshot-forced-reset` | §2 row 8 — see [§5 §8-Open](#5-8-open-backlog--two-tensions-with-named-ownership) |
| 10 | L1067-1167 | `if (gateSnapshot?.runtime_state === "NEXT_SCENARIO_READY")` (3 sub-branches: re-exposure-inside-next-ready / blocked / ready-CTA) | Transition (NEXT_SCENARIO_READY) | `arena-play-snapshot-reexposure` / `arena-play-snapshot-next-scenario-blocked` / `arena-play-snapshot-next-scenario-ready` | §2 row 9 — see [§5 §8-Open](#5-8-open-backlog--two-tensions-with-named-ownership) |
| 11 | L1173-1186 | shell-fallback loader (valid gate + null scenario) | Safety loader | `arena-play-gate-shell-fallback` | infrastructure |
| 12 | L1188-1207 | `if (!s.scenario)` | Empty-scenario error | `arena-play-empty-scenario` | error |
| 13 | L1209-1221 | `if (!s.scenario.eliteSetup)` | Non-elite error | `arena-play-non-elite-scenario` | error |
| 14 | L1223-1242 | `if (!s.canRenderScenarioProgressionUi)` | Play-surface blocked placeholder | `arena-play-snapshot-play-surface-blocked` | transitional block |
| **15** | **L1244-1439** | **final `return (...)`** with `s.playUiSegment` switch | **Play main surface (primary / tradeoff / action_decision / run_complete)** | `arena-play-main` + `arena-flow-phase-instruction-{primary,tradeoff,action-decision}` | **v1.1 §2 rows 1/2/3 + §5.2** |

Only **#7 and #15** render Play-domain content that this surface owns per v1.1 §2.

---

## 3. v1.1 §2 home-row compliance (rows 1/2/3/7 + §5.2)

| v1.1 §2 row | State | Spec Surface | Current rendering location | Verdict |
|---|---|---|---|---|
| 1 | `PRIMARY_CHOICE_ACTIVE` | Play | #15 L1244-1439 → `s.playUiSegment === "primary_choice"` → `<ChoiceList variant="elite">` (L1367-1374) wrapped by `<EliteArenaStep2Context>` (L1360-1365) + primary-pick hint (L1366) | ✅ correct |
| 2 | `TRADEOFF_ACTIVE` | Play | #15 L1244-1439 → `s.playUiSegment === "forced_tradeoff"` → `<EliteArenaPostChoiceBlock>` (L1394-1409) with tradeoff phase instruction `arena-flow-phase-instruction-tradeoff` (L1336-1343) | ✅ correct |
| 3 | `ACTION_DECISION_ACTIVE` | Play | #15 L1244-1439 → `s.playUiSegment === "action_decision"` → `<EliteActionDecisionStep>` (L1378-1387) with `<ArenaBindingError>` fallback (L1388-1392) + action-decision phase instruction `arena-flow-phase-instruction-action-decision` (L1344-1351) | ✅ correct |
| 7 | `REEXPOSURE_DUE` | **Play (re-exposure mode flag)** | #7 L985-1010 → `<ArenaReexposurePanel>` inside Play `<ScreenShell>` (testid `arena-play-snapshot-reexposure`); also #10 L1081-1103 when `NEXT_SCENARIO_READY` snapshot carries `re_exposure.due === true` | ✅ correct — rendered as Play mode flag, not separate surface or overlay |

§5.2 Play identity (in-scenario interaction container, 3 modes + re-exposure mode) is **fully honored**. The 2-layer authority model for row 7 (server-triggered via `effectiveArenaSnapshot.runtime_state === "REEXPOSURE_DUE"`; client-rendered via `<ArenaReexposurePanel>` mounted in the Play `<ScreenShell>`) is preserved per FD-4 / §7.1.

---

## 4. §8 prohibition assessment

| § | Prohibition | Status | Evidence |
|---|---|---|---|
| §8-1 | Authority violation: client overrides server gate | ✅ **PASS** | All gate-state reads route through `gateSnapshot = s.effectiveArenaSnapshot ?? s.arenaServerSnapshot` (server). `arenaActionBlocking` is server-derived in `useArenaSession.ts:1070-1073` (pendingActionContract OR `isArenaActionBlockingRuntimeState(runtime_state)`). No client-side `runtime_state` writes found in `BtyArenaRunPageClient.tsx`. |
| §8-2 | Surface invariant: Play renders Resolve state | ✅ **PASS (production path)** | Production Resolve render branch removed by 2D-1; `arenaActionBlocking` true → returns null + `useEffect` navigates to `/play/resolve`. **JSON-engine inline ACTION_REQUIRED at L643-844 is already counted** as the deferred 2D-2 backlog item per [Resolve closure §3.2 + §6](STAGE2_RESOLVE_CLOSURE.md) — non-production / `jsonCatalogDevMode`-gated / explicitly OUT OF §8 user-facing scope. NOT re-scoped here. |
| §8-3 | Lock bypass | n/a | Play has no LOCKED states (rows 1/2/3/7 all unlocked per v1.1 §2); applies to Resolve. |
| §8-4 | FD-6 violation (Resolve as feedback screen) | n/a | Applies to Resolve (now in `ArenaResolveClient`). |
| §8-5 | FD-5 violation (Center as menu/dashboard) | ⚠️ See [§5 §8-Open](#5-8-open-backlog--two-tensions-with-named-ownership) — Play renders FORCED_RESET as a gate page with manual `<Link>` rather than auto-redirect; this is Center-scope to enforce. |
| §8-6 | FD-4 violation: REEXPOSURE_DUE as separate surface | ✅ **PASS** | Rendered as Play mode flag via `<ArenaReexposurePanel>` inside Play `<ScreenShell>` (#7 L985-1010). Two-layer model (server gate triggers, Play renders) preserved. No separate route, overlay, or modal. |
| §8-7 | HARD LOCKED bypass | n/a | Applies to Center/FORCED_RESET. |
| §8-8 | Skip CTA on LOCKED | n/a | Play has no LOCKED states. |

**§8 prohibitions directly attributable to Play step 3: ZERO.** Play is already compliant for its v1.1 §2 home rows (1/2/3/7).

---

## 5. §8-Open backlog — two tensions with NAMED OWNERSHIP

Per Commander condition on Plan A: the two §8-Open invariant tensions surfaced in Phase 1 are recorded here as **explicit backlog items with named ownership**, not absorbed into a vague "out of Play scope" wording.

### 5.1 NEXT_SCENARIO_READY rendered in Play → **OWNERSHIP: Stage 2 step 6 (Hub)**

- **Where**: `BtyArenaRunPageClient.tsx:1067-1167` — three sub-branches handle `gateSnapshot?.runtime_state === "NEXT_SCENARIO_READY"` directly inside Play, including a "Continue to next scenario" CTA button (testid `arena-next-scenario-continue`, L1153) that calls `s.continueNextScenario()`.
- **v1.1 spec position**: §2 row 9 lists Surface = **Lobby or Hub** (D1-pending split). NEXT_SCENARIO_READY is NOT in Play's home rows.
- **Test-pinned**: snapshot-gates P5 E (4 tests at `bty-app/src/app/[locale]/bty-arena/BtyArenaRunPageClient.snapshot-gates.test.tsx`) extensively assert NEXT_SCENARIO_READY rendering on the Play surface — the current behavior is intentional and would break tests if changed without coordinated migration.
- **Why this is not Play step 3 work**: v1.1 §9 D1 ("Lobby ↔ Hub 통합 여부") was supposed to be decided "at Stage 2 Lobby code-time". The Lobby refactor at inner `7e4b33ca` performed route separation but did NOT resolve D1's surface-ownership question for NEXT_SCENARIO_READY — it stayed where it was. Resolving NEXT_SCENARIO_READY's home requires deciding whether Hub is a distinct surface from Lobby (D1), and that decision is naturally the Hub sub-phase's responsibility because Hub's existence is what would make a NEXT_SCENARIO_READY surface separate from Lobby exist at all.
- **OWNERSHIP — Stage 2 step 6 (Hub)**: Hub sub-phase must (a) resolve D1 (Lobby ↔ Hub merge or distinct), (b) if distinct, migrate NEXT_SCENARIO_READY rendering to Hub or Lobby per v1.1 §2 row 9, (c) update snapshot-gates P5 E tests to reflect the new surface, (d) remove `BtyArenaRunPageClient.tsx:1067-1167` after migration.

### 5.2 FORCED_RESET_PENDING rendered as Play gate-page with manual `<Link>` → **OWNERSHIP: Stage 2 step 4 (Center)**

- **Where**: `BtyArenaRunPageClient.tsx:1031-1065` — when `gateSnapshot?.runtime_state === "FORCED_RESET_PENDING"`, Play renders a `<ScreenShell>` with `arena-play-snapshot-forced-reset` testid containing the forced-reset gate title/lead + a `<Link href={centerHref}>` to `/center` (`arena-forced-reset-go-center` testid, L1056).
- **v1.1 spec position**: §2 row 8 + FD-5 (`docs/BTY_ARENA_SEMANTIC_LOCKING_TABLE_v1.1.md`) say FORCED_RESET_PENDING = "Center hard interrupt (modal 아님, **full redirect**)". §8-5 prohibits "Center를 일반 menu / dashboard로 표현". The current Play rendering is a gate-page with a click-to-Center CTA, not a full auto-redirect — closer to a "preview" than a hard interrupt.
- **Test-pinned**: snapshot-gates P5 B (1 test asserting `arena-play-snapshot-forced-reset` testid renders and `arena-play-main` is absent).
- **Why this is not Play step 3 work**: FD-5 enforcement (auto-redirect at the route/middleware layer, not a Play-surface gate) is naturally the Center sub-phase's job. Center step is when the `/center` route + its entry contract get built; until then, fixing the redirect-vs-gate question would commit to a Center architecture that hasn't been designed yet. The current Play gate-page is a pragmatic stand-in that doesn't violate §8-2 (it doesn't render Resolve state) but does ride the §8-5/FD-5 invariant — making it Center's responsibility to either move the redirect into middleware (preferred per FD-5 "full redirect") or own a Center entry surface that absorbs this rendering.
- **Middleware reference**: `bty-app/src/middleware.ts:351-368` already redirects `/bty-arena/*` to `/bty?arena_contract=resolve` when `userHasBlockingArenaActionContract`, but FORCED_RESET_PENDING is a **different** runtime state and is NOT in that middleware path. Adding it would be the cleanest FD-5 fix.
- **OWNERSHIP — Stage 2 step 4 (Center)**: Center sub-phase must (a) define the `/center` (or equivalent) route + entry contract, (b) move FORCED_RESET_PENDING auto-redirect into middleware (or equivalent route-level enforcement) per FD-5 "full redirect", (c) update snapshot-gates P5 B test to reflect the new redirect behavior, (d) remove `BtyArenaRunPageClient.tsx:1031-1065` after migration.

### 5.3 Both items: shared discipline note

Neither tension was introduced by Resolve or Play. Both have lived in `BtyArenaRunPageClient.tsx` since pre-Stage-2. The Lobby refactor at `7e4b33ca` did not address either; Resolve at `b92bd0d9` did not address either (correctly — they're not Resolve domain). Surfacing them here under named ownership creates traceability so they don't become silent debt across the remaining Stage 2 steps.

---

## 6. D-N items relevant to Play

| ID | Item | Status | Note |
|---|---|---|---|
| D4 | Re-exposure mode header phrasing | **CLOSED — already shipped** | Implemented in `bty-app/src/lib/i18n.ts`: KO `arenaReexposurePanel{Title,Description}` at `:2928-2940`; EN at `:4594-4604`. KO title: "재노출 라운드", description: "이전 선택과 연결된 지연 결과가 도착했습니다. 시나리오로 들어가 계속 진행하세요." EN: "Re-exposure round", "A delayed outcome linked to an earlier choice is ready. Enter the scenario to continue." Both honor v1.1 §7.2 (abstract context, no spoiler of prior choice) and §7.3 (no "retry"/"skip" framing; marker present without becoming a "try again" frame). CTA copy "Enter scenario" / "시나리오로 들어가기" honors §4.2 unlocked progression. D4 verified by Phase 1 inspection. |

No other D-N items in v1.1 §9 are Play-scoped.

---

## 7. Outer sync-debt set

### 7.1 Inventory at this closure entry

Identical to the 2E Resolve closure §8.1 — **18 entries**, fully classified:

| Origin | Count | Files |
|---|---|---|
| HK6 (prior) | 1 | `bty-app/src/lib/bty/identity/getMyPageIdentityState.ts` (M) |
| HK7 (prior) | 3 | `bty-app/src/lib/bty/center/letterService.ts` (M), `bty-app/src/lib/bty/validator/layer2Semantic.ts` (M), `bty-app/src/lib/llm.ts` (D) |
| HK8/HK9 (prior) | 1 | `bty-app/src/features/my-page/logic/computeLeadershipState.ts` (M) |
| Lobby refactor (prior) | 2 | `bty-app/src/app/[locale]/bty-arena/ArenaEntryClient.tsx` (M), `bty-app/src/app/[locale]/bty-arena/play/page.tsx` (M) |
| 2B Resolve | 3 (outer view) | `bty-app/src/app/[locale]/bty-arena/hooks/useArenaSession.ts` (M), `bty-app/src/app/[locale]/bty-arena/play/resolve/page.tsx` (M), `bty-app/src/app/[locale]/bty-arena/play/resolve/ArenaResolveClient.tsx` (??) |
| 2C Resolve | 5 | `bty-app/.../arena-guards.spec.ts` (M), `bty-app/.../BtyArenaRunPageClient.snapshot-gates.test.tsx` (M), `bty-app/.../play/resolve/ArenaResolveClient.test.tsx` (??), `bty-app/.../play/resolve/ArenaResolveClient.empty-state-edge-case.test.tsx` (??), `bty-app/.../play/resolve/page.test.tsx` (??) |
| 2D-1 Resolve | 3 | `bty-app/.../BtyArenaRunPageClient.tsx` (M), `bty-app/.../BtyArenaRunPageClient.action-decision-503.integration.test.tsx` (M), `bty-app/.../BtyArenaRunPageClient.json-reexposure.test.tsx` (M) |

**Total: 18 entries** = 7 prior (HK + Lobby) + 11 Resolve-added (2B 3 outer-view + 2C 5 + 2D-1 3). 0 anomalies.

### 7.2 Play step 3 impact on sync-debt

**Net change: 0.** Play step 3 is outer-doc-only (Plan A). No inner commit, no new sync-debt entries. Total remains at 18.

The set will continue to grow as Stage 2 steps 4-6 (Center / Foundry / Hub) accumulate inner commits. Leak-integration sprint follows Stage 2 completion per [INNER_PUSH_POLICY §5](../INNER_PUSH_POLICY.md).

---

## 8. Gate 4-check (pre-mutation, this closure)

| Gate | Measurement | Verdict |
|---|---|---|
| (a) Outer/origin sync | `git fetch origin main`; rev-list `0 0`; local HEAD = `origin/main` = `4406ced` | **ORIGIN_SYNC_OK** |
| (b) Known sync-debt set | 18 entries, all classified (§7.1 above), 0 anomalies | **LEAKS_CLASSIFIED_OK** |
| (c) HK6 canonical untouched by this task | `getMyPageIdentityState.ts` = prior leak (not in this closure's diff); 0 fresh mutations by Play step 3 | **HK6_NOT_RE_EDITED_OK** |
| (d) Explicit-path staging | This closure stages 3 files only (this doc + `CURSOR_TASK_BOARD.md` + `CURRENT_TASK.md`); 0 sync-debt entries staged | **STAGING_CLEAN_OK** |

**4/4 PASS** → Play step 3 closure mutation entry authorized.

---

## 9. Self-application — closure invariants for Play step 3

| Invariant | Result |
|---|---|
| Mutation = outer-only, 3 files | ✅ this closure + 2 board updates |
| 18 sync-debt entries preserved | ✅ untouched, unstaged |
| HK6 canonical file re-edit = 0 | ✅ prior leak only |
| Explicit-path staging | ✅ specific paths, no `-A` / `-u` |
| Inner repo change = 0 | ✅ no `git -C bty-app` for code |
| `bty-app/` change = 0 | ✅ Plan A = doc-only |
| No inventing scope | ✅ Phase 1 finding ("Play is post-2D-1 compliant") honored; D4 confirmed already-shipped, not re-shipped |

---

## 10. Play sprint final state

- ✅ v1.1 §2 home rows 1/2/3/7 RENDER COMPLIANT (#15 main return + #7 re-exposure mode flag)
- ✅ §8-1 (server-authority) PASS
- ✅ §8-2 production-path PASS (post-2D-1)
- ✅ §8-6 (FD-4 re-exposure as Play mode flag) PASS
- ✅ D4 (re-exposure header phrasing) CLOSED — already shipped, §7.2/§7.3 compliant
- ⏸ §8-Open #1 (NEXT_SCENARIO_READY rendered in Play) → backlogged with explicit ownership: **Stage 2 step 6 (Hub)**
- ⏸ §8-Open #2 (FORCED_RESET_PENDING gate-page) → backlogged with explicit ownership: **Stage 2 step 4 (Center)**
- ⏸ JSON-engine ACTION_REQUIRED inline (L643-844) — already counted as the deferred 2D-2 Resolve backlog item, NOT re-scoped to Play
- ✅ Sync-debt unchanged at 18 (no inner code change)
- ⏭ Stage 2 step 4 = **Center** (next, per LOCKED order — also inherits §8-Open #2)

---

## Discipline note

This closure is the **fifth** `docs/closures/` application after `HK9_CODENAME_SYNC_CLOSURE.md`, `HK9_ORPHAN_DOCS_CLOSURE.md`, `HK8_OUTER_INNER_SYNC_POLICY_CLOSURE.md`, `STAGE2_RESOLVE_CLOSURE.md`. The pattern (explicit-path stage, inner repo no-touch in closure commit, Commander-provided verbatim commit message, pre-commit gate verification) is preserved.

**Verification-only as a legitimate closure class**: Stage 2 step 3 is the first sub-phase where the right answer was "no inner refactor needed — prior work covered it." Recording this honestly under named ownership for the §8-Open tensions prevents the "no work done" classification from becoming silent debt. The two §8-Open items are tracked, not buried.

The "verification-only" classification is **not** a skipped step — it's a deliberate finding that Play's §8 compliance was absorbed by 2D-1's production Resolve removal + the existing Play-domain code/copy already honoring v1.1 §2 row 7 and §7.2/§7.3. Inventing inner work to "earn" a Play step 3 commit would have either pushed into D1-blocked Hub territory (NEXT_SCENARIO_READY) or pre-committed to a Center architecture (FORCED_RESET_PENDING) — both correctly rejected.
