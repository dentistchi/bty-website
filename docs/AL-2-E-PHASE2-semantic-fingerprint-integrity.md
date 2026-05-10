# AL-2-E Phase 2 — Semantic Fingerprint Integrity Check

**Sprint**: AL-2-E Ψ-1 Step 3 (Phase 2 audit, Component 2)
**Mode**: read-only deep audit (Path 1, 27 scenarios)
**Authority**: Hanbit Commander (BTY Semantic Council)
**Authoring date**: 2026-05-10
**Inner HEAD**: `50317b8` (untouched) · **Outer HEAD**: `d513c6e` (Step 2 final) · **Worker**: `e9e179ed-38a7-40ae-8f97-13cfb09191b7`

**Cross-ref**: [LOCK_5_SEMANTIC_BOUNDARY_SPEC.md](LOCK_5_SEMANTIC_BOUNDARY_SPEC.md), [AL-2-E R3 Phase 1 Reconciliation Appendix](AL-2-E-R3-PHASE1-RECONCILIATION-APPENDIX.md)

---

## §1 — 5 invariants (Commander definition)

Per Lock 5 spec §6.2 and Phase 2 dispatch component 2:

| invariant | scope | Lock 5 spec ref |
|---|---|---|
| **i1** | pattern_family integrity — scenario JSON `pattern_family` tag정렬 vs alias dict (59) + canonical 5 + new_axis canonical (5) | §6.2.a (cited as scenario alignment) |
| **i2** | direction continuity — scenario JSON `direction` 명시 일관성 (entry/exit only) | §6.2.b |
| **i3** | axis continuity — scenario JSON axis 라벨 vs canonical 12 (Ownership / Time / Authority / Truth / Repair / Conflict / Integrity / Visibility / Accountability / Courage(Risk) / Control / Identity); F2 drift candidates auto-marked | §6.2.c |
| **i4** | action commitment continuity — `is_action_commitment` 플래그 일관성 + commitment/avoidance 균형 (회피도 검증) | §6.2.d |
| **i5** | re-exposure continuity — `incident.propagation.reExposureNote` 존재 + transition 조건 일관성 (AL-1.8-D filter cross-ref `bty-app/src/lib/bty/arena/noChangeRisk.server.ts:117`) | §6.2.e |

Status legend: ✅ INTACT · ⚠️ DRIFT · ❌ VIOLATION

→ DRIFT = runtime-neutral (Lock 7 raw passthrough or non-canonical text axis); VIOLATION = breaks runtime (none detected in 27/27).

---

## §2 — Per-scenario integrity matrix

| scenario | i1 pattern_family | i2 direction | i3 axis | i4 commitment | i5 re-exposure |
|---|:---:|:---:|:---:|:---:|:---:|
| core_01_training_system_exposure | ⚠️ DRIFT | ✅ | ⚠️ DRIFT | ✅ ⚠ OUTLIER | ✅ |
| core_02_new_doctor_reexposure_compromise_loop | ✅ INTACT | ✅ | ✅ | ✅ | ✅ |
| core_03_training_failure_hidden_as_performance_issue | ⚠️ DRIFT | ✅ | ✅ | ✅ | ✅ |
| core_04_manager_neutrality_as_abandonment | ✅ INTACT | ✅ | ⚠️ DRIFT | ✅ | ✅ |
| core_05_resignation_signal | ✅ INTACT | ✅ | ⚠️ DRIFT | ✅ | ✅ |
| core_06_external_exposure | ✅ INTACT | ✅ | ⚠️ DRIFT | ✅ | ✅ |
| core_07_repair_conversation | ⚠️ DRIFT | ✅ | ✅ | ✅ | ✅ |
| core_08_doctor_repair | ⚠️ DRIFT | ✅ | ⚠️ DRIFT | ✅ | ✅ |
| core_09_identity_shift | ⚠️ DRIFT | ✅ | ⚠️ DRIFT | ✅ | ✅ |
| core_10_integrity_favoritism_signal | ⚠️ DRIFT | ✅ | ⚠️ DRIFT | ✅ | ✅ |
| core_11_selective_standard_escalation | ⚠️ DRIFT | ✅ | ⚠️ DRIFT | ✅ | ✅ |
| core_12_silence_normalization | ⚠️ DRIFT | ✅ | ⚠️ DRIFT | ✅ | ✅ |
| core_13_assistant_adaptation | ✅ INTACT | ✅ | ✅ | ✅ | ✅ |
| core_14_manager_awareness_gap | ✅ INTACT | ✅ | ✅ | ✅ | ✅ |
| core_15_system_exposure | ✅ INTACT | ✅ | ✅ | ✅ | ✅ |
| core_16_repair_standard_reset | ✅ INTACT | ✅ | ✅ | ✅ | ✅ |
| core_17_lead_assistant_repair | ⚠️ DRIFT | ✅ | ⚠️ DRIFT | ✅ | ✅ |
| core_18_identity_integrity_choice | ⚠️ DRIFT | ✅ | ⚠️ DRIFT | ✅ | ✅ |
| core_19_authority_signal | ⚠️ DRIFT | ✅ | ⚠️ DRIFT | ✅ | ✅ |
| core_20_unquestioned_decision | ⚠️ DRIFT | ✅ | ⚠️ DRIFT | ✅ | ✅ |
| core_21_silence_under_hierarchy | ⚠️ DRIFT | ✅ | ⚠️ DRIFT | ✅ | ✅ |
| core_22_assistant_truth_block | ⚠️ DRIFT | ✅ | ⚠️ DRIFT | ✅ | ✅ |
| core_23_manager_truth_block | ✅ INTACT | ✅ | ⚠️ DRIFT | ✅ | ✅ |
| core_24_external_truth_exposure | ⚠️ DRIFT | ✅ | ⚠️ DRIFT | ✅ | ✅ |
| core_25_forced_repair_conversation | ✅ INTACT | ✅ | ⚠️ DRIFT | ✅ | ✅ |
| core_26_doctor_repair_choice | ✅ INTACT | ✅ | ⚠️ DRIFT | ✅ | ✅ |
| core_27_identity_repair_commitment | ⚠️ DRIFT | ✅ | ✅ | ✅ | ✅ |

---

## §3 — Per-scenario evidence (DRIFT detail)

### Fully clean scenarios (5/27)

`core_02` · `core_13` · `core_14` · `core_15` · `core_16`

→ All 5 invariants ✅ INTACT. No drift surface.

### i1 DRIFT (16/27 scenarios) — pattern_family raw_passthrough literals

Per Lock 7 R3.5.2 raw passthrough — these literals do NOT appear in `bty-app/src/domain/pattern-family.ts:5-11` canonical 5 NOR in alias dict (lines 26-118). Runtime impact: 0 (passthrough at activePatterns Set, no pen() match → 0 axisVector contribution).

| scenario | drift literals | location |
|---|---|---|
| core_01 | `system_thinking` | en/ko `choices[].pattern_family` |
| core_03 | `system_thinking` | en/ko `choices[].pattern_family` |
| core_07 | `emotional_release_loop` | en/ko `choices[].pattern_family` |
| core_08 | `emotional_release_loop` | en/ko `choices[].pattern_family` |
| core_09 | `standard_creation` | en/ko `choices[].pattern_family` |
| core_10 | `pattern_capture`, `avoidance_behavior` | en/ko `choices[].pattern_family` |
| core_11 | `internalization`, `standard_separation`, `system_adaptation`, `adaptive_alignment`, `pattern_structuring`, `avoidance_behavior`, `fairness_definition` (7) | — highest density |
| core_12 | `avoidance_behavior` | — |
| core_17 | `emotional_bypass` | — |
| core_18 | `principle_with_constraint`, `equal_application`, `system_constraint`, `pattern_ownership` (4) | — |
| core_19 | `system_reinforcement`, `relationship_buffer`, `standard_enforcement`, `localized_system`, `active_verification`, `drift_detection` (6) | — |
| core_20 | `successor_assumption`, `system_independence`, `successor_ownership_mechanism`, `pressure_tested_successor_alignment`, `observed_handoff`, `instruction_based_handoff` (6) | — |
| core_21 | `system_feedback_loop`, `decentralized_correction`, `symbolic_correction`, `self_correction_protocol` (4) | — |
| core_22 | `constraint_definition`, `system_reliability`, `controlled_scaling`, `standard_enforcement`, `scaling_control` (5) | — |
| core_24 | `system_thinking` | — |
| core_27 | `accountability_system` | — |

→ **All 39 distinct drift literals overlap with the 37 DEPRECATE LOW row inventory** ([AL-2-D-P1-R3-HK-deprecate-low-row-status.md](AL-2-D-P1-R3-HK-deprecate-low-row-status.md)) — handed off to AL-2-HK HK2.

### i2 DRIFT (0/27 scenarios) — direction continuity

All 27 scenarios use `direction = "entry"` or `direction = "exit"` only. No drift.

### i3 DRIFT (19/27 scenarios) — non-canonical axis labels

Per Phase 1 [E.R3.A2.11], 15 non-canonical axis literals exist. Per-scenario distribution:

| scenario | non-canonical axes | classification |
|---|---|---|
| core_01 | `Axis 1 — Ownership`, `Axis 2 — Time`, `Axis 3 — Authority`, `Axis 4 — Truth`, `Axis 9 — Accountability` (5) | format prefix variant — canonical name is suffix |
| core_04 | `Support` | F2 [F2_VOCABULARY_DRIFT] — likely Repair-axis surrogate |
| core_05 | `Documentation`, `Image` | meta-axis + Visibility surrogate |
| core_06 | `Reputation` | F2 — likely Visibility surrogate per AL-2-C R3.3.2 |
| core_08 | `Comfort` | likely Self-Protection / Control surrogate |
| core_09 | `System` | meta-axis |
| core_10 | `belonging`, `awareness` | semantic-axis-class — no canonical |
| core_11 | `belonging` | — |
| core_12 | `belonging` | — |
| core_17 | `Comfort`, `Compliance`, `Self-Protection` | Compliance → Authority; Self-Protection hyphen variant |
| core_18 | `system_identity` | composite axis |
| core_19 | `consistency` | semantic-class |
| core_20 | `transferability` | non-axis field bleed |
| core_21 | `self_correction` | composite |
| core_22 | `scalability` | non-axis field bleed |
| core_23 | `Documentation` | meta-axis |
| core_24 | `System`, `Documentation` | meta-axes |
| core_25 | `Image` | Visibility surrogate |
| core_26 | `Explanation` | Accountability surrogate |

→ All [F2_VOCABULARY_DRIFT] markers cross-reference Phase 1 Area 2 §3.

### i4 commitment continuity (0/27 DRIFT, 1/27 OUTLIER)

All 27 scenarios maintain:
- balanced commitment/avoidance counts (equal yes/no)
- 0 missing `is_action_commitment` flags
- AD1 (commitment) / AD2 (avoidance) invariant

| structure | scenarios |
|---|---|
| 4 keys × 2 choices (8 total: 4 commitment + 4 avoidance) | 26 |
| **8 keys × 2 choices (16 total: 8 commitment + 8 avoidance)** ⚠ OUTLIER | 1 (`core_01_training_system_exposure`) |

→ core_01 is structural OUTLIER — branches all 4 primary × 2 tradeoff combinations through action_decision (A_X / A_Y / B_X / B_Y / C_X / C_Y / D_X / D_Y), while standard 26 use only 4 (A_X / B_X / C_X / D_X). Invariant intact (commit/avoid balance preserved); architectural variant flagged for **Component 3 Q1**.

### i5 re-exposure continuity (0/27 DRIFT)

All 27 scenarios have non-empty `incident.propagation.reExposureNote`. AL-1.8-D filter at `bty-app/src/lib/bty/arena/noChangeRisk.server.ts:117` operates on accrual math (`axisTotal >= 2 || riskCount >= 2`), not on reExposureNote text. No runtime DRIFT.

---

## §4 — Aggregate counts

| invariant | INTACT | DRIFT | VIOLATION |
|---|---:|---:|---:|
| i1 pattern_family | 11 | 16 | 0 |
| i2 direction | 27 | 0 | 0 |
| i3 axis | 8 | 19 | 0 |
| i4 commitment | 27 (1 OUTLIER) | 0 | 0 |
| i5 re-exposure | 27 | 0 | 0 |
| **total cells (27 × 5)** | **100** | **35** | **0** |

→ INTACT 74.1% · DRIFT 25.9% · VIOLATION 0% · all DRIFT runtime-neutral per Phase 1 Lock 7 + axisVector wiring evidence

---

## §5 — Auto-escalation triggers (Guard P2-5)

Per Guard P2-5: any action_decision ambiguity auto-escalates. Detection in this audit:

| trigger | scenario | type | feed |
|---|---|---|---|
| OUTLIER architectural variant (8 keys vs 4) | core_01 | i4-adjacent | Component 3 Q1.1 |
| 16 distinct DEPRECATE LOW row pattern_family literals across 16 scenarios | (i1 drift) | runtime-neutral | AL-2-HK HK2 (NOT Component 3) |
| 15 non-canonical axis literals across 19 scenarios | (i3 drift) | runtime-neutral | Component 4 §A + AL-2-HK HK5 |
| **27 action_decision text cells (escalation_required = YES per matrix)** | all 27 | Lock 5 default FORBIDDEN | Component 3 Q1.2 (aggregate) |

→ **1 substantive Q1 escalation entry** (core_01 OUTLIER) + 1 aggregate Q1 entry (26 standard scenarios default-FORBIDDEN confirmed)

---

## §6 — Component 3 / Component 4 feed

- **Component 3 Q1**: core_01 outlier + 26 standard scenarios aggregate
- **Component 3 Q2**: 0 substantive (i5 INTACT 27/27)
- **Component 3 Q3**: 0 substantive (no specific title-body edit candidate without Commander direction)
- **Component 3 Q4**: 1 substantive (F1 phantom × 3 baseline users — see Component 4 §C)
- **Component 4 §A**: 15 non-canonical literal mapping confidence (i3 drift surface)
- **Component 4 §B**: per-scenario drift density ranking (Component 1 + i3 drift sums)

---

## §7 — Markers emitted

- 0 [REQUIRES_COMMANDER_REVIEW] in this doc (markers fed downstream to Component 3)
- 0 [HK4_MERGE_CANDIDATE] in this doc (fed to Component 4 §C)
- 19 [F2_VOCABULARY_DRIFT] (one per i3-drift scenario per §3)
- 0 `<C5 inventory에서 확인>` (sufficient data collected)
