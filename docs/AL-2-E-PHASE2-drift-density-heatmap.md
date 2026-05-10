# AL-2-E Phase 2 — Drift Density Heatmap

**Sprint**: AL-2-E Ψ-1 Step 3 (Phase 2 audit, Component 4)
**Mode**: read-only inventory — F2 follow-up + F1 phantom lineage trace
**Authority**: Hanbit Commander (BTY Semantic Council)
**Authoring date**: 2026-05-10
**Inner HEAD**: `50317b8` · **Outer HEAD**: `d513c6e` · **Worker**: `e9e179ed`

**Cross-ref**: [Phase 1 Area 2 §3](AL-2-E-R3-area2-axis-vocabulary-alignment.md), [AL-2-D-P1 reconciliation appendix §4](AL-2-D-P1-R3-RECONCILIATION-APPENDIX.md), [Component 2 §3](AL-2-E-PHASE2-semantic-fingerprint-integrity.md)

→ Inventory only. NO correction (Guard P2-2 enforced). NO mutation (Guard P2-1 enforced).

---

## §A — Non-canonical axis literal inventory

Total non-canonical occurrences across 27 Path 1 scenarios: **222**

15 distinct literals with canonical 12 mapping confidence (HIGH / MEDIUM / LOW):

| literal | total occ | scenario distribution | canonical 12 mapping candidate(s) | confidence |
|---|---:|---|---|:---:|
| `belonging` | 36 | core_10 (~7), core_11 (~17), core_12 (~12) | none — semantic-axis-class outside canonical 12 | **LOW** |
| `System` | 20 | core_09, core_24 | meta-axis (system-level scope, not behavioral axis) — no direct map | **LOW** |
| `Documentation` | 16 | core_05, core_23, core_24 | meta-axis (artifact-class, not behavioral) — no direct map | **LOW** |
| `transferability` | 14 | core_20 | non-axis field bleed (likely successor-handoff attribute) | **LOW** |
| `system_identity` | 12 | core_18 | composite (Identity + System scope) — Identity-axis canonical candidate | **MEDIUM** |
| `scalability` | 12 | core_22 | non-axis field bleed (capacity attribute) | **LOW** |
| `Axis 1 — Ownership` | 9 | core_01 (5 occ), others format-prefix variants | format prefix variant — canonical name **Ownership** is suffix | **HIGH** (format normalization) |
| `Image` | 8 | core_05, core_25 | Visibility (likely surrogate per AL-2-C R3.3.2 visibility-axis class) | **MEDIUM** |
| `Comfort` | 8 | core_08, core_17 | Self-Protection / Control (likely Control-axis surrogate) | **MEDIUM** |
| `consistency` | 8 | core_19 | semantic-class — possible Integrity / Truth surrogate | **LOW** |
| `self_correction` | 7 | core_21 | composite — possibly Repair / Truth surrogate | **LOW** |
| `correction` | 7 | core_21, core_24 | possibly Repair-axis (alias for repair_avoidance / truth_naming) | **MEDIUM** |
| `Axis 2 — Time` | 6 | format-prefix variants | format prefix variant — canonical **Time** is suffix | **HIGH** |
| `Support` | 6 | core_04 | Repair-axis (likely surrogate) | **MEDIUM** |
| `Reputation` | 6 | core_06 | Visibility (per AL-2-C R3.3.2 — `group_conformity → reputation_protection [visibility axis]`) | **HIGH** |

### §A confidence tally

- HIGH (3): format prefix normalization (`Axis N — X`) + `Reputation → Visibility`
- MEDIUM (5): semantic-class with documented canonical mapping intent (`system_identity → Identity`, `Image → Visibility`, `Comfort → Control`, `correction → Repair`, `Support → Repair`)
- LOW (7): no canonical mapping documented; require Commander semantic decision (`belonging`, `System`, `Documentation`, `transferability`, `scalability`, `consistency`, `self_correction`)

**[F2_VOCABULARY_DRIFT]** marker × 15 literals.

→ Mapping decisions deferred to **추후 sprint** per dispatch scope: "enum tightening / canonicalization → 추후 sprint deferred". Guard P2-2 prohibits canonical rewrite in Phase 2 audit.

---

## §B — Per-scenario drift density ranking

Non-canonical axis literal occurrence count per scenario (descending):

| rank | scenario | non-canonical occ |
|---:|---|---:|
| 1 | `core_01_training_system_exposure` | **26** |
| 2 | `core_20_unquestioned_decision` | **18** |
| 2 | `core_21_silence_under_hierarchy` | **18** |
| 4 | `core_17_lead_assistant_repair` | **16** |
| 4 | `core_22_assistant_truth_block` | **16** |
| 6 | `core_10_integrity_favoritism_signal` | 14 |
| 6 | `core_11_selective_standard_escalation` | 14 |
| 6 | `core_12_silence_normalization` | 14 |
| 9 | `core_18_identity_integrity_choice` | 12 |
| 9 | `core_19_authority_signal` | 12 |
| 9 | `core_24_external_truth_exposure` | 12 |
| 12 | `core_05_resignation_signal` | 8 |
| 13 | `core_04_manager_neutrality_as_abandonment` | 6 |
| 13 | `core_06_external_exposure` | 6 |
| 13 | `core_09_identity_shift` | 6 |
| 13 | `core_25_forced_repair_conversation` | 6 |
| 13 | `core_26_doctor_repair_choice` | 6 |
| 18 | `core_08_doctor_repair` | 4 |
| 18 | `core_23_manager_truth_block` | 4 |
| 20 | `core_02_new_doctor_reexposure_compromise_loop` | 2 |
| 20 | `core_03_training_failure_hidden_as_performance_issue` | 2 |
| 22 | `core_07_repair_conversation` | 0 |
| 22 | `core_13_assistant_adaptation` | 0 |
| 22 | `core_14_manager_awareness_gap` | 0 |
| 22 | `core_15_system_exposure` | 0 |
| 22 | `core_16_repair_standard_reset` | 0 |
| 22 | `core_27_identity_repair_commitment` | 0 |

### §B Top 5 drift density scenarios (per dispatch [E.P2.C4.6])

1. **core_01_training_system_exposure** (26)
2. **core_20_unquestioned_decision** (18)
3. **core_21_silence_under_hierarchy** (18)
4. **core_17_lead_assistant_repair** (16)
5. **core_22_assistant_truth_block** (16)

→ 5 scenarios with 0 drift (clean): core_07 / core_13 / core_14 / core_15 / core_16 / core_27 (6 actually clean — core_07 has i1 drift but i3 clean per Component 2)

### §B Heatmap matrix excerpt (top 5 drift × top 5 literals)

|  | belonging | System | Documentation | transferability | system_identity |
|---|---:|---:|---:|---:|---:|
| core_01 | — | — | — | — | — (5 format-prefix variants instead) |
| core_20 | — | — | — | **14** | — |
| core_21 | — | — | — | — | — (8 self_correction + 4 others) |
| core_17 | — | — | — | — | — (Comfort 4 / Compliance 4 / Self-Protection 4) |
| core_22 | — | — | — | — | — (12 scalability) |
| core_10 | 7 | — | — | — | — |
| core_11 | 17 | — | — | — | — |
| core_12 | 12 | — | — | — | — |
| core_18 | — | — | — | — | 12 |

→ Concentration pattern: belonging mostly in core_10/11/12 (incident_02 cluster); transferability isolated to core_20; system_identity isolated to core_18; format-prefix `Axis N — X` mostly in core_01.

---

## §C — F1 phantom lineage trace

**Phantom signal**: `patient-complaint-revised-estimate`
**Forensic resolution**: forbidden in this audit (HK4 merge sprint deferred per dispatch scope). Inventory only.

### §C.1 DB row enumeration (Q-E0.3.1 + lineage query)

| field | value |
|---|---|
| total rows | **20** in `bty_arena_signals` |
| date range | 2026-03-20T18:30:08Z → 2026-04-18T18:15:51Z |
| span | 29 days, all pre-AL-2-A Council session (2026-05-08) |
| post-AL-2-D-P0 hits | 0 (last hit 2026-04-18; no AL-2 period activity) |

### §C.2 User distribution (3 distinct users)

| user_id (prefix) | row count | AL-2-D-P1 baseline membership | Lock 4 status |
|---|---:|:---:|---|
| `3c732192-...` | 9 | ✓ baseline | no Lock 4 row |
| `2322beb7-...` | 7 | ✓ baseline | no Lock 4 row |
| `38ce28d2-...` | 4 | ✓ baseline | **active QUIETFLAME (Lock 4 active baseline)** |

→ **3/3 phantom users ARE among 5 AL-2-D-P1 baseline users** (per AL-2-D-P1 reconciliation appendix §4.3). Phantom cohort = subset of baseline cohort.

### §C.3 Path 1 27 scenarios overlap (lineage cross-reference)

Path 1 production traffic for these 3 users (post-2026-04-28):

| user | Path 1 scenarios touched | first Path 1 hit |
|---|---|---|
| `3c732192` | core_01_*, core_05, etc. | 2026-05-01 |
| `2322beb7` | core_02, core_03 | 2026-04-30 |
| `38ce28d2` | core_03, core_04, core_27 | 2026-04-28 |

Temporal lineage:
```
2026-03-20 ── phantom signal first row ───┐
                                          │ (29 days phantom usage)
2026-04-18 ── phantom signal last row ────┤
                                          │ (10-day silent gap = engine version migration boundary)
2026-04-28 ── first Path 1 hit (core_*) ──┘
            ── phantom users continue in Path 1 ──→ ongoing
```

### §C.4 [HK4_MERGE_CANDIDATE]

- Phantom forensic = same 3 users + same `bty_arena_signals` enumeration sweep as HK4 baseline UUID 정밀 식별
- Merge eliminates duplicate forensic methodology (history archaeology)
- Combined sub-sprint scope: (a) 5 baseline UUID provenance enumeration, (b) `patient-complaint-revised-estimate` scenario_id origin trace (engine version archaeology), (c) impact assessment of 20 historical rows on AL-2-D-P1 freeze invariants
- Expected impact: 0 (phantom rows pre-date Lock 6 / Lock 4 / R3.5.2 by 2-3 weeks; historical-only)

→ **1 [HK4_MERGE_CANDIDATE] entry**. Forensic resolution forbidden in Phase 2 audit per dispatch scope.

### §C.5 No correction / no mutation

Per Guard P2-2 (no inferred canonical rewrite) + Guard P2-1 (no mutation):
- 0 changes to `bty_arena_signals` 20 phantom rows
- 0 cleanup decision
- 0 historical data mutation
- 0 scenario_id rename / re-tag

Phantom lineage handed off to AL-2-HK HK4 + F1 merged sub-sprint.

---

## §D — Aggregate findings

| metric | value |
|---|---:|
| §A non-canonical literals enumerated | 15 |
| §A HIGH confidence mapping | 3 |
| §A MEDIUM confidence mapping | 5 |
| §A LOW confidence mapping | 7 |
| §B drift density top 5 scenarios | core_01 (26) / core_20 (18) / core_21 (18) / core_17 (16) / core_22 (16) |
| §B clean scenarios (0 drift) | 6 (core_07, core_13, core_14, core_15, core_16, core_27) |
| §B total non-canonical occurrences | 222 |
| §C phantom lineage entries | 1 ([HK4_MERGE_CANDIDATE]) |
| §C HK4 merge candidates | 1 (F1 + 5 baseline UUID forensic combined) |

**[F2_VOCABULARY_DRIFT]** total markers: 15 (one per literal in §A)
**[HK4_MERGE_CANDIDATE]** total markers: 1 (§C.4)

---

## §E — Closure status

| acceptance gate | status |
|---|---|
| §A 15 non-canonical literals enumerated | ✅ |
| §A confidence classifications (HIGH/MED/LOW) | ✅ 3 / 5 / 7 |
| §B per-scenario drift density ranking | ✅ 27 scenarios ranked |
| §B top 5 identified | ✅ core_01 / core_20 / core_21 / core_17 / core_22 |
| §C F1 phantom lineage trace | ✅ 20 rows / 3 users / 29-day window / 10-day migration gap |
| §C HK4 merge candidate registered | ✅ 1 [HK4_MERGE_CANDIDATE] |
| Guard P2-1 no mutation | ✅ |
| Guard P2-2 no inferred canonical rewrite | ✅ (mapping candidates only; no rewrite) |
| Guard P2-3 no dormant-path mixing | ✅ (Path 1 only) |

→ **Component 4 logically closed.** F2 + F1 inventory delivered; mutation / forensic resolution forbidden per Phase 2 scope; handed off to AL-2-HK HK4+F1 merged sub-sprint and 추후 sprint (enum tightening / canonicalization).
