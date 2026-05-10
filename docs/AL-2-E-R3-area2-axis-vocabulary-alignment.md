# AL-2-E R3 — Area 2: Axis Vocabulary Alignment

**Sprint**: AL-2-E R3 Phase 1
**Mode**: read-only inventory + production DB query (Q-E2.1)
**Priority**: 최우선 per dispatch (Reputation anomaly source identification)

## §1 Canonical 12 axes authority

[E.R3.A2.1] canonical_12_axes_source: BTY_12_CORE_AXIS.md (per dispatch cite); also referenced in `docs/ENGINE_ARCHITECTURE_V1.md` and `docs/specs/ARCHETYPE_DETERMINISM_LOCK_V1.md` §4.1

[E.R3.A2.2] canonical_12_axes_enumeration:
```
Ownership / Time / Authority / Truth / Repair / Conflict /
Integrity / Visibility / Accountability / Courage(Risk) / Control / Identity
```

## §2 Q-E2.1 — production user_pattern_signatures axis distinct values

[E.R3.A2.3] total_ups_rows: 5
[E.R3.A2.4] axis_distinct_count_in_db: **4**
[E.R3.A2.5] axis_distribution_in_db:

| axis | occurrences | canonical 12 match | row pattern_family |
|---|---:|:---:|---|
| `Accountability` | 2 | ✓ | `performance_blame` (alias → explanation_substitution) |
| `Truth` | 1 | ✓ | `truth_naming` (canonical anchor) |
| `Integrity` | 1 | ✓ | `integrity_compromise` (canonical anchor) |
| **`Reputation`** | **1** | **✗** | `reputation_protection` (canonical anchor) |

[E.R3.A2.6] reputation_anomaly_row_full:
- user_id_prefix: `ee9d2075`
- axis: `Reputation`
- pattern_family: `reputation_protection`
- updated_at: 2026-05-07T19:34:21Z (pre-AL-2-D-P0 deploy)

## §3 scenario JSON axis enumeration

[E.R3.A2.7] axis_field_locations_in_jsons:
- `axis` (per-choice in en/ko `choices[*].axis`)
- `axis_primary` (en/ko top-level)
- `axis_secondary[]` (en/ko top-level array)
- `bty_tension_axis` (en/ko top-level narrative tension axis name)
- `incident.axisGroup` (base.json)

[E.R3.A2.8] distinct_axis_literals_count: ~24 across all locations
[E.R3.A2.9] canonical_12_present_count: 9/12 (3 absent: Visibility, Courage, Identity)

[E.R3.A2.10] canonical_12_axis_distribution_in_jsons:

| axis | occurrences | mixed-case variants |
|---|---:|---|
| Truth | 120 | + lowercase `truth` 28× |
| Integrity | 102 | `Integrity` 22× / `integrity` 80× |
| Repair | 100 | (single case) |
| Time | 72 | (single case) |
| Ownership | 50 | (single case) |
| Authority | 40 | (single case) |
| Control | 35 | (single case) |
| Accountability | 31 | (single case) |
| Conflict | 22 | (single case) |
| Visibility | **0** | absent |
| Courage / Risk | **0** | absent |
| Identity | **0** | absent |

[E.R3.A2.11] non_canonical_axis_literals_in_jsons (15 entries):

| literal | occurrences | drift class |
|---|---:|---|
| `belonging` | 36 | semantic-axis-class — no canonical mapping documented |
| `Documentation` | 16 | meta-axis (artifact-class, not behavioral axis) |
| `System` | 13 | meta-axis (system-level, not behavioral axis) |
| `transferability` | 14 | non-axis field bleeding into axis namespace |
| `scalability` | 12 | non-axis field bleeding |
| `system_integrity` | 12+ | composite axis (Integrity + System scope) |
| `system_identity` | similar | composite |
| `system_correction` | similar | composite |
| `Image` | 8 | semantic-axis-class — likely Visibility surrogate |
| `Comfort` | 8 | semantic-axis-class — likely Self-Protection surrogate |
| `Reputation` | 6 | **semantic-axis-class — ALSO present in DB (anomaly source)** |
| `Support` | 6 | semantic-axis-class — likely Repair surrogate |
| `Self-Protection` | 6 | hyphenated variant of canonical Control axis surrogate |
| `Explanation` | 6 | likely Accountability surrogate (matches `explanation_substitution` family) |
| `Compliance` | 6 | likely Authority surrogate |

## §4 "Reputation" anomaly forensic

[E.R3.A2.12] reputation_in_jsons_count: **6 occurrences** in scenario JSON files
[E.R3.A2.13] reputation_in_db_count: **1 occurrence** (ee9d2075 row)
[E.R3.A2.14] reputation_origin_classification: **scenario JSON tag** (not runtime override; not free-text user input). The 6 JSON occurrences predate the 1 DB row.
[E.R3.A2.15] reputation_propagation_chain: scenario JSON `axis_primary: "Reputation"` (or `axis: "Reputation"` per-choice) → user signal write at `bty-app/src/lib/bty/arena/patternSignatureUpsert.server.ts` (or equivalent insert path) → `user_pattern_signatures.axis` text column accepts raw value (no enum constraint per Q7) → row persists with `axis = "Reputation"`
[E.R3.A2.16] reputation_canonical_mapping_candidate: likely **Visibility** (per AL-2-C R3.3.2 decision lock at [docs/AL-2-C-decision-lock.md](AL-2-C-decision-lock.md): `group_conformity → reputation_protection (visibility axis)`). pattern_family `reputation_protection` is the visibility-axis NEW canonical. So `axis = "Reputation"` *should* be `axis = "Visibility"` per intended canonical mapping.

[E.R3.A2.17] reputation_isolated_vs_systemwide: **system-wide drift** — 6 scenario JSON occurrences confirm this is not isolated to one row but originates in scenario authoring vocabulary. Anomaly is structural.

[E.R3.A2.18] reputation_runtime_impact: **0 axisVector impact** — `user_pattern_signatures.axis` text column is not consumed by `buildFingerprintInput.ts` axisVector construction (axisVector is built from pattern_family → pen() axis penalty, not from text axis label). Free-text axis is display/audit metadata only.

## §5 Three-way matrix: canonical / scenario JSON / DB

[E.R3.A2.19] three_way_matrix:

| axis | canonical 12 | scenario JSON | runtime DB |
|---|:---:|:---:|:---:|
| Ownership | ✓ | ✓ (50 occ) | ✗ (0 in 5 rows) |
| Time | ✓ | ✓ (72 occ) | ✗ |
| Authority | ✓ | ✓ (40 occ) | ✗ |
| Truth | ✓ | ✓ (120 occ + lowercase 28) | ✓ (1) |
| Repair | ✓ | ✓ (100 occ) | ✗ |
| Conflict | ✓ | ✓ (22 occ) | ✗ |
| Integrity | ✓ | ✓ (102 occ + lowercase 80) | ✓ (1) |
| Visibility | ✓ | ✗ (0 — likely "Reputation"/"Image" surrogate) | ✗ |
| Accountability | ✓ | ✓ (31 occ) | ✓ (2) |
| Courage / Risk | ✓ | ✗ (0) | ✗ |
| Control | ✓ | ✓ (35 occ + "Self-Protection" 6 surrogate) | ✗ |
| Identity | ✓ | ✗ (0) | ✗ |
| **Reputation** (non-canonical) | ✗ | ✓ (6 occ) | ✓ (1) — **drift** |
| **belonging** (non-canonical) | ✗ | ✓ (36 occ) | ✗ | drift candidate |
| (12 other non-canonical) | ✗ | ✓ varies | ✗ | drift candidates |

## §6 Schema vs invariant

[E.R3.A2.20] db_schema_axis_column: `user_pattern_signatures.axis` column type = `text NOT NULL`, **no enum constraint**, **no foreign key to canonical 12 axes table** (no canonical 12 table exists). Free-text accepted.
[E.R3.A2.21] determinism_lock_authority: `bty-app/src/lib/bty/archetype/buildFingerprintInput.ts` constructs `axisVector` (12-dim numeric) from `patternFamilies` → pen() axis penalties. The text `axis` column from ups is NOT a direct input to axisVector. Therefore non-canonical axis labels do NOT affect determinism, archetype selection, or FINGERPRINT_VERSION.
[E.R3.A2.22] lock4_impact_check: per AL-2-D-P1 reconciliation appendix §5.4, axis text column has 0 impact on Lock 4 / archetype rule / fingerprint. Confirmed.

## §7 Mixed-case drift

[E.R3.A2.23] case_sensitivity_drift:
- `Truth` (120) vs `truth` (28) → 78% upper-case dominant, 22% lower-case
- `Integrity` (22) vs `integrity` (80) → 22% upper-case, 78% lower-case (inverted!)

[E.R3.A2.24] case_sensitivity_implication: scenario authoring inconsistency. Determinism impact 0 (axis column is free-text), but display normalization implications. **[PHASE_2_DEFERRED]** — case normalization policy decision.

## §8 Mutation candidate classification (audit-only per Guard E1)

[E.R3.A2.25] mutation_candidates_safe (Lock 5 explicit MUTABLE per Area 4):
- numericStructure (per `SCENARIO_CONTENT_GUIDELINES.md:23-26`)
- locale-specific phrasing (`narrativeKo`, `timeConstraintKo`, `resourceConstraintKo`)

[E.R3.A2.26] mutation_candidates_risky (no Lock 5 citation, but axis-relevant):
- axis label case normalization (Truth/truth, Integrity/integrity)
- Reputation → Visibility re-tag (per AL-2-C R3.3.2 intent)
- Image / Comfort / Support / Self-Protection / Explanation / Compliance → canonical-12 mapping

[E.R3.A2.27] mutation_candidates_forbidden (Lock 5 explicit IMMUTABLE per Area 4):
- `pattern_family` literals (Lock 5 per `AL-2-D-P1-R3-archetype-determinism-trace.md:147`)
- `bty_tension_axis` literal re-tag (Lock 5 per `AL-2_SPRINT_CLOSURE.md §5.3`)

[E.R3.A2.28] enum_tightening_recommendation: schema migration to enforce `user_pattern_signatures.axis ∈ canonical 12 axes` is a candidate but **[PHASE_2_DEFERRED]** — requires (a) prior backfill of existing 1 Reputation row + 6 scenario JSON occurrences, (b) Lock 5 unlock decision (since `bty_tension_axis` re-tag is in AL-2-E scope per §5.3). AL-2-HK HK5 candidate.

## §9 Findings & markers

[E.R3.A2.29] semantic_drift_count: **1** [SEMANTIC_DRIFT_DETECTED] — `Reputation` axis label is system-wide (6 scenario JSON occurrences) AND production-active (1 DB row). Not isolated.
[E.R3.A2.30] phase2_deferred_count: **3** [PHASE_2_DEFERRED] — (a) case normalization policy, (b) non-canonical axis re-tag (Reputation/Image/Comfort/etc.), (c) enum tightening migration
[E.R3.A2.31] runtime_axis_severity: **LOW** — non-canonical axis labels are display/audit metadata; 0 axisVector / determinism / Lock 4 impact
