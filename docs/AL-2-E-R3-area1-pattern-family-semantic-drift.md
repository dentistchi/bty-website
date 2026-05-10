# AL-2-E R3 — Area 1: pattern_family Semantic Drift

**Sprint**: AL-2-E R3 Phase 1
**Mode**: read-only

## §1 Authority sources

[E.R3.A1.1] canonical_5_anchors (from `bty-app/src/domain/pattern-family.ts:5-11`):
```
ownership_escape
repair_avoidance
explanation_substitution
delegation_deflection
future_deferral
```

[E.R3.A1.2] alias_dictionary_size: 59 entries at `bty-app/src/domain/pattern-family.ts:26-118`
[E.R3.A1.3] new_axis_canonical_anchors (alias targets from R3.5.2 closure — 5 entries):
```
truth_naming        (truth axis)
integrity_compromise (integrity axis)
authority_protection (authority axis)
self_protection      (control axis)
reputation_protection (visibility axis)
```
[E.R3.A1.4] additional_unique_new_anchors (R3.3 Option β, 3 entries):
```
closure_rush         (axis deferred)
boundary_definition  (axis deferred)
re_engagement        (axis deferred)
```

## §2 scenario JSON pattern_family enumeration

[E.R3.A1.5] distinct_literals_count: **110** across 81 JSON files (27 scenarios × 3 locale files)
[E.R3.A1.6] total_occurrences: 486
[E.R3.A1.7] enumeration_method: grep across `bty-app/src/data/scenario/`, `bty-app/src/data/bty_chain_workspace/`, `bty-app/src/lib/bty/arena/ownRe02R1EliteScenario.server.ts`

## §3 Classification breakdown

[E.R3.A1.8] classification_summary:

| classification | count | meaning |
|---|---:|---|
| canonical 5 direct match | 4/5 present (ownership_escape absent) | scenario tag ∈ canonical 5 |
| alias key (resolves to canonical 5) | 26 | normalized to canonical 5 at runtime |
| alias key (resolves to NEW_AXIS canonical) | 27 | normalized to NEW_AXIS canonical at runtime |
| R3 decision-lock additional aliases | 6 | R3.3.* additions (private_intention, successor_protection, system_defensiveness, accountability_application, misuse_correction, visible_correction) |
| DEPRECATE LOW row candidates | 37 | flagged in `docs/AL-2-D-P1-R3-HK-deprecate-low-row-status.md`; NOT in alias dict; **raw passthrough** at runtime per Lock 7 |
| **total** | **100 distinct + duplicates** | (110 listed; 10 are aggregate rollups) |

[E.R3.A1.9] canonical_5_occurrence_count_in_jsons:
- `future_deferral` — 70 occurrences
- `delegation_deflection` — 21 occurrences
- `explanation_substitution` — 14 occurrences
- `repair_avoidance` — 2 occurrences
- `ownership_escape` — **0 occurrences** (per AL-2_SPRINT_CLOSURE.md §3.2 ghost canonical finding)

## §4 NEW_AXIS canonical anchor occurrences

[E.R3.A1.10] new_axis_anchor_distribution:

| anchor | direct_occurrences | alias_occurrences | total |
|---|---:|---:|---:|
| `truth_naming` | 89 | 7 (across 7 alias keys) | 96 |
| `integrity_compromise` | 10 | 12 (across 12 alias keys) — 160 total scenario file appearances | 22 distinct paths |
| `authority_protection` | 14 | 5 (5 keys) | 19 |
| `self_protection` | 6 | 5 (5 keys) | 11 |
| `reputation_protection` | 14 | 1 (group_conformity) | 15 |

## §5 DEPRECATE LOW row overlap with scenario JSON

[E.R3.A1.11] deprecate_low_row_count_per_HK_doc: 37 (per `docs/AL-2-D-P1-R3-HK-deprecate-low-row-status.md` rows 12-48)
[E.R3.A1.12] deprecate_low_row_in_scenario_jsons_count: 37/37 — all 37 DEPRECATE candidates appear at least once in scenario JSONs (per HK A2.2 sampled grep verification + this enumeration)
[E.R3.A1.13] deprecate_low_row_alias_dict_membership: **0/37** — none are in `PATTERN_FAMILY_ALIAS` (intentional design — DEPRECATE = no alias entry)
[E.R3.A1.14] deprecate_low_row_runtime_behavior: raw passthrough per Lock 7 R3.5.2 — `normalizePatternFamilyId` returns the raw literal unchanged → flows into `activePatterns Set` as-is → does not match any pen() lookup → 0 axisVector contribution

[E.R3.A1.15] deprecate_low_row_high_volume_examples (per Area 1 dispatch agent enumeration):
- `accountability_system` (18 occurrences)
- `standard_creation` (12 occurrences)
- `fairness_definition` (7 occurrences)

[E.R3.A1.16] deprecate_low_row_handling_status: **unhandled** (37/37 per HK A2 status); disposition pending Commander (Option H1 prune / H2 silent dropout / H3 no action) → AL-2-HK HK2 scope

## §6 Drift candidate enumeration

[E.R3.A1.17] drift_candidate_class_a_canonical_absence: `ownership_escape` is canonical 5 anchor but **0 scenario JSON occurrences**. Per [AL-2_SPRINT_CLOSURE.md §3.2](AL-2_SPRINT_CLOSURE.md), empirical alternative is `ownership_act` (freq=23) which is aliased TO `ownership_escape` (line 29 of pattern-family.ts). Status: **expected drift** — `ownership_escape` is "ghost canonical" anchor whose scenario representation is via aliases.

[E.R3.A1.18] drift_candidate_class_b_deprecated_in_use: 37 LOW rows in scenario JSON but not in alias dict → raw passthrough; 0 runtime impact but **scenario-tag mismatch with system intent**. Severity: low (Lock 7 protects); long-term cleanup: AL-2-HK HK2.

[E.R3.A1.19] drift_candidate_class_c_unique_new_anchors_unwired: `closure_rush`, `boundary_definition`, `re_engagement` (Option β, R3.3.6/8/10 from AL-2-C decision lock) are canonical anchors but axis-unassigned (deferred to AL-2-D fingerprint sprint). Their scenario JSON occurrence count: not separately enumerated in this audit (subset of 110 distinct literals). [PHASE_2_DEFERRED] for axis assignment + scenario re-tag.

[E.R3.A1.20] drift_candidate_class_d_alias_form_in_runtime: 24h observe found 2 of 5 baseline users with `pattern_family = performance_blame` in `user_pattern_signatures`. `performance_blame` is **alias key** (line 47 → `explanation_substitution`). Runtime normalization (R3.5.2 closure) handles this correctly. **No drift** — this is the alias dictionary working as designed. Cross-ref: AL-2-D-P1 reconciliation appendix §3 ⚠️ A2 baseline correction.

## §7 Cross-runtime path pattern_family inventory

[E.R3.A1.21] path1_pattern_family_distribution: 81 JSON files contain pattern_family literals; 110 distinct values; matches inventory above
[E.R3.A1.22] path2_chain_workspace_pattern_family: per Explore agent, chain workspace JSON files (`Core_*/{S1,S2,S3}.json`) **do not contain `pattern_family` field** — different schema. Pattern resolution for Path 2 routes through Path 1 binding (`eliteScenariosCanonical.server.ts:196-236`).
[E.R3.A1.23] path3_inline_ts_pattern_family: `bty-app/src/lib/bty/arena/ownRe02R1EliteScenario.server.ts` hardcodes `future_deferral` and `repair_avoidance` (canonical 5 only). No alias use.

## §8 Drift summary table

[E.R3.A1.24] drift_table:

| literal class | count | runtime impact | drift severity | resolution |
|---|---:|---|---|---|
| canonical 5 (4 present, 1 ghost) | 5 | direct pen() | none | accept ghost (ownership_escape) |
| alias keys | 53 | normalized to canonical | none (R3.5.2 closure) | accept |
| R3 decision-lock additions | 6 | normalized to canonical | none | accept |
| Option β unique-new (axis unassigned) | 3 | passthrough → 0 axisVector contribution | low | [PHASE_2_DEFERRED] axis assignment in AL-2-D fingerprint sprint |
| 37 DEPRECATE LOW rows | 37 | passthrough → 0 axisVector contribution | low | AL-2-HK HK2 cleanup |
| **total drift candidates** | **40** (37 LOW + 3 Option β) | **0** runtime axis impact | low (Lock 7 protected) | deferred |

[E.R3.A1.25] aggregate_runtime_axis_impact: **0** — every literal in scenario JSON either resolves to a canonical anchor (with pen() wiring) or passes through unchanged (no pen() match → no axisVector delta).

[E.R3.A1.26] semantic_drift_marker: 0 [SEMANTIC_DRIFT_DETECTED] for pattern_family in this Area (all drift candidates are runtime-neutral per Lock 7).
[E.R3.A1.27] phase2_deferred_marker: 1 [PHASE_2_DEFERRED] — Option β unique-new anchors axis assignment.
