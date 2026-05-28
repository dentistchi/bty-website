# L5+L6 Re-scope — QR Issuance Alignment Plan

**Status:** Locked v0.2 — Commander approved (review 8.8/10 → 4 fixes + 3 Q answers applied)
**Lane:** L5 (Layer 2 advisory) + L6 (canonical auto-approve removal) re-scoped under Spec v2 §3.5
**Authored:** 2026-05-28 by C3 (Claude), non-mutating dispatch author
**Executor:** Claude Code (VSCode), sole mutation runner
**Mode:** BTY Product Mode (NOT Infra Mode — memory #1 boundary)
**Spec authority:** docs/QR_VERIFICATION_ARCHITECTURE_V1.md @ d07a47ba (Locked v2) §3.5
**Recovery Plan authority:** docs/UNIVERSAL_QR_ARCHITECTURE_RECOVERY_PLAN.md §4.5 (L5), §4.6 (L6)
**Baseline:** inner d07a47ba / outer c5c4af1a / ledger cbd6e5f1
**Memory invariants:** #1 BTY Product Mode, #13 verify gate (vitest + tsc), #21 file path drift, #24 single Supabase production-effective, #26 bty_qr_arch_v1_LOCKED, #27 lock-and-dispatch sequencing

**Commander decisions baked in (2026-05-28):**
- Spec v2 §3.5 progression model: QR scan = sole gate, Layer 2 = advisory (X-2)
- Decision 2 (a): L5+L6 re-scope (not new parallel lane), recovery-plan-consistent
- Decision 3 (b): legacy disposition = L8 scope; this lane is canonical-only
- Decision 4 (A): auto-approve removal targets CANONICAL path only; legacy OR retained with TODO[L8-cleanup]
- L1 columns confirmed present: `self_scan_suspected` + `verification_confidence` on le_verification_log (Component 4 = wiring only, no schema add)

---

## 1. Lane Overview

### 1.1 What this lane does

Spec v2 §3.5 mandates QR scan as the sole progression gate and Layer 2 as advisory
(X-2). The current code violates this via STAB-01-P1 self-report auto-approve, which
sets `verified_at` inline and makes contracts terminal without a QR scan. This lane
brings the code into spec v2 alignment.

### 1.2 Two build components (STEP 0 inventory confirmed)

**Component 1 — Remove canonical auto-approve (L6 remaining scope).**
Remove the `mvp_open` canonical auto-approve path in submit-validation. Contracts no
longer reach terminal without a QR scan. qr/validate becomes the sole approved-setter.

**Component 4 — Layer 2 advisory (L5 re-scope per spec v2 §3.5(C)).**
escalate/reject no longer set blocking statuses. Layer 2 verdict recorded as
`le_verification_log.verification_confidence` metadata. Structurally removes the
escalate dead-end (Lane 7 H1 deadlock).

### 1.3 Emergent (no standalone build)

STEP 0 confirmed Components 2 & 3 are emergent consequences of Component 1:
- **Component 2 (3-of-axis → QR always):** `qrAllowedForContract` (arenaRuntimeSnapshot.server.ts:58-74) already returns true for non-terminal contracts. Removing auto-approve → contracts stay non-terminal until scan → QR always offered. No new mint plumbing.
- **Component 3 (QR scan = sole gate):** qr/validate already gates progression (status-membership in blocking set). Removing the only other approved-setter (auto-approve) makes scan the sole route. No new gate code.

### 1.4 Out of scope (decisions 3b + 4A)

- ❌ Legacy OR branch removal (`legacy_self_attest` arm) — retained with TODO[L8-cleanup]. 55 in-flight legacy pending contracts protected. L8 owns legacy disposition + OR removal.
- ❌ Scanner identity capture / self-scan hole close → L4 (tier-hardening).
- ❌ Schema changes (L1 columns already exist).
- ❌ AD2 non_event_confirmed → L7 (inherits advisory model downstream).

---

## 2. Sequencing

```
L1 (DONE — columns exist)
  └─→ THIS LANE: Component 1 (canonical auto-approve removal) + Component 4 (Layer 2 advisory)
        ├─ shipped together (single deploy unit — they touch the same submit-validation branches)
        └─→ L4 (tier-aware validate route + self-scan hole close) — separate, later
```

Component 1 and Component 4 ship together: both rewrite submit-validation's
post-Layer-2 branch logic (approve/escalate/reject outcomes). Splitting them would
leave an inconsistent intermediate state.

---

## 3. Component 1 — Canonical Auto-Approve Removal

### 3.1 File
`src/app/api/bty/action-contract/submit-validation/route.ts`

### 3.2 Edit specification (STEP 0 line refs at d07a47ba)

**3.2.1 Gate (L275-288) — remove canonical arm, KEEP legacy OR:**

Current dual-path:
```typescript
const canSelfReportAutoApprove =
  (
    (verificationTier === "mvp_open" && verificationStatus === "pending" && selfReportAutoApprove === true)  // canonical — REMOVE
    ||
    (verificationTier === "legacy_self_attest" && verificationType === "self_attest" && verificationStatus === "pending")  // legacy — KEEP
  )
  && envAutoApprove === true
  && isStagingWorker === true;
```

New (canonical arm removed, legacy retained):
```typescript
// Canonical mvp_open auto-approve REMOVED per spec v2 §3.5(B) — QR scan is sole gate.
// Legacy arm retained for 55 in-flight legacy_self_attest contracts.
// TODO[L8-cleanup]: Remove this entire gate after L8 legacy disposition.
const canLegacyAutoApprove =
  verificationTier === "legacy_self_attest"
  && verificationType === "self_attest"
  && verificationStatus === "pending"
  && envAutoApprove === true
  && isStagingWorker === true;
```

Rename to `canLegacyAutoApprove` to make intent explicit (variable no longer covers
canonical contracts). Update the 6 call sites accordingly.

**3.2.2 evalResult true-branch (L290) — canonical contracts always go through evaluator:**
With canonical arm gone, mvp_open contracts always run Layer 1 + Layer 2 (now advisory
per Component 4) and land on submitted + validation_approved_at + QR offered.
Only legacy contracts skip via `canLegacyAutoApprove`.

**3.2.3 approvePatch true-branch (L360-367) — remove inline verified_at/completed_at for canonical:**
The inline `verified_at` + `completed_at` set now applies ONLY to the legacy auto-approve
path. Canonical contracts get submitted + validation_approved_at (verified_at stays null
→ QR offered → scan sets verified_at).

**3.2.4 INVARIANT-3 branch (L434-495) — remove canonical run-completion inline:**
This branch inlines run-completion + XP + AIR (mirroring qr/validate L187-228) so
auto-approve completes the run without a scan. For canonical contracts this MUST move
back to qr/validate (scan-only). For legacy, retain (legacy auto-approve still completes).
Gate this branch on `canLegacyAutoApprove` instead of the old combined gate.

**3.2.5 response discriminator (L502-503):**
- Canonical contract → always `contract_state: "awaiting_qr"`, `verified_at: null`
- Legacy contract (canLegacyAutoApprove) → `contract_state: "terminal"`, `verified_at` set

### 3.3 What stays untouched
- qr/validate/route.ts:174 (the legitimate scan verified_at setter) — KEEP
- legacy OR logic (now canLegacyAutoApprove) — KEEP, tagged
- reflectionRewards.server.ts (called from scan path) — KEEP

---

## 4. Component 4 — Layer 2 Advisory

### 4.1 Files
- `src/app/api/bty/action-contract/submit-validation/route.ts` (escalate/reject branches L509-561)
- `routeLayer2Outcome.ts` (outcome semantics — may stay; the consumer changes, not the router)
- le_verification_log write path (confidence metadata)

### 4.2 Edit specification

**4.2.1 escalate/reject no longer set blocking statuses (L509-561):**

Current:
- reject → status=rejected (blocking, dead-end except resubmit)
- escalate → status=escalated + bty_action_contract_escalations row (blocking, H3 QR forward-exit)

New (advisory):
- Both escalate AND reject → land on the SAME **progression state** (`submitted` +
  `validation_approved_at`) the approve outcome uses → QR offered → scan still gates.
- ★ Same progression state, DISTINCT confidence semantics (Risk 2 fix). The three
  outcomes share one progression class (all → submitted → QR → scan) but carry
  different Layer 2 semantic confidence:
  - approve → 'high'
  - escalate (ambiguous / confidence < 0.7) → 'medium'
  - reject (criterion fail) → 'low'
  They are NOT the same state — they are the same progression class with distinct
  confidence metadata. This distinction is what makes the future X-3 content-gate
  migration tractable (X-3 will re-separate them into gate outcomes).
- This structurally removes the escalate dead-end (Lane 7 H1). escalate/reject become
  confidence tags within one progression class, not progression blocks.

**4.2.2 Confidence metadata write — validation vs verification separation (Risk 1 fix, Commander 2026-05-28):**

★ CRITICAL semantic boundary (spec D1). `le_verification_log` is the **verification
event** source of truth — a row exists only when a QR scan (verification event) occurs.
At submit-validation time there is NO verification event yet (contract is `submitted`,
not `verified`). Writing Layer 2 verdict to `le_verification_log` at submit time would
pollute the verification log with validation metadata — a D1 violation.

Correct two-phase flow:
1. **At submit-validation (Layer 2 runs):** write Layer 2 semantic confidence to
   **validation metadata** — `bty_action_contract_validator_evaluations` (existing
   logEvaluation path, L320-334) is the canonical home. Optionally mirror a summary to
   a `bty_action_contracts` validation field if a read-fast path is needed (decide in
   STEP 1; prefer NOT adding state to contracts table per minimal-state principle).
2. **At QR scan (qr/validate, verification event occurs):** the le_verification_log row
   is created. At THAT point, copy/carry the validation confidence into
   `le_verification_log.verification_confidence` as part of the scan record.

So `le_verification_log.verification_confidence` is written by the SCAN path, not
submit-validation. submit-validation only records Layer 2 verdict as validation metadata.
This keeps `le_verification_log` = pure verification event log (spec D1 intact).

**Naming (Risk/Q3):** the submit-time Layer 2 value is **Layer 2 semantic confidence**
(validation metadata), distinct from **verification confidence** (the scan-time record).
Do not conflate. The mapping (approve→high / escalate→medium / reject→low) is the Layer 2
semantic confidence; it becomes verification_confidence only when carried through a scan.

**4.2.3 bty_action_contract_escalations:**
With escalate no longer a blocking terminal state, decide: still insert the escalation
row for audit (recommended — audit trail), but it no longer gates progression. The row
becomes advisory record, not a dead-end marker.

**4.2.4 Runtime state machine coherence (hazard):**
arenaRuntimeSnapshot maps ACTION_ESCALATED / ACTION_SUBMITTED priorities + H3 circuit
breaker. When escalate no longer produces a distinct blocking state, verify the
state machine stays coherent — escalate contracts now map to the same awaiting-scan
state as submitted. Capture + test the ACTION_SUBMITTED path covers former-escalate rows.

### 4.3 Layer 2 stays advisory, NOT removed
Layer 2 still runs (content quality evaluation). Its verdict informs confidence
metadata + AIR weighting. It does NOT block progression. X-3 (post-launch) can
re-promote Layer 2 to content gate once LLM reliability is verified (needs levers
α/β/γ). This lane implements X-2 only.

---

## 5. STEP Plan (lock cycle)

```
STEP 0   inventory — DONE (this plan is its output)
STEP 0.5 runtime state-map inventory (Risk 3 — REQUIRED before STEP 1)
STEP 1A  Component 1 — canonical auto-approve removal
STEP 1B  Component 4 — Layer 2 advisory
         (1A + 1B same file region — combined edit dispatch per Commander Q1)
STEP 2   test suite — rewrite + add advisory tests, vitest + tsc
STEP 3   atomic commit + push + Commander deploy + post-deploy probes
STEP 4   ledger update
```

Each STEP = separate dispatch, Commander approval between.

### 5.1 STEP 0.5 — Runtime state-map inventory (Risk 3, REQUIRED)

Removing the `escalated` blocking state changes the runtime state machine. Per BTY
invariant "canonical snapshot > uiStep", the runtime state map must stay coherent when
escalate no longer produces a distinct blocking state. This is NOT a simple "verify
coherence" — it requires explicit inventory before any edit.

Read and map (read-only):
- `arenaRuntimeSnapshot.server.ts` — `ACTION_ESCALATED` priority, `ACTION_SUBMITTED`
  priority, state ordering, `qrAllowedForContract` (L58-74)
- H3 circuit breaker logic (the escalated + verified_at-null forward-exit)
- `blockingArenaActionContract.ts` blocking status membership set
- Any consumer that branches on `ACTION_ESCALATED` distinctly from `ACTION_SUBMITTED`

Report:
- Current state priority ordering (verbatim)
- Every reference to ACTION_ESCALATED
- What happens to H3 breaker when escalate→submitted collapse lands
- Whether ACTION_ESCALATED can be removed cleanly OR must be retained as alias of
  ACTION_SUBMITTED OR mapped some other way
- The exact runtime_state a former-escalate contract will report post-change

STEP 0.5 report → Commander review → THEN STEP 1. Do not start STEP 1 until the
state-map disposition is explicit.

---

## 6. STEP 2 — Test Impact (memory #13 verify gate)

Tests asserting current auto-approve/terminal behavior MUST be rewritten (not deleted —
migrations rule: never regress baseline):
- submit-validation/route.test.ts (auto-approve → terminal assertions)
- qr/validate/route.test.ts (scan completion — should now be the sole completion path)
- MyPageLeadershipConsole.test.tsx
- action-loop-token/route.test.ts
- canonical-reward-loop.integration.test.ts (terminal flow)

New tests required:
- "canonical mvp_open contract → submitted + validation_approved_at + verified_at null (NOT terminal)"
- "canonical contract progression requires qr/validate scan"
- "legacy_self_attest contract still auto-approves (canLegacyAutoApprove)"
- "Layer 2 escalate → submitted (not escalated blocking) + confidence='medium'"
- "Layer 2 reject → submitted (not rejected dead-end) + confidence='low'"
- "Layer 2 approve → submitted + confidence='high'"
- "escalate no longer produces dead-end (progression via scan works)"

Gate: vitest all pass + tsc --noEmit exit 0 (eslint ajv crash = pre-existing backlog, not gate).

---

## 7. STEP 3 — Deploy + Probes

Atomic single commit (Component 1 + 4 + tests). Push inner-main + outer mirror (memory #9).
Commander-direct worker deploy (§5.3 pattern from L2+L6 bundle).

Post-deploy probes:
- Probe 1: canonical contract created → submit-validation → contract_state='awaiting_qr', verified_at=null (NOT terminal). ★ Core fix verification (DB-level).
- **Probe 1B (Risk 4 fix — REQUIRED):** runtime snapshot, not just DB. After
  submit-validation for a canonical contract, fetch the arena runtime snapshot and
  confirm:
  ```json
  {
    "runtime_state": "ACTION_AWAITING_VERIFICATION",
    "gates": { "qr_allowed": true, "next_allowed": false }
  }
  ```
  Rationale: `verified_at == null` at DB level does NOT prove the QR actually surfaced
  in the UI. Per BTY invariant "snapshot > uiStep", the runtime snapshot is the
  authoritative surface signal. The original symptom (Commander's "QR 안보임") is a
  snapshot/surface issue — Probe 1 (DB) is necessary but not sufficient; Probe 1B
  (snapshot gates) proves QR is offered. (Exact runtime_state literal confirmed in
  STEP 0.5.)
- Probe 2: QR scan (qr/validate) → verified_at set → progression unlocked (next_allowed=true).
- Probe 3: legacy contract → still auto-approves (canLegacyAutoApprove).
- Probe 4: Layer 2 escalate case → contract reaches submitted (not escalated dead-end);
  Layer 2 semantic confidence='medium' in validation metadata; carried to
  le_verification_log.verification_confidence only after scan (Risk 1 two-phase).
- Probe 5: no escalation spike / no deadlock.

★ Probe 1 + 1B together = regression-fix proof: the original symptom ("QR 안보임")
must be resolved — canonical contracts now surface QR (snapshot qr_allowed=true)
instead of terminal "Action reported".

---

## 8. HALT Gates

| Gate | Condition | Action |
|---|---|---|
| H1 | submit-validation line refs differ at d07a47ba | HALT, report actual |
| H2 | canLegacyAutoApprove change accidentally affects canonical | HALT |
| H3 | tsc error | HALT |
| H4 | escalate rework breaks runtime state machine coherence (STEP 0.5 must clear first) | HALT, report state map |
| H5 | verification_confidence column write fails (column absent) | HALT (but confirmed present) |
| H6 | legacy OR branch modified beyond rename | HALT (decision 4A: keep legacy) |
| H7 | qr/validate (scan path) accidentally modified | HALT (out of scope) |
| H8 | Test baseline regressed (deleted not rewritten) | HALT |
| H9 | Probe 1 still shows terminal/no-QR for canonical | HALT, fix incomplete |
| H10 | Inner push to origin/main | HALT (memory #9) |

---

## 9. Out of Scope (explicit)

- ❌ Legacy OR removal (L8)
- ❌ Scanner identity / self-scan hole (L4)
- ❌ Schema changes (L1 done)
- ❌ AD2 non_event (L7)
- ❌ X-3 Layer 2 content gate (post-launch)
- ❌ Levers α/β/γ implementation (resolved for MVP by X-2 advisory; X-3 reopens)
- ❌ qr/validate scan logic changes (this lane makes scan mandatory; L4 hardens who scans)

---

## 10. Resolved Decisions (Commander 2026-05-28)

1. **STEP 1A + 1B = COMBINED.** Both touch submit-validation post-Layer-2 semantics.
   Separating creates intermediate incoherence: 1A-only leaves reject/escalate dead-end;
   1B-only leaves auto-approve bypass. Ship together.
2. **bty_action_contract_escalations = KEEP inserting (audit only).** No longer blocking;
   becomes advisory escalation row. Valuable signal for future X-3. blocking removal ≠
   audit removal.
3. **Layer 2 confidence mapping = approve→high / escalate→medium / reject→low for MVP.**
   Named **"Layer 2 semantic confidence"** (validation metadata, distinct from scan-time
   "verification confidence" — Risk 1 two-phase separation). X-3 may refine granularity.

## 10b. Open Items (none blocking lock)

- STEP 0.5 will resolve the exact ACTION_ESCALATED disposition (remove / alias / map).
- STEP 1 decides whether a read-fast validation field on bty_action_contracts is needed
  (default: NO — keep contracts table minimal, use validator_evaluations).

---

## 11. Version History

| Date | Version | Change | Author |
|---|---|---|---|
| 2026-05-28 | Draft | STEP 0 inventory → lane plan. Components 1+4 build, 2+3 emergent. Decisions a/b/A baked in. | C3 (Claude) |
| 2026-05-28 | **Locked v0.2** | Commander review 8.8/10. 4 fixes: (R1) le_verification_log write timing — two-phase validation-metadata-at-submit / verification-confidence-at-scan, D1 boundary restored; (R2) "same progression class, distinct confidence semantics" wording; (R3) STEP 0.5 runtime state-map inventory added (required before STEP 1); (R4) Probe 1B runtime snapshot qr_allowed surfaced. Q1 combined / Q2 keep escalation audit / Q3 "Layer 2 semantic confidence" naming. | C3 + Commander |
