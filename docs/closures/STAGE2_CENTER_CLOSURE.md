# STAGE 2 CENTER — Closure

**Sprint**: Stage 2 step 4 (Center) — BTY Arena Cursor pipeline
**Closure date**: 2026-05-14
**Closure type**: Spec correction (v1.1 → v1.1.1) + FORCED_RESET sub-mode hardening (middleware redirect + nav suppression + 30 tests); §8-Open #2 RESOLVED
**Mutation scope this doc**: outer-only, 3 files (this closure + 2 board updates), 0 code changes
**Stage 2 LOCKED order**: Lobby → Resolve → Play → **Center** ← step 4/6 — Foundry → Hub (per v1.1.1 §11, [BTY_ARENA_STAGE1_FRAME_MAPPING_REPORT.md](../BTY_ARENA_STAGE1_FRAME_MAPPING_REPORT.md))
**Inner commit chain**: `b92bd0d9` (Resolve 2D-1) → `d0d763c7` (2C-1) → `0f160e54` (2C-2) → `a1800737` (2D)
**Outer HEAD at closure entry**: `540aaa7` (v1.1.1 spec correction); this commit advances outer by 1
**Authority docs touched in chain**: `docs/BTY_ARENA_SEMANTIC_LOCKING_TABLE_v1.1.md` (in-doc version marker v1.1 → v1.1.1; filename intentionally unchanged per Stage 0 `ba1d375` lesson)

---

## 1. Context — what Center is, why this sub-phase

Center is the BTY product's **recovery surface** per the 4-doc consensus (`BTY_ARENA_VISUAL_BEHAVIOR_SPEC.md` §1.4 + §1.5 Screens 9-13; `BTY_CURSOR_MASTER_PROMPT.md` Recovery layer; `BTY_MASTER_BUILD_V1.md` §6; `LEADERSHIP_ENGINE_SPEC.md` §5). It hosts Safe Mirror, Small Wins, Self-esteem Check, Healing Phase Tracker, Dear Me letters — the "회복" phase of the action → analysis → recovery product loop.

Center additionally hosts a **FORCED_RESET sub-mode** (Stage 4 forced reset per `LEADERSHIP_ENGINE_SPEC.md` §5): a system-friction hard interrupt with 48h lockout, compliance task surface, and HARD LOCKED navigation per v1.1.1 §5.5.2 + FD-5 + §8-7.

Pre-Center-step state:
- The live `/center` route shipped both modes correctly: default recovery hub (Mode A) + `ForcedResetUX` conditional render when `stage.currentStage === 4 || forcedResetTriggeredAt != null` (Mode B).
- v1.1 §5.5 / §8-5 framed Center entirely as the system-interrupt surface, banning the recovery hub framing — a **spec outlier** vs the 4-doc consensus.
- Play closure ([STAGE2_PLAY_CLOSURE.md §5.2](STAGE2_PLAY_CLOSURE.md#52-forced_reset_pending-rendered-as-play-gate-page-with-manual-link--ownership-stage-2-step-4-center)) backlogged §8-Open #2 to Center step ownership: FD-5 "full redirect" was NOT enforced at the route/middleware layer; sibling nav stayed clickable during forced-reset.

Center step goal: resolve the spec-vs-spec inconsistency, then close §8-Open #2 at both the URL level (middleware) and the UI level (nav suppression), with test coverage.

---

## 2. Sub-phase chain

| # | Commit | Date | Title | Scope |
|---|---|---|---|---|
| 2A | (inventory + blocker-class finding, no commit) | 2026-05-14 | Phase 1 inventory | Read-only mapping of `/[locale]/center/` (511 lines, 7 tracked files: `CenterPageClient.tsx` 386 lines + supporting shells + layout + page + error/loading) + `ForcedResetUX.tsx` (281 lines) + `HealingPhaseTracker.tsx` + i18n. **Blocker-class finding**: what looked like spec-vs-product contradiction was actually spec-vs-spec inconsistency — v1.1 §5.5 outlier vs 4-doc consensus. STOPPED for Commander decision. |
| 2A → β | (Commander decision, no commit) | 2026-05-14 | Option β: correct v1.1, keep shipped product | Commander confirmed v1.1 §5.5 is the correction target. Sub-phase plan: 2B (spec correction) → 2C-1 (middleware) → 2C-2 (nav suppression) → 2D (tests) → 2E (closure). |
| 2B | `540aaa7` (outer) | 2026-05-14 | v1.1 → v1.1.1 §5.5/§8-5/§6 scope correction | Outer doc commit. §5.5 split into §5.5.1 (default recovery surface, 4-doc citation + route lineage note) + §5.5.2 (FORCED_RESET override sub-mode). §8-5 scoped to sub-mode. §6 scope clarifier + §6.2/§6.3 header reframe. §0 Changelog v1.1.1 entry. §12 Memory block v1.1.1 line. Footer `v1.1.1 frozen`. **Filename unchanged** per `ba1d375` lesson; in-doc version marker only. FD-1~6 / §2 row mappings / §8 prohibition semantics (1/2/3/4/6/7/8) / §11 LOCKED order — unchanged. |
| 2C-1 | `d0d763c7` (inner) | 2026-05-14 | Middleware FORCED_RESET redirect (Platform/Infra Mode) | Inner code. Added `userHasForcedResetPending(supabase, userId)` to `src/lib/bty/leadership-engine/state-service.ts` + 4 unit tests. Added 307-redirect clause to `src/middleware.ts` BEFORE the existing `userHasBlockingArenaActionContract` block (HARD LOCKED > LOCKED precedence). Source scope: `/[locale]/bty-arena/*` + `/[locale]/bty/foundry/*` (v1.1.1 §5.4 secondary block); target `/[locale]/center`; debug header `x-forced-reset=redirect`. Auth/deploy impact: none (read + redirect, same cookie reassertion pattern as contract block, edge-runtime compatible). |
| 2C-2 | `0f160e54` (inner) | 2026-05-14 | Nav suppression (UI Mode) | Inner code. New shared hook `src/components/bty/navigation/useForcedResetActive.ts` (module-level fetch dedup: 60s TTL + in-flight singleton; loading/error default = NOT-suppressed for UX safety). Edited `Nav.tsx` (defensive, zero live consumers), `HubTopNav.tsx` (both arena + dear theme branches gated), `BottomNav.tsx` (grid-cols-1 vs grid-cols-3). What stays visible during FORCED_RESET: Center link only + `trailing` slot (LangSwitch + LogoutButton) for HubTopNav — language flip is not a surface escape, LogoutButton MUST stay for security. What's hidden: Arena + Foundry pills, sub-pills (Dashboard / Leaderboard / My Page / My Account), divider, BottomNav Arena + My Page tabs. **Suppression = not-render** (stronger than disable) per v1.1.1 §5.5.2. |
| 2D | `a1800737` (inner) | 2026-05-14 | Tests for 2C-1 + 2C-2 | Inner tests only (5 new files, 30 cases). `middleware.forced-reset-redirect.test.ts` (8: Arena→/center en/ko, Foundry→/center, /center self-no-loop, inactive fall-through, FORCED_RESET wins over contract, /bty/login bypass, /bty/dashboard not-Foundry-parent guard); `useForcedResetActive.test.ts` (8: true/false return, loading default, !r.ok 401, network error, cache hit dedup, in-flight singleton, cache reset for test isolation); `Nav.test.tsx` (4); `HubTopNav.test.tsx` (5: both themes); `BottomNav.test.tsx` (5: grid-cols + a11y + ko). All 30 pass on first run; **0 prod bugs surfaced**. Inner baseline 17 failures preserved (passed 3225 → 3255). |
| 2E | (this closure) | 2026-05-14 | Center closure doc | Outer doc commit. Records v1.1.1 correction, §8-Open #2 resolution, Mode A compliance, deferred backlog, exact sync-debt count (30). |

---

## 3. The spec-vs-spec inconsistency: blocker-class finding + resolution

### 3.1 What Phase 1 found

Live `/center` route is a fully-built recovery hub (Dear Me letters + Resilience log + Self-esteem Assessment + Healing Phase Tracker + Stage Context Card) with `<ForcedResetUX>` as a conditional sub-mode for stage 4. Tone is "calm, warm" — "쉼터 / Your reset space / 안전한 공간 / 치유받는 방". Center is a top-level main-nav item (`Nav.tsx`, `HubTopNav.tsx`, `BottomNav.tsx`) — user-initiated navigation freely permitted.

v1.1 §5.5 framed Center as exclusively "system interrupt surface (FD-5)"; §8-5 banned "menu / dashboard / safe room 톤" globally; §5.5 stated "접근 경로: server gate 강제 (유저 자발 navigation 아님)" — user-initiated nav forbidden.

Phase 1's first read: **product-identity contradiction** (gut existing Center vs revise v1.1). Surfaced 3 Commander-decision options: α (spec wins, rebuild Center), β (product wins, revise v1.1), γ (hybrid split route).

### 3.2 Commander's reframe (2026-05-14)

Not a contradiction — a **spec-vs-spec inconsistency**. The other 4 FINAL LOCKED docs define Center as a recovery surface:

| Doc | Evidence |
|---|---|
| `BTY_ARENA_VISUAL_BEHAVIOR_SPEC.md` | §1.4 Center block table (One Liner "You are safe here." + Safe Mirror + Small Wins Tile + Self-esteem Indicator + Tiny Recovery Curve) + §1.5 Artboard Screens 9-13 (Center Entry / Safe Mirror / Small Wins Capture / Self-esteem Check / Center Mini Recovery) + §3 톤 ("Center: Calm, Warm — 정서 안정 — Warm pastels"). The strongest direct evidence. |
| `BTY_CURSOR_MASTER_PROMPT.md` | Layer table "Recovery — protection"; Feel "Recovery — structured reset, not failure"; Recovery section "calm structured reset, not shame; short prompt: pressure pattern → what must reset → re-entry commitment"; `RecoveryEntry` domain model. |
| `BTY_MASTER_BUILD_V1.md` | §1 Product Definition "Recovery — Protection"; §2 Core Loop "Arena → Reflection → Recovery (if needed) → My Page → next Arena cycle"; §6 Screen Roles "Recovery — Pressure reset, short re-entry fields, return to Growth / Arena". |
| `LEADERSHIP_ENGINE_SPEC.md` §5 | Stage4 forced reset is deterministic but is **one of 4 stages**, not the entire engine — implies Stage1–3 are the normal recovery operation; only Stage4 is the hard-interrupt sub-mode. |

**v1.1 §5.5 was the outlier.** Commander Option β: correct v1.1 to v1.1.1, keep the shipped product as the canonical Mode A.

**Route lineage nuance** (2A's 4-doc cross-check surfaced; recorded in §5.5.1 of v1.1.1): 2 of the 4 docs (CURSOR_MASTER_PROMPT, MASTER_BUILD_V1) route Recovery at `/[locale]/growth/recovery` — the older architecture. Live product consolidated Recovery + Dear-Me at `/[locale]/center` via `bty-app/src/middleware.ts:133-146` `/dear-me → /center` 301 alias. `/center` is the canonical recovery route; `/growth/recovery` references in older specs are historical lineage. This is recorded so future readers don't hit the same path confusion.

### 3.3 What v1.1.1 changed

| Change | Where |
|---|---|
| Title marker `v1.1` → `v1.1.1` + new "Filename note" preamble (filename unchanged per `ba1d375`) | L1 of `docs/BTY_ARENA_SEMANTIC_LOCKING_TABLE_v1.1.md` |
| `§0 Changelog` header v1 → v1.1.1; new "v1.1 → v1.1.1 (2026-05-14)" sub-section with change ledger + "FD-1~6 / §2 row mappings / §8 prohibition semantics (1/2/3/4/6/7/8) / §11 LOCKED order — 변경 없음" guarantee | `§0` |
| §5.5 rewritten: §5.5.1 default recovery surface (4-doc citation + route lineage note) + §5.5.2 FORCED_RESET override sub-mode (Stage4 trigger; FD-5 full redirect; HARD LOCKED §8-7; compliance task surface) | `§5.5` |
| §6 top-level scope clarifier: "§6 전체는 §5.5의 FORCED_RESET sub-mode에 적용. Default recovery mode는 §6 prohibition 대상이 아님" | `§6` |
| §6.2 header `Center 내 UI 금지 사항` → `FORCED_RESET sub-mode 내 UI 금지 사항` + added "default recovery surface UI 가려져야 함" bullet | `§6.2` |
| §6.3 header `Center 내 UI 필수 사항` → `FORCED_RESET sub-mode 내 UI 필수 사항`; cited `LEADERSHIP_ENGINE_SPEC.md` §4 (activation weight 2.0) and §5 (completion verification) | `§6.3` |
| §8-5 rewritten: sub-mode scope; "Default recovery mode에는 §5.5.1에 따라 menu/dashboard pattern + calm·warm 톤 허용 — 이는 v1.1.1 violation 아님" | `§8-5` |
| §12 Memory block: new v1.1.1 entry alongside existing v1.1 entry | `§12` |
| Footer Status: `v1.1 frozen` → `v1.1.1 frozen (Center §5.5/§8-5/§6 scope 정확화, 2026-05-14, Stage 2 step 4 sub-phase 2B)` | footer |

**Unchanged sections** (per 2A confirmation, re-verified): FD-1 through FD-6 frozen decisions; §1 Core Principle; §2 row 8 (`FORCED_RESET_PENDING → Center, HARD LOCKED`); §3 FD-5 ("Center hard interrupt, full redirect, modal 아님" — applies to sub-mode); §4 Lock 등급; §7 Re-exposure; §8 prohibitions 1/2/3/4/6/7/8 (only #5 scope clarified); §9 deferred items; §10 Stage 1 entry; §11 Stage 2 LOCKED order.

---

## 4. §8-Open #2 closure — FORCED_RESET enforcement

[STAGE2_PLAY_CLOSURE.md §5.2](STAGE2_PLAY_CLOSURE.md#52-forced_reset_pending-rendered-as-play-gate-page-with-manual-link--ownership-stage-2-step-4-center) backlogged §8-Open #2 to Center step ownership. Status: **RESOLVED in 2C-1 + 2C-2**, test-guarded in 2D.

### 4.1 Gap (a): URL-level enforcement — landed in 2C-1 (`d0d763c7`)

- **Mechanism**: New 307-redirect clause in `bty-app/src/middleware.ts` at L351-372 (BEFORE the existing `userHasBlockingArenaActionContract` block — HARD LOCKED > LOCKED precedence).
- **Helper**: `userHasForcedResetPending(supabase, userId)` exported from `src/lib/bty/leadership-engine/state-service.ts` — reads `leadership_engine_state.forced_reset_triggered_at IS NOT NULL`. Open-on-failure error handling (returns `false` on db error; mirrors `userHasBlockingArenaActionContract` pattern). 4 unit tests in `state-service.test.ts`.
- **Source scope**: `/[locale]/bty-arena` + `/[locale]/bty-arena/*` (v1.1.1 §2 row 8) + `/[locale]/bty/foundry` + `/[locale]/bty/foundry/*` (v1.1.1 §5.4 secondary block).
- **Excluded** from source scope: `/center/*` (target — avoids infinite loop), `/api/*` (already excluded by middleware early-return), `/bty/login` (outside source scope, auth path preserved).
- **Headers**: `x-mw-hit=1`, `x-mw-user=1`, `x-forced-reset=redirect`; cookie reassertion via `reassertAuthCookiesPathRoot`.
- **Precedence**: When both FORCED_RESET and a blocking contract are true, the forced-reset clause fires first and the contract block never runs. The contract redirect target (`/bty?arena_contract=resolve`) is unreachable in this case — HARD LOCKED ("Center 외 모든 surface 접근 금지", §4.1) outranks LOCKED ("다른 화면 진입은 허용").
- **Auth/deploy impact**: none. Read + redirect; same Supabase SSR pattern as contract block; edge-runtime compatible; +~30 lines middleware bundle.

### 4.2 Gap (b): UI-level enforcement — landed in 2C-2 (`0f160e54`)

- **Mechanism**: Shared client hook `useForcedResetActive()` at `src/components/bty/navigation/useForcedResetActive.ts`. Fetches `GET /api/arena/leadership-engine/state`, returns `forcedResetTriggeredAt != null`. Loading/error default = `false` (NOT-suppressed) per Phase 1 recommendation — false-suppression on a normal user is a worse UX bug than a brief nav-visible window for a forced-reset user (whom 2C-1's middleware already redirects). Module-level dedup: 60s TTL cache + in-flight promise singleton — multiple nav components on one page share a single fetch.
- **Suppression scope**:
  - `HubTopNav.tsx` (both `arena` + `dear` theme branches): when active → Arena pill, Foundry pill, divider, sub-pills (Dashboard / Leaderboard / My Page / My Account) NOT rendered. Center pill + `trailing` (LangSwitch + LogoutButton) stay.
  - `BottomNav.tsx`: when active → `grid-cols-1` with only Center tab. Arena (btyARENA) and My Page tabs NOT rendered. `<nav>` element + `aria-label` preserved for a11y.
  - `Nav.tsx` (defensive — zero live consumers; future-proofs the file): when active → Center link only; Foundry, Arena, language toggle NOT rendered.
- **Why `trailing` stays**: LangSwitch is a locale flip, not a surface escape. LogoutButton MUST stay accessible for security — a user must always be able to log out.
- **Suppression method**: not-render (stronger than disable) per v1.1.1 §5.5.2 "자발 navigation 금지". `<nav>` element + `aria-label` preserved for screen-reader semantics.

### 4.3 Test guards — 2D (`a1800737`)

30 tests across 5 new files, all passing on first run, **0 prod bugs surfaced**:

| File | Cases | Coverage |
|---|---|---|
| `bty-app/src/middleware.forced-reset-redirect.test.ts` | 8 | Source-scope match (Arena en/ko, Foundry secondary block), Center self-no-loop, inactive fall-through, FORCED_RESET precedence over contract, /bty/login auth bypass, /bty/dashboard not-Foundry-parent guard |
| `bty-app/src/components/bty/navigation/useForcedResetActive.test.ts` | 8 | true/false return, loading default, !r.ok (401), network error, dedup cache hit, in-flight singleton sharing, `__resetForcedResetActiveCacheForTests` for isolation |
| `bty-app/src/components/Nav.test.tsx` | 4 | Forced-reset inactive (4 links), active (Center only), loading default, ko locale-agnostic |
| `bty-app/src/components/bty/HubTopNav.test.tsx` | 5 | Both theme branches (arena + dear) gated symmetrically; trailing slot preserved; loading default NOT-suppressed |
| `bty-app/src/components/bty/navigation/BottomNav.test.tsx` | 5 | grid-cols-3 vs grid-cols-1, loading, a11y (`<nav>` + aria-label preserved), ko locale-agnostic |

---

## 5. Mode A (recovery hub) status: compliant with v1.1.1, no code changes

Phase 1's tone audit found `/center` Mode A copy/structure:
- Title: "Center — 나의 쉼터" / "Center — Your reset space"
- i18n: "센터, 듣고 있어요." / "아늑한 방에서 쉬어가요." / "치유받는 방이에요." / "회복과 재정비의 공간이에요."
- Components: `<StageContextCard>` + `<HealingPhaseTracker>` + `<DearMeCard>` + `<ResilienceCard>` + `<AssessmentCard>` (the recovery-hub menu/dashboard pattern)

Under v1.1.1 §5.5.1: **all compliant**. The corrected §5.5.1 explicitly allows calm·warm tone, voluntary navigation, and the recovery surface pattern. The §8-5 prohibition (menu/dashboard/safe-room tone) is sub-mode-scoped per v1.1.1 — does not apply to Mode A. **No Mode A code changes were needed** in 2A → 2E.

The 2 of 4 docs that historically routed Recovery at `/growth/recovery` (CURSOR_MASTER_PROMPT, MASTER_BUILD_V1) have no impact on Mode A's correctness — the live `/center` consolidation is the canonical route, documented in v1.1.1 §5.5.1's route lineage note.

---

## 6. Deferred backlog (Center-originated)

| # | Item | Rationale | Owner |
|---|---|---|---|
| 1 | **`BtyArenaRunPageClient.tsx:1031-1065` FORCED_RESET gate-page removal** | Intentionally retained for coexistence safety (like Resolve 2B's pattern). After 2C-1's middleware redirect, this gate-page is unreachable in practice (middleware intercepts before render). Removal is a separate later step after deployed-environment verification of the middleware redirect — not blocking. | Center follow-up (post-deploy verification) |
| 2 | **v1.1.1 §9 D2: Foundry FORCED_RESET 접근 차단 UI 표현** | Infra enforcement landed (2C-1 middleware redirects `/bty/foundry/*` to `/center`; 2C-2 hides Foundry pill in HubTopNav during FORCED_RESET). **Explicit UI representation** of "you were redirected because Foundry is blocked during forced reset" is NOT built — the user is redirected silently without an explanatory notice. Recorded as a content gap, not a §8 structural violation. | Optional UX polish; not a §8-blocker |
| 3 | **v1.1.1 §9 D5: 48h lockout timer UI 표현** | **Addressed by existing `ForcedResetUX.tsx`** countdown timer (L181-189 — `formatHms(remainingMs)` with `aria-live="polite"`). No follow-up needed for D5 itself. Recorded here for traceability. | CLOSED — already shipped pre-Stage-2 |
| 4 | **v1.1.1 §6.3: "현재 reset 사유 명시 (어떤 pattern / 어떤 axis)"** | Phase 1 found `ForcedResetUX.tsx` shows a generic 3-item checklist (stabilize / boundary / accountability) but does NOT surface the specific `pattern_family` / `axis` that triggered the forced reset. Content gap — required by §6.3. Not §8-2 structural; doesn't block Center step closure. | Center follow-up content task |
| 5 | **JSON-engine ACTION_REQUIRED relocation** (inherited from Resolve 2D-2 backlog) | Independent of Center; not Center-step scope; recorded for cross-reference. | Future sub-phase (per Resolve closure §6) |

The §8-Open #1 from Play closure (NEXT_SCENARIO_READY rendered in Play; ownership Stage 2 step 6 Hub) is NOT touched by Center step — it remains Hub's job per [STAGE2_PLAY_CLOSURE.md §5.1](STAGE2_PLAY_CLOSURE.md#51-next_scenario_ready-rendered-in-play--ownership-stage-2-step-6-hub).

---

## 7. Tests

| Metric | Pre-Center (Play close `c9e8dfa`) | After 2D (`a1800737`) | Δ |
|---|---|---|---|
| Inner test files passed | 449 | 454 | +5 (5 NEW test files in 2D) |
| Inner tests passed | 3221 | **3255** | +34 (4 helper unit tests from 2C-1 + 30 from 2D) |
| Inner tests failed | 17 | **17** | 0 — baseline preserved across all 4 inner commits |
| Inner tests skipped | 6 | 6 | 0 |
| **Failure set** | 7 files (arena/n/session, arena/session/next, bty/healing, bty/q241, bty/q3, MyPageLeadershipConsole, delayed-outcome-e2e) | **same 7 files** | unchanged ✓ |
| New tests added | — | 34 (4 helper + 30 redirect/hook/nav) | all passing |
| Prod bugs surfaced by tests | — | **0** | tests codify shipped behavior |

---

## 8. Outer sync-debt set — **exact measurement** (gate (b))

Measured by `git status --short | wc -l` at 2E gate (b): **EXACTLY 30 entries**. Every entry traces to a known origin (0 anomalies).

### 8.1 Full classified set

| Group | Count | Entries |
|---|---|---|
| **18 prior** (Play closure §7.1 set; HK + Lobby + Resolve) | 18 | `bty-app/src/lib/bty/identity/getMyPageIdentityState.ts` (HK6 M), `bty-app/src/lib/bty/center/letterService.ts` (HK7 M), `bty-app/src/lib/bty/validator/layer2Semantic.ts` (HK7 M), `bty-app/src/lib/llm.ts` (HK7 D), `bty-app/src/features/my-page/logic/computeLeadershipState.ts` (HK8/HK9 M), `bty-app/src/app/[locale]/bty-arena/ArenaEntryClient.tsx` (Lobby M), `bty-app/src/app/[locale]/bty-arena/play/page.tsx` (Lobby M), `bty-app/src/app/[locale]/bty-arena/hooks/useArenaSession.ts` (2B Resolve M), `bty-app/src/app/[locale]/bty-arena/play/resolve/page.tsx` (2B M), `bty-app/src/app/[locale]/bty-arena/play/resolve/ArenaResolveClient.tsx` (2B ??), `bty-app/e2e/arena/arena-guards.spec.ts` (2C Resolve M), `bty-app/src/app/[locale]/bty-arena/BtyArenaRunPageClient.snapshot-gates.test.tsx` (2C M), `bty-app/.../play/resolve/ArenaResolveClient.test.tsx` (2C ??), `bty-app/.../play/resolve/ArenaResolveClient.empty-state-edge-case.test.tsx` (2C ??), `bty-app/.../play/resolve/page.test.tsx` (2C ??), `bty-app/src/app/[locale]/bty-arena/BtyArenaRunPageClient.tsx` (2D-1 M), `bty-app/.../BtyArenaRunPageClient.action-decision-503.integration.test.tsx` (2D-1 M), `bty-app/.../BtyArenaRunPageClient.json-reexposure.test.tsx` (2D-1 M) |
| **2C-1 added** (`d0d763c7` middleware FORCED_RESET) | 3 | `bty-app/src/middleware.ts` (M), `bty-app/src/lib/bty/leadership-engine/state-service.ts` (M), `bty-app/src/lib/bty/leadership-engine/state-service.test.ts` (M) |
| **2C-2 added** (`0f160e54` nav suppression) | 4 | `bty-app/src/components/Nav.tsx` (M), `bty-app/src/components/bty/HubTopNav.tsx` (M), `bty-app/src/components/bty/navigation/BottomNav.tsx` (M), `bty-app/src/components/bty/navigation/useForcedResetActive.ts` (??) |
| **2D added** (`a1800737` tests) | 5 | `bty-app/src/middleware.forced-reset-redirect.test.ts` (??), `bty-app/src/components/bty/navigation/useForcedResetActive.test.ts` (??), `bty-app/src/components/Nav.test.tsx` (??), `bty-app/src/components/bty/HubTopNav.test.tsx` (??), `bty-app/src/components/bty/navigation/BottomNav.test.tsx` (??) |
| **Total** | **30** | 18 + 3 + 4 + 5 = 30 — matches measured count |

### 8.2 Disposition

All 30 entries are sync-debt per [HK8 closure clause 4](HK8_OUTER_INNER_SYNC_POLICY_CLOSURE.md#조항-4-5-leaks--sync-debt-not-anomaly) — inner-side implementation not yet integrated into outer HEAD. Forbidden mutations: `git checkout -- <file>`, `git restore`, deletion, recovery. Allowed disposition: post-Stage-2 leak-integration sprint (outer fetches `inner-main` → cherry-pick → 4-check → push) per [INNER_PUSH_POLICY §5](../INNER_PUSH_POLICY.md).

The set will continue to grow as Stage 2 steps 5-6 (Foundry / Hub) accumulate inner commits.

---

## 9. Gate 4-check (pre-mutation, this closure)

| Gate | Measurement | Verdict |
|---|---|---|
| (a) Outer/origin sync | `git fetch origin main`; rev-list `0 0`; local HEAD = `origin/main` = `540aaa7` | **ORIGIN_SYNC_OK** |
| (b) Known sync-debt set | **30 entries** measured by `git status --short \| wc -l`; all classified (§8.1 above); 0 anomalies | **LEAKS_CLASSIFIED_OK** |
| (c) HK6 canonical untouched by this task | `getMyPageIdentityState.ts` = prior leak only; 0 fresh edits by 2E | **HK6_NOT_RE_EDITED_OK** |
| (d) Explicit-path staging | This closure stages 3 files only (this doc + `CURSOR_TASK_BOARD.md` + `CURRENT_TASK.md`); 0 sync-debt entries staged | **STAGING_CLEAN_OK** |

**4/4 PASS** → Center step closure mutation entry authorized.

---

## 10. Self-application — closure invariants for Center step 2E

| Invariant | Result |
|---|---|
| Mutation = outer-only, 3 files | ✅ this closure + 2 board updates |
| 30 sync-debt entries preserved | ✅ untouched, unstaged |
| HK6 canonical file re-edit = 0 | ✅ prior leak only |
| Explicit-path staging | ✅ specific paths, no `-A` / `-u` |
| Inner repo change = 0 | ✅ no `git -C bty-app` for code |
| `bty-app/` change = 0 | ✅ Option β closure = outer-doc-only |
| Sync-debt count by **measurement**, not estimate | ✅ `wc -l` says 30; classified table says 18+3+4+5=30; match |

---

## 11. Center sprint final state

- ✅ v1.1 → v1.1.1 §5.5/§8-5/§6 scope correction landed (`540aaa7`)
- ✅ §8-Open #2 RESOLVED — URL-level (2C-1 middleware redirect) + UI-level (2C-2 nav suppression) + test-guarded (2D, 30 tests)
- ✅ Mode A (default recovery surface) confirmed compliant with v1.1.1 §5.5.1 — no Mode A code changes needed
- ✅ Mode B (FORCED_RESET sub-mode) hardened per v1.1.1 §5.5.2 + §8-7 — `ForcedResetUX` countdown remains, middleware enforces full redirect, nav suppression enforces HARD LOCKED
- ✅ Inner commit chain `d0d763c7` (2C-1) → `0f160e54` (2C-2) → `a1800737` (2D); each with EXPLICIT `inner-main` ff-sync verification per 2C-1 lesson
- ✅ Tests 17/3255/6 — exact baseline failures preserved; +34 new tests passing; 0 prod bugs surfaced
- ⏸ 5 deferred backlog items (§6): gate-page removal post-deploy, D2 Foundry block UI representation (non-§8-blocker), §6.3 reset reason content gap; D5 timer already shipped; JSON-engine relocation inherited from Resolve backlog
- ⏭ Stage 2 step 5 = **Foundry** (per LOCKED order; lifecycle-external analysis surface; v1.1.1 §5.4 — FORCED_RESET secondary block already enforced by 2C-1+2C-2)

---

## Discipline note

This closure is the **sixth** `docs/closures/` application after `HK9_CODENAME_SYNC_CLOSURE.md`, `HK9_ORPHAN_DOCS_CLOSURE.md`, `HK8_OUTER_INNER_SYNC_POLICY_CLOSURE.md`, `STAGE2_RESOLVE_CLOSURE.md`, `STAGE2_PLAY_CLOSURE.md`. The pattern (explicit-path stage, inner repo no-touch in closure commit, Commander-provided verbatim commit message, pre-commit gate verification) is preserved.

**Measurement-over-estimate discipline (new in 2E):** the 2D report estimated sync-debt growth inconsistently ("18 → 25" while also "18 + 4 + 5 + 5"; neither summed correctly). 2E dispatch made measurement mandatory: gate (b) ran `git status --short` and classified every entry against `prior / 2C-1 / 2C-2 / 2D`. Measured count = 30 = 18 + 3 + 4 + 5. The 2D estimate was inaccurate in two ways: (1) it conflated 2C-1's 3 modified files with the eventual "added" count, (2) it didn't account for `state-service.ts` and `state-service.test.ts` as separate entries from `middleware.ts`. Discipline: future closures must measure, not estimate.

**Verification-only Mode A (Plan B's "no code change" prediction held):** Phase 1's Plan B prediction that "the shipped Center is already v1.1.1-compliant once the spec is corrected" was vindicated — 2A → 2E shipped zero code changes to Mode A (the recovery hub). All inner code (2C-1, 2C-2, 2D) was confined to FORCED_RESET sub-mode hardening: middleware redirect + nav suppression + their tests. The recovery hub product code is untouched.
