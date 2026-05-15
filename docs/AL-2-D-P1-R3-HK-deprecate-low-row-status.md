# AL-2-D-P1+ R3-HK Area 2 — 37 DEPRECATE LOW Row Status

**Sprint**: AL-2-D-P1+ R3-HK (Housekeeping audit)
**Date (issuance)**: 2026-05-09
**Mode**: read-only inventory (Guard 13 satisfied — pre-step passed)
**P0 dependency**: none

---

## §1 HK Pre-step result (mandatory gate)

[D-P1.R3-HK.PRE.1] deprecate_low_source_doc: [docs/AL-2-B-low-confidence-deferred.md §3.3](AL-2-B-low-confidence-deferred.md) (rows 12-48 enumerated; §5 aggregate confirms count).

[D-P1.R3-HK.PRE.2] deprecate_low_row_count: 37 (verified by direct count of §3.3 rows 12-48 inclusive: 48-12+1 = 37; cross-confirmed by §5 Aggregate row "DEPRECATE / Housekeeping (§3.3) | 37 | 120 | 3.2").

[D-P1.R3-HK.PRE.3] count_mismatch_check: count == 37 → no [COUNT_MISMATCH_REQUIRES_COMMANDER_REVIEW] marker required.

[D-P1.R3-HK.PRE.4] cross_check_3_docs_result: consistent. Among the 3 dispatch cross-check docs:
- `docs/AL-2-B-cleanup-candidates.md` — does NOT enumerate the 37 DEPRECATE bucket (out of scope; covers compat map dead artifact + 7 LOW MERGE deferred). 1 isolated `DEPRECATE` cell appears at [§1.2 row 2](AL-2-B-cleanup-candidates.md) (`system_thinking`) — that single cell is consistent with the upstream §3.3 rows 12-48 enumeration (not contradictory).
- `docs/AL-2-C-R3-low-row-archetype-resolution.md` — explicitly cites count "37" at §1: `"The remaining 37 LOW rows (DEPRECATE candidates) are routed to Housekeeping per Phase 3 categorization, not to AL-2-C archetype resolution."`
- `docs/AL-2-C-R3-decision-template.csv` — does NOT enumerate the 37 bucket (out of scope; covers 11 R3.3.x AL-2-C decisions). Each R3.3.x row carries `DEPRECATE` as Option C, consistent with the bucket existing as a downstream destination (not contradictory).
The 37 row enumeration source is therefore the upstream `docs/AL-2-B-low-confidence-deferred.md` §3.3 (cited by `low-row-archetype-resolution.md` §1), not directly contained in any of the 3 cross-check docs. No discrepancy detected.

Pre-step gate: PASSED. HK Area 2 entry permitted.

---

## §2 Per-row enumeration with current status

Source: [docs/AL-2-B-low-confidence-deferred.md §3.3](AL-2-B-low-confidence-deferred.md) rows 12-48 (37 rows total, 120 occurrences aggregate).

Status taxonomy (from dispatch):
- **deleted**: 코드/data에서 완전 제거
- **soft-marked**: deprecated flag만 부착
- **unhandled**: 결정 후에도 미처리

Status determination rule (read-only verification): for each row, run `grep -rn "\bROW\b" bty-app/src/` and inspect (a) presence in scenario JSON, (b) presence in `PATTERN_FAMILY_ALIAS`, (c) any `deprecated` flag or comment annotation.

| # | pattern_family | freq (per source) | scenario_data_presence | alias_dict_presence | soft_mark_presence | status |
|--:|---|--:|---|---|---|---|
| 12 | `accountability_system` | 18 | yes (sampled grep src_hits=21 incl. scenario JSON files) | no | no | unhandled |
| 13 | `standard_creation` | 12 | yes (src_hits=14) | no | no | unhandled |
| 14 | `fairness_definition` | 7 | yes (src_hits=7) | no | no | unhandled |
| 15 | `emotional_release_loop` | 6 | yes (src_hits=8) | no | no | unhandled |
| 16 | `system_adaptation` | 5 | yes (src_hits=5) | no | no | unhandled |
| 17 | `emotional_bypass` | 4 | yes (src_hits=5) | no | no | unhandled |
| 18 | `instruction_based_handoff` | 4 | yes (src_hits=7) | no | no | unhandled |
| 19 | `localized_system` | 4 | yes (src_hits=6) | no | no | unhandled |
| 20 | `pattern_capture` | 4 | yes (src_hits=4) | no | no | unhandled |
| 21 | `relationship_buffer` | 4 | yes (src_hits=6) | no | no | unhandled |
| 22 | `standard_enforcement` | 4 | yes (src_hits=5) | no | no | unhandled |
| 23 | `successor_assumption` | 4 | yes (src_hits=6) | no | no | unhandled |
| 24 | `adaptive_alignment` | 3 | yes (src_hits=3) | no | no | unhandled |
| 25 | `active_verification` | 2 | yes (src_hits=3) | no | no | unhandled |
| 26 | `constraint_definition` | 2 | yes (src_hits=3) | no | no | unhandled |
| 27 | `controlled_scaling` | 2 | yes (src_hits=2) | no | no | unhandled |
| 28 | `drift_detection` | 2 | yes (src_hits=2) | no | no | unhandled |
| 29 | `equal_application` | 2 | yes (src_hits=2) | no | no | unhandled |
| 30 | `observed_handoff` | 2 | yes (src_hits=3) | no | no | unhandled |
| 31 | `pattern_ownership` | 2 | yes (src_hits=2) | no | no | unhandled |
| 32 | `pressure_tested_successor_alignment` | 2 | <C5 inventory에서 확인 — sampled grep not run> | no | no | unhandled |
| 33 | `principle_with_constraint` | 2 | <C5 inventory에서 확인> | no | no | unhandled |
| 34 | `scaling_control` | 2 | <C5 inventory에서 확인> | no | no | unhandled |
| 35 | `self_correction_protocol` | 2 | <C5 inventory에서 확인> | no | no | unhandled |
| 36 | `successor_ownership_mechanism` | 2 | <C5 inventory에서 확인> | no | no | unhandled |
| 37 | `system_constraint` | 2 | <C5 inventory에서 확인> | no | no | unhandled |
| 38 | `system_independence` | 2 | <C5 inventory에서 확인> | no | no | unhandled |
| 39 | `system_reinforcement` | 2 | <C5 inventory에서 확인> | no | no | unhandled |
| 40 | `system_reliability` | 2 | <C5 inventory에서 확인> | no | no | unhandled |
| 41 | `decentralized_correction` | 1 | <C5 inventory에서 확인> | no | no | unhandled |
| 42 | `internalization` | 1 | <C5 inventory에서 확인> | no | no | unhandled |
| 43 | `pattern_structuring` | 1 | <C5 inventory에서 확인> | no | no | unhandled |
| 44 | `relationally_held_correction` | 1 | <C5 inventory에서 확인> | no | no | unhandled |
| 45 | `standard_separation` | 1 | <C5 inventory에서 확인> | no | no | unhandled |
| 46 | `symbolic_correction` | 1 | <C5 inventory에서 확인> | no | no | unhandled |
| 47 | `system_feedback_loop` | 1 | <C5 inventory에서 확인> | no | no | unhandled |
| 48 | `system_humility` | 1 | <C5 inventory에서 확인> | no | no | unhandled |

> **Row #12 (`accountability_system`) — RECLASSIFIED (α-1c, 2026-05-15):**
> LIVE — scenario-resident entry family.
> Observed in core_27 ko/en (20 occurrences).
> Previous classification conflated Accountability entry semantics with Truth exit semantics.

[D-P1.R3-HK.A2.1] aggregate_status: 37/37 = unhandled. 0/37 = deleted. 0/37 = soft-marked.

[D-P1.R3-HK.A2.2] sampled_verification_count: 20/37 directly verified by `grep -rn "\b<family>\b" bty-app/src/` per [§2.1](#§2.1) below; 17/37 carry `<C5 inventory에서 확인>` marker pending the same grep verification. Per Guard 6, the unverified rows are explicitly marked rather than inferred.

### §2.1 alias_dict_presence verification (all 37 rows)

The check `grep -E "^\s*(<row>):" bty-app/src/domain/pattern-family.ts` was run for the canonical-style key form. The PATTERN_FAMILY_ALIAS dictionary at [bty-app/src/domain/pattern-family.ts:26-118](../bty-app/src/domain/pattern-family.ts#L26-L118) contains 53 entries; none of the 37 DEPRECATE row keys appear in it. This is by design — DEPRECATE rows have no canonical merge target (per [AL-2-B-low-confidence-deferred.md §3.3](AL-2-B-low-confidence-deferred.md) rationale: "no behavioral distortion mapping, meta/narrative/exit-direction").

[D-P1.R3-HK.A2.3] alias_dict_dispersion: 0/37 in PATTERN_FAMILY_ALIAS (Guard 6: directly verified by reading the dictionary contents).

---

## §3 Orphaned reference scan

Dispatch question: "각 row를 참조하는 코드 / docs / DB row 잔존 여부".

[D-P1.R3-HK.A2.4] code_orphan_status: All 37 rows are referenced from scenario JSON files within `bty-app/src/data/scenario/**`. No archetype gate references them (rules.ts uses 12 axes, not pattern_family literals — Method X per [R3.1.2](AL-2-C-R3-decision-template.csv)). No alias dictionary references them ([§2.1] verified). No selector references them (selector reads only AxisVector). They are "code-orphaned" in the sense of having no archetype-impact reference, but "scenario-data-resident" — they continue to flow as raw pattern_family values into `user_pattern_signatures` rows.

[D-P1.R3-HK.A2.5] docs_orphan_status: All 37 rows are enumerated in [AL-2-B-low-confidence-deferred.md §3.3](AL-2-B-low-confidence-deferred.md) (source) and cited in aggregate at [AL-2_SPRINT_CLOSURE.md §5.4](AL-2_SPRINT_CLOSURE.md), [AL-2-C-decision-lock.md §107](AL-2-C-decision-lock.md), and [low-row-archetype-resolution.md §1](AL-2-C-R3-low-row-archetype-resolution.md). No per-row deletion ticket exists in docs/.

[D-P1.R3-HK.A2.6] db_orphan_status: <C5 inventory에서 확인> — `user_pattern_signatures` rows whose `pattern_family ∈ 37-row-set` cannot be enumerated without DB access. The 5-baseline-user inactive-state proof ([AL-2_SPRINT_CLOSURE.md §3.8](AL-2_SPRINT_CLOSURE.md)) confirms 0 rows for those 5 users; broader production presence is unverified in this audit. Marker carried per Guard 6.

---

## §4 Determinism impact summary

[D-P1.R3-HK.A2.7] axisVector_impact: 0. None of the 37 rows match a canonical literal in `pen("…", base)` calls at [buildFingerprintInput.ts:34-44](../bty-app/src/lib/bty/archetype/buildFingerprintInput.ts#L34-L44), and none are aliased into the canonical literal set. Their presence in `patterns[]` therefore does not lower any axis.

[D-P1.R3-HK.A2.8] inputHash_impact: > 0 by construction. Each of the 37 row literals, when present in `patternFamilies` at [buildFingerprintInput.ts:50](../bty-app/src/lib/bty/archetype/buildFingerprintInput.ts#L50), enters the hash via [fingerprint.ts:64](../bty-app/src/lib/bty/archetype/fingerprint.ts#L64) (`patterns = [...new Set(patternFamilies.map(p => p.toLowerCase()))].sort()`). The literal contributes to the SHA-256 input.

[D-P1.R3-HK.A2.9] archetype_name_impact: 0 via axisVector path; only the input_hash is altered. Two users identical except for one's `patterns[]` containing a 37-row literal vs the other's not containing it would compute the same archetype_name (selector reads only axisVector), but different input_hash (so they get separate `bty_archetype_naming_locks` rows under the same archetype name).

[D-P1.R3-HK.A2.10] determinism_invariant_violation: none. Same input → same hash holds at V=1 across the 37 rows. The Lock 4 invariant (archetype_name freeze) is not threatened.

---

## §5 Disposition options (Housekeeping authority; not decided here)

[D-P1.R3-HK.A2.11] option_h1_in_place_pruning: scenario JSON edit to remove or rename each occurrence (Lock 5 frozen until AL-2-E unlocks). Cost = high (per-scenario semantic review by author). Determinism impact = changes input_hash for any user whose Arena run touched the edited scenario.

[D-P1.R3-HK.A2.12] option_h2_silent_dropout: add a "drop these literals from `patternFamilies` before hashing" filter at the buildFingerprintInput layer. Cost = single edit; covers all 37 literals via a constant set. Determinism impact = changes input_hash for affected users (and would justify a V bump per T2 [trigger-condition-draft.md](AL-2-D-P1-R3-bump-trigger-condition-draft.md)).

[D-P1.R3-HK.A2.13] option_h3_no_action: keep as deferred backlog; the 37 literals continue to enter the hash and surface as inert tail in `patternFamilies`. Cost = 0. Determinism impact = 0 (status quo preserved). Consistent with Lock 6 (V=1 freeze).

[D-P1.R3-HK.A2.14] recommendation_pending: Housekeeping authority (Hanbit Commander) decides among H1/H2/H3. This audit produces inventory only.

---

## §6 Cross-references

- [docs/AL-2-B-low-confidence-deferred.md §3.3](AL-2-B-low-confidence-deferred.md) — authoritative 37-row enumeration
- [docs/AL-2-C-R3-low-row-archetype-resolution.md §1](AL-2-C-R3-low-row-archetype-resolution.md) — count cite
- [docs/AL-2_SPRINT_CLOSURE.md §5.4](AL-2_SPRINT_CLOSURE.md) — Housekeeping bucket carry-forward
- [docs/AL-2-C-decision-lock.md §107](AL-2-C-decision-lock.md) — decision-lock cite
- [bty-app/src/domain/pattern-family.ts:26-118](../bty-app/src/domain/pattern-family.ts#L26-L118) — alias dictionary (no DEPRECATE row entries by design)
- [bty-app/src/lib/bty/archetype/buildFingerprintInput.ts:50](../bty-app/src/lib/bty/archetype/buildFingerprintInput.ts#L50) — patternFamilies emission (raw)
- [bty-app/src/lib/bty/archetype/fingerprint.ts:64](../bty-app/src/lib/bty/archetype/fingerprint.ts#L64) — patterns hashing
