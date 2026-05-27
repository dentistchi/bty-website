# Universal QR Architecture Recovery Plan

**Status:** Draft for Commander review
**Author:** C3 (Claude) · dispatch author, non-mutating
**Date:** 2026-05-27
**Target:** BTY launch (was 5/30, shifted to 6/02 per memory #16; now no time constraint — Commander directive: "제대로 고쳐 시간 아직 많아")
**Code baseline:** inner HEAD `90e5c13a` (Lane 7 Layer 1 closure)

---

## 0. Context

This plan is the corrected response to D-7 (2026-05-26) Lane 7 QR-gate regression incident. The D-7 incident framing was wrong in 5 critical ways (see §2 below). Commander corrected the architecture direction on 2026-05-27 to **Option E — Tier-aware hybrid (mvp_open + member_only + manager_only)**. This plan implements that decision from scratch, treating the D-7 Lane 7 Layer 1 A2 revert as a temporary stabilization to be replaced.

The plan reference invariants are stored in:
- Memory #11: 12-axis canonical model with 3-of-7 trigger (5 canonical, 7 alias/unimplemented)
- Memory #26: BTY QR three-tier architecture (Commander 2026-05-27)

---

## 1. Reference architecture (locked)

### 1.1 Core invariant

> Action verification requires an **external witness**. Self-attestation does not constitute behavioral evidence. A contract reaches `complete_verified` only when a party other than the actor has confirmed (via QR scan) that the action occurred.

In code form: `scanner.user_id != contract.user_id` (for member_only / manager_only tiers).

### 1.2 Three-tier QR access

| Tier | Phase | Window | Scanner eligibility | Self-scan policy |
|---|---|---|---|---|
| `mvp_open` | MVP pilot | D-0 6/02 → ~7/02 (30 days) | Anyone with a QR reader | Record + flag, no hard block |
| `member_only` | General rollout | 200-person full deployment | Registered btyARENA users (`auth.users` row required) | Hard block (409) |
| `manager_only` | Event-restricted | Mission trip, doctor's meeting, training, etc. | Designated managers for the linked event | Hard block + role check |

### 1.3 verification_type taxonomy (new)

Replaces legacy `self_attest / qr / hybrid / link / self_report / qr_peer / qr_system / qr_location / none`.

| Type | Meaning |
|---|---|
| `action_completed` | Default. Actor performed a measurable external action, witness confirms. |
| `non_event_confirmed` | AD2 path. Witness confirms an avoidance commitment was honored (X did not happen). |
| `manager_reviewed` | Manager reviewed and verified action with formal evaluation (score + comment). |

Legacy verification_types remain in the CHECK constraint during cutover for backward compatibility but are not used in new contracts.

### 1.4 New DB fields on `bty_action_contracts`

| Field | Type | Notes |
|---|---|---|
| `verification_tier` | text CHECK | mvp_open / member_only / manager_only / legacy_self_attest |
| `verified_by_user_id` | uuid (FK auth.users) | nullable; set when scanner is logged-in |
| `verified_by_fingerprint_hash` | text | nullable; set for mvp_open scans |
| `verification_confidence` | text CHECK | low / medium / high |
| `self_scan_suspected` | boolean DEFAULT false | true when scanner fingerprint matches actor's |
| `actor_device_fingerprint_hash` | text | captured at contract creation |

### 1.5 Legacy contract policy

All existing contracts at migration time → `verification_tier = 'legacy_self_attest'`.
- XP/AIR reflection: **preserved** (users already received progression — no rollback)
- Relational verification badge: **withheld** (UI does not show "verified by external witness")
- `details.legacy_disposition` breadcrumb on hotfix contracts: `external_witness_absent_but_admin_approved`

### 1.6 Behavioral rationale (Commander 2026-05-27)

> BTY는 MVP에서 사람을 막는 시스템이 아니라 행동 루프를 여는 시스템으로 시작한다. 하지만 architecture는 처음부터 Tier 2/3 strict invariant를 품고 간다. 즉, MVP는 open, engine은 strict-ready.

The mvp_open tier intentionally does not hard-block self-scan because (a) MVP organic adoption requires friction minimization, (b) BTY's primary signal is behavioral loop closure (does the contract reach `complete_verified` at all?), and (c) `self_scan_suspected` is recorded as integrity pressure data without forcing the user to abandon the loop.

---

## 2. D-7 framing corrections

The D-7 Lane 7 incident (2026-05-26) and subsequent dispatch decisions misframed the system in 5 ways. This plan supersedes those decisions.

| # | D-7 framing | Reality (verified 2026-05-27) |
|---|---|---|
| 1 | "Lane 7 A2 revert (self_attest) is launch-safe because consumption side not pre-wired" | QR validate route exists at `/api/arena/leadership-engine/qr/validate` (237 lines, complete). Consumption side was always ready. A2 revert was unnecessary and violated Commander's universal-QR product direction. |
| 2 | "STAB-01 4-AND gate is acceptable production semantic" | 4-AND gate is staging-isolated (BTY_ENV check) but the **production self-scan hole** is via the QR validate route itself (no scanner-actor separation). 4-AND gate framing was a distraction from the real invariant gap. |
| 3 | "Production Layer 2 path means self_attest is verified-safe" | Layer 2 evaluator is **unaware of verification_type**. Self_attest contracts pass Layer 2 if text quality meets 3 criteria. Layer 2 approve → status='submitted' + validation_approved_at=NOW(), but verified_at is then set by anyone POSTing to QR validate with the token — including the actor. |
| 4 | "8 hotfix contracts unblocked stuck deadlock" | Hotfix wrote `verified_at = NOW()` with no external witness. This is an audit false claim. The contracts must be tagged `legacy_self_attest` with explicit `external_witness_absent_but_admin_approved` breadcrumb. |
| 5 | "WRITE 3 sites is the full universal-QR lineage" | A **4th WRITE site** exists at `actionContractLifecycle.server.ts:294` using `'hybrid'` for draft micro_win activation. This site was outside the Lane 7 A2 revert scope and must be addressed in this plan. |

---

## 3. Code facts (verified 2026-05-27)

### 3.1 12-axis canonical model

- `src/domain/pattern-family.ts:5-11` — `CANONICAL_PATTERN_FAMILIES` exactly 5:
  - `ownership_escape`
  - `repair_avoidance`
  - `explanation_substitution`
  - `delegation_deflection`
  - `future_deferral`
- `src/domain/pattern-family.ts:14` — `PATTERN_ACTION_CONTRACT_EXIT_THRESHOLD = 3`
- `src/domain/arena/patternTrigger.ts:46` — `ACCUMULATION_EXIT_THRESHOLD = 3`
- `src/lib/bty/pattern-engine/syncPatternStates.ts:4` — `WINDOW_SIZE = 7`
- `src/lib/bty/archetype/buildFingerprintInput.ts:33-46` — 12-slot axisVector, 10 pen()-wrapped, 2 raw passthrough (courage, identity)
- DB: 41 distinct `pattern_family` values — scenario authoring drift, must be reconciled

**Implication:** Of the 12 axes, only 5 (ownership, time, authority, truth, repair) currently fire QR triggers via the 3-of-7 accumulation rule. The other 7 axes either resolve via alias maps to one of the 5 canonical or do not contribute to runtime trigger. Scenario JSON authoring discipline is broken — new pattern_family values appear in DB without taxonomy enforcement.

### 3.2 Current WRITE sites (Lane 7 Layer 1 A2 revert intact)

| Site | File | Current verification_type |
|---|---|---|
| 1 | `src/app/api/arena/action-contracts/route.ts:64` | `'self_attest'` |
| 2 | `src/lib/bty/action-contract/ensureActionContract.ts:280` | `'self_attest'` |
| 3 | `src/lib/bty/arena/eliteBindingActionCommitment.server.ts:201` | `'self_attest'` |
| 4 | `src/lib/bty/action-contract/actionContractLifecycle.server.ts:294` | `'hybrid'` (draft micro_win, scope=外 Lane 7) |

### 3.3 Validate route

- Path: `src/app/api/arena/leadership-engine/qr/validate/route.ts` (237 lines)
- `requireUser: NO` — anyone with a token can POST
- Token validation: `token.userId === contract.user_id` (token belongs to contract owner)
- **No scanner identity capture, no scanner-actor separation check**
- This is the production self-scan hole

### 3.4 Mint route

- Path: `src/app/api/arena/leadership-engine/qr/action-loop-token/route.ts`
- `requireUser: YES` — actor logged in
- Token payload: `{ sessionId, userId, actionId, issuedAt, contractId }`
- Token is JWT-like signed payload (not DB row; spec qr_tokens table is unimplemented drift)
- Token is transferable post-mint

### 3.5 Submit-validation route

- Path: `src/app/api/bty/action-contract/submit-validation/route.ts` (note: BTY segment, not Arena)
- L266-270: 4-AND `canSelfReportAutoApprove` gate (staging-only by BTY_ENV check)
- L341-489: outcome=approve branches into auto-approve (4-AND true) vs Layer 2 normal (status='submitted' + validation_approved_at, no verified_at)

### 3.6 Layer 2 evaluator

- File: `src/lib/bty/validator/runActionContractValidation.ts` + `layer2Semantic.ts`
- LLM payload includes: pattern_context, contract fields (who/what/how/when/raw_text), 3 criteria_questions
- LLM payload **does not include**: verification_type, verification_tier, user_id, status, history
- 3 criteria: `re_entry_direction`, `external_measurability`, `non_cosmetic`
- Approve when all 3 pass with confidence ≥ 0.7
- No external-witness instruction in system prompt

---

## 4. Lanes

This plan is structured as 9 lanes (L0–L9). Each lane has an independent verify gate. Commander reviews dispatch at the start of each lane.

### 4.1 Lane overview

| Lane | Goal | Dependency | Mutation | Risk |
|---|---|---|---|---|
| L0 | Spec lock — write `QR_VERIFICATION_ARCHITECTURE_V1.md` | None | doc-only | Low |
| L1 | DB migration — new columns + legacy isolation | L0 | DB schema | Med |
| L2 | Contract creation: verification_tier stamp + new verification_type at 4 WRITE sites | L1 | Code | Med |
| L3 | QR mint path: tier-aware token payload | L2 | Code | Low |
| L4 | QR validate route: tier-aware enforcement ★ critical | L3 | Code | **High** |
| L5 | Layer 2 prompt + outcome: verification_type-aware | L4 | Code | Med |
| L6 | STAB-01 4-AND gate removal | L5 | Code | Low |
| L7 | AD2 non_event_confirmed path | L6 | Code | Med |
| L8 | 8 hotfix contracts + 41 pattern_family disposition | L4 | DB + governance | High |
| L9 | UI: Resolve screen + Identity Console tier-aware messaging | All | UI | Low |

### 4.2 L0 — Spec lock

**Goal:** Lock the architecture decision in a referenceable spec document.

**Deliverables:**
- `bty-app/docs/QR_VERIFICATION_ARCHITECTURE_V1.md` (estimated 350-500 lines)
  - Three-tier definitions (mvp_open / member_only / manager_only)
  - New verification_type taxonomy (action_completed / non_event_confirmed / manager_reviewed)
  - DB schema additions (verification_tier, verified_by_user_id, verified_by_fingerprint_hash, verification_confidence, self_scan_suspected, actor_device_fingerprint_hash)
  - Validate route invariants per tier (pseudocode)
  - Token payload changes (tier + scanner_required flag)
  - Layer 2 prompt changes (tier-aware system prompt + verification_type in user payload)
  - Legacy contract policy (`legacy_self_attest` isolation)
  - AD2 non_event_confirmed path semantics
- Cross-references added to `bty-app/docs/BTY_12_CORE_AXIS.md` (already exists) and `docs/CURSOR_TASK_BOARD.md`
- `docs/CURRENT_TASK.md` Lane checklist appended

**Verify gate:**
- Commander reads document and locks (no edits requested OR edits applied)
- Document cross-referenced from CURSOR_TASK_BOARD.md
- Lane checklist visible

### 4.3 L1 — DB migration

**Goal:** Add new columns, tag legacy contracts, update CHECK constraints.

**Migration SQL (single file, idempotent):**
```sql
-- Add new columns
ALTER TABLE bty_action_contracts 
  ADD COLUMN IF NOT EXISTS verification_tier text;
ALTER TABLE bty_action_contracts 
  ADD COLUMN IF NOT EXISTS verified_by_user_id uuid REFERENCES auth.users(id);
ALTER TABLE bty_action_contracts 
  ADD COLUMN IF NOT EXISTS verified_by_fingerprint_hash text;
ALTER TABLE bty_action_contracts 
  ADD COLUMN IF NOT EXISTS verification_confidence text;
ALTER TABLE bty_action_contracts 
  ADD COLUMN IF NOT EXISTS self_scan_suspected boolean DEFAULT false;
ALTER TABLE bty_action_contracts 
  ADD COLUMN IF NOT EXISTS actor_device_fingerprint_hash text;

-- Tag all existing contracts as legacy
UPDATE bty_action_contracts 
  SET verification_tier = 'legacy_self_attest'
  WHERE verification_tier IS NULL;

-- Add CHECK constraints
ALTER TABLE bty_action_contracts 
  ADD CONSTRAINT verification_tier_check 
  CHECK (verification_tier IN (
    'mvp_open', 'member_only', 'manager_only', 'legacy_self_attest'
  ));

ALTER TABLE bty_action_contracts 
  ADD CONSTRAINT verification_confidence_check 
  CHECK (verification_confidence IS NULL OR verification_confidence IN (
    'low', 'medium', 'high'
  ));

-- Expand verification_type CHECK to include new + keep legacy during cutover
ALTER TABLE bty_action_contracts 
  DROP CONSTRAINT IF EXISTS verification_type_check;
ALTER TABLE bty_action_contracts 
  ADD CONSTRAINT verification_type_check 
  CHECK (verification_type IN (
    -- new (canonical post-cutover)
    'action_completed', 'non_event_confirmed', 'manager_reviewed',
    -- legacy (preserved for backward compat during cutover; not used in new contracts)
    'self_attest','qr','link','hybrid','qr_peer','qr_system','qr_location','self_report','none'
  ));
```

**Verify gate:**
- Snapshot before migration (full schema dump)
- Apply migration on Supabase
- Snapshot after migration
- Production query: all existing contracts have `verification_tier = 'legacy_self_attest'`
- Production query: 6 new columns visible with correct types
- New CHECK constraints active (test insert with invalid values returns error)

**Risk note (memory #24):** Single Supabase project backs all workers. Migration is production-effective immediately.

### 4.4 L2 — Contract creation rewrite

**Goal:** Update the 4 WRITE sites to stamp `verification_tier` and use new `verification_type`.

**WRITE sites (all 4):**
1. `src/app/api/arena/action-contracts/route.ts:64`
2. `src/lib/bty/action-contract/ensureActionContract.ts:280`
3. `src/lib/bty/arena/eliteBindingActionCommitment.server.ts:201`
4. `src/lib/bty/action-contract/actionContractLifecycle.server.ts:294` (draft micro_win — was scope-out in Lane 7, now in scope)

**Logic at each site:**
```ts
// Tier determination (env-based phase + event-aware)
const verification_tier = (() => {
  if (event_id_present && event_designated_managers_set) {
    return 'manager_only';
  }
  if (process.env.BTY_PHASE === 'tier2_member_only') {
    return 'member_only';
  }
  // Default: MVP open (Commander launch posture)
  return 'mvp_open';
})();

// verification_type
// Site 1-3 (normal action contracts): 'action_completed'
// Site 4 (draft micro_win): 'action_completed' (unless AD2 — see L7)
const verification_type = 'action_completed';

// Actor device fingerprint at creation
const actor_device_fingerprint_hash = await computeDeviceFingerprintHash(req);

// Persist
.insert({
  ...existing_fields,
  verification_tier,
  verification_type,
  actor_device_fingerprint_hash,
  // New verified_by_* / verification_confidence / self_scan_suspected remain NULL until QR scan
});
```

**Fingerprint computation:** Stable hash of (User-Agent + Accept-Language + IP subnet + some browser characteristics). Implementation: `src/lib/bty/qr/computeDeviceFingerprintHash.ts` (new file).

**Verify gate:**
- E2E: new contract from each WRITE site → row has `verification_tier IN ('mvp_open', 'member_only', 'manager_only')`
- E2E: new contract has `verification_type = 'action_completed'`
- E2E: new contract has `actor_device_fingerprint_hash IS NOT NULL`
- Legacy contracts unchanged
- Test: env BTY_PHASE flip changes tier on next contract

### 4.5 L3 — QR mint path tier-aware

**Goal:** Token payload includes verification_tier so validate route can branch.

**File:** `src/app/api/arena/leadership-engine/qr/action-loop-token/route.ts`

**Changes:**
```ts
// Existing token payload
const payload = {
  sessionId, userId, actionId, issuedAt, contractId,
};

// New token payload
const payload = {
  sessionId, userId, actionId, issuedAt, contractId,
  verification_tier: contract.verification_tier,
  scanner_required: contract.verification_tier !== 'mvp_open',
};
```

**Verify gate:**
- Decode signed token after mint → contains `verification_tier`
- For mvp_open contract → `scanner_required: false`
- For member_only contract → `scanner_required: true`
- For manager_only contract → `scanner_required: true`

### 4.6 L4 — QR validate route tier-aware enforcement ★ critical

**Goal:** Close the production self-scan hole. Enforce scanner-actor separation per tier.

**File:** `src/app/api/arena/leadership-engine/qr/validate/route.ts`

**Pseudocode (replaces existing handler):**
```ts
export async function POST(req: Request) {
  const { token } = await req.json();
  const verified = verifyArenaActionLoopToken(token);
  if (!verified.ok) return 401 { error: 'invalid_token' };
  
  const { contractId, userId: actorUserId } = verified.payload;
  const contract = await fetchContract(contractId, actorUserId);
  if (!contract) return 404 { error: 'contract_not_found' };
  
  // Awaiting verification classification (existing logic preserved)
  const awaitingVerification = (
    contract.status IN ('approved', 'submitted')
    && contract.validation_approved_at != null
    && contract.verified_at == null
  );
  if (!awaitingVerification) {
    return 409 { error: 'contract_not_pending' };
  }
  
  const tier = contract.verification_tier;
  
  // ─────────────────────────────────────────────────────────
  // Tier 1 — mvp_open
  // ─────────────────────────────────────────────────────────
  if (tier === 'mvp_open') {
    const scannerFingerprint = await computeDeviceFingerprintHash(req);
    const selfScanSuspected = (
      scannerFingerprint === contract.actor_device_fingerprint_hash
    );
    const verificationConfidence = selfScanSuspected ? 'low' : 'medium';
    
    // Optional: capture logged-in scanner if happens to be authenticated
    const optionalUser = await tryGetUser(req);
    const verifiedByUserId = optionalUser?.user_id ?? null;
    
    await db.update('bty_action_contracts', {
      status: 'approved',
      verified_at: now,
      completed_at: now,
      verified_by_user_id: verifiedByUserId,
      verified_by_fingerprint_hash: scannerFingerprint,
      verification_confidence: verificationConfidence,
      self_scan_suspected: selfScanSuspected,
    }).where({ id: contractId });
    
    await completeArenaRunAfterContractVerification(...);
    await onArenaRunCompleteVerified(...);
    await applyArenaRunRewardsOnVerifiedCompletion(...);
    await reflectContractVerificationToAir(...);
    
    return 200 { 
      outcome: 'verified', 
      verification_confidence: verificationConfidence,
      self_scan_suspected: selfScanSuspected,
    };
  }
  
  // ─────────────────────────────────────────────────────────
  // Tier 2 — member_only
  // ─────────────────────────────────────────────────────────
  if (tier === 'member_only') {
    const scanner = await requireUser(req);
    if (!scanner) return 401 { error: 'login_required' };
    if (scanner.user_id === contract.user_id) {
      return 409 { 
        error: 'self_scan_blocked',
        message: 'Action verification requires another bty member.',
      };
    }
    
    await db.update('bty_action_contracts', {
      status: 'approved',
      verified_at: now,
      completed_at: now,
      verified_by_user_id: scanner.user_id,
      verification_confidence: 'high',
      self_scan_suspected: false,
    }).where({ id: contractId });
    
    // ... downstream chain same as mvp_open
    
    return 200 { outcome: 'verified', verified_by: scanner.codename };
  }
  
  // ─────────────────────────────────────────────────────────
  // Tier 3 — manager_only
  // ─────────────────────────────────────────────────────────
  if (tier === 'manager_only') {
    const scanner = await requireUser(req);
    if (!scanner) return 401 { error: 'login_required' };
    if (scanner.user_id === contract.user_id) {
      return 409 { error: 'self_scan_blocked' };
    }
    
    const event = await fetchEvent(contract.event_id);
    if (!event) return 400 { error: 'event_link_missing' };
    
    if (!event.designated_managers.includes(scanner.user_id)) {
      return 403 { 
        error: 'not_designated_manager',
        message: 'This action can only be verified by a designated manager.',
      };
    }
    
    await db.update('bty_action_contracts', {
      status: 'approved',
      verified_at: now,
      completed_at: now,
      verified_by_user_id: scanner.user_id,
      verification_confidence: 'high',
      self_scan_suspected: false,
    }).where({ id: contractId });
    
    // ... downstream chain
    
    return 200 { outcome: 'verified', verified_by_manager: scanner.codename };
  }
  
  // ─────────────────────────────────────────────────────────
  // Legacy tier
  // ─────────────────────────────────────────────────────────
  if (tier === 'legacy_self_attest') {
    // Legacy contracts created before cutover. No verification path via this route.
    // They are already verified via L8 disposition.
    return 410 { 
      error: 'legacy_contract_no_verification_path',
      message: 'This contract predates the verification architecture.',
    };
  }
  
  return 400 { error: 'unknown_tier', tier };
}
```

**New helper file:** `src/lib/bty/qr/computeDeviceFingerprintHash.ts`

**E2E test plan:**
1. mvp_open contract, actor self-scan → 200, `self_scan_suspected: true`, `verification_confidence: 'low'`
2. mvp_open contract, third-party scan → 200, `self_scan_suspected: false`, `verification_confidence: 'medium'`
3. member_only contract, actor self-scan → 409 `self_scan_blocked`
4. member_only contract, another logged-in user scan → 200, `verification_confidence: 'high'`
5. member_only contract, unauthenticated scan → 401
6. manager_only contract, designated manager scan → 200
7. manager_only contract, non-designated logged-in user scan → 403
8. manager_only contract, actor self-scan → 409 (even if actor happens to be a manager elsewhere)
9. legacy_self_attest contract via this route → 410

**Verify gate:** All 9 E2E cases pass.

### 4.7 L5 — Layer 2 evaluator verification_type-aware

**Goal:** Layer 2 LLM evaluator aware of verification_type + tier; outcome routing respects new types.

**Files:**
- `src/lib/bty/validator/runActionContractValidation.ts:19-73`
- `src/lib/bty/validator/layer2Semantic.ts:69-97`
- `src/lib/bty/validator/routeLayer2Outcome.ts`

**Changes:**

a) Input signature:
```ts
evaluateActionContractPayload(input: {
  who, what, how, when, rawText,
  patternFamily,
  verificationType: 'action_completed' | 'non_event_confirmed' | 'manager_reviewed',
  verificationTier: 'mvp_open' | 'member_only' | 'manager_only',
})
```

b) System prompt (layer2Semantic.ts) — append:
```
The contract verification_type is "{verification_type}".
- "action_completed": Actor commits to a measurable external action verified by external witness via QR scan after completion.
- "non_event_confirmed": Actor commits to AVOIDING an action; witness later confirms the avoidance was honored.
- "manager_reviewed": Action will undergo formal manager evaluation including score and comment.

Verification occurs in the physical world via external witness, not by self-report. Evaluate the contract text for evidence-readiness — does the action have observable external markers another person could verify?
```

c) User payload — append verification_type + tier metadata (LLM uses for evidence-readiness assessment, not for routing).

d) Outcome → status mapping (unchanged): outcome=approve still produces status='submitted' + validation_approved_at=NOW(). verified_at is set only by L4 validate route.

**Verify gate:**
- New contract Layer 2 approve → verified_at remains NULL
- Layer 2 LLM call traces include verification_type + verification_tier in payload
- Reject case (action lacks external markers): Layer 2 returns reject or escalate with appropriate confidence

### 4.8 L6 — STAB-01 4-AND gate removal

**Goal:** Remove `canSelfReportAutoApprove` path entirely. No production path can set verified_at from submit-validation.

**File:** `src/app/api/bty/action-contract/submit-validation/route.ts`

**Changes:**
- Delete L266-270 (`canSelfReportAutoApprove` computation)
- Delete L341-410 (4-AND approve branch with verified_at)
- L341 onward: outcome=approve always produces `{ status: 'submitted', validation_approved_at: now, escalated_at: null }` — never verified_at, never completed_at.
- Layer 2 SKIP branch (formerly under 4-AND true): also delete, always run Layer 2.

**Backward compat consideration:** Staging E2E tests that relied on 4-AND auto-approve must migrate to the QR validate flow with `BTY_PHASE=mvp` test env. Test fixtures must mock QR validate POSTs.

**Verify gate:**
- grep -rn "canSelfReportAutoApprove" src/ → no results
- grep -rn "self_report_auto_approve" src/ → only in legacy contract `details` field reads (audit), no writes
- Staging E2E test: submit-validation with old 4-AND env flags → still goes through Layer 2 (no auto-approve)

### 4.9 L7 — AD2 non_event_confirmed path

**Goal:** Implement avoidance/non-event verification path.

**Open question for Commander before L7 starts:**

> AD2의 approver는 누구인가?
>
> A. 일반 member도 가능 (e.g., 동료가 "X를 안 하는 것을 봤다"고 증언)
> B. Manager만 가능 (manager_reviewed로만 검증)
> C. Mvp_open에서는 누구나, Tier 2에서는 member, Tier 3에서는 manager — tier에 따라 다름
> D. AD2는 self-attest 허용 (BTY 회피 검증의 특수성)

Recommendation: **C** (tier-aware), keeping AD2 consistent with main verification architecture. But this is product decision, not technical.

**Logic (assuming C):**
- AD2 contract creation: `verification_type = 'non_event_confirmed'`, `verification_tier = (same tier rules as action_completed)`
- QR validate route: AD2 contracts use same tier branches as action_completed, but with different UI/messaging
- Approver UI: shows "X 안 일어났음을 확인했다" prompt instead of "X가 일어났음을 확인했다"
- Optional approver note field

**Verify gate:**
- AD2 scenario produces contract with verification_type='non_event_confirmed'
- AD2 contract verification via QR validate works in all 3 tiers
- UI shows correct non-event prompt

### 4.10 L8 — Legacy contract disposition

**Goal:** Tag 8 hotfix contracts + reconcile 41 pattern_family drift.

**L8a — 8 hotfix contracts (D-7):**

| Contract ID (per D-7 transcript) | User |
|---|---|
| fe71287c | chihanbit7 (original trigger) |
| b76b1da3 | hanbitchi |
| e4632681 | STAB-08 smoke seed |
| 1ba8b194 | ikendo1 |
| c52628f0 | hanbitchi |
| 9df071f9 | ywamer2022 |
| 38d9e485 | ikendo1 |
| aaa3a010 | chihanbit7 |

```sql
UPDATE bty_action_contracts
SET 
  verification_tier = 'legacy_self_attest',
  details = jsonb_set(
    coalesce(details, '{}'::jsonb), 
    '{legacy_disposition}', 
    '"external_witness_absent_but_admin_approved"'::jsonb
  )
WHERE id IN (
  '<8 hotfix UUIDs from D-7 transcript>'
);
```

XP/AIR not rolled back (users already received progression). Relational verification badge withheld in UI (L9).

**L8b — 41 pattern_family drift:**

Two-track approach:
1. **Build-time enforcement:** Scenario JSON validator (CI step) — reject scenarios using pattern_family not in CANONICAL_PATTERN_FAMILIES or alias map.
2. **Alias map expansion:** Map drift families to canonical 5:
   - `truth_naming` → `explanation_substitution` (already in code as alias?)
   - `unknown_pattern_family` → reject (CI fail)
   - `integrity_compromise` → `explanation_substitution`
   - ... (full mapping in spec doc)
3. **DB cleanup:** Migrate existing rows' `pattern_family` to canonical where alias exists; mark `details.original_pattern_family` for audit.

**Verify gate:**
- 8 hotfix contracts: `verification_tier='legacy_self_attest'` + `details.legacy_disposition` set
- CI: scenario PR with non-canonical pattern_family → build fails
- DB: all rows have `pattern_family IN (canonical 5)` OR `details.original_pattern_family` for audit
- Test: 41 DB pattern_family → after cleanup, 5 canonical

### 4.11 L9 — UI tier-aware messaging

**Goal:** User-facing feedback that reflects verification tier and confidence.

**Files:**
- `src/app/[locale]/bty-arena/play/resolve/ArenaResolveClient.tsx`
- `src/components/bty-arena/ArenaResolveScreen.tsx`
- `src/components/bty/my-page/MyPageLeadershipConsole.tsx`

**UI variants:**

a) Resolve screen on contract verified:
- mvp_open + self_scan_suspected=false: "Action verified."
- mvp_open + self_scan_suspected=true: "Action recorded. Verification confidence: building."
- member_only verified: "Action verified by {scanner_codename}."
- manager_only verified: "Action verified by manager {scanner_codename}."
- legacy_self_attest (existing contracts viewing): "Action recorded (legacy mode)."

b) Identity Console pattern signatures:
- New field: `Verification: relational` (for contracts with `verification_confidence='high'`)
- Or: `Verification: recorded` (for mvp_open with `self_scan_suspected=false`)
- Or: `Verification: self-reported` (for `self_scan_suspected=true` or legacy)

c) Pattern_family literal exposure (related but separate):
- Current screenshot shows `truth_naming`, `reputation_protection` as visible labels. After L8 alias resolution these become canonical 5.
- Optional: replace pattern_family literal with translated friendly label (e.g., "Ownership" instead of `ownership_escape`). This is a separate design decision.

**Verify gate:**
- Manual screenshot per tier
- A11y check
- KO/EN both locales

---

## 5. Cross-lane risks

| Risk | Mitigation |
|---|---|
| R1. Backward compat during cutover | L1 adds columns nullable. L2-L4 deploy in same release window. CHECK constraint allows legacy verification_type values until cutover complete. |
| R2. Staging worker self_attest contracts | After L6, staging cannot auto-approve. E2E tests must migrate to QR validate flow with `BTY_PHASE=mvp` and mocked scanner. |
| R3. Worker deploy ordering (memory #4) | L1 (DB migration) before any worker deploy. Then L2-L9 in a single worker version OR sequential with feature flags. |
| R4. Memory cap (30) | Plan-level invariants in this doc; only the most critical architectural facts in memory (#11, #26). |
| R5. Token transferability | Acceptable because L4 enforces server-side scanner.user_id verification. Token alone is insufficient for member_only/manager_only. |
| R6. mvp_open fingerprint spoofability | Acknowledged limitation. Self_scan_suspected is best-effort signal, not security boundary. Tier 2+ uses logged-in identity. |
| R7. Build-time scenario validation breaking existing scenarios | Run L8b CI enforcement only after DB cleanup completes. Pre-cleanup CI in warn-only mode. |

---

## 6. Execution order (Commander-approved sequence)

1. **L0 → L1** — spec lock + DB migration. Foundation for everything.
2. **L2 → L3 → L4** — creation + mint + validate. Universal QR core. **L4 verify gate must pass before launch.**
3. **L5 → L6** — Layer 2 awareness + 4-AND removal. Invariant strengthening.
4. **L9** — UI tier-aware messaging. Aligns user-facing feedback.
5. **L7** — AD2 path. Separate workstream, can parallel L9.
6. **L8** — Legacy disposition. Final cleanup.

**Launch gate:** Production launch (was 6/02) blocked until L4 verify gate passes. L7/L8/L9 can be post-launch if necessary, but L4 is non-negotiable for universal QR architecture integrity.

**Launch posture (Commander 2026-05-27):** All new contracts created post-cutover default to `verification_tier='mvp_open'`. Tier 2 cutover (D-30 ~ 7/02) triggered by env flag flip `BTY_PHASE=tier2_member_only`. Tier 3 (event-restricted) requires event creation + designated_managers data — separate workstream.

---

## 7. Out of scope (this plan)

- 12-axis taxonomy collapse beyond CANONICAL 5 enforcement (L8b handles alias-map but full re-design of 7 partial-implemented axes is post-launch)
- Trigger model spec drift (Immediate / Integrity Gap / Convergence beyond Accumulation) — flagged in fact-capture, no fix here
- spec qr_tokens table vs JWT-like signed payload drift — current JWT-like sufficient
- axisVector S-B (10) vs pattern_states S-B (5) vocabulary mismatch — WS-1/#3 documented, deferred
- ActionContractHub UI enum `self_attest` non-recognition — separate STAB-03-A area
- Memory Engine consumer additions (already wired 3 locations per memory #17)
- LRI sub-tab + Certified sub-tab admin lane (memory #28, post-launch HIGH)

---

## 8. Memory references

This plan depends on the following memory invariants:

- **#11** `[12_axis_canonical 2026-05-27]` — code wiring locations for CANONICAL_PATTERN_FAMILIES + 3/7 trigger constants
- **#26** `[bty_qr_arch 2026-05-27]` — Commander Option E architecture decision (this plan implements)
- **#4** `[secret/build precedence]` — wrangler/build precedence for env vars
- **#17** `[docs_authority_2026_05_15]` — CURSOR_TASK_BOARD + CURRENT_TASK as authoritative source
- **#21** `[file_path_drift]` — verified path corrections; submit-validation is in `/api/bty/`, not `/api/arena/`
- **#22** `[db_cleanup_discipline]` — pre-DB migration grep + FK CASCADE + rehearsal account preservation
- **#24** `[supabase_topology_lock]` — single Supabase project, all worker DB mutations production-effective
- **#27** `[provenance_self_correction]` — dispatch author ≠ Commander-reviewed; verify-then-no-op preferred
- **#29** `[inventory_first_safety_system]` — constitutional safety, no semantic subtraction without residency verification

---

## 9. Approval

This plan requires Commander review per lane before dispatch execution. C3 (Claude) writes dispatches; Claude Code executes mutations. Commander confirms verify gate before next lane begins.

**Plan status:** DRAFT pending Commander review and lock.

**Next step on approval:** Begin L0 — draft `QR_VERIFICATION_ARCHITECTURE_V1.md` for Commander review.

---

*End of plan.*
