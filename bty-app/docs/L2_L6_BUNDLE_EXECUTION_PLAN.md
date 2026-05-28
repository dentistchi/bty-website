# L2+L6 Bundle Execution Plan

**Status:** Locked v1 — Commander approved (2026-05-27, §1.3 patch + §3.3/§3.1/§5.3 decisions confirmed)
**Lane:** L2 (contract creation rewrite) + L6 (gate rewrite) — single deploy bundle
**Authored:** 2026-05-27 by C3 (Claude), non-mutating dispatch author
**Executor:** Claude Code (VSCode), sole mutation runner
**Mode:** BTY Product Mode (NOT Infra Mode — memory #1 boundary)
**Spec authority:** docs/QR_VERIFICATION_ARCHITECTURE_V1.md @ d9443b84 (Locked v1) §2.1, §4.1, §6.1, §6.3
**L6 plan authority:** docs/L6_GATE_REWRITE_PLAN.md @ 69e36b6a (Locked v1) §3.4, §3.5, §4
**L1 plan authority:** docs/L1_MIGRATION_PLAN.md @ d9443b84 (Locked v1.3) §10 L2 contract
**Baseline:** inner 69e36b6a / outer 99525598 / ledger cbd6e5f1
**Memory invariants:** #1 BTY Product Mode, #13 verify gate (vitest + tsc), #21 file path drift, #24 single Supabase production-effective, #26 bty_qr_arch_v1_LOCKED, #27 lock-and-dispatch sequencing

**Commander decisions baked in (2026-05-27):**
- §3.4 = α (Site 4 draft excluded from auto-approve)
- Cutover = β-3 (transitional dual-path gate, legacy OR protected, TODO[L8-cleanup] tagged)
- Bundle = atomic single deploy (5 production files + tests + types)

---

## 1. Bundle Overview

### 1.1 Why bundled

L2 stamps new canonical `verification_type='action_completed'` at contract creation.
The current submit-validation gate requires `verification_type === 'self_attest'` to
auto-approve. L2 alone would disable auto-approve on every new contract → all route
to non-deterministic Layer 2 (OpenAI) → Lane 7 H1 deadlock re-creation on the live
staging worker.

L6 rewrites the gate to a tier-based canonical rule, so L2's `action_completed`
contracts keep auto-approving via `verification_tier === 'mvp_open'`. The two changes
are inseparable — they must ship in one commit + one worker deploy.

### 1.2 Core principle

L2 makes the canonical contract stamp. L6 makes the canonical gate not block it.
Same deploy unit. JSON/Supabase/Binding paths converge to one runtime.

### 1.3 Sequencing risk (the actual hazard)

This bundle's risk is not size — it is sequencing. If gate and stamp land out of
sync (gate before stamp, or stamp before gate), the live worker enters a state where
new contracts deadlock. The atomic single-commit + single-deploy boundary (§5)
eliminates the intermediate broken state.

---

## 2. Verified File Paths (memory #21 — inventory-confirmed, no inference)

### 2.1 L2 WRITE sites (4) — from L2 STEP 0 inventory

| # | Path | Creation logic | Current verification_type |
|---|---|---|---|
| Site 1 | `src/app/api/arena/action-contracts/route.ts` | L51-90 insert | `self_attest` (L64) |
| Site 2 | `src/lib/bty/action-contract/ensureActionContract.ts` | L257-288 insert | `self_attest` (L280) |
| Site 3 | `src/lib/bty/arena/eliteBindingActionCommitment.server.ts` | L189-213 insert | `self_attest` (L201) |
| Site 4 | `src/lib/bty/action-contract/actionContractLifecycle.server.ts` | L280-303 insert | `hybrid` (L294) |

### 2.2 L6 gate site (1) — from L6 STEP 0 inventory

| Path | Gate location | Current first AND-term |
|---|---|---|
| `src/app/api/bty/action-contract/submit-validation/route.ts` | L266-270 | `verificationType === "self_attest"` |

**Path correction note:** An earlier dispatch listed the gate as
`src/app/api/arena/submit-validation/route.ts` (incorrect). Verified actual path is
`src/app/api/bty/action-contract/submit-validation/route.ts` (memory #21 route group
path ≠ URL path). This plan uses the verified path throughout.

### 2.3 Variable source for gate (route.ts:77 + L249-250)

The SELECT that feeds the gate must be extended to also fetch `verification_tier`
and `verification_status`. Currently fetches `verification_type` only (L77 select,
L249-250 coerce).

---

## 3. STEP 1 — Per-site Rewrite Specification

Each STEP 1 sub-step is a separate dispatch (1A-1E). Commander approves each before
the next. No file is committed until all 5 sites + tests pass (§4).

### 3.1 STEP 1A — Site 1 (action-contracts/route.ts)

**Change:** Add to the existing `insert({...})` payload at L51-90:
```
verification_type: 'action_completed',   // was 'self_attest'
verification_status: 'pending',          // new (Invariant 1)
verification_tier: 'mvp_open',           // new (Invariant 3)
actor_device_fingerprint_hash: <computed from NextRequest headers, or null>,  // Invariant 4
```

**Device fingerprint:** Site 1 is the ONLY site with `NextRequest` in scope. Compute
from request headers (User-Agent + available sec-ch-ua-* per spec §4.1). If headers
unavailable → null (NULL-able column, acceptable pre-L4).

**Preserve unchanged:** all other stamped fields (user_id, action_id, mode='arena',
verification_mode='hybrid', weight=1, status='pending', details.self_report_auto_approve:true, etc.)

**No refactor:** Direct insert pattern stays (api-handlers.md prefers service call,
but that is pre-existing — Invariant 6 forbids unrelated refactor).

### 3.2 STEP 1B — Site 2 (ensureActionContract.ts)

**Change:** Add to insert payload at L257-288:
```
verification_type: 'action_completed',   // was 'self_attest'
verification_status: 'pending',          // new
verification_tier: 'mvp_open',           // new
// actor_device_fingerprint_hash: NOT set (admin client, no request) → NULL OK pre-L4
```

**Preserve:** details.self_report_auto_approve:true, all other fields.
**Shared helper note:** shares `resolveActionContractSpecForPatternFamily` with Site 4
— do not modify the shared helper, only the insert payload.

### 3.3 STEP 1C — Site 3 (eliteBindingActionCommitment.server.ts)

**Change:** Modify `insertPayload` (L189-207, currently `as const`):
```
verification_type: 'action_completed',   // was 'self_attest'
verification_status: 'pending',          // new
verification_tier: 'mvp_open',           // new
// actor_device_fingerprint_hash: NOT set (admin client) → NULL OK pre-L4
```

**Type parallel-update:** `EnsureContractFailureDetail.insert_payload` type (L72-82)
mirrors a subset of insert fields for error logging. If the new columns are added to
the logged subset, the type needs parallel update. **Decision: do NOT add new columns
to the error-log subset** (subset is not exhaustive; keeps diff minimal). Type unchanged.

**`as const` note:** adding string-literal fields to an `as const` object is fine
(literals preserved). Verify TypeScript accepts the widened object against the insert
signature.

### 3.4 STEP 1D — Site 4 (actionContractLifecycle.server.ts)

**Change:** Modify insert payload at L280-303:
```
verification_type: 'action_completed',   // was 'hybrid' (the only divergent site)
verification_status: 'pending',          // new — NOTE: lifecycle status stays 'draft'
verification_tier: 'mvp_open',           // new
// actor_device_fingerprint_hash: NOT set (admin client) → NULL OK pre-L4
// details.self_report_auto_approve: NOT set (Commander §3.4 = α, draft excluded)
```

**Critical α invariant:** Site 4 is the draft-lifecycle path (`status='draft'`).
Per Commander §3.4 = α, Site 4 does NOT stamp `details.self_report_auto_approve=true`.
This is intentional asymmetry vs Sites 1/2/3. The L2 verify gate (§3.6) must NOT
assert flag presence for Site 4.

**Two distinct status fields:** `status='draft'` (lifecycle, unchanged) vs
`verification_status='pending'` (verification, new). Both coexist. Do not conflate.

### 3.5 STEP 1E — L6 gate rewrite (submit-validation/route.ts)

**Change 1 — extend SELECT (L77 + L249-250 scope):**
Add `verification_tier`, `verification_status` to the contract SELECT and coerce to
typed local variables `verificationTier`, `verificationStatus`.

**Change 2 — gate rewrite (L266-270):**
Replace the 4-AND `canSelfReportAutoApprove` const with the transitional dual-path
gate (L6 plan §3.5):

```typescript
const canSelfReportAutoApprove =
  (
    // Canonical path (post-L2 contracts)
    (verificationTier === 'mvp_open'
      && verificationStatus === 'pending'
      && selfReportAutoApprove === true)
    ||
    // Legacy protection path (pre-L2 contracts, removed by L8)
    // TODO[L8-cleanup]: Remove this OR branch after legacy disposition complete.
    (verificationTier === 'legacy_self_attest'
      && verificationType === 'self_attest'
      && verificationStatus === 'pending')
  )
  && envAutoApprove === true       // STAB-01 4-AND defense (env)
  && isStagingWorker === true;     // STAB-01 4-AND defense (env)
```

**Preserve:** the 6 downstream call sites of `canSelfReportAutoApprove`
(L272/342/361/416/484/485) read the boolean result — no change to their logic.
INVARIANT 3 branch (L416) preserved.

**No new helper extraction:** gate stays inline (Invariant 6 — no unrelated refactor).

### 3.6 New L2 verify-gate tests (Plan §10 L1209-1211)

Add tests asserting per-site creation invariants:
- "new contract row verification_status is NOT NULL"
- "new contract row verification_type ∈ {action_completed, non_event_confirmed, manager_reviewed}"
- "new contract row verification_tier = 'mvp_open'"
- "Site 4 draft contract does NOT carry details.self_report_auto_approve" (α invariant)

### 3.7 New L6 gate tests

- "canonical: mvp_open + pending + flag + env → auto-approve"
- "legacy: legacy_self_attest + self_attest + pending + env → auto-approve"
- "Site 4 draft (status='draft', verification_status='pending', no flag) → NOT auto-approve"
- "mvp_open + status='approved' (already verified) → NOT re-auto-approve"
- "legacy_self_attest + type='hybrid' + pending → NOT auto-approve (legacy path requires type='self_attest')"
- "mvp_open + pending + flag but envAutoApprove=false → NOT auto-approve (STAB-01 defense)"

---

## 4. STEP 2 — Verification Gate (pre-commit, memory #13)

### 4.1 Local checks before any commit

```
vitest                        → all pass
npm run lint (tsc --noEmit)   → all pass
```

### 4.2 Updated existing test files (must stay green)

- `src/app/api/bty/action-contract/submit-validation/route.test.ts`
  (gate-behavior tests L366/417/469/481/530/569/620/661 — rewrite for new gate)
- `action-contracts/route.test.ts` (L88-126 — verification_type assertion update)
- `session/next/route.test.ts:129` (fixture update)

### 4.3 New test files added

Per §3.6 (L2 verify-gate) + §3.7 (L6 gate) above.

### 4.4 HALT if

- Any vitest failure → HALT, report failing test
- tsc error → HALT, report type error
- Test expecting old `self_attest` behavior not updated → HALT (stale test)

---

## 5. STEP 3 — Commit + Deploy + Verify

### 5.1 Atomic single commit (β-3 bundle boundary)

Files in ONE commit:
- src/app/api/arena/action-contracts/route.ts (Site 1)
- src/lib/bty/action-contract/ensureActionContract.ts (Site 2)
- src/lib/bty/arena/eliteBindingActionCommitment.server.ts (Site 3)
- src/lib/bty/action-contract/actionContractLifecycle.server.ts (Site 4)
- src/app/api/bty/action-contract/submit-validation/route.ts (L6 gate)
- All updated + new test files
- Any TypeScript type updates (Site 3 type unchanged per §3.3 decision)

NOT in commit: migration files (L1 shipped), schema (FINAL), worker config (no env change).

### 5.2 Push (memory #9 footgun discipline)

- Inner: `git push origin inner-main` (explicit cd, NEVER origin/main from inner)
- Outer mirror commit + `git push origin main`
- Capture SHAs to /tmp files (no shell var across Bash boundaries)

### 5.3 Worker deploy (Invariant 7 — production code change)

**Commander decision (2026-05-27): Commander performs deploy directly.**
Claude Code may PREPARE the checklist only. No deploy without explicit Commander
deploy command. Claude Code does NOT run wrangler/opennext deploy.

Pre-deploy checklist (memory #16-baseline deploy invariants) — Claude Code prepares,
Commander executes:
- Comment dev-only `.env.local` vars (LLM_BASE_URL, Tailscale IP, localhost) before
  `cf:build` (baked into worker bundle by opennextjs-cloudflare populateProcessEnv)
- `git status` acknowledge dirty-tree deploy if any WIP
- Deploy: standard wrangler/opennext flow (Commander runs)

Post-deploy 3-way verify (memory #16):
- Deploy output Version ID (most trusted)
- git log HEAD
- Runtime empirical (DB row / log)

### 5.4 Post-deploy production verification (memory #24 single Supabase + worker)

- Probe 1: insert via Site 1 path → submit-validation → auto-approve PASS (canonical)
- Probe 2: submit existing pending legacy contract → auto-approve PASS (legacy OR)
- Probe 3: insert via Site 4 draft path → submit-validation → NOT auto-approve (α excluded)
- DB query: COUNT new contracts post-deploy WHERE verification_type='action_completed' → > 0
- Layer 2 escalation rate: should not spike (legacy OR keeps existing pending flow)

### 5.5 Rollback strategy

If post-deploy verify fails:
- Revert single bundle commit on inner-main
- Worker re-deploy (previous code restored)
- DB rows from canonical path: no rollback (forward-compatible — old gate routes them
  to Layer 2 = pre-L1 baseline behavior)
- Document reason + patch dispatch

### 5.6 Ledger update (post-deploy verify PASS)

- docs/CURSOR_TASK_BOARD.md + docs/CURRENT_TASK.md (outer-only, memory #15)
- L2 + L6 marked complete in L0-L9 checklist
- Separate dispatch after bundle deploy verified

---

## 6. HALT Gates (sequencing safety)

| Gate | Condition | Action |
|---|---|---|
| G1 | Any verified file path not found at baseline | HALT, memory #21 drift |
| G2 | Site creation logic not at expected lines | HALT, report actual |
| G3 | vitest OR tsc fail | HALT, no commit |
| G4 | Stale test expecting self_attest behavior | HALT, update first |
| G5 | Gate rewrite TypeScript invalid | HALT |
| G6 | Site 4 stamped self_report_auto_approve (violates α) | HALT |
| G7 | Any schema mutation attempted (L1 FINAL) | HALT, Invariant 5 |
| G8 | Unrelated refactor introduced | HALT, Invariant 6 |
| G9 | Partial deploy (gate without stamps or vice versa) | HALT, atomic boundary violation |
| G10 | Inner push attempts origin/main | HALT, memory #9 footgun |
| G11 | Post-deploy probe 1/2/3 fails | HALT, rollback (§5.5) |
| G12 | 5th unintended WRITE site touched | HALT |

---

## 7. Out of Scope (Invariant 5, 6)

- ❌ Schema mutation (L1 schema is FINAL)
- ❌ Migration files (L1 shipped)
- ❌ Any file outside the 5 production files + their tests + types
- ❌ Unrelated refactor (e.g. Site 1 service-call extraction)
- ❌ Shared helper modification (resolveActionContractSpecForPatternFamily — Sites 2/4)
- ❌ qrAllowedForContract gate (arenaRuntimeSnapshot.server.ts:58 — separate Lane 7 gate)
- ❌ L7 non_event_confirmed path (future lane)
- ❌ L8 legacy disposition + TODO[L8-cleanup] removal (future lane)
- ❌ L4 device fingerprint full wiring (Sites 2/3/4 stay NULL pre-L4)
- ❌ Worker env var changes

---

## 8. Open Questions for Commander

(none currently — all decisions baked in: §3.4=α, cutover=β-3, bundle=atomic.
Surface here if review reveals ambiguity.)

---

## 9. Version History

| Date | Version | Change | Author |
|---|---|---|---|
| 2026-05-27 | Draft | Initial bundle execution plan from L2+L6 STEP 0 inventories + Commander decisions | C3 (Claude) |
| 2026-05-27 | Locked v1 | Commander approved: §1.3 cross-ref patch (§4→§5), §3.3 Site 3 type unchanged confirmed, §3.1 Site 1 fingerprint approved, §5.3 Commander-direct-deploy | C3 + Commander |
