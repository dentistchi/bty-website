# AL-2-B LOW Confidence Deferred Rows

**Sprint context**: AL-2-B Phase 3 closure discipline
**Date**: 2026-05-09
**Decision policy**: docs-only deferred (force-map 영역 안 0)
**Rationale**: "Implementation does not decide ontology" — invariant 정합

---

## §1 Source

- File: [docs/AL-2-A-mapping-decision-template.csv](AL-2-A-mapping-decision-template.csv)
- Filter: `confidence == LOW` (notes column starts with "LOW")
- Count: **48 rows** (Phase 0 actual count, CSV-aware enumeration)

### §1.1 Why LOW

LOW = the Council CSV's lowest-confidence tier. Each row's `notes` column carries the `LOW; <reason>` pattern. Common reasons (per CSV):
- semantic boundary fuzzy / dual-interpretation
- generic name / lacks specific mechanism anchor
- positive/exit-direction valence with no penalty target
- meta narrative (no behavioral distortion mapping)
- depends on NEW_AXIS adoption (Phase 2 deferred)

### §1.2 Phase 2 already-deferred LOW (4 rows)

Per Phase 2 dispatch, these LOW rows were explicitly excluded from the NEW_AXIS alias dictionary (Phase 2 closure cite):

| pattern_family | NEW_AXIS cluster | freq |
|---|---|---:|
| `private_intention` | `MERGE_INTO=self_protection` (NEW_AXIS=control) | 10 |
| `successor_protection` | `MERGE_INTO=authority_protection` (NEW_AXIS=authority) | 2 |
| `system_defensiveness` | `MERGE_INTO=authority_protection` (NEW_AXIS=authority) | 2 |
| `group_conformity` | `MERGE_INTO=reputation_protection` (NEW_AXIS=visibility, V-1-A) | 4 |

All 4 are **MERGE_INTO** rows whose target is a Phase 2 NEW_AXIS anchor. Phase 2 deferred them per HIGH+MEDIUM-only admit rule.

The remaining **48 − 4 = 44 LOW rows** were not Phase 2 candidates (either DEPRECATE or merging into existing canonical-5).

---

## §2 Destination Categories (candidate, Commander confirmation pending)

Three downstream sprints/buckets host the eventual disposition of LOW rows. **Final destination = Hanbit Commander semantic decision**; placeholders below are the most likely candidate per row.

### §2.1 AL-2-C — archetype meaning sprint

Scope: 7 archetype semantic redesign · `patternRequires` recalculation · `courage`/`identity` axis pen() shape · NEW_AXIS LOW row resolution · meaning of edge-case families.

LOW row candidates routed here:
- All 4 NEW_AXIS-dependent LOW rows (Phase 2 deferred — §1.2 above)
- 7 existing-canonical merge candidates (semantic boundary fuzzy, depends on archetype meaning):
  - `avoidance_behavior`, `closure_rush`, `accountability_application`, `boundary_definition`, `misuse_correction`, `re_engagement`, `visible_correction`

### §2.2 AL-2-E — scenario JSON re-tag sprint

Scope: `bty_tension_axis` literal re-tag · 12 Type 4 OUTSIDE literals (Phase 2 enum null entries) · scenario authoring vocabulary realignment.

LOW row candidates routed here: **0 from this list** — most LOW rows are family-level (not Layer 2 sentence-level). Phase 2's enum table already enumerates the 12 OUTSIDE literals as `null`; AL-2-E may rewrite the scenarios (not the LOW row list).

### §2.3 Housekeeping — cleanup sprint

Scope: dead artifact deletion (`patternFamilyCompatibilityMap` per [AL-2-B-cleanup-candidates.md](AL-2-B-cleanup-candidates.md)) · deprecated family pruning · scenario-author rename consolidation.

LOW row candidates routed here: 37 DEPRECATE rows (no behavioral distortion mapping, meta/narrative/exit-direction).

---

## §3 LOW Row × Destination Table (48 rows)

Sorted by destination candidate, then by frequency (desc).

### §3.1 NEW_AXIS-dependent (4 rows) — candidate destination: AL-2-C

| # | pattern_family | freq | candidate_canonical | rationale (excerpted) | candidate destination |
|--:|---|--:|---|---|---|
| 1 | `private_intention` | 10 | `MERGE_INTO=self_protection` | Public-private intent gap (covert distortion) — control-axis dimension | AL-2-C (NEW_AXIS=control) |
| 2 | `group_conformity` | 4 | `MERGE_INTO=reputation_protection` | Conforming for group belonging — visibility-axis dimension | AL-2-C (NEW_AXIS=visibility, V-1-A) |
| 3 | `successor_protection` | 2 | `MERGE_INTO=authority_protection` | Protecting successor authority position | AL-2-C (NEW_AXIS=authority) |
| 4 | `system_defensiveness` | 2 | `MERGE_INTO=authority_protection` | System defensiveness = authority protection mechanism | AL-2-C (NEW_AXIS=authority) |

### §3.2 Existing-canonical merge candidates (7 rows) — candidate destination: AL-2-C / Phase 4 alias

| # | pattern_family | freq | candidate_canonical | rationale (excerpted) | candidate destination |
|--:|---|--:|---|---|---|
| 5 | `avoidance_behavior` | 9 | `MERGE_INTO=delegation_deflection` | Generic avoidance — defaults to conflict-axis distortion | AL-2-C / Phase 4 alias |
| 6 | `closure_rush` | 4 | `MERGE_INTO=future_deferral` | Rushing closure — time-axis distortion (collapse direction) | AL-2-C / Phase 4 alias |
| 7 | `accountability_application` | 2 | `MERGE_INTO=explanation_substitution` | Accountability application — exit direction | AL-2-C / Phase 4 alias |
| 8 | `boundary_definition` | 1 | `MERGE_INTO=repair_avoidance` | Defining boundary — repair-dimension exit | AL-2-C / Phase 4 alias |
| 9 | `misuse_correction` | 1 | `MERGE_INTO=repair_avoidance` | Correcting misuse = repair-dimension exit | AL-2-C / Phase 4 alias |
| 10 | `re_engagement` | 1 | `MERGE_INTO=repair_avoidance` | Re-engagement = repair-dimension exit | AL-2-C / Phase 4 alias |
| 11 | `visible_correction` | 1 | `MERGE_INTO=repair_avoidance` | Visible correction = repair-dimension exit | AL-2-C / Phase 4 alias |

### §3.3 DEPRECATE rows (37) — candidate destination: Housekeeping

| # | pattern_family | freq | rationale (excerpted) | candidate destination |
|--:|---|--:|---|---|
| 12 | `accountability_system` | 18 | Systemic accountability narrative — exit/positive valence meta family | Housekeeping |
| 13 | `standard_creation` | 12 | Creating new standard — ambiguous valence (could be repair-exit or scope-evasion) | Housekeeping |
| 14 | `fairness_definition` | 7 | Defining fairness narrative — meta/discourse family | Housekeeping |
| 15 | `emotional_release_loop` | 6 | Emotional discharge cycle — comfort axis (no canonical) | Housekeeping |
| 16 | `system_adaptation` | 5 | Adaptive belonging narrative — positive valence | Housekeeping |
| 17 | `emotional_bypass` | 4 | Emotional discharge — comfort axis (no canonical) | Housekeeping |
| 18 | `instruction_based_handoff` | 4 | Handoff narrative — transferability dimension; no axis fit | Housekeeping |
| 19 | `localized_system` | 4 | Localized system narrative — meta family | Housekeeping |
| 20 | `pattern_capture` | 4 | Awareness/meta family — exit/positive valence | Housekeeping |
| 21 | `relationship_buffer` | 4 | Relationship buffer narrative — meta family | Housekeeping |
| 22 | `standard_enforcement` | 4 | Enforcing standard — exit/positive direction | Housekeeping |
| 23 | `successor_assumption` | 4 | Successor narrative — transferability dimension | Housekeeping |
| 24 | `adaptive_alignment` | 3 | Belonging adaptation narrative | Housekeeping |
| 25 | `active_verification` | 2 | Verification narrative — exit/positive valence meta | Housekeeping |
| 26 | `constraint_definition` | 2 | Constraint definition — meta family | Housekeeping |
| 27 | `controlled_scaling` | 2 | Scaling narrative — no axis fit | Housekeeping |
| 28 | `drift_detection` | 2 | Drift awareness — exit/positive valence meta | Housekeeping |
| 29 | `equal_application` | 2 | Equal application narrative — exit/positive valence | Housekeeping |
| 30 | `observed_handoff` | 2 | Handoff narrative — transferability dimension | Housekeeping |
| 31 | `pattern_ownership` | 2 | Pattern ownership — meta family | Housekeeping |
| 32 | `pressure_tested_successor_alignment` | 2 | Successor narrative — transferability dimension | Housekeeping |
| 33 | `principle_with_constraint` | 2 | Principle-constraint narrative — exit direction | Housekeeping |
| 34 | `scaling_control` | 2 | Scaling/control narrative | Housekeeping |
| 35 | `self_correction_protocol` | 2 | Self-correction narrative — exit/positive valence | Housekeeping |
| 36 | `successor_ownership_mechanism` | 2 | Successor mechanism narrative — transferability | Housekeeping |
| 37 | `system_constraint` | 2 | System constraint narrative | Housekeeping |
| 38 | `system_independence` | 2 | System independence narrative | Housekeeping |
| 39 | `system_reinforcement` | 2 | System reinforcement narrative | Housekeeping |
| 40 | `system_reliability` | 2 | Reliability narrative | Housekeeping |
| 41 | `decentralized_correction` | 1 | Decentralized correction narrative | Housekeeping |
| 42 | `internalization` | 1 | Internalization narrative | Housekeeping |
| 43 | `pattern_structuring` | 1 | Pattern structuring narrative — exit/positive valence meta | Housekeeping |
| 44 | `relationally_held_correction` | 1 | Correction narrative — meta | Housekeeping |
| 45 | `standard_separation` | 1 | Standard separation narrative | Housekeeping |
| 46 | `symbolic_correction` | 1 | Symbolic correction — performative; no behavioral distortion | Housekeeping |
| 47 | `system_feedback_loop` | 1 | Feedback loop narrative | Housekeeping |
| 48 | `system_humility` | 1 | Humility narrative — exit/positive valence | Housekeeping |

---

## §4 Force-map invariant

LOW row force-map = "implementation decides ontology" violation.

- Phase 3 = docs cite only — no alias entry, no enum entry, no archetype rule change.
- Final disposition = AL-2-C / AL-2-E / Housekeeping sprint scope (Hanbit Commander semantic decision).
- Force-mapping a LOW row to canonical for coverage statistics would inflate `~80.1%` claim with low-quality entries; preserved as deferred.

---

## §5 Aggregate statistics

| bucket | row count | total occurrences | avg freq |
|---|--:|--:|--:|
| NEW_AXIS-dependent (§3.1) | 4 | 18 | 4.5 |
| Existing-canonical candidates (§3.2) | 7 | 19 | 2.7 |
| DEPRECATE / Housekeeping (§3.3) | 37 | 120 | 3.2 |
| **Total** | **48** | **157** | **3.3** |

Sprint coverage progression context (per AL-2-B sprint summary):
- Pre-AL-2-B: 14.3% (107/748 occurrences canonical)
- Post-AL-2-B: ~80.1% (Council adoption + 30 alias + 47 enum)
- 48 LOW rows / 157 occurrences = 21.0% of total 748 occurrences remain deferred. Force-mapping them to canonical would not improve runtime accuracy because the underlying semantic decisions are deferred to AL-2-C scope.

---

## §6 Cross-references

- [docs/AL-2-A-mapping-decision-template.csv](AL-2-A-mapping-decision-template.csv) — Council CSV authoritative source
- [docs/AL-2-B-cleanup-candidates.md](AL-2-B-cleanup-candidates.md) — Phase 1 dead-artifact + compat-map conflict status
- [docs/specs/ARCHETYPE_DETERMINISM_LOCK_V1.md](specs/ARCHETYPE_DETERMINISM_LOCK_V1.md) — § 0 L18 AL-2 reservation (archetype meaning redesign)
- [bty-app/src/domain/pattern-family.ts](../bty-app/src/domain/pattern-family.ts) — alias dictionary (53 entries post-AL-2-B Phase 3, including Phase 1 ownership_act already wired)
