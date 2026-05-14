# STAGE 2 RESOLVE — Closure

**Sprint**: Stage 2 step 2 (Resolve) — BTY Arena Cursor pipeline
**Closure date**: 2026-05-14
**Closure type**: Production-path §8-2 resolved + JSON-engine relocation deferred (Commander Option B)
**Mutation scope this doc**: outer-only, 3 files (this closure + 2 board updates), 0 code changes
**Stage 2 LOCKED order**: Lobby → **Resolve** ← step 2/6 — Play → Center → Foundry → Hub (per v1.1 §11, [BTY_ARENA_STAGE1_FRAME_MAPPING_REPORT.md](../BTY_ARENA_STAGE1_FRAME_MAPPING_REPORT.md))
**Inner commits chain**: `7e4b33ca` (Lobby close) → `9dc9076c` (2B) → `d51bfb4c` (2C) → `b92bd0d9` (2D-1)
**Outer HEAD at closure entry**: `108a280` (Stage 2 Lobby complete); this commit advances outer by 1

---

## 1. Context — what Resolve is, why this sub-phase

Resolve is the BTY Arena **Action Gate** — runtime states `ACTION_REQUIRED` / `ACTION_SUBMITTED` / `ACTION_AWAITING_VERIFICATION` per v1.1 §5.3 / FD-6. It is the **Stage 2 sub-phase with the highest §8 prohibition violation risk** per v1.1 §11 (LOCKED state, §8-3/4/8 prohibitions on rendering Resolve UI inside the Play surface).

The pre-Resolve state of the codebase had `BtyArenaRunPageClient` rendering BOTH:
- The Play surface (PRIMARY_CHOICE → TRADEOFF → ACTION_DECISION)
- The Resolve surface (ACTION_REQUIRED gate, blocked surface, EmptyState fallback)

inside a single client component at `/[locale]/bty-arena/play`. This is a §8-2 violation: the user-facing surface boundary between "in-scenario play" and "post-decision action gate" was not enforced at the route level.

Resolve goal: separate the Resolve surface onto its own route `/play/resolve` rendered by a dedicated client (`ArenaResolveClient`), with `BtyArenaRunPageClient` rendering zero Resolve states.

---

## 2. Sub-phase chain

| # | Inner hash | Date | Title | Scope |
|---|---|---|---|---|
| 2A | (inventory only) | 2026-05-14 | Resolve inventory | Read-only mapping of L988-1066 production block + L618+ JSON-engine block + dependency graph; identified ITEM 2 EmptyState edge case |
| 2B | `9dc9076c` | 2026-05-14 | ArenaResolveClient production path created | Added `play/resolve/{ArenaResolveClient.tsx, page.tsx, layout.tsx}`; added `useArenaSession.ts` SavedArenaState schema slots for `jsonFlow`-family (writes deferred to 2D); BtyArenaRunPageClient untouched (both paths coexist temporarily) |
| 2C | `d51bfb4c` | 2026-05-14 | Test guardrail before 2D surgery | Migrated `snapshot-gates.test.tsx` P5 A/D to render ArenaResolveClient directly; FLIPPED `arena-guards.spec.ts` (`/play/resolve` no longer deprecated); +14 NEW tests across 3 new files; ITEM 2 EmptyState edge case **pinned** as a test |
| 2D-1 | `b92bd0d9` | 2026-05-14 | Production Resolve removal + navigation | Removed `BtyArenaRunPageClient` L987-1066 (production Resolve render branch + 3-way fallback); added `useRouter` + transition useEffect that `router.push`es to `/play/resolve` on `s.arenaActionBlocking` false→true; re-pointed `action-decision-503` test to assert navigation; added next/navigation mock to `json-reexposure.test.tsx` as infra-only fix; explicit `inner-main` ff-sync verified `main == inner-main == b92bd0d9` |
| 2D-2 | **DEFERRED** | — | JSON-engine ACTION_REQUIRED relocation | **Option B per Commander decision (2026-05-14)** — see §3 |

---

## 3. §8-2 status

### 3.1 Production path — **RESOLVED**

- **Before 2D-1**: `BtyArenaRunPageClient.tsx:988-1066` rendered the production Action Gate inline. User on `/[locale]/bty-arena/play` saw both Play and Resolve surfaces from the same client component.
- **After 2D-1**: That block is gone (replaced by `if (s.arenaActionBlocking) { return null; }` while the new useEffect navigates to `/play/resolve`). The Action Gate is rendered exclusively by `ArenaResolveClient` at `/[locale]/bty-arena/play/resolve`.
- **Verification**: 2C+2D-1 test suite asserts the route separation; `arena-resolve-main-pending-contract` testid lives in `ArenaResolveClient`, `arena-play-main-pending-contract` testid is gone, navigation spy records `router.push("/en/bty-arena/play/resolve")` on the AD1→503→ACTION_REQUIRED in-app flow.
- **User-facing surface boundary**: enforced. v1.1 §8-2 user-facing compliance for the production path = **resolved**.

### 3.2 JSON-engine path — **explicitly out of §8 user-facing scope**

- **Status**: the `json-engine-action-required` block at `BtyArenaRunPageClient.tsx:643-844` (~202 lines) remains in place, unchanged by 2D-2.
- **Scope label**: this path is **non-production / dev-catalog-gated**. It is gated by `jsonCatalogDevMode` (`process.env.NODE_ENV !== "production"` + a few dev-mode env vars at BtyArenaRunPageClient.tsx:244-249). It is **NOT** part of the §8 user-facing compliance closure that protects real-user surface boundaries — it is a developer-tool surface (debugging the action-contract flow via the JSON catalog) that real users never reach.
- **Why this OPEN status does NOT mean §8-2 user-facing compliance is incomplete**: §8-2 exists to protect user-facing surface boundaries between Play and Resolve. The user-facing surface IS resolved (§3.1). The JSON-engine path is a dev tool whose §8 status is documented as **OPEN / backlogged**, not **VIOLATING / blocking**. Closing the JSON-engine §8 leak is a code-hygiene improvement, not a user-facing compliance gate.
- **Backlog**: see §6 — the deferred 2D-2 sub-phase.

---

## 4. ITEM 2 EmptyState edge case — Commander-approved intentional behavior change

### 4.1 What was removed

`BtyArenaRunPageClient.tsx:1042-1050` (pre-2D-1) contained a 3rd-way fallback inside the production Resolve render branch:

```tsx
) : (
  <div data-testid="arena-play-action-block-no-contract-payload" className="mt-4">
    <EmptyState
      icon="📋"
      message={t.arenaRunErrorTitle}
      hint={t.arenaRunErrorDescription}
    />
  </div>
)
```

This branch handled the **null-snapshot edge case**: `s.arenaActionBlocking === true` AND `s.pendingActionContract === null` AND `gateSnapshot === null` (both `effectiveArenaSnapshot` and `arenaServerSnapshot` null). It rendered an EmptyState placeholder.

### 4.2 What ArenaResolveClient does instead

`ArenaResolveClient.tsx` collapses this to a 2-way fallback. When `gateSnapshot` is null (or `runtime_state` is not in the Resolve domain), the component **early-returns `null`** and the `useEffect` calls `router.replace('/${locale}/bty-arena/play')`. The EmptyState branch is **unreachable by design**.

### 4.3 Why this is intentional, not an accidental drop

- The EmptyState branch in BtyArenaRunPageClient was a safety net for a **logically impossible hook state** — `arenaActionBlocking === true` with `null` snapshot would be a `useArenaSession` bug, not a real Arena runtime state.
- The new redirect-to-Play behavior is **more semantically correct** under v1.1 §4.3 transition table: if the Resolve route has no Resolve runtime state to render, the canonical Play surface is the right fallback.
- **Commander approval**: this judgment call was made in the 2C dispatch (per "no clarifying questions" instruction) and explicitly affirmed in the 2D-1 dispatch (under STEP 3: *"The EmptyState branch removal is an APPROVED INTENTIONAL behavior change per the ITEM 2 judgment call (Commander-confirmed)"*).
- **Pinned by test**: `bty-app/src/app/[locale]/bty-arena/play/resolve/ArenaResolveClient.empty-state-edge-case.test.tsx` (added in 2C) codifies the new behavior — `arenaActionBlocking=true` + null snapshot → `router.replace('/${locale}/bty-arena/play')` + `container.firstChild === null` + `arena-play-action-block-no-contract-payload` testid absent.

This record exists so the EmptyState removal is never mistaken for an accidental drop in future code archaeology.

---

## 5. 2B schema-slot correction (record of the inaccuracy)

### 5.1 What 2B did

`useArenaSession.ts:170-182` added 7 optional fields to the `SavedArenaState` localStorage persist shape:

```ts
// Sub-phase 2B addition (Stage 2 step 2 Resolve route): JSON-engine dev-path state
// for cross-route survivability when the line-618 inline rendering relocates to
// ArenaResolveClient in sub-phase 2D. Until 2D wires the writes, these fields
// default to undefined on load — equivalent to fresh state, no migration needed.
jsonFlow?: RuntimeFlowContext | null;
jsonEngineState?: "ACTION_REQUIRED" | "NEXT_SCENARIO_READY" | null;
jsonSelectedPrimary?: string | null;
jsonSelectedTradeoff?: string | null;
jsonSelectedActionDecision?: string | null;
jsonReExposureDueCandidate?: boolean | null;
jsonNoChangeRisk?: string | null;
```

These are **type declarations only**. The comment block (also added in 2B) explicitly noted "Until 2D wires the writes, these fields default to undefined on load."

### 5.2 The inaccuracy in the 2D-2 dispatch context

The 2D-2 dispatch as originally written stated:

> "2B added jsonFlow-family fields to SavedArenaState (useArenaSession persist shape) … These persist across route navigation already."

The second clause ("persist across route navigation already") is **factually wrong**. Verification in 2D-2 STEP 1:

| Check | Result |
|---|---|
| `saveState({…, jsonFlow, …})` calls in `useArenaSession.ts` | **0** (verified across all 8 `saveState` call sites at lines 831, 988, 1014, 1155, 2006, 2253, 2343) |
| `saved.jsonFlow` / `saved.jsonEngineState` reads | **0** (verified across all `loadState()` consumers) |
| Field exposure through `useArenaSession` return object | **0** |
| `React.useState` for `jsonFlow` in `BtyArenaRunPageClient.tsx` | **L91** — component-local, not lifted |

### 5.3 What the actual state is

All JSON-engine state (jsonFlow, jsonEngineState, jsonSelectedPrimary/Tradeoff/ActionDecision, jsonReExposureDueCandidate, jsonNoChangeRisk, plus the form state contractWho/What/When/Evidence + lifecycle flags) lives **purely as `React.useState` in BtyArenaRunPageClient.tsx** (lines 85-104). 2B added the SCHEMA slot, not the persistence or hook exposure.

This correction is recorded so future sub-phases (the deferred 2D-2 or any successor) do not assume the persist wiring exists when it does not. The actual state lift into `useArenaSession` is what a future JSON-engine sub-phase must do.

---

## 6. Deferred backlog (Resolve-originated)

| # | Item | Origin | Notes |
|---|---|---|---|
| 1 | **JSON-engine ACTION_REQUIRED relocation + state lift into `useArenaSession`** | 2D-2 (Option B deferral) | The deferred sub-phase. Requires wiring the 2B-prepared SavedArenaState schema (saveState/loadState + hook exposure), moving JSON-flow setters into the hook, adding a JSON-engine navigation trigger (`jsonEngineState === "ACTION_REQUIRED"` → push to /play/resolve), then relocating `BtyArenaRunPageClient.tsx:643-844` INTACT into `ArenaResolveClient`. Estimated scope ~250-400 lines diff. Risk profile: useArenaSession.ts is a 2400-line state machine — higher risk than 2D-1's BtyArenaRunPageClient surgery. Dev-only path; zero production-user exposure. |
| 2 | **Orphan `ArenaResolveScreen.tsx` cleanup** | 2A inventory | §8-4-violating component; never rendered by any route after 2B; safe to delete after 2D-2 lands (kept untouched during Resolve to avoid scope creep). |
| 3 | **`AWAITING_VERIFICATION` vs `ACTION_AWAITING_VERIFICATION` naming** | 2A inventory | Naming inconsistency between snapshot runtime state literal and gate component prop — v1.2 normalization. Non-blocking. |
| 4 | **D3 (micro-feedback range) / D6 (approver scan flow)** | v1.1 §9 deferred items | Reviewed at Resolve code-time, confirmed non-§8-blockers, remain deferred. |
| 5 | **Borderline JSON-engine framing — "Action commitment recorded" feedback-style copy** | 2A inventory | Framing-cleanup pass, separate from 2D-2 relocation. Q6 said "relocate intact" — so if 2D-2 ever runs, the borderline framing relocates as-is and this cleanup item still applies. |

---

## 7. Tests

| Metric | Value | Note |
|---|---|---|
| Inner test baseline | **17 failed / 3221 passed / 6 skipped** | At 2D-1 close (`b92bd0d9`). Identical to 2C close. Identical failure set to pre-Resolve baseline (arena/n/session 4, arena/session/next 5, bty/healing 4, bty-healing smoke 1, bty-healing-awakening Q3 1, MyPageLeadershipConsole 1, delayed-outcome-e2e 1). |
| Tests added during Resolve | **+14** | 2C: 9 in `ArenaResolveClient.test.tsx` + 3 in `ArenaResolveClient.empty-state-edge-case.test.tsx` + 2 in `play/resolve/page.test.tsx`. |
| Tests migrated / re-pointed | **6** | 2C: snapshot-gates P5 A (3) + P5 D (1) migrated to render `ArenaResolveClient`; arena-guards `/play/resolve` test flipped. 2D-1: action-decision-503 end-state assertion re-pointed to assert navigation. |
| Tests left as-is (deferred) | **1** | `json-reexposure.test.tsx` — 2D-1 added next/navigation mock as infra-only fix; assertions still point at `BtyArenaRunPageClient` testids per dispatch (re-pointing belongs to the deferred 2D-2). |
| Tests broken at end of Resolve | **0 new** | All 17 baseline failures are pre-existing; same files as before Stage 2. |

---

## 8. Outer sync-debt set

### 8.1 Inventory at this closure entry

Outer working tree showed **18 entries** at gate (b) for this closure:

| Origin | Count | Files |
|---|---|---|
| HK6 (prior) | 1 | `bty-app/src/lib/bty/identity/getMyPageIdentityState.ts` (M) |
| HK7 (prior) | 3 | `bty-app/src/lib/bty/center/letterService.ts` (M), `bty-app/src/lib/bty/validator/layer2Semantic.ts` (M), `bty-app/src/lib/llm.ts` (D) |
| HK8/HK9 (prior) | 1 | `bty-app/src/features/my-page/logic/computeLeadershipState.ts` (M) |
| Lobby refactor (prior) | 2 | `bty-app/src/app/[locale]/bty-arena/ArenaEntryClient.tsx` (M), `bty-app/src/app/[locale]/bty-arena/play/page.tsx` (M) |
| 2B Resolve | 4 | `bty-app/src/app/[locale]/bty-arena/hooks/useArenaSession.ts` (M), `bty-app/src/app/[locale]/bty-arena/play/resolve/page.tsx` (M), `bty-app/src/app/[locale]/bty-arena/play/resolve/ArenaResolveClient.tsx` (??), (+ `layout.tsx` inner-side, may not appear depending on outer view) |
| 2C Resolve | 5 | `bty-app/.../arena-guards.spec.ts` (M), `bty-app/.../BtyArenaRunPageClient.snapshot-gates.test.tsx` (M), `bty-app/.../play/resolve/ArenaResolveClient.test.tsx` (??), `bty-app/.../play/resolve/ArenaResolveClient.empty-state-edge-case.test.tsx` (??), `bty-app/.../play/resolve/page.test.tsx` (??) |
| 2D-1 Resolve | 3 | `bty-app/.../BtyArenaRunPageClient.tsx` (M), `bty-app/.../BtyArenaRunPageClient.action-decision-503.integration.test.tsx` (M), `bty-app/.../BtyArenaRunPageClient.json-reexposure.test.tsx` (M) |

**Total: 18 entries** = 7 prior (at outer `108a280`) + 11 Resolve-added (4 from 2B + 5 from 2C + 3 from 2D-1).

### 8.2 Disposition

All 18 entries are sync-debt per [HK8 closure clause 4](HK8_OUTER_INNER_SYNC_POLICY_CLOSURE.md#조항-4-5-leaks--sync-debt-not-anomaly) — inner-side implementation not yet integrated into outer HEAD. **Forbidden mutations**: `git checkout -- <file>`, `git restore`, deletion, recovery. **Allowed disposition**: post-Stage-2 leak-integration sprint (outer fetches `inner-main` → cherry-pick → 4-check → push) per [INNER_PUSH_POLICY §5](../INNER_PUSH_POLICY.md).

The 18-entry set will continue to grow as Stage 2 steps 3-6 (Play / Center / Foundry / Hub) accumulate inner commits. Leak-integration sprint follows Stage 2 completion.

---

## 9. Gate 4-check (pre-mutation, this closure)

| Gate | Measurement | Verdict |
|---|---|---|
| (a) Outer/origin sync | Local HEAD = `origin/main` = `108a280` (rev-list 0 0) | **ORIGIN_SYNC_OK** |
| (b) Known sync-debt set | 18 entries, all classified (§8.1 above), 0 anomalies | **LEAKS_CLASSIFIED_OK** |
| (c) HK6 canonical untouched by this task | `getMyPageIdentityState.ts` = prior leak (not in this closure's diff); 0 fresh mutations by 2E | **HK6_NOT_RE_EDITED_OK** |
| (d) Explicit-path staging | This closure stages 3 files only (this doc + `CURSOR_TASK_BOARD.md` + `CURRENT_TASK.md`); 0 sync-debt entries staged | **STAGING_CLEAN_OK** |

**4/4 PASS** → 2E mutation entry authorized.

---

## 10. Self-application — closure invariants for 2E

| Invariant | Result |
|---|---|
| Mutation = outer-only, 3 files | ✅ this closure + 2 board updates |
| 18 sync-debt entries preserved | ✅ untouched, unstaged |
| HK6 canonical file re-edit = 0 | ✅ prior leak only |
| Explicit-path staging | ✅ specific paths, no `-A` / `-u` |
| Inner repo change = 0 | ✅ no `git -C bty-app` for code |
| `bty-app/` change = 0 | ✅ Option B = doc-only |

---

## 11. Resolve sprint final state

- ✅ Production path §8-2 RESOLVED (user-facing surface boundary enforced via route separation)
- ⏸ JSON-engine path §8 = OPEN as documented backlog (non-production / dev-catalog-gated; not in user-facing §8 scope)
- ✅ ITEM 2 EmptyState removal recorded as Commander-approved intentional change, test-pinned
- ✅ 2B schema-slot inaccuracy corrected in the record
- ✅ 14 new tests + 6 re-pointed/migrated tests; 17 baseline failures preserved
- ✅ Inner commit chain `9dc9076c → d51bfb4c → b92bd0d9` with explicit `inner-main` ff-sync verified
- ⏭ Stage 2 step 3 = **Play** (next, per LOCKED order)

---

## Discipline note

This closure is the **fourth** `docs/closures/` application after `HK9_CODENAME_SYNC_CLOSURE.md`, `HK9_ORPHAN_DOCS_CLOSURE.md`, `HK8_OUTER_INNER_SYNC_POLICY_CLOSURE.md`. The pattern (explicit-path stage, inner repo no-touch in closure commit, Commander-provided verbatim commit message, pre-commit gate verification) is preserved.

The 2B schema-slot correction (§5) is also a discipline mint: future dispatches that cite the persist shape must verify saveState/loadState writes, not rely on type declarations alone. Schema slots are not wires.
