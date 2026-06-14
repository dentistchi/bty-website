# BTY_PATTERN_FAMILY_AXISVECTOR_COVERAGE_LOCK.md  (v1.0)

> Derived per BTY_CHARACTER_AXIS_GOVERNANCE_LOCK.md v1.0 / LOCK-D-FIELD.
> This document does not redefine Avatar, Axis, or Axis Actor.
> It only records pattern_family → AxisVector coverage derived from STEP 0C/0D evidence.
> Source: STEP 0C/0D read-only inventories, HEAD cdf028ff. Live path: pattern_family → normalizePatternFamilyId → AxisVector.
> STATUS: Commander-approved. §C verdicts = Commander (Phase 2). DOC-ONLY (no code/data/fingerprint change).

---

## 0. Path of record

`pattern_family` (scenario/choice data)
  → `normalizePatternFamilyId` (`pattern-family.ts:120-129`, pure dictionary, NO substring/keyword fallback)
  → exact trigger literal
  → `buildFingerprintInput.ts:33-46` (reads `pattern_family` only)
  → `AxisVector` (12, `fingerprint.ts:6-18`)

Route legend:
- **direct-canonical** = value IS itself a trigger literal.
- **exact-alias** = `PATTERN_FAMILY_ALIAS` hit → trigger literal.
- **UNCLAIMED** = normalize returns value unchanged, matches no trigger → zero AxisVector effect.

Coverage: 111 distinct → 69 CLAIMED / 42 UNCLAIMED.

---

## A. CLAIMED (69 distinct → AxisVector)

| pattern_family | count | normalized_id | AxisVector | route |
|---|---:|---|---|---|
| future_deferral | 199 | future_deferral | time | direct-canonical |
| repair_avoidance | 195 | repair_avoidance | repair | direct-canonical |
| truth_naming | 89 | truth_naming | truth | direct-canonical |
| delegation_deflection | 46 | delegation_deflection | conflict | direct-canonical |
| conflict_avoidance | 34 | delegation_deflection | conflict | exact-alias |
| explanation_substitution | 32 | explanation_substitution | accountability | direct-canonical |
| ownership_act | 23 | ownership_escape | ownership | exact-alias |
| trust_repair | 22 | repair_avoidance | repair | exact-alias |
| ownership_clarity | 18 | ownership_escape | ownership | exact-alias |
| integrity_alignment | 18 | integrity_compromise | integrity | exact-alias |
| reputation_protection | 14 | reputation_protection | visibility | direct-canonical |
| neutrality_masking | 14 | authority_protection | authority | exact-alias |
| authority_protection | 14 | authority_protection | authority | direct-canonical |
| documentation_sanitization | 12 | explanation_substitution | accountability | exact-alias |
| performance_blame | 11 | explanation_substitution | accountability | exact-alias |
| private_intention | 10 | self_protection | control | exact-alias |
| integrity_compromise | 10 | integrity_compromise | integrity | direct-canonical |
| system_exposure | 8 | truth_naming | truth | exact-alias |
| blame_shift | 8 | explanation_substitution | accountability | exact-alias |
| temporary_compliance | 6 | self_protection | control | exact-alias |
| surface_compliance | 6 | self_protection | control | exact-alias |
| silent_execution | 6 | integrity_compromise | integrity | exact-alias |
| silence_avoidance | 6 | delegation_deflection | conflict | exact-alias |
| self_protection | 6 | self_protection | control | direct-canonical |
| over_ownership | 6 | ownership_escape | ownership | exact-alias |
| insight_without_behavior | 6 | integrity_compromise | integrity | exact-alias |
| identity_commitment | 6 | integrity_compromise | integrity | exact-alias |
| hidden_resistance | 6 | self_protection | control | exact-alias |
| growth_justification | 6 | explanation_substitution | accountability | exact-alias |
| burnout_normalization | 6 | future_deferral | time | exact-alias |
| boundary_reset | 6 | repair_avoidance | repair | exact-alias |
| blame_reversal | 6 | explanation_substitution | accountability | exact-alias |
| silence_normalization | 4 | delegation_deflection | conflict | exact-alias |
| relationship_exception | 4 | integrity_compromise | integrity | exact-alias |
| reality_distortion | 4 | truth_naming | truth | exact-alias |
| person_dependent_integrity | 4 | integrity_compromise | integrity | exact-alias |
| passive_trust | 4 | integrity_compromise | integrity | exact-alias |
| ownership_transfer | 4 | ownership_escape | ownership | exact-alias |
| leader_variability | 4 | integrity_compromise | integrity | exact-alias |
| group_conformity | 4 | reputation_protection | visibility | exact-alias |
| exception_normalization | 4 | integrity_compromise | integrity | exact-alias |
| control_fixation | 4 | self_protection | control | exact-alias |
| authority_preservation | 4 | authority_protection | authority | exact-alias |
| authority_exercise | 4 | authority_protection | authority | exact-alias |
| truth_recognition | 3 | truth_naming | truth | exact-alias |
| ownership_escape | 3 | ownership_escape | ownership | direct-canonical |
| leader_protection | 3 | authority_protection | authority | exact-alias |
| compensation_loop | 3 | repair_avoidance | repair | exact-alias |
| truth_expression | 2 | truth_naming | truth | exact-alias |
| truth_entry | 2 | truth_naming | truth | exact-alias |
| system_defensiveness | 2 | authority_protection | authority | exact-alias |
| successor_protection | 2 | authority_protection | authority | exact-alias |
| stability_preservation | 2 | delegation_deflection | conflict | exact-alias |
| selective_enforcement | 2 | integrity_compromise | integrity | exact-alias |
| role_ownership | 2 | ownership_escape | ownership | exact-alias |
| recentralized_control | 2 | self_protection | control | exact-alias |
| reality_reclaiming | 2 | truth_naming | truth | exact-alias |
| rationalization | 2 | explanation_substitution | accountability | exact-alias |
| principle_without_constraint | 2 | integrity_compromise | integrity | exact-alias |
| drift_normalization | 2 | integrity_compromise | integrity | exact-alias |
| documentation_without_ownership | 2 | ownership_escape | ownership | exact-alias |
| correction_avoidance | 2 | repair_avoidance | repair | exact-alias |
| authority_constraint | 2 | authority_protection | authority | exact-alias |
| accountability_application | 2 | explanation_substitution | accountability | exact-alias |
| visible_correction | 1 | truth_naming | truth | exact-alias |
| silence_alignment | 1 | delegation_deflection | conflict | exact-alias |
| ownership_avoidance | 1 | ownership_escape | ownership | exact-alias |
| misuse_correction | 1 | truth_naming | truth | exact-alias |
| distortion_identification | 1 | truth_naming | truth | exact-alias |

---

## B. UNCLAIMED (42 distinct — passthrough, zero AxisVector effect)

Per LOCK: normalize returns each value unchanged; no trigger match. Verdicts in §C.

system_thinking(30), accountability_system(18), standard_creation(12), avoidance_behavior(9),
fairness_definition(7), emotional_release_loop(6), system_adaptation(5), successor_assumption(4),
standard_enforcement(4), relationship_buffer(4), pattern_capture(4), localized_system(4),
instruction_based_handoff(4), emotional_bypass(4), closure_rush(4), adaptive_alignment(3),
system_reliability(2), system_reinforcement(2), system_independence(2), system_constraint(2),
successor_ownership_mechanism(2), self_correction_protocol(2), scaling_control(2),
principle_with_constraint(2), pressure_tested_successor_alignment(2), pattern_ownership(2),
observed_handoff(2), equal_application(2), drift_detection(2), controlled_scaling(2),
constraint_definition(2), active_verification(2), system_humility(1), system_feedback_loop(1),
symbolic_correction(1), standard_separation(1), relationally_held_correction(1), re_engagement(1),
pattern_structuring(1), internalization(1), decentralized_correction(1), boundary_definition(1).

---

## C. UNCLAIMED-42 — Commander Decision Table (verdict-complete)

> Verdicts = Commander (Phase 2). Core conclusion: NEW CLAIM = 0 · NEW ALIAS = 0 · CODE IMPACT = 0 · FINGERPRINT IMPACT = 0.
> STEP 0D did not discover a new axis; it proved the existing 69-claimed structure already holds the boundary.
> The significance of this verdict is what was deliberately NOT added.
> Guard upheld: family meaning ≠ scenario axis ≠ neighboring claimed family. Neighboring-axis signals are
> scenario-level, not family-intrinsic; using them as alias grounds would violate LOCK-D-FIELD.

### C.1 Group B (12) — verdict: keep-unclaimed (doc-only)

| pattern_family | count | dir | neighbor axis (scenario-level, NOT family meaning) | verdict | rationale | downstream |
|---|---:|---|---|---|---|---|
| avoidance_behavior | 9 | exit | truth/mixed (sparse) | keep-unclaimed | EXIT 회피/철수, 시나리오 축 분산, 단일 AxisVector 미형성 | doc-only |
| fairness_definition | 7 | entry | integrity (sparse) | keep-unclaimed | ENTRY 건설적 명명, 왜곡축 아님 | doc-only |
| emotional_release_loop | 6 | exit | ownership (core_08) | keep-unclaimed | EXIT comfort 측, 시나리오 축 분산 | doc-only |
| emotional_bypass | 4 | exit | repair | keep-unclaimed | EXIT 회피, repair 시나리오의 exit 측, 자기 축 없음 | doc-only |
| closure_rush | 4 | exit | integrity/authority tie | keep-unclaimed | EXIT 직면 회피, 시나리오 축 분산 | doc-only |
| relationship_buffer | 4 | exit | integrity | keep-unclaimed | EXIT 관계통한 예외, 자기 축 없음 | doc-only |
| pattern_ownership | 2 | entry | integrity/authority tie | keep-unclaimed | ENTRY 시스템화, 건설적, 왜곡축 아님 | doc-only |
| successor_ownership_mechanism | 2 | entry | integrity/ownership tie | keep-unclaimed | ENTRY 소유, 건설적 | doc-only |
| pressure_tested_successor_alignment | 2 | entry | integrity/ownership tie | keep-unclaimed | ENTRY 소유/정렬, 건설적 | doc-only |
| scaling_control | 2 | entry | integrity | keep-unclaimed | ENTRY 시스템화, 건설적 | doc-only |
| drift_detection | 2 | entry | integrity | keep-unclaimed | ENTRY 능동검증, 건설적, relationship_buffer(exit)의 entry 짝 | doc-only |
| re_engagement | 1 | entry | integrity (sparse) | keep-unclaimed | ENTRY 재참여, avoidance_behavior(exit)의 entry 짝 | doc-only |

### C.2 Group A (26) — verdict: keep-unclaimed (doc-only)

Rationale (그룹 공통): system/governance vocabulary — distortion family가 아니라 capability / operating-system language. downstream = doc-only.

system_thinking(30), accountability_system(18), standard_creation(12), system_adaptation(5),
standard_enforcement(4), pattern_capture(4), localized_system(4), adaptive_alignment(3),
system_reliability(2), system_reinforcement(2), system_independence(2), system_constraint(2),
self_correction_protocol(2), principle_with_constraint(2), equal_application(2), controlled_scaling(2),
constraint_definition(2), active_verification(2), system_humility(1), system_feedback_loop(1),
standard_separation(1), pattern_structuring(1), internalization(1), decentralized_correction(1),
boundary_definition(1), relationally_held_correction(1).
[26 families · all keep-unclaimed · doc-only]

### C.3 Group C (4) — verdict: retire (canonical classification only — doc-only)

Rationale (그룹 공통): 실사용 패턴 축으로 채택할 근거 부족; legacy / narrow implementation residue 성격.

For these four, all of the following are simultaneously true:
- Canonical Axis Coverage = **retire** (classified as non-axis legacy residue in this canon)
- Runtime behavior = **unchanged passthrough**
- Code = **untouched** (`normalizePatternFamilyId`, `PATTERN_FAMILY_ALIAS`, `buildFingerprintInput`)
- Data = **untouched** (scenario JSON)

`retire` here ≠ runtime deletion ≠ data migration ≠ code removal.

| pattern_family | count | verdict | downstream |
|---|---:|---|---|
| successor_assumption | 4 | retire | doc-only |
| instruction_based_handoff | 4 | retire | doc-only |
| observed_handoff | 2 | retire | doc-only |
| symbolic_correction | 1 | retire | doc-only |

### C.4 Final checksum

| bucket | count |
|---|---:|
| CLAIMED → AxisVector | 69 |
| KEEP-UNCLAIMED (Group A) | 26 |
| KEEP-UNCLAIMED (Group B) | 12 |
| RETIRE (Group C) | 4 |
| **TOTAL** | **111** |

NEW CLAIM = 0 · NEW ALIAS = 0 · CODE IMPACT = 0 · FINGERPRINT IMPACT = 0.
No change to: pattern-family.ts · PATTERN_FAMILY_ALIAS · buildFingerprintInput · AxisVector coverage.

---

## D. Coverage summary (by AxisVector key)

| AxisVector | pattern-derived coverage | notes |
|---|---|---|
| repair | strong (~228) | |
| time | strong (~205) | |
| truth | strong (~113) | |
| conflict | strong (~93) | |
| accountability | strong (~79) | |
| integrity | strong (~72) | |
| ownership | mid (~59) | |
| authority | mid (~45) | |
| control | mid (~40) | |
| visibility | weak (~18) | only 2 families; governance lock §3.4.3 |
| courage | none (pattern) | metric-sourced (emotionalRegulation); lock §3.4.2 |
| identity | none (pattern) | metric-sourced (TII); lock §3.4.2 |

Honesty clauses inherited from governance lock §3.4: 5-vs-10 split; courage/identity not pattern-derived; visibility weak.

---

*Authored: this-chat transcription (NON-MUTATING). Commander-approved; authority on repo materialize.*
*Source evidence: STEP 0C / 0D read-only inventories, HEAD cdf028ff. Governance parent: BTY_CHARACTER_AXIS_GOVERNANCE_LOCK.md v1.0.*
