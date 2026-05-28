# L6 Gate Rewrite Plan — Auto-Approve Gate Tier-Based Swap

**Status:** Locked v1 — Commander approved (2026-05-27, decisions α + β-3 baked in)
**Authority anchor:** inner `d9443b84` (L1 close baseline)
**Spec authority:** `docs/QR_VERIFICATION_ARCHITECTURE_V1.md` (Locked v1) — §2.3, §4.1, §6.3
**Plan authority:** `docs/L1_MIGRATION_PLAN.md` (Locked v1.3) — §10 L2 contract
**Cross-ref:** L2 STEP 0 inventory (4 WRITE sites), Lane 7 QR-gate regression (CURSOR_TASK_BOARD D-7)

---

## 1. Authority & Scope

### 1.1 What L6 changes

L6 rewrites the **single** auto-approve gate that currently branches on the legacy
`verification_type === 'self_attest'` literal, so that it recognizes the post-L2
canonical taxonomy. Per STEP 0 inventory (§2), this is the **only** value-branching
read of `verification_type` in the codebase — every other read is a display/DTO
pass-through that does not branch on the value.

**Change surface:** one inline gate in
`src/app/api/bty/action-contract/submit-validation/route.ts` (L266-270) + its test
file `submit-validation/route.test.ts`. No helper family, no other route.

### 1.2 Why L6 is coupled to L2

`verification_type` is NOT NULL with no DB default (Plan §10). The 4 L2 WRITE sites
currently stamp `self_attest` (×3) / `hybrid` (×1); L2 rewrites these to
`action_completed`. On the **single live staging-configured worker** (memory #16:
`bty-arena-staging`, `BTY_ENV=staging` + `SELF_REPORT_AUTO_APPROVE=true`, no separate
prod worker), both env AND-terms of the gate are already satisfied — so
`verification_type === 'self_attest'` is the **only** gate term in play. L2 flipping
the value to `action_completed` is therefore the single change that disables
auto-approve, routing every contract to the non-deterministic OpenAI Layer 2. This is
the same mechanism as the Lane 7 H1 regression. **L6 must land with (or before) L2.**

### 1.3 Out of scope

Per Commander invariants: no schema drift (L1 FINAL), no unrelated refactor, no L2
WRITE-site edits in this lane (L2-owned), no token/validate-route changes (L3/L4),
no Layer 2 evaluator changes (L5), no AD2 path (L7).

---

## 2. STEP 0 Inventory (read-only, baseline d9443b84)

### 2.1 verification_type call-site classification (B.1)

| Site | Line | Class | Scope |
|------|------|-------|-------|
| `submit-validation/route.ts` | **267** | **READ — value branch** (`verificationType === "self_attest"`, 4-AND gate) | **L6** |
| `submit-validation/route.ts` | 77, 249-250 | READ — feeds the gate (SELECT + string coerce) | L6 |
| `arena/action-contracts/route.ts` | 64 | WRITE — stamps `self_attest` (Site 1) | L2 |
| `action-contract/ensureActionContract.ts` | 280 | WRITE — stamps `self_attest` (Site 2) | L2 |
| `arena/eliteBindingActionCommitment.server.ts` | 201 | WRITE — stamps `self_attest` (Site 3) | L2 |
| `action-contract/actionContractLifecycle.server.ts` | 294 | WRITE — stamps `hybrid` (Site 4) | L2 |
| `arena/arenaRuntimeSnapshot.server.ts` | 103 | READ — pass-through (snapshot DTO, no value branch) | display |
| `arena/arenaSessionRouterClient.ts` | 97,101,142,146,157 | READ — pass-through (`:146` is `typeof` guard) | display |
| `arena/arenaSessionNextCore.ts` | 71 | READ — pass-through | display |
| `arena/blockingArenaActionContract.ts` | 9,32,64 | READ — type + SELECT columns | display |
| `my-page/openActionContractForMyPage.ts` | 15,87,130,175 | READ — maps `verification_mode`→`verification_type` field (DTO) | display |
| `arena/choice/route.ts`, `bty-arena/hooks/useArenaSession.ts` | — | READ — `null` defaults in DTOs | display |

**Decisive finding:** the only place that branches on the `verification_type` *value*
is the gate at `submit-validation/route.ts:267`. Display surfaces are value-agnostic —
after L2 they render `action_completed` instead of `self_attest` with no logic break.

**TEST files → parallel-update list:**
- **L6 primary:** `submit-validation/route.test.ts` — gate-behavior tests at
  366,417,469,481,530,569,620,661 (assert `self_attest`→auto-approve,
  `qr`/non-self_attest→Layer 2). Encode the *old* gate semantics; rewritten with L6.
- **L2-owned (cross-ref):** `arena/action-contracts/route.test.ts` (88-126),
  `arena/session/next/route.test.ts:129` fixture.

### 2.2 canSelfReportAutoApprove trace (B.2)

- **Definition:** `submit-validation/route.ts:266-270` — a **local `const`**, *not* an
  exported/named helper. 4-AND boolean:
  ```
  verificationType === "self_attest"   // ← L6 target term
    && selfReportAutoApprove === true  // details.self_report_auto_approve === true
    && envAutoApprove === true         // process.env.SELF_REPORT_AUTO_APPROVE === "true"
    && isStagingWorker === true        // process.env.BTY_ENV === "staging"
  ```
- **Return type:** `boolean` (inline expression).
- **Call sites (all within submit-validation/route.ts, 6×):** 272 (auto-approve vs
  Layer 2 ternary), 342 (`approvePatch`), 361 (log), 416 (INVARIANT 3 branch), 484
  (`contract_state` terminal/awaiting_qr), 485 (`verified_at` set vs null).
- **Sibling gate helpers:** **none named** — `canManagerReview` / `isEscalated` do not
  exist. The only adjacent gate is `qrAllowedForContract(row)` at
  `arenaRuntimeSnapshot.server.ts:58` (Lane 7 runtime QR-allow, separate file/concern).
  The L6 gate is **inline and isolated** → rewrite contained to one route + its test.

### 2.3 Layer 2 / LLM verification path — the false-branch consumer (B.3)

- **Route:** gate false → `evaluateActionContractPayload`
  (`lib/bty/validator/runActionContractValidation.ts:19`) → Layer 1
  (`runAllLayer1Rules`) → `runLayer2Semantic` (`lib/bty/validator/layer2Semantic.ts`).
- **LLM verifier:** `layer2Semantic.ts` — OpenAI `client.chat.completions.create`,
  `response_format: json_object`, 3-criteria semantic check (`re_entry_direction` /
  `external_measurability` / `non_cosmetic`).
- **Worker env dependency:** `BTY_VALIDATOR_OPENAI_MODEL` (model id; fallback
  `getLlmModel()` / `DEFAULT_MODEL`); LLM client + API auth abstracted in
  `getLlmClient()` / `isLlmAvailable()` — config absent → `missing_llm_config` → `!l2.ok`.
- **Outcome router** (`routeLayer2Outcome.ts`, §3.4): confidence threshold **0.7**;
  `ambiguous` OR `confidence < 0.7` → **escalate**; any criterion `fail` → reject;
  else approve.
- **Production deadlock mechanism (verbatim anchors):**
  - LLM failure (`openai_request_failed` / `openai_invalid_json` / `missing_llm_config`)
    → `evaluateActionContractPayload` returns `outcome: "escalate"`
    (`runActionContractValidation.ts:55-62`).
  - escalate → `status:"escalated"` + insert `bty_action_contract_escalations`
    (`submit-validation/route.ts:509-535`) → `{outcome:"escalate"}`.
  - Code rationale (`route.ts:237`): *"staging's non-deterministic AI cannot stall the
    run with escalate."* — the 4-AND gate exists precisely to give the live staging
    worker a deterministic auto-approve, bypassing the non-deterministic OpenAI Layer 2.
  - Lane 7's `ACTION_ESCALATED` + `qr_allowed` exit mitigates the *deadlock*, but the
    deterministic happy-path is lost if the gate breaks. This is why L2 and L6 are
    coupled (see §1.2).

---

## 3. Schema Alignment & Gate Rule Decision

### 3.0 Old gate ↔ new taxonomy (C.1)

Old gate term: `verification_type === 'self_attest'` (1 of 8 legacy values).
Post-L2 new rows: `verification_type='action_completed'`,
`verification_tier='mvp_open'`, `verification_status='pending'`, and (Sites 1/2/3)
`details.self_report_auto_approve=true` — **Site 4 (draft) does not set the flag.**

### 3.1 Candidate gate rules

**C-1 (tier-based swap):** SELECTED
- Pro: spec §4.1 mvp_open = launch posture "soft enforcement" = auto-approve domain
- Pro: tier 2/3 (member_only/manager_only) correctly excluded (external witness required)
- Pro: legacy_self_attest correctly excluded (must not re-auto-approve)
- Pro: type-agnostic → works for action_completed (L2) AND future non_event_confirmed (L7)
- Pro: minimal diff (replace first AND-term only)
- Pro: preserves STAB-01 4-AND defense-in-depth (3 other terms unchanged)
- Pro: preserves INVARIANT 3 branch logic

**C-2 (status + explicit flag):** REJECTED
- Con: lifecycle status carries no enforcement semantics
- Con: over-relies on details.self_report_auto_approve JSON flag (brittle)
- Con: Site 4 (draft) does not stamp the flag — would fail

**C-3 (composite tier+type+status):** REJECTED
- Con: hard-coding type==='action_completed' excludes non_event_confirmed (L7)
- Con: re-couples L6 to L7 (AD2 path)
- Con: brittle to future verification_type additions

### 3.2 Commander decision (2026-05-27)
**Selected: C-1 (tier-based swap).**

### 3.3 Implementation specification

**Change scope:** submit-validation/route.ts:266-270 — replace first AND-term only.

```diff
- verificationType === "self_attest"
+ verificationTier === "mvp_open"
```

Other 3 AND-terms unchanged. The `verificationTier` variable must be sourced
from the same SELECT that currently feeds `verificationType` (route.ts:77 + L249-250
extension scope).

### 3.4 Site 4 draft auto-approve handling (Commander decision 2026-05-27)

**Selected: α — Site 4 draft contracts excluded from auto-approve domain.**

Rationale: Draft lifecycle state (`status='draft'`) represents incomplete commitment
authority. A draft cannot carry auto-approval rights — that authority is only
acquired on lifecycle transition out of draft. Site 4 will NOT stamp
`details.self_report_auto_approve=true` as part of L2 rewrite.

Asymmetry note: Sites 1, 2, 3 stamp the flag; Site 4 does not. This is inventoried
fact, not drift. L2 rewrite preserves this asymmetry. L2 verify gate must NOT
assert flag presence for Site 4 (would be false-positive failure).

Operational consequence: A Site 4 draft contract that later transitions to
`status='pending'` will not auto-approve until the transition path explicitly
stamps `self_report_auto_approve=true` (out of L2/L6 scope; future lane).

### 3.5 Final gate rule (Commander decision 2026-05-27, cutover = β-3)

L6 cutover ships with **transitional dual-path gate** in submit-validation/route.ts:

```typescript
const canSelfReportAutoApprove =
  (
    // Canonical path (post-L2 contracts)
    (verificationTier === 'mvp_open'
      && verificationStatus === 'pending'
      && selfReportAutoApprove === true)
    ||
    // Legacy protection path (pre-L2 contracts, must be cleaned up by L8)
    // TODO[L8-cleanup]: Remove this OR branch after legacy disposition complete.
    (verificationTier === 'legacy_self_attest'
      && verificationType === 'self_attest'
      && verificationStatus === 'pending')
  )
  && envAutoApprove === true       // STAB-01 4-AND defense (env)
  && isStagingWorker === true;     // STAB-01 4-AND defense (env)
```

Notes:
- STAB-01 4-AND defense-in-depth preserved: envAutoApprove + isStagingWorker apply
  to BOTH paths.
- Canonical path uses `tier='mvp_open'` (type-agnostic — works for L2 action_completed
  AND future L7 non_event_confirmed without re-coupling).
- Legacy path narrowly scoped: tier+type+status all three required. Cannot
  accidentally protect non-legacy rows.
- Site 4 draft contracts (status='draft', not 'pending') are correctly excluded by
  both paths' `status='pending'` requirement.

Scope of variable extensions (route.ts:77 + L249-250):
- Add `verification_tier` and `verification_status` to existing SELECT
- Add corresponding TypeScript types in route handler
- No other route file changes

Cleanup commit (L8 follow-up, NOT this dispatch):
Find by tag `TODO[L8-cleanup]`. After L8 legacy disposition complete, the legacy OR
branch is removed entirely. Resulting gate is single canonical path:

```typescript
const canSelfReportAutoApprove =
  verificationTier === 'mvp_open'
  && verificationStatus === 'pending'
  && selfReportAutoApprove === true
  && envAutoApprove === true
  && isStagingWorker === true;
```

---

## 4. L2+L6 Bundle Cutover Plan

### 4.1 Sequencing within bundle (Commander β-3 = atomic single deploy)

L2 site rewrites + L6 gate rewrite ship as ONE deploy unit:
- Single commit containing: 4 L2 site rewrites + submit-validation/route.ts gate update
- Single worker deploy after commit
- No partial state — pre-deploy worker has neither change; post-deploy worker has both.

Pre-existing 55 pending legacy contracts (STEP 1C inventory: tier=legacy_self_attest,
status=pending) are protected by the legacy OR branch in §3.5 final gate rule.
New post-deploy contracts route through canonical path.

### 4.2 Single deploy unit boundary

Files in single commit:
- src/app/api/arena/action-contracts/route.ts (Site 1)
- src/lib/bty/action-contract/ensureActionContract.ts (Site 2)
- src/lib/bty/arena/eliteBindingActionCommitment.server.ts (Site 3)
- src/lib/bty/action-contract/actionContractLifecycle.server.ts (Site 4)
- src/app/api/bty/action-contract/submit-validation/route.ts (L6 gate)
- Updated test files (per L2+L6 STEP 0 inventories)
- Updated TypeScript types (EnsureContractFailureDetail.insert_payload if affected)

Files NOT in this commit:
- Migration files (L1 already shipped)
- Schema changes (L1 schema FINAL)
- Worker config (no env var change)

### 4.3 Pre-deploy verification gate (memory #13)

Local checks before commit:
- `vitest` → all pass
- `npm run lint` (tsc --noEmit) → all pass
- Updated tests green:
  - submit-validation/route.test.ts (8 sites: L366/417/469/481/530/569/620/661)
  - action-contracts/route.test.ts (L88-126)
  - session/next/route.test.ts:129 fixture
- New L2 verify-gate tests added (per Plan §10 L1209-1211):
  - "new contract row verification_status is NOT NULL"
  - "new contract row verification_type ∈ {action_completed, non_event_confirmed, manager_reviewed}"
  - "new contract row verification_tier = 'mvp_open' (unless spec override)"
- New L6 transitional gate tests:
  - "canonical path: mvp_open + pending + flag + env → auto-approve"
  - "legacy path: legacy_self_attest + self_attest + pending + env → auto-approve"
  - "Site 4 draft (status='draft') → NOT auto-approve under either path"
  - "tier='mvp_open' + status='approved' (already verified) → NOT re-auto-approve"
  - "tier='legacy_self_attest' + type='hybrid' + status='pending' → NOT auto-approve (legacy path requires type='self_attest')"

### 4.4 Post-deploy verification

Production-effective verification (memory #24 single Supabase + single worker):
- Manual probe 1: insert via Site 1 path → submit-validation → auto-approve PASS (canonical)
- Manual probe 2: submit existing pending legacy contract → auto-approve PASS (legacy OR)
- Manual probe 3: insert via Site 4 (draft) path → submit-validation → NOT auto-approve (correctly excluded)
- Database query: COUNT new contracts in 1 hour post-deploy where verification_type='action_completed' → > 0
- Layer 2 escalation rate: should not spike (legacy OR keeps existing pending flow)

### 4.5 Rollback strategy

If post-deploy verification fails:
- Revert single bundle commit on inner-main
- Worker re-deploy (previous code restored)
- DB rows already created via canonical path: no rollback needed (data is forward-compatible — old gate would route them to Layer 2, which is the pre-L1 baseline behavior)
- Document rollback reason + create patch dispatch

### 4.6 Cleanup commit (L8 follow-up)

Out of this bundle's scope. After L8 legacy disposition complete:
- Find `TODO[L8-cleanup]` tag in submit-validation/route.ts
- Remove legacy OR branch
- Update tests (remove "legacy path" test cases)
- Single commit + deploy in L8 closure

---

## 5. Version History

| Date | Version | Change | Author |
|---|---|---|---|
| 2026-05-27 | Draft | STEP 0 inventory complete + C-1 recommendation surfaced | C3 (Claude) |
| 2026-05-27 | Locked v1 | Commander approved §3.4=α + cutover=β-3 + final gate rule + bundle plan §4 | C3 + Commander |
