# STAB-08 Scope C — STEP 0 Read-Only Inventory

Generated: 2026-05-22
Mode: **READ-ONLY INVENTORY** (no mutation performed; this file is the sole write-once output)
Baseline anchor (verified clean): inner `f71c0616` / outer `4aecd42` / worker live `844990c0` / tests 3307/0/6
Commander decisions in force: D1 Scope C only · D2 escalated revise branch inside `ArenaResolveClient` reusing existing revise form · D3 expanded inventory · D4 redispatch STAB-07-P0 after close

---

## PRE-INVENTORY RESULTS

### P0 — clean tree
- Outer `/Users/hanbit/Dev/btytrainingcenter` — HEAD `4aecd42`, `git status --porcelain` = 0 lines ✅
- Inner `/Users/hanbit/Dev/btytrainingcenter/bty-app` — HEAD `f71c0616`, `git status --porcelain` = 0 lines ✅
- (After this file is written, outer tree carries exactly one untracked file: this output. No commit, per dispatch.)

### P1 — path verification (memory #25 drift defense)
**4 of 5 dispatch paths drifted.** Resolved actual paths (used throughout this sheet):

| # | Dispatch-cited path | Resolved actual path | Drift |
|---|---------------------|----------------------|-------|
| 1 | `src/components/arena/ArenaResolveClient.tsx` | `src/app/[locale]/bty-arena/play/resolve/ArenaResolveClient.tsx` | ✅ DRIFT (route dir, not components) |
| 2 | `src/components/arena/ArenaPendingContractGate.tsx` | `src/components/bty-arena/ArenaPendingContractGate.tsx` | ✅ DRIFT (`bty-arena`, not `arena`) |
| 3 | `src/app/api/arena/action-contracts/submit-validation/route.ts` | `src/app/api/bty/action-contract/submit-validation/route.ts` | ✅ DRIFT (`bty/action-contract`, singular) |
| 4 | `src/lib/bty/action-contract/openActionContractForMyPage.*` | `src/lib/bty/my-page/openActionContractForMyPage.ts` | ✅ DRIFT (`my-page`, not `action-contract`) |
| 5 | `arenaRuntimeSnapshot.*` | `src/lib/bty/arena/arenaRuntimeSnapshot.server.ts` + `.types.ts` | — found as cited |

Supporting paths resolved during inventory:
- Revise form: `src/components/bty-arena/ArenaActionValidationForm.tsx`
- Blocking fetch: `src/lib/bty/arena/blockingArenaActionContract.ts`
- Client payload/parser: `src/lib/bty/arena/arenaSessionRouterClient.ts`
- Session hook: `src/app/[locale]/bty-arena/hooks/useArenaSession.ts`

### P2 — STAB-07-P0 context restore
`git show c6159ab:docs/STAB-07-P0-SCENARIO-INVENTORY.md` → `/tmp/STAB-07-P0-INVENTORY-RESTORED.md`, **746 lines** confirmed ✅ (read-only; not committed). (Note: that sheet was removed from outer HEAD `4aecd42`; it lives at closure commit `c6159ab` only.)

---

## Section A — Exact stuck-path reproduction (each step cites file:line)

1. **Submit.** On the Resolve surface in `ACTION_REQUIRED`, the user fills who/what/result and POSTs to `/api/bty/action-contract/submit-validation` — `ArenaActionValidationForm.tsx:109-120` (body composed at `:112-119`).
2. **Layer 2 escalates.** Server takes the escalate branch: `UPDATE status='escalated', escalated_at=now` — `submit-validation/route.ts:509-518`; inserts `bty_action_contract_escalations` row (`:527-537`); responds `{ outcome: "escalate" }` (`:541`).
3. **In-session, not yet stuck.** The form renders an inline info banner ("sent for review … you can revise and resubmit") — `ArenaActionValidationForm.tsx:149-151`. `onApproved` is NOT called (only `approve` calls it, `:133-139`), so `validationApproved` stays `false` and the form stays mounted — the user *can* still resubmit while this render persists.
4. **Stuck trigger = reload / re-entry / session refetch.** Blocking-fetch surfaces escalated rows: `.in("status", ["pending","submitted","rejected","escalated"])` — `blockingArenaActionContract.ts:34`. → `pendingActionContract` becomes non-null.
5. **Snapshot maps escalated → ACTION_SUBMITTED.** `runtimeStateFromBlockingContract`: `if (st === "submitted" || st === "escalated") return "ACTION_SUBMITTED"` — `arenaRuntimeSnapshot.server.ts:39`.
6. **qr_allowed = false for escalated.** `qrAllowedForContract` returns true only for `pending`, or `approved`/`submitted` with `validation_approved_at` set and `verified_at` null; `escalated` falls through to `return false` — `arenaRuntimeSnapshot.server.ts:54-63`; wired into gates at `:71`.
7. **status carried to client.** Snapshot `action_contract.status = row.status` (`arenaRuntimeSnapshot.server.ts:92-93`), preserved through the client parser `parseArenaSessionRouterSnapshotFromJson` (`arenaSessionRouterClient.ts:140-157`, status at `:155`).
8. **Resolve surface keeps the user.** `runtime_state === "ACTION_SUBMITTED"` ⇒ `isResolveState === true` — `ArenaResolveClient.tsx:58-61`; the redirect effect returns early (`:71`).
9. **Render gate misses escalated.** `ArenaResolveClient.tsx:162-191`: `pendingActionContract` is truthy, but `runtimeState === "ACTION_REQUIRED" && !validationApproved` is **false** (state is `ACTION_SUBMITTED`) → ELSE branch → `<ArenaPendingContractGate runtimeState="ACTION_SUBMITTED" qrAllowed={false} … />`.
10. **Gate has no revise CTA.** With `qrAllowed=false`, the QR button guard fails (`ArenaPendingContractGate.tsx:96`); only "Go to My Page" link (`:111-117`), "Retry" (`:118-126`), "Refresh status" (`:127-135`) render. **No way to re-edit/resubmit ⇒ STUCK.**
11. **Boundary dead-end.** "Go to My Page" → `/my-page?arena_contract=resolve`, but `fetchOpenActionContractForMyPage` only queries `pending` / `approved` / `completed`/`missed` and **excludes `escalated`** (`openActionContractForMyPage.ts:55, :99, :143`) → returns null → My Page is also a dead-end (this is the Scope A gap, a non-goal here).

**Server↔UI asymmetry (root cause):** the server permits `escalated` (and `rejected`) to resubmit (`route.ts:192-197`). `rejected` maps to `ACTION_REQUIRED` (`server.ts:40` fall-through) → the form renders → not stuck. `escalated` maps to `ACTION_SUBMITTED` → the gate renders → stuck. Escalated is the lone unresolvable status in the UI.

---

## Section B — Current render matrix (derived from code; no runtime trace needed)

Sources: `runtimeStateFromBlockingContract` (server.ts:36-41), `qrAllowedForContract` (server.ts:49-64), render gate (ArenaResolveClient.tsx:162-191).

| contract.status | runtime_state | gates.qr_allowed | client renders | revise possible? |
|-----------------|---------------|------------------|----------------|------------------|
| `pending` | ACTION_REQUIRED | true* | `ArenaActionValidationForm` | **YES** (it is the form) |
| `rejected` | ACTION_REQUIRED | false | `ArenaActionValidationForm` | **YES** (form; server allows rejected resubmit) |
| `committed`/`draft` | ACTION_REQUIRED† | false | `ArenaActionValidationForm` | YES (form) |
| `submitted` (validation_approved_at set, verified_at null) | ACTION_SUBMITTED | true | `ArenaPendingContractGate` (+QR) | NO — but QR path open (not stuck) |
| `submitted` (validation_approved_at null) | ACTION_SUBMITTED | false | `ArenaPendingContractGate` (no QR) | NO (transient edge; normally approve sets the timestamp) |
| **`escalated`** | **ACTION_SUBMITTED** | **false** | **`ArenaPendingContractGate` (no QR)** | **NO — STUCK** ← the gap |
| `approved` (verified_at null) | ACTION_AWAITING_VERIFICATION | true | `ArenaPendingContractGate` (+QR) | NO — QR path open |
| `approved`+`verified_at` / terminal | (terminal flag) | false | `ArenaActionCompleted` (hook flag) | n/a — complete |

\* `pending` yields `qr_allowed=true`, but the validation form renders first (`ACTION_REQUIRED && !validationApproved`); QR appears only after `validationApproved` flips. † `committed`/`draft` are not in the blocking-fetch `in(...)` list directly (`blockingArenaActionContract.ts:34` lists pending/submitted/rejected/escalated); they are handled inside the submit route, not as a resting blocking state — included for completeness, not a live Resolve resting state.

No cell is "UNKNOWN — needs runtime trace"; all rows are derivable from the two pure mapping functions.

---

## Section C — Server/client contract compatibility

- **Form sends** (`ArenaActionValidationForm.tsx:112-119`): `{ contractId, who, what, how, when: "today", raw_text }`.
- **Server accepts** (`submit-validation/route.ts:24-32` `Body` type): `{ contractId, who, what, how, when, raw_text, pattern_state_snapshot? }` — `pattern_state_snapshot` optional (`:65-69`, `:218-220`).
- **Source-state guard** (`route.ts:192-201`): permits `pending`, `rejected`, `committed`, **`escalated`**; `draft`→`committed` handled earlier (`:153-187`). Escalated resubmit was deliberately enabled by MVP-FIX-ACTION-DEMO-01 (A-3) — comment `:189-191`: *"escalated also allowed for resubmit … users can self-resolve via the validation form instead of waiting on the 72h cron."*

**Verdict: bodies match exactly; escalated is an accepted source state. No API change needed. Scope C is a pure UI surfacing.** ✅

---

## Section D — Snapshot surface sufficiency

- The discriminator `escalated` vs plain `submitted` is **not** carried by `runtime_state` (both collapse to `ACTION_SUBMITTED`, `server.ts:39`).
- But it **is** carried by `action_contract.status`: set server-side (`server.ts:92-93`), typed non-optional (`arenaRuntimeSnapshot.types.ts:31-37, :56`), and preserved by the client parser (`arenaSessionRouterClient.ts:155`). The hook exposes `effectiveArenaSnapshot`/`arenaServerSnapshot` (`useArenaSession.ts:622, :1072-1074`), and `ArenaResolveClient` already reads `gateSnapshot = s.effectiveArenaSnapshot ?? s.arenaServerSnapshot` (`ArenaResolveClient.tsx:46`).
- **Note:** `ArenaPendingContractPayload` (`arenaSessionRouterClient.ts:32-39`) has **no** `status` field, so `s.pendingActionContract.status` is unavailable — the discriminator must come from `gateSnapshot.action_contract.status`, which is present.

**Verdict: snapshot already surfaces enough. `gateSnapshot.action_contract?.status === "escalated"` is the client-side discriminator. Scope C is a pure client-side branch — NO snapshot change required, NO Commander scope-expansion escalation needed.** ✅

---

## Section E — Minimal mutation proposal (Scope C ONLY — pseudo-code, NOT final code; awaiting approval)

- **File to modify (single):** `src/app/[locale]/bty-arena/play/resolve/ArenaResolveClient.tsx`
- **New derived value:** add near the existing `runtimeState`/`isResolveState` block (after `ArenaResolveClient.tsx:61`):

  ```ts
  // STAB-08 Scope C: escalated contracts map to ACTION_SUBMITTED (server.ts:39) but the
  // server permits resubmit (route.ts:196). Surface the same validation form so the user
  // can self-resolve instead of dead-ending in the pending gate.
  const escalatedReviseAllowed =
    runtimeState === "ACTION_SUBMITTED" &&
    gateSnapshot?.action_contract?.status === "escalated";
  ```

- **Branch location:** extend the form-branch condition in the render ternary at `ArenaResolveClient.tsx:163` (currently `runtimeState === "ACTION_REQUIRED" && !validationApproved`):

  ```tsx
  {s.pendingActionContract ? (
    (runtimeState === "ACTION_REQUIRED" || escalatedReviseAllowed) && !validationApproved ? (
      <ArenaActionValidationForm
        locale={locale}
        contractId={s.pendingActionContract.id}
        onApproved={(info) => {            // identical handler — no change
          if (info?.terminal) s.setActionTerminalCompletion(true);
          else setValidationApproved(true);
        }}
      />
    ) : (
      <ArenaPendingContractGate … unchanged … />   // existing ELSE preserved
    )
  ) : (
    <ArenaBlockedSurface … unchanged … />
  )}
  ```

  Reuse is verbatim — `ArenaActionValidationForm` consumes only `{ locale, contractId, onApproved }` (`ArenaActionValidationForm.tsx:31-41`) and handles approve/revise/reject/escalate internally (`:133-153`). **No refactor of the form.**

- **Estimated LOC delta:** ~6-9 net added lines (one derived const + comment + condition extension). Zero deletions of existing branches.
- **Transition correctness:** on a successful resubmit, `onApproved(awaiting_qr)` sets `validationApproved=true` → ELSE branch with forced `ACTION_AWAITING_VERIFICATION` → QR gate (mirrors the existing ACTION_REQUIRED flow). `terminal` → hook completion flag. A repeat `escalate` keeps the form mounted (`escalatedReviseAllowed` still true, `validationApproved` still false). The `&& !validationApproved` guard prevents the form re-appearing after approval within the same session.
- **Test coverage plan:**
  - *Existing, unaffected:* `ArenaResolveClient.test.tsx` "renders ArenaPendingContractGate for ACTION_SUBMITTED" uses `baseSnapshot` with `action_contract.status: null` (`:46`) → `escalatedReviseAllowed=false` → still renders the gate. No regression.
  - *New (add to `ArenaResolveClient.test.tsx`, or `ArenaResolveClient.escalated-revise.test.tsx`):*
    1. `ACTION_SUBMITTED` + `action_contract.status="escalated"` + `pendingActionContract` set → expects `arena-action-validation-form`.
    2. `ACTION_SUBMITTED` + `status="submitted"` → expects `arena-pending-action-contract-gate` (guard / no false-positive).
    3. (optional) escalated → form approve(awaiting_qr) → asserts flip to gate at `ACTION_AWAITING_VERIFICATION`.
  - *Server:* already covered — `submit-validation/route.test.ts` exercises the escalate outcome (`:282, :490-613`). Escalated-as-source acceptance is governed by `route.ts:196`; an explicit "escalated source → not 409" assertion is optional and is **not** required for this UI-only diff.

---

## Section F — Explicit non-goals (reaffirmed)

- ❌ NO Scope A mutation — `openActionContractForMyPage.ts` is untouched (its escalated exclusion is a known, separate gap; see Section G).
- ❌ NO Scope B — no `wrangler.toml [triggers]` addition.
- ❌ NO cron route changes.
- ❌ NO snapshot logic changes — Section D confirms the existing `action_contract.status` surface is sufficient, so `arenaRuntimeSnapshot.server.ts` / `.types.ts` / the parser are NOT modified. (Escalation to Commander would only have been required had Section D come back insufficient; it did not.)
- ❌ NO refactor of `ArenaActionValidationForm` — reused verbatim via its existing props.

---

## Section G — Risk flags

1. **Boundary unmask (Scope A, do not fix here):** the in-gate "Go to My Page" CTA still dead-ends for escalated contracts because `fetchOpenActionContractForMyPage` excludes `escalated` (`openActionContractForMyPage.ts:55, :99, :143`). Scope C makes the *Resolve* surface self-sufficient, so the user is no longer stuck — but the My Page CTA remains misleading for escalated. **Flag for Scope A backlog.** This is the "Scope C unmasks an adjacent gap" case (parallel to STAB-07-P0 unmasking Scope C).
2. **Server↔UI class (memory #24 / discipline_server_vs_ui):** Scope C *closes* a server-vs-UI gap (server `route.ts:196` allows; UI gate omits) — the same class STAB-06-FIX-03 closed (Track B added the `actionTerminalCompletion` render branch, `4ae97ea8`). The fix keys on a server-emitted snapshot field (`action_contract.status`), so it does **not** introduce a new snapshot/UI divergence.
3. **qr_allowed interaction (Track A `ae76092b`):** escalated has `qr_allowed=false` by Track A design; the new revise branch renders *before* the QR-bearing gate, so the false `qr_allowed` is correctly bypassed for escalated. After a successful resubmit the status becomes `submitted` (qr_allowed flips true on next refetch) — clean handoff. No contradiction with Track A.
4. **Hidden coupling — discriminator source:** the branch depends on `gateSnapshot.action_contract.status` being populated. Verified end-to-end (server `:92-93` → parser `:155`). If a future change drops `status` from the snapshot, this branch silently reverts to the stuck behavior — recommend the new unit test asserts on the escalated render to lock the contract.
5. **STAB-07-P0 re-dispatch blocker:** **none found.** STAB-07-P0 (verification-mode integrity: self_attest + auto-approve hardcoded across `ensureActionContract` / `eliteBindingActionCommitment` / action-contracts route) is orthogonal to the escalated-revise UI gap. D4 (redispatch STAB-07-P0 after Scope C close) is unblocked by this inventory.
6. **In-session vs reload nuance:** the form already handles escalate inline while mounted; the stuck state is specifically on reload / re-entry / refetch. Scope C makes both paths consistent.

---

## ABORT-condition audit

| ABORT trigger | Finding | Status |
|---------------|---------|--------|
| T1: revise form not cleanly reusable (needs refactor) | `ArenaActionValidationForm` consumes only `{locale, contractId, onApproved}` and handles all outcomes internally; identical invocation to the ACTION_REQUIRED branch | **NOT triggered** |
| T4/Section D: snapshot lacks required signal | `gateSnapshot.action_contract.status === "escalated"` is surfaced server→client | **NOT triggered** |
| T3: server endpoint needs data the client lacks | Form's exact body is accepted; `escalated` is a permitted source state (`route.ts:196`) | **NOT triggered** |
| T6: STAB-06-FIX-03 reveals an adjacent unfixed gap | Only adjacent gap is the My Page escalated exclusion = the known Scope A non-goal (flagged G-1), not a regression risk in the Scope C lane | **NOT triggered** |

## RECOMMENDATION: **PROCEED**

All four ABORT conditions cleared. Scope C is a single-file, ~6-9 LOC, pure client-side branch in `ArenaResolveClient.tsx`, reusing `ArenaActionValidationForm` verbatim, keyed on the already-surfaced `action_contract.status === "escalated"`, with no API, snapshot, cron, Scope A, or Scope B changes. Awaiting Commander approval of Section E before any code change.
