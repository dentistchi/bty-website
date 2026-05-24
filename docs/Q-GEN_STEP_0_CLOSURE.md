# Q-GEN STEP 0 — Constitutional Closure

**Status**: FORMALLY CLOSED
**Date**: 2026-05-24
**Lane class**: forensic, mutation-zero
**Authority**: Commander-reviewed verbatim record

---

## 1. Context — Why Q-GEN existed

Q-GEN ("question generation") was opened as a forensic lane to resolve the
runtime origin of QR (Quick-Reflect / verification) issuance in BTY Arena.
The triggering question was framed initially as:

> "What path causes QR to appear?"

The lane was scoped as STEP 0 — a precursor to any mutation. The intent was
to corroborate substrate authority before any code or schema change could be
proposed, in keeping with the post-STAB-07-P0 discipline that QR lineage is
not a single-author claim but a multi-source convergence question.

## 2. STEP 0 scope

STEP 0 was bounded to:

- substrate (DB columns + table cardinality + index/constraint shape) inventory
- runtime path forensic (writer / reader / gate authority separation)
- intent vs. implementation collision mapping
- explicit prohibition of any code, schema, or ledger mutation during the lane

Mutation budget at lane open: 0. Mutation budget at lane close: 0.

## 3. Five-cycle corroborated forensic result

The lane completed five corroborating forensic cycles, each with split
authority between C3 (intent / policy inventory) and Claude Code (runtime /
substrate inventory):

| Cycle     | Scope                              | Authority    |
|-----------|------------------------------------|--------------|
| Phase 3   | Intent inventory                   | C3           |
| Phase 1+2 | Runtime forensic                   | Claude Code  |
| Phase 2.5 | Substrate lineage (3-tier map)     | Claude Code  |
| Phase 3.9 | Escalation table corroboration     | Claude Code  |
| Phase 4   | 4-axis collision map               | C3 synthesis |

A prior claim of "three writers" for QR lineage was corrected during
Phase 1+2 to two writers and one reader. Specifically: writers at
`ensureActionContract.ts:280` and `eliteBindingActionCommitment.server.ts:204`
(both setting `verification_type:"qr"`); reader at `submit-validation/route.ts`
(reading `pattern_state_snapshot` and `verification_type`, not writing).
The prior writer-classification of `route.ts:64` was identified as drift.

### Substrate authority map (FINAL)

`bty_action_contracts` — four reviewed columns, three-tier verdict:

| Column                  | Verdict                                                       |
|-------------------------|---------------------------------------------------------------|
| `validation_approved_at`| ACTIVE — gate pivot, live write ✓ / tracked ✗                |
| `escalated_at`          | ACTIVE — full escalation lifecycle (4 write / 1 read)         |
| `qr_token_ref`          | TRUE-ORPHAN — live ✓ / refs 0 / signer linkage 0              |
| `resolution`            | NON-RELEVANT in this table — real residency is `bty_action_contract_escalations` |

`bty_action_contract_escalations` — separate table, 11 columns, rows = 2:

- audit-subsystem schema
- columns include `opened_at`, `escalated_at`, `expires_at`, `resolved_at`,
  `resolution`, `reviewer_user_id`, `reviewer_notes`
- CREATE migration itself is out-of-band (tracked migrations = 0)

## 4. Mutation-zero confirmation

The lane closed with the following invariants intact:

- Code mutations: 0
- Schema mutations: 0
- Ledger mutations: 0
- Provenance violations: 0
- Premature dispatch authoring incidents: 0

## 5. Lever α/β/γ — HOLD

The lane surfaced three options for resolving the spec-vs-runtime collision
on the role plane:

- **α** — Layer 2 promoted to visible MVP feature (large product change;
  conflicts with D-9 freeze)
- **β** — Layer 2 retained as hidden internal lifecycle (status quo;
  weakens spec authority)
- **γ** — Layer 2 deferred to post-MVP (conservative; requires explicit
  rationale for deferral)

**Decision**: HOLD. Deferred to a separate governance cycle outside of
Q-GEN STEP 0 scope. The deliberate non-decision is itself authoritative —
it is not avoidance, it is the recognition that the lever framework is now
formalized and the choice belongs to a different governance surface.

## 6. No lane escalation

Q-GEN STEP 0 does not escalate into a follow-on Q-GEN STEP 1. Any further
work on this collision space requires:

1. Commander-authorized new lane open
2. Reference to this closure document as the substrate baseline
3. Re-validation of substrate state at re-entry time (substrate is live
   and may have drifted)

## 7. Executor topology clarification

This lane was conducted under the post-2026-05-18 executor topology:

- **Commander**: directs, decides, holds verbatim authority
- **C3 (Claude, this chat)**: dispatch author, inventory reviewer, verdict
  arbiter; non-mutating
- **Claude Code (VSCode)**: sole mutation executor; STEP 0 corroborator

Executor authority and mutation authority were intentionally separated.

The prior Cursor multi-agent setup (C1–C5) is permanently retired. Any
historical references to Cursor / C1–C5 in older dispatches are invalid
authority sources.

## 8. Closure statement

Q-GEN STEP 0 is hereby declared **FORMALLY CLOSED** as of 2026-05-24,
with the framing of its central question authoritatively redefined.

**Original framing (Korean, verbatim):**

> "Spec 의 3-role 평면 (Issuer/Actor/Approver) 에 부재한 Layer 2
> (Reviewer + audit subsystem) 를 MVP launch 시점에 어떻게 정의 / 인정 /
> 노출할 것인가?"

**Portable framing (English):**

> "How shall the Layer 2 (Reviewer + audit subsystem), absent from the
> spec's 3-role plane (Issuer / Actor / Approver), be defined, recognized,
> or surfaced at the MVP launch boundary?"

This reframing is the lane's primary artifact. The fix was not a code
change. The fix was the authoritative redefinition of the question.

No implementation authority follows from this closure without a separately
opened lane.

## 9. Downstream implications

Open questions outside the closure scope, non-blocking for launch:

- `bty_action_contract_escalations` CREATE migration is itself untracked —
  schema backfill decision is deferred
- 10 `validator_evaluations` case-B (`outcome:'ambiguous'` vs.
  `confidence < 0.7`) — threshold-relaxation lever remains available but
  not exercised
- `bty_action_contract_escalations.rows = 2` — actual status of those rows
  not inspected during STEP 0; deferred to operational observation

Historical framings associated with "escalated_at / resolution orphan
reconcile" and F2 / MVP-policy did not formally enter the operational
ledger and are conceptually absorbed into:

- post-launch migration candidate space
- α/β/γ governance HOLD

## 10. Ledger reference recommendation

This closure document is the constitutional source. The operational ledger
(`docs/CURSOR_TASK_BOARD.md` + `docs/CURRENT_TASK.md`) should hold only a
pointer-class reference to this file, not duplicate the forensic content.

The verbatim ledger entry wording is out of scope for this closure document
and will be authored under a separate Commander-reviewed lane (Stage C of
the lane sequence that produced this closure).

---

## Document provenance

- **Author**: C3 (Claude, this chat), 2026-05-24
- **Authority**: Commander-reviewed (pending verbatim lock)
- **Substrate**:
  - STAB-07-P0 corrected record
  - Q-GEN STEP 0 closure session (2026-05-24)
- **Mutation budget at draft**: 0
- **Verbatim status**: pending Commander verbatim lock
