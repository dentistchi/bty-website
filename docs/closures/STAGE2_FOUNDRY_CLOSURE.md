# STAGE 2 FOUNDRY — Closure

**Sprint**: Stage 2 step 5 (Foundry) — BTY Arena Cursor pipeline
**Closure date**: 2026-05-14
**Closure type**: Verification-only — Foundry is already v1.1.1 §5.4 compliant; FORCED_RESET secondary block enforced by Center step (2C-1 + 2C-2 + 2D); no inner refactor needed
**Mutation scope this doc**: outer-only, 3 files (this closure + 2 board updates), 0 code changes
**Stage 2 LOCKED order**: Lobby → Resolve → Play → Center → **Foundry** ← step 5/6 — Hub (per v1.1.1 §11, [BTY_ARENA_STAGE1_FRAME_MAPPING_REPORT.md](../BTY_ARENA_STAGE1_FRAME_MAPPING_REPORT.md))
**Inner commit reference**: `a1800737` (Center 2D) — unchanged this sub-phase
**Outer HEAD at closure entry**: `c4b395d` (Center 2E closure); this commit advances outer by 1

---

## 1. Context — why Foundry step 5 is verification-only

Per v1.1.1 §5.4, **Foundry** is an analysis surface (pattern, trend, AIR, leadership engine). It is **lifecycle-external**: independent from the 10-state runtime state machine, does NOT render any `ArenaRuntimeStateId` directly. The only runtime-state interaction is a **secondary block** — when `FORCED_RESET_PENDING` is active, Foundry is HARD LOCKED per v1.1.1 §5.4 + §8-7.

Foundry's FORCED_RESET secondary block was **absorbed by Center step (step 4)**:
- 2C-1 (`d0d763c7`) middleware redirect source scope includes `/[locale]/bty/foundry/*` → 307 to `/[locale]/center`
- 2C-2 (`0f160e54`) `HubTopNav.tsx` gates `{hubPill(foundry, "Foundry", "foundry")}` inside the forced-reset suppression branch (both `arena` and `dear` themes)
- 2D (`a1800737`) `middleware.forced-reset-redirect.test.ts` test #3 pins the Foundry → /center redirect: *"redirects /[locale]/bty/foundry/* → /[locale]/center when forced-reset active (Foundry secondary block per v1.1.1 §5.4)"*

Phase 1 inventory ([STEP 0 cross-signal report](#step-0-references)) confirmed the live `/bty/foundry` route matches v1.1.1 §5.4's lifecycle-external + no-in-scenario-interaction requirements. The remaining content-design gap (vs `BTY_ARENA_VISUAL_BEHAVIOR_SPEC.md` §1.3) is non-§8-blocker because v1.1.1 (the authoritative locked spec) is permissive about specific Foundry UI content. **Foundry step 5 = closure, not refactor.** This mirrors Play step 3's "verification-only" classification.

---

## 2. Foundry surface inventory

### 2.1 Filesystem + git status (signals (b)+(c) from Phase 1)

```
src/app/[locale]/bty/(protected)/foundry/
├── FoundryHubLoadingShell.tsx              17 lines
├── loading.tsx                              6 lines
├── page.tsx                                21 lines  (Suspense + FoundryHubClient mount)
├── page.client.tsx                         94 lines  (the main hub)
├── dojo-micro/
│   ├── page.tsx                            16 lines
│   └── DojoMicroClient.tsx                 33 lines
└── program/[programId]/
    ├── page.tsx                            11 lines
    └── page.client.tsx                    104 lines
                                          ─────────
                                          302 lines route total

src/components/foundry/                  2269 lines (6 components: DojoAssessmentShell 485,
                                         EliteSpecWidget 306, LearningPathWidget 418,
                                         MentorChatShell 313, ProgramProgressShell 352,
                                         ProgramRecommenderWidget 395)

src/domain/foundry/                       4 files  (index.ts, program-catalog-signals.ts + tests)
src/lib/bty/foundry/                      6 files  (dojoSubmitService, integritySubmitService,
                                                   foundryExitEvents, index + tests)
src/engine/foundry/                       (exists)
src/app/api/bty/foundry/                  (exists)
```

**All 8 Foundry route files are TRACKED + CLEAN** (verified via `git ls-files` + `git status --short` against the route path). **None appear in the 30-entry sync-debt set.** Not in the untracked-import problem set. Not entangled with HK6/HK7/HK8/HK9 leaks, Lobby refactor leaks, Resolve sub-phase leaks, or Center sub-phase leaks.

### 2.2 What renders on `/[locale]/bty/foundry`

`page.client.tsx:50-93` renders:
- Back-to-bty-home link
- Header (`tLand.foundryTitle` / `tLand.foundryDesc` i18n)
- `<ProgramRecommenderWidget>` — live top-3 program recommendations from `GET /api/bty/foundry/recommendations`, Supabase broadcast `foundry_program_assign` + `postgres_changes` on `foundry_recommendations`
- 3 feature cards: Dr. Chi Mentor (`/bty/mentor`) / Dashboard (`/bty/dashboard`) / Elite (`/bty/elite`)
- Leaderboard nav link

Sub-routes:
- `/bty/foundry/dojo-micro` — skill-area dojo assessment shell (DojoAssessmentShell wrapper)
- `/bty/foundry/program/[programId]` — program detail (LearningPathWidget consumer)

**Render character:** feature-hub + analysis-flavored widgets. **0 runtime-state rendering** (verified by grep across foundry route files: 0 hits for `PRIMARY_CHOICE | TRADEOFF | ACTION_DECISION | REEXPOSURE | FORCED_RESET | playUiSegment` — the few "arena" matches are CSS variable names `--arena-accent` / `--arena-text` / `--arena-bg` used for theming consistency, not runtime-state).

### 2.3 Foundry vs Growth route coexistence

Live product has **two separate hubs**:
- `/[locale]/bty/foundry` — 3-card hub (Mentor / Dashboard / Elite) + ProgramRecommender (analyzed in §2.2)
- `/[locale]/growth` — 5-card hub (Dojo / Integrity / Guidance / Journey / History; `src/app/[locale]/growth/page.tsx`)

This mirrors the Center step's "route lineage" pattern: older specs (`BTY_CURSOR_MASTER_PROMPT.md` + `BTY_MASTER_BUILD_V1.md`) reference a "Growth" product layer with `/growth/*` routes; v1.1.1 + `BTY_ARENA_VISUAL_BEHAVIOR_SPEC.md` use "Foundry". The live product carries both. Both are lifecycle-external; both are tracked + clean; coexistence is documentation-shaped, not entanglement-shaped. See [§6 deferred backlog #2](#6-deferred-backlog-foundry-originated) for explicit recording.

---

## 3. v1.1.1 §5.4 compliance + §2 verification

| v1.1.1 spec | Status | Evidence |
|---|---|---|
| §5.4 identity: "analysis surface (pattern, trend, AIR, leadership engine)" | ✅ MATCH | Live `/bty/foundry` is hub for analysis-flavored surfaces: ProgramRecommender is pattern-driven (consumes `foundry_recommendations`, `program-catalog-signals` domain, `foundry_unlock` events from scenario tokens); Dr. Chi Mentor link (analysis chat); Dashboard link (analysis stats); Elite link (advanced content). Supporting components (`EliteSpecWidget` 306 lines, `LearningPathWidget` 418, `MentorChatShell` 313, `ProgramProgressShell` 352, `DojoAssessmentShell` 485, `ProgramRecommenderWidget` 395) all pattern/analysis-flavored. |
| §5.4 "lifecycle 외부 — runtime state machine과 독립" | ✅ MATCH | No `ArenaRuntimeStateId` rendering. Grep across all foundry route files: 0 hits for runtime-state names. The `useArenaSession` hook (which exposes runtime state) is not imported anywhere in `src/app/[locale]/bty/(protected)/foundry/`. |
| §5.4 "10개 runtime state를 직접 render하지 않음" | ✅ MATCH | Same as above. Foundry is not gated by any `arenaServerSnapshot.runtime_state`. |
| §5.4 forbidden "in-scenario interaction (Play/Resolve 영역)" | ✅ MATCH | No primary_choice / forced_tradeoff / action_decision UI components in Foundry route. No `ArenaPendingContractGate` / `ArenaBlockedSurface` / `ChoiceList variant="elite"` / `EliteActionDecisionStep` imports. |
| §2 — any Foundry row in the 10-state mapping? | ✅ NONE (expected) | Per Stage 1 §3.4 (which mirrors v1.1.1 §2): "v1.1 §2 rows: none (lifecycle-external)." Re-verified: v1.1.1 §2 rows 1-10 map to Lobby/Play/Resolve/Center/Hub; none to Foundry. Correct — Foundry sits outside the runtime-state-to-surface mapping by design. |

---

## 4. §8 prohibition assessment + FORCED_RESET secondary block verification

| § | Prohibition | Status |
|---|---|---|
| §8-1 | Authority violation (client overrides server gate) | n/a — Foundry doesn't render runtime states |
| §8-2 | Surface invariant (Play renders Resolve / vice versa) | ✅ PASS — Foundry is lifecycle-external; no Play/Resolve state rendering |
| §8-3 | Lock bypass | n/a — Foundry has no LOCKED states (lifecycle-external) |
| §8-4 | FD-6 violation (Resolve as feedback screen) | n/a — Foundry isn't Resolve |
| §8-5 | FD-5 violation (Center as menu/dashboard) | n/a — Foundry isn't Center |
| §8-6 | FD-4 violation (REEXPOSURE_DUE separate surface) | n/a — Foundry isn't Play |
| **§8-7** | **HARD LOCKED bypass (FORCED_RESET 시 Center 외 surface 접근)** | ✅ **ENFORCED — see §4.1 below** |
| §8-8 | Skip CTA on LOCKED | n/a — Foundry has no LOCKED states |

**§8 prohibitions directly attributable to Foundry step 5: ZERO new ones.** §8-7 is the only one in scope and it's already enforced by Center step.

### 4.1 §8-7 FORCED_RESET secondary block — three-layer enforcement verified

| Layer | Inner commit | Where | Evidence |
|---|---|---|---|
| **URL-level** | `d0d763c7` (Center 2C-1, Platform/Infra Mode) | `bty-app/src/middleware.ts:351-372` | Source-scope clause: `pathname === '/${locale}/bty/foundry' \|\| pathname.startsWith('/${locale}/bty/foundry/')` is part of the FORCED_RESET 307-redirect condition. On `userHasForcedResetPending(supabase, user.id) === true`, redirects to `/${locale}/center`. Inserted BEFORE the contract block (HARD LOCKED > LOCKED precedence). |
| **UI-level** | `0f160e54` (Center 2C-2, UI Mode) | `bty-app/src/components/bty/HubTopNav.tsx` | Both `arena` and `dear` theme branches gate `{hubPill(foundry, "Foundry", "foundry")}` inside `forcedResetActive ? null : (<>...</>)`. Foundry pill suppressed (not-rendered) during forced-reset. |
| **Test-pinned** | `a1800737` (Center 2D) | `bty-app/src/middleware.forced-reset-redirect.test.ts` test #3 | Asserts `/en/bty/foundry/insights` → 307 redirect to `http://localhost/en/center` with `x-forced-reset=redirect` header when `mockForcedReset.mockResolvedValue(true)`. |

**Verification by independent re-read in Phase 1 STEP 2:** middleware source-scope glob covers all Foundry sub-routes (`/bty/foundry`, `/bty/foundry/dojo-micro`, `/bty/foundry/program/[programId]`). HubTopNav suppression applies to all 5 mount sites (ArenaLayoutShell + CenterLayoutShell + LandingClient + journal + assessment) where Foundry pill would otherwise render. Test #3 codifies the contract.

**No additional Foundry-step §8 work needed.**

---

## 5. Foundry step 5 classification: VERIFICATION-ONLY

Plan A chosen by Commander (2026-05-14) over Plan B.1 (VISUAL_BEHAVIOR_SPEC §1.3 spec reconciliation — deferred to backlog) and Plan C (build out the spec's prescribed elements — greenfield not required by v1.1.1).

**Why Plan A is honest, not lazy:**
- v1.1.1 §5.4 (the locked semantic gate) is **permissive** about specific Foundry UI content. It locks lifecycle-external + no-in-scenario-interaction + FORCED_RESET secondary block — all three satisfied by the live `/bty/foundry` hub.
- FORCED_RESET secondary block — the only §8-flavored work that could have landed in Foundry step — was absorbed by Center step's middleware + nav suppression + tests because Foundry shares the same enforcement path as `/bty-arena/*` (per Center closure §4).
- VISUAL_BEHAVIOR_SPEC §1.3 prescribes specific Pattern Summary / Decision Replay / Hidden Stats / Trend Graph / Insights UI elements. The current Foundry hub lacks those as on-page elements (some live on `/bty/dashboard`, `/growth/history`). **This is a content-design gap, not a §8 violation** — VISUAL_BEHAVIOR_SPEC is an older design doc, NOT in v1.1.1's locking authority chain.

**Mirror of Play step 3 pattern**: Play step 3 was verification-only because 2D-1 (Resolve sub-phase) already absorbed the §8-2 production-path cleanup; the only remaining items were two `§8-Open` tensions explicitly handed to Center step (FORCED_RESET) and Hub step (NEXT_SCENARIO_READY). Foundry step 5 is verification-only because Center step 4 already absorbed the §8-7 enforcement work. **Verification-only is a legitimate closure class when prior steps absorbed the work** — neither Play nor Foundry was a skipped step.

---

## 6. Deferred backlog (Foundry-originated)

Three items, per Commander's Plan A condition (record explicitly, not silently dropped):

### 6.1 VISUAL_BEHAVIOR_SPEC §1.3 ↔ live-code content-design gap

- **Where**: `bty-app/docs/BTY_ARENA_VISUAL_BEHAVIOR_SPEC.md` §1.3 + §1.5 Screens 4-8 prescribe:
  - Header: "Your Pattern Summary"
  - Decision Replay (flow visual + summary text)
  - Stats Direction (↑ Integrity / → Resilience / ↓ Communication)
  - Trend Graph 14d (labelled history + mini annotations)
  - Insights Card Stack (What you did well / Opportunity / Suggestion)
  - Chatbot default ACTIVE
- **Live status**: `/bty/foundry` is a 3-card feature-hub (Mentor / Dashboard / Elite) + `ProgramRecommenderWidget` + Leaderboard link. None of the §1.3-prescribed elements appear ON this page. The analysis elements they describe (pattern signatures, leadership stage, AIR/TII metrics, trend graph, decision replay) likely live on `/bty/dashboard`, `/growth/history`, or are not built as consolidated UI.
- **Authority chain status**: `BTY_ARENA_VISUAL_BEHAVIOR_SPEC.md` is **NOT** in v1.1.1's locking authority chain (v1.1.1 §0 Changelog lists `BTY_ARENA_FIGMA_CODE_MAPPING.md`, `BTY_ARENA_VISUAL_BEHAVIOR_SPEC.md`, `BTY_Arena_-_QR_Action_System_Product_Spec_v1` as **참조 docs**, not authority sources for §8 gates). v1.1.1 §5.4 is the binding spec for Foundry semantics and it does not prescribe specific UI content — only lifecycle-external + no-in-scenario-interaction + FORCED_RESET secondary block.
- **Classification**: **content-design backlog**, NOT a §8 gap, NOT a v1.1.1 violation.
- **Future options (not committed by this closure)**:
  - **Plan B.1**: outer-doc-only edit to `bty-app/docs/BTY_ARENA_VISUAL_BEHAVIOR_SPEC.md` §1.3 to align with the live "hub" framing (acknowledge the design moved from per-screen analysis-element layout to a feature-hub routing pattern). **Note**: this would be an inner-repo edit (path is `bty-app/docs/...`) — would require inner commit + explicit `inner-main` ff-sync per 2C-1 lesson, NOT a pure outer-doc commit. Commander confirmation needed before going this route.
  - **Plan C**: build the §1.3 elements as on-page content (Pattern Summary header + Decision Replay panel + Hidden Stats Direction chips + 14d Trend Graph + Insights Card Stack on `/bty/foundry`). Multi-sub-phase greenfield (estimated chain 2A-2F like Resolve); justified only if Commander wants to invest in the §1.3 vision as the canonical Foundry product target.
  - **Plan deferred**: leave both unaddressed; record the gap; revisit during a future content-design sprint.
- **Recommendation**: deferred. The live Foundry hub is functional and routes users to the analysis surfaces that exist elsewhere; v1.1.1 compliance is intact; building the §1.3 vision is product enrichment, not §8 compliance.

### 6.2 Foundry vs Growth route coexistence — documentation gap

- **Where**: Live product has BOTH `/[locale]/bty/foundry` (Foundry hub: Mentor / Dashboard / Elite + ProgramRecommender) AND `/[locale]/growth` (Growth hub: Dojo / Integrity / Guidance / Journey / History). Both are tracked, clean, lifecycle-external.
- **Spec lineage**: `BTY_CURSOR_MASTER_PROMPT.md` Layer table + `BTY_MASTER_BUILD_V1.md` §1 Product Definition use the "Growth" name (one of 4 layers: Arena / Growth / Recovery / My Page) with `/growth/*` routes including `/growth/recovery` (now `/center` redirect alias per Center 2A) and `/growth/reflection`, `/growth/history`. v1.1.1 + `BTY_ARENA_VISUAL_BEHAVIOR_SPEC.md` use the "Foundry" name. The live product carries both vocabularies.
- **Parallel to Center**: This mirrors Center's route-lineage pattern (recorded in v1.1.1 §5.5.1 as the "Route lineage note" after Commander's 2A addition). Both Center and Foundry have the same pattern of "old specs use route X, newer specs/live product use surface name Y, live product retains X as a coexisting hub/alias."
- **Classification**: **documentation gap**, not entanglement. No doc currently records that Foundry and Growth are live coexisting hubs. Mirrors the kind of route-lineage note v1.1.1 §5.5.1 added for Center.
- **Future option (not committed by this closure)**: add a route-lineage note to v1.1.1 §5.4 like the §5.5.1 pattern, recording the Foundry/Growth coexistence and which doc lineage each name belongs to. This would be a v1.1.1 → v1.1.2 outer-doc-only edit (filename unchanged per `ba1d375` lesson). Light enough to bundle into a future cleanup pass; not blocking.
- **Recommendation**: deferred. The coexistence is functional; both routes work; no user-facing confusion has been surfaced. A future v1.1.2 patch can add the route-lineage note when convenient.

### 6.3 v1.1.1 §9 D2 — Foundry FORCED_RESET access-block UI representation

- **Per v1.1.1 §9**: D2 = "Foundry FORCED_RESET 접근 차단 UI 표현 | Center 코드화 시" (deferred decision item).
- **Current status**: **infra-level enforcement landed** in Center step:
  - Middleware (2C-1) redirects `/bty/foundry/*` → `/center` on FORCED_RESET — user IS blocked at the URL level
  - HubTopNav suppression (2C-2) hides the Foundry pill — user can't see the link to click
  - Test #3 in 2D pins the redirect
- **What's NOT built**: an explicit user-facing notice ("you were redirected from Foundry because Foundry is blocked during integrity reset"). The user is correctly blocked + redirected silently — they land on `/center` and see the ForcedResetUX, but no explanatory message tells them they tried to reach Foundry.
- **Classification**: **non-§8-blocker UX polish**. The user IS protected (HARD LOCKED enforced); they just don't get an explanatory toast/notice. Center step recorded this as a deferred backlog item ([STAGE2_CENTER_CLOSURE.md §6 item 2](STAGE2_CENTER_CLOSURE.md)) and Foundry step 5 re-confirms the deferral here.
- **Future option (not committed by this closure)**: small UI addition — when `ForcedResetUX` mounts, check if the redirect came from `/bty/foundry/*` (e.g. via referrer or a query param the middleware appends) and show a one-liner notice "Foundry is blocked during integrity reset". Small scope, non-blocking; recommend deferring to a content-polish sprint.
- **Recommendation**: deferred. Infra enforcement is correct; explicit UX notice is a nice-to-have, not §8 compliance.

---

## 7. Tests

| Metric | Pre-Foundry (Center 2D close `a1800737`) | After 2E (this closure) | Δ |
|---|---|---|---|
| Inner test files passed | 454 | 454 | 0 |
| Inner tests passed | 3255 | 3255 | 0 |
| Inner tests failed | 17 | 17 | 0 (baseline preserved across all Center sub-phases) |
| Inner tests skipped | 6 | 6 | 0 |
| Failure set | 7 files | same 7 files | unchanged ✓ |
| New tests added in Foundry step | — | **0** | Foundry step is outer-doc-only; no inner commits |

**No test changes in Foundry step.** The §8-7 enforcement tests landed in Center 2D (`a1800737`) — Foundry step 5 inherits them. The Foundry-specific test in 2D's middleware test (test #3 covering `/bty/foundry/*` redirect) is already passing per the 2D report.

---

## 8. Outer sync-debt set — exact measurement (gate (b))

Measured by `git status --short | wc -l` at 2E gate (b): **EXACTLY 30 entries**. **Identical set** to [STAGE2_CENTER_CLOSURE.md §8.1](STAGE2_CENTER_CLOSURE.md) (Center 2E closure). 0 anomalies; 0 changes; every entry traces to a known origin from prior Stage 2 steps (Lobby / Resolve / Center) or pre-Stage-2 (HK6/HK7/HK8/HK9).

### 8.1 Full classified set (unchanged from Center 2E §8.1)

| Group | Count | Source |
|---|---|---|
| **18 prior** (Play closure §7.1 set; HK6/HK7/HK8/HK9/Lobby + Resolve 2B/2C/2D-1) | 18 | unchanged |
| **2C-1** (Center middleware FORCED_RESET) | 3 | `middleware.ts`, `state-service.ts`, `state-service.test.ts` |
| **2C-2** (Center nav suppression) | 4 | `Nav.tsx`, `HubTopNav.tsx`, `BottomNav.tsx`, `useForcedResetActive.ts` |
| **2D** (Center tests) | 5 | `middleware.forced-reset-redirect.test.ts`, `useForcedResetActive.test.ts`, `Nav.test.tsx`, `HubTopNav.test.tsx`, `BottomNav.test.tsx` |
| **Foundry step 5** | **0** | this closure is outer-doc-only; no inner commits |
| **TOTAL** | **30** | 18 + 3 + 4 + 5 + 0 = 30 — matches measured count |

### 8.2 Disposition

All 30 entries are sync-debt per [HK8 closure clause 4](HK8_OUTER_INNER_SYNC_POLICY_CLOSURE.md#조항-4-5-leaks--sync-debt-not-anomaly) — inner-side implementation not yet integrated into outer HEAD. Forbidden mutations: `git checkout -- <file>`, `git restore`, deletion, recovery. Allowed disposition: post-Stage-2 leak-integration sprint per [INNER_PUSH_POLICY §5](../INNER_PUSH_POLICY.md).

The set will continue at 30 through Foundry step 5 (this closure adds 0 sync-debt). It will grow if Stage 2 step 6 (Hub) adds inner commits.

---

## 9. Gate 4-check (pre-mutation, this closure)

| Gate | Measurement | Verdict |
|---|---|---|
| (a) Outer/origin sync | `git fetch origin main`; rev-list `0 0`; local HEAD = `origin/main` = `c4b395d` | **ORIGIN_SYNC_OK** |
| (b) Known sync-debt set | **30 entries** measured by `git status --short \| wc -l`; identical set to Center 2E §8.1; 0 anomalies | **LEAKS_CLASSIFIED_OK** |
| (c) HK6 canonical untouched by this task | `getMyPageIdentityState.ts` = prior leak only; 0 fresh edits by Foundry 2E | **HK6_NOT_RE_EDITED_OK** |
| (d) Explicit-path staging | This closure stages 3 files only (this doc + `CURSOR_TASK_BOARD.md` + `CURRENT_TASK.md`); 0 sync-debt entries staged | **STAGING_CLEAN_OK** |

**4/4 PASS** → Foundry step 5 closure mutation entry authorized.

---

## 10. Self-application — closure invariants for Foundry step 5

| Invariant | Result |
|---|---|
| Mutation = outer-only, 3 files | ✅ this closure + 2 board updates |
| 30 sync-debt entries preserved | ✅ untouched, unstaged |
| HK6 canonical file re-edit = 0 | ✅ prior leak only |
| Explicit-path staging | ✅ specific paths, no `-A` / `-u` |
| Inner repo change = 0 | ✅ no `git -C bty-app` for code |
| `bty-app/` change = 0 | ✅ Plan A = outer-doc-only |
| No inventing scope | ✅ verification-only honored; VISUAL_BEHAVIOR_SPEC §1.3 / Foundry-Growth coexistence / D2 surfaced as explicit backlog items (Commander's Plan A condition) rather than silently dropped |
| 3 backlog items explicitly framed | ✅ §6.1, §6.2, §6.3 above |

---

## 11. Foundry sprint final state

- ✅ v1.1.1 §5.4 compliance verified — live `/bty/foundry` is lifecycle-external (0 runtime-state rendering), analysis-flavored hub, no in-scenario interaction
- ✅ v1.1.1 §2 — no row maps to Foundry (correct per Stage 1 §3.4 lifecycle-external)
- ✅ §8-7 FORCED_RESET secondary block ENFORCED + test-guarded (URL via 2C-1 middleware + UI via 2C-2 HubTopNav + test via 2D middleware test #3)
- ✅ Foundry step classification: VERIFICATION-ONLY (legitimate closure class; mirrors Play step 3)
- ✅ All 8 Foundry route files TRACKED + CLEAN; not in 30-entry sync-debt set; not in untracked-import problem set
- ⏸ 3 deferred backlog items (§6): VISUAL_BEHAVIOR_SPEC §1.3 content-design gap (non-§8); Foundry/Growth route coexistence documentation gap; v1.1.1 §9 D2 explicit UX notice (infra enforcement sufficient)
- ✅ Tests 17/3255/6 — exact baseline preserved; +0 new tests (no inner commits)
- ✅ Sync-debt unchanged at 30
- ⏭ Stage 2 step 6 = **Hub** (final Stage 2 step; per LOCKED order; inherits §8-Open #1 from Play closure §5.1 — NEXT_SCENARIO_READY rendered in Play with ownership pending D1 Lobby↔Hub merge decision)

---

## Discipline note

This closure is the **seventh** `docs/closures/` application after `HK9_CODENAME_SYNC_CLOSURE.md`, `HK9_ORPHAN_DOCS_CLOSURE.md`, `HK8_OUTER_INNER_SYNC_POLICY_CLOSURE.md`, `STAGE2_RESOLVE_CLOSURE.md`, `STAGE2_PLAY_CLOSURE.md`, `STAGE2_CENTER_CLOSURE.md`. The pattern (explicit-path stage, inner repo no-touch in closure commit, Commander-provided verbatim commit message, pre-commit gate verification, measurement-over-estimate for sync-debt) is preserved.

**Verification-only as a recurring legitimate closure class:** Play step 3 (verification-only because 2D-1 absorbed §8-2 production-path) and now Foundry step 5 (verification-only because Center step absorbed §8-7) both demonstrate that **a Stage 2 sub-phase can legitimately close without inner code changes** when prior sub-phases absorbed the work. The discipline is to record this honestly with explicit backlog items for any spec-vs-product gaps that exist outside the §8 scope, not to invent code work to "earn" a commit. Foundry step 5 surfaced 3 such backlog items (§6.1 VISUAL_BEHAVIOR_SPEC content gap; §6.2 Foundry/Growth coexistence; §6.3 D2 explicit notice) — all non-§8-blockers, all deferred with explicit framing per Commander's Plan A condition.

**Cross-step inheritance pattern (Stage 2 specific):** Resolve 2D-1 absorbed §8-2 production-path → Play step 3 verification-only. Center 2C-1+2C-2+2D absorbed §8-7 (Center primary + Foundry secondary) → Foundry step 5 verification-only. This inheritance pattern means Hub step 6 (the final Stage 2 step) inherits §8-Open #1 from Play step 3 (NEXT_SCENARIO_READY rendered in Play, pending D1 Lobby↔Hub merge decision) — Hub's scope cannot be verification-only if it must resolve D1.
