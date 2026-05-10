# AL-2-D-P1+ R3-HK Area 3 — Orphaned Semantic Reference + Dead Compat Branch Inventory

**Sprint**: AL-2-D-P1+ R3-HK (Housekeeping audit)
**Date (issuance)**: 2026-05-09
**Mode**: read-only inventory (no deletion authorized in this dispatch)
**P0 dependency**: none

---

## §1 AL-2-C "deprecate" + "unique new" cross-reference

Source: [docs/AL-2-C-deprecate-and-unique-new.md](AL-2-C-deprecate-and-unique-new.md) §1-§2.

### §1.1 DEPRECATE row enumeration (1 row)

[D-P1.R3-HK.A3.1] al2c_deprecate_count: 1.

| # | pattern_family | freq | R3 decision | alias_dict_entry | runtime_effect |
|--:|---|--:|---|--:|---|
| 1 | `avoidance_behavior` | 9 | DEPRECATE (R3.3.5; override Council target) | 0 | passthrough at `normalizePatternFamilyId` (raw); 0 pen() match → 0 axisVector impact; non-zero patternFamilies hash contribution |

### §1.2 Unique NEW row enumeration (3 rows, axis deferred)

[D-P1.R3-HK.A3.2] al2c_unique_new_count: 3.

| # | pattern_family | freq | R3 decision | axis_assigned | alias_dict_entry | runtime_effect |
|--:|---|--:|---|---|--:|---|
| 1 | `closure_rush` | 4 | unique NEW (Option β; R3.3.6) | deferred | 0 | passthrough; 0 axis impact; non-zero hash impact |
| 2 | `boundary_definition` | 1 | unique NEW (Option β; R3.3.8) | deferred | 0 | passthrough; 0 axis impact; non-zero hash impact |
| 3 | `re_engagement` | 1 | unique NEW (Option β; R3.3.10) | deferred | 0 | passthrough; 0 axis impact; non-zero hash impact |

[D-P1.R3-HK.A3.3] al2c_total_orphan_semantic_refs: 4 (1 DEPRECATE + 3 unique NEW). All 4 carry `alias dictionary entry = 0` per [§3 Force-map invariant](AL-2-C-deprecate-and-unique-new.md).

[D-P1.R3-HK.A3.4] al2c_orphan_runtime_observability: each of the 4 literals can appear in `user_pattern_signatures.pattern_family` rows (raw write side), in `patternFamilies` array hashed at [fingerprint.ts:64](../bty-app/src/lib/bty/archetype/fingerprint.ts#L64), but contribute 0 to AxisVector. Determinism preserved at V=1.

### §1.3 Note on stale doc cite

[D-P1.R3-HK.A3.5] al2c_doc_§3_stale_paragraph: [AL-2-C-deprecate-and-unique-new.md §3](AL-2-C-deprecate-and-unique-new.md) line 127-128 references "buildFingerprintInput.ts:23-25" and asserts "activePatterns Set built from raw pattern_family.toLowerCase() bypasses alias dictionary regardless." This was the [R3.5.2 gap](AL-2-C-R3-decision-template.csv) — closed in AL-2-D-P0 ([buildFingerprintInput.ts:27-29](../bty-app/src/lib/bty/archetype/buildFingerprintInput.ts#L27-L29) now uses `normalizePatternFamilyId`). The §3 paragraph is observably stale. **No mutation in this dispatch** — flagged for downstream doc closure. Guard 8 (Group B operating docs untouched) preserved; this doc is not Group B.

---

## §2 Dead branch code grep

Dispatch question: "alias dictionary 외 dead resolution path · selector / rules의 dead match arm".

### §2.1 `bty_archetype_naming_locks.selected_by` enum vs code

[D-P1.R3-HK.A3.6] selected_by_db_enum: `'rule_engine', 'cached_match', 'fallback', 'ai_assisted'` per [migrations/20260505000000_bty_archetype_naming_locks.sql:25-27](../bty-app/supabase/migrations/20260505000000_bty_archetype_naming_locks.sql#L25-L27).

[D-P1.R3-HK.A3.7] selected_by_code_emission: only `'rule_engine'` is emitted. [selector.ts:8](../bty-app/src/lib/bty/archetype/selector.ts#L8) declares `selectedBy: "rule_engine"`; [selector.ts:58](../bty-app/src/lib/bty/archetype/selector.ts#L58) sets it on the returned object. No code path emits `'cached_match'`, `'fallback'`, or `'ai_assisted'`.

[D-P1.R3-HK.A3.8] selected_by_dead_arm_classification:
- `'cached_match'`: dead at write side. Cache hit returns the EXISTING row (with whatever `selected_by` it had); no new write. The enum value can in principle be written by future code but is currently unreachable.
- `'fallback'`: dead. [selector.ts:14-24](../bty-app/src/lib/bty/archetype/selector.ts#L14-L24) declares `SelectorInvariantError` instead of writing a fallback row → throws to caller; no row is written under a `selected_by='fallback'` label.
- `'ai_assisted'`: dead. No AI-assisted selection path exists in [bty-app/src/lib/bty/archetype/](../bty-app/src/lib/bty/archetype/).

### §2.2 RULE_REGISTRY (rules.ts)

[D-P1.R3-HK.A3.9] rule_registry_count: 7 (CLEARANCHOR, IRONROOT, TRUEBEARING, OPENHAND, QUIETFLAME, NIGHTFORGE, STILLWATER) per [rules.ts:19-78](../bty-app/src/lib/bty/archetype/rules.ts#L19-L78).

[D-P1.R3-HK.A3.10] rule_registry_dead_arm: 0. All 7 rules participate in `RULE_REGISTRY.filter((r) => ruleMatches(r, axisVector))` at [selector.ts:34](../bty-app/src/lib/bty/archetype/selector.ts#L34) — selector is exhaustive over the registry. No dead match arm.

[D-P1.R3-HK.A3.11] axis_condition_dead_arm: 0. Method X (axis-only) per [R3.1.2 lock](AL-2-C-R3-decision-template.csv); no `patternRequires` field exists on `ArchetypeRule`. No dead match arm at the conditions level.

### §2.3 ArchetypeClass enum (rules.ts)

[D-P1.R3-HK.A3.12] archetype_class_enum: 6 values declared at [rules.ts:3](../bty-app/src/lib/bty/archetype/rules.ts#L3) (`stability | pressure | repair | truth | courage | identity`).

[D-P1.R3-HK.A3.13] archetype_class_db_check: 6 values at [migrations/20260505000000_bty_archetype_naming_locks.sql:19-22](../bty-app/supabase/migrations/20260505000000_bty_archetype_naming_locks.sql#L19-L22). Match. No dead enum value.

### §2.4 `tensionAxisToAxisVector.ts`

[D-P1.R3-HK.A3.14] tensionAxisToAxisVector_consumer_count: 0 — Decision Cn (Phase 2 mapping function only, 0 consumer; carry-forward per [AL-2_SPRINT_CLOSURE.md §4.1](AL-2_SPRINT_CLOSURE.md), backlog at §5.1).

[D-P1.R3-HK.A3.15] tensionAxisToAxisVector_classification: orphan at code level (declared, exported via barrel? — verify). Dead at consumer level. Standalone capacity per Decision Cn.

[D-P1.R3-HK.A3.16] tensionAxisToAxisVector_disposition: backlog AL-2-D consumer wiring per [AL-2_SPRINT_CLOSURE.md §5.1](AL-2_SPRINT_CLOSURE.md). Not a Housekeeping deletion candidate (sprint reservation).

### §2.5 `patternFamilyCompatibilityMap` (cross-ref to HK Area 1)

[D-P1.R3-HK.A3.17] compat_map_grep: 1 hit (declaration only); 0 imports; 0 consumers. Detailed in [docs/AL-2-D-P1-R3-HK-compat-map-deletion-trace.md](AL-2-D-P1-R3-HK-compat-map-deletion-trace.md).

[D-P1.R3-HK.A3.18] compat_map_classification: dead artifact, deletion candidate (Housekeeping authority).

### §2.6 LEGACY_EXPLANATION_ALIAS path

[D-P1.R3-HK.A3.19] legacy_explanation_alias_present: [pattern-family.ts:120-127](../bty-app/src/domain/pattern-family.ts#L120-L127) `normalizePatternFamilyId` checks `tLower === LEGACY_EXPLANATION_ALIAS` before alias dictionary lookup.

[D-P1.R3-HK.A3.20] legacy_explanation_alias_classification: live but legacy. Special-case branch handling backward-compatible literal. Not dead. Preservation candidate.

---

## §3 Classification: deletion candidate vs preservation candidate

| ID | item | classification | rationale |
|---|---|---|---|
| C1 | `patternFamilyCompatibilityMap` (13 entries, [bty-app/src/data/scenario/index.ts:542-556](../bty-app/src/data/scenario/index.ts#L542-L556)) | **deletion** | dead artifact (HK Area 1 verified); 0 consumer; 8/13 row conflict with Council CSV; superseded by `PATTERN_FAMILY_ALIAS` |
| C2 | `selected_by='fallback'` enum value | **preservation** (DB schema) | enum-level reservation for future fallback selection path; no rows currently exist; deleting requires CHECK constraint replacement and is high-cost low-benefit at this time |
| C3 | `selected_by='ai_assisted'` enum value | **preservation** (DB schema) | enum-level reservation for future AI-assisted selection; no rows; same cost-benefit as C2 |
| C4 | `selected_by='cached_match'` enum value | **preservation** | semantically meaningful but write-path doesn't currently emit it (cache returns existing rows); future emission possible without schema change |
| C5 | `tensionAxisToAxisVector.ts` (0 consumer) | **preservation** | Decision Cn standalone capacity; backlog AL-2-D consumer wiring; NOT a Housekeeping target |
| C6 | `avoidance_behavior` (R3.3.5 DEPRECATE; 9 freq) | **deferred decision** | scenario JSON contains the literal; deletion requires Lock 5 unlock at AL-2-E; pruning at scenario authoring layer is the canonical path |
| C7 | `closure_rush` (R3.3.6 unique NEW; 4 freq) | **preservation** | unique NEW reservation; awaits axis assignment; deletion would erase semantic placeholder |
| C8 | `boundary_definition` (R3.3.8 unique NEW; 1 freq) | **preservation** | unique NEW reservation; awaits axis assignment |
| C9 | `re_engagement` (R3.3.10 unique NEW; 1 freq) | **preservation** | unique NEW reservation; awaits axis assignment |
| C10 | 37 DEPRECATE LOW rows (HK Area 2) | **deferred decision** | 37/37 unhandled; H1/H2/H3 disposition options enumerated in [docs/AL-2-D-P1-R3-HK-deprecate-low-row-status.md §5](AL-2-D-P1-R3-HK-deprecate-low-row-status.md); Commander chooses |

[D-P1.R3-HK.A3.21] deletion_candidate_count: 1 (C1).

[D-P1.R3-HK.A3.22] preservation_candidate_count: 7 (C2, C3, C4, C5, C7, C8, C9).

[D-P1.R3-HK.A3.23] deferred_decision_count: 2 (C6, C10).

---

## §4 Determinism + identity continuity impact summary

[D-P1.R3-HK.A3.24] orphan_axis_impact: 0. None of the orphan/dead items cited (C1-C10) currently mutate AxisVector. C2/C3/C4 are DB enum reservations only; C5 is a function with 0 consumer; C6-C10 are pattern_family literals with 0 alias entry → 0 pen() match.

[D-P1.R3-HK.A3.25] orphan_hash_impact: variable per item.
- C1, C2, C3, C4, C5: 0 hash impact (not on hash path).
- C6, C7, C8, C9: hash impact > 0 when present in `patterns[]` (raw inclusion at [fingerprint.ts:64](../bty-app/src/lib/bty/archetype/fingerprint.ts#L64)).
- C10 (37 rows): hash impact > 0 per [HK Area 2 §4](AL-2-D-P1-R3-HK-deprecate-low-row-status.md).

[D-P1.R3-HK.A3.26] orphan_archetype_name_impact: 0. archetype_name is a function of axisVector via selector (Method X; V-independent). Hash differences alone don't change the name.

[D-P1.R3-HK.A3.27] guard11_position: All preservation candidates (C2-C5, C7-C9) preserve determinism at V=1 by leaving the system unchanged. All deletion candidates (C1) and deferred-decision items (C6, C10) require explicit Commander dispatch before mutation.

---

## §5 Cross-references

- [docs/AL-2-C-deprecate-and-unique-new.md](AL-2-C-deprecate-and-unique-new.md) — 4-row decision detail
- [docs/AL-2-D-P1-R3-HK-compat-map-deletion-trace.md](AL-2-D-P1-R3-HK-compat-map-deletion-trace.md) — HK Area 1 detail (C1)
- [docs/AL-2-D-P1-R3-HK-deprecate-low-row-status.md](AL-2-D-P1-R3-HK-deprecate-low-row-status.md) — HK Area 2 detail (C10)
- [bty-app/src/lib/bty/archetype/rules.ts](../bty-app/src/lib/bty/archetype/rules.ts) — RULE_REGISTRY (no dead arm)
- [bty-app/src/lib/bty/archetype/selector.ts](../bty-app/src/lib/bty/archetype/selector.ts) — selectArchetype + SelectorInvariantError
- [bty-app/src/lib/bty/archetype/tensionAxisToAxisVector.ts](../bty-app/src/lib/bty/archetype/tensionAxisToAxisVector.ts) — orphan function (0 consumer)
- [bty-app/supabase/migrations/20260505000000_bty_archetype_naming_locks.sql](../bty-app/supabase/migrations/20260505000000_bty_archetype_naming_locks.sql) — `selected_by` enum
- [docs/AL-2_SPRINT_CLOSURE.md §4.1, §5.1](AL-2_SPRINT_CLOSURE.md) — Decision Cn + AL-2-D backlog
