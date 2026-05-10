# AL-2-D-P1+ R3-HK Area 1 — patternFamilyCompatibilityMap Deletion Trace

**Sprint**: AL-2-D-P1+ R3-HK (Housekeeping audit)
**Date (issuance)**: 2026-05-09
**Mode**: read-only inventory (no deletion authorized in this dispatch)
**P0 dependency**: none

---

## §1 Current state of `patternFamilyCompatibilityMap`

[D-P1.R3-HK.A1.1] declaration_site: [bty-app/src/data/scenario/index.ts:542-556](../bty-app/src/data/scenario/index.ts#L542-L556) — `export const patternFamilyCompatibilityMap: Record<string, string> = { ... }`.

[D-P1.R3-HK.A1.2] declaration_entry_count: 13 entries (per [AL-2-B-cleanup-candidates.md §1](AL-2-B-cleanup-candidates.md), confirmed by direct read of [bty-app/src/data/scenario/index.ts:542-556](../bty-app/src/data/scenario/index.ts#L542-L556) — keys: `ownership_act`, `system_thinking`, `blame_shift`, `truth_naming`, `future_deferral`, `delegation_deflection`, `integrity_compromise`, `repair_avoidance`, `courage_act`, `control_fixation`, `self_protection`, `explanation_substitution`, `conflict_avoidance`).

[D-P1.R3-HK.A1.3] grep_src_total_hits: 1 (the declaration site only). Verification: `grep -rn "patternFamilyCompatibilityMap" bty-app/src/` returns only `bty-app/src/data/scenario/index.ts:542:export const patternFamilyCompatibilityMap: Record<string, string> = {`.

[D-P1.R3-HK.A1.4] import_hits: 0 — `grep -rn "import.*patternFamilyCompatibilityMap\|from.*patternFamilyCompatibilityMap" bty-app/src/` returns 0 results (per AL-2-B Phase 0 + Phase 1 re-verification, [AL-2-B-cleanup-candidates.md §1.1](AL-2-B-cleanup-candidates.md)).

[D-P1.R3-HK.A1.5] consumer_hits: 0 — no property access (`patternFamilyCompatibilityMap[…]`), no spread (`...patternFamilyCompatibilityMap`), no function-call use.

[D-P1.R3-HK.A1.6] dead_status: confirmed dead-but-tolerated artifact. Status carried forward from AL-2-B Phase 1 closure to AL-2_SPRINT_CLOSURE §3.6.

---

## §2 Semantic-impact analysis (where compat resolution moved to)

The dispatch question: "compatibility resolution이 어디로 이전되었는가? 이전 후 결과의 동등성 검증 가능성?"

[D-P1.R3-HK.A1.7] replacement_authority: `PATTERN_FAMILY_ALIAS` dictionary at [bty-app/src/domain/pattern-family.ts:26-118](../bty-app/src/domain/pattern-family.ts#L26-L118), introduced AL-2-B Phase 1, supersedes the compat map for all live alias resolution.

[D-P1.R3-HK.A1.8] consumer_of_replacement: `normalizePatternFamilyId(raw)` at [bty-app/src/domain/pattern-family.ts:120-127](../bty-app/src/domain/pattern-family.ts#L120-L127). Called from `activePatterns` Set construction at [bty-app/src/lib/bty/archetype/buildFingerprintInput.ts:28](../bty-app/src/lib/bty/archetype/buildFingerprintInput.ts#L28) (AL-2-D-P0 alias-aware closure of [AL-2-C R3.5.2](AL-2-C-R3-decision-template.csv)).

[D-P1.R3-HK.A1.9] equivalence_check_compat_map_vs_alias_dict: NOT EQUIVALENT. Per [AL-2-B-cleanup-candidates.md §1.2](AL-2-B-cleanup-candidates.md), the 13-entry compat map disagrees with the Council CSV decision in 8 of 13 rows. Specifically:

| key | compat map target | Council CSV (authoritative) decision | conflict type |
|---|---|---|---|
| `ownership_act` | `ownership_claim` | `MERGE_INTO=ownership_escape` | target divergence (compat map invents non-canonical `ownership_claim`) |
| `system_thinking` | `accountability_system` | `DEPRECATE` | Council rejects compat-map promotion |
| `blame_shift` | `accountability_deflection` | `MERGE_INTO=explanation_substitution` | target divergence |
| `truth_naming` | `truth_naming` (identity) | `NEW_AXIS=truth` | canonical promotion mismatch |
| `integrity_compromise` | `integrity_compromise` (identity) | `NEW_AXIS=integrity` | canonical promotion mismatch |
| `control_fixation` | `control_fixation` (identity) | `MERGE_INTO=self_protection` | Council subsumes |
| `self_protection` | `identity_drift` | `NEW_AXIS=control` | dual conflict (target divergence + canonical promotion) |
| `conflict_avoidance` | `conflict_avoidance` (identity) | `MERGE_INTO=delegation_deflection` | semantic anchor inversion |

Compat map matches Council CSV in only 4 of 13 rows (`future_deferral`, `delegation_deflection`, `repair_avoidance`, `explanation_substitution` — all canonical-anchor identity passthrough).

1 row (`courage_act`) is a phantom entry — no scenario JSON in the 110-row inventory authors it ([AL-2-B-cleanup-candidates.md §1.4](AL-2-B-cleanup-candidates.md)).

[D-P1.R3-HK.A1.10] equivalence_check_runtime_consequence: Because the compat map has 0 consumers, the 8-row divergence has 0 runtime impact at present. Resolution moved to `PATTERN_FAMILY_ALIAS` (53 entries post-AL-2-B Phase 3 + AL-2-C R3 closure) which carries the Council CSV decisions, not the compat map decisions.

---

## §3 Deletion decision surface

[D-P1.R3-HK.A1.11] deletion_pre_requirement_alias_dict_lock: `PATTERN_FAMILY_ALIAS` is the live authority. Deletion of compat map does not destabilize live behavior. Verification: re-grep + ts-prune (or equivalent) for any consumer references should return 0 before deletion.

[D-P1.R3-HK.A1.12] deletion_pre_requirement_test_inventory: scan test files for any test that references `patternFamilyCompatibilityMap` symbol or imports `bty-app/src/data/scenario/index.ts` and consumes the export. Per [D-P1.R3-HK.A1.4] grep result = 0, no test depends on it.

[D-P1.R3-HK.A1.13] deletion_pre_requirement_scenario_json_lock: Lock 5 (scenario JSON re-tag deferred to AL-2-E) does NOT cover [bty-app/src/data/scenario/index.ts](../bty-app/src/data/scenario/index.ts) — that file is the export aggregator, not scenario JSON content. Deletion of the dead export is permissible without violating Lock 5.

[D-P1.R3-HK.A1.14] deletion_pre_requirement_alias_dictionary_lock: Guard 3 in this dispatch protects "alias dictionary" specifically, which is `PATTERN_FAMILY_ALIAS` ([bty-app/src/domain/pattern-family.ts](../bty-app/src/domain/pattern-family.ts)). The compat map is a separate, dead artifact. Deletion does not touch the alias dictionary.

[D-P1.R3-HK.A1.15] deletion_blocker: none identified at code level. The remaining decision is **whether** to delete (Housekeeping authority) — the dispatch reserves deletion for a future sprint and this audit only inventories impact.

---

## §4 Recommendation surface

[D-P1.R3-HK.A1.16] recommendation_no_action_in_this_dispatch: Per dispatch declaration "MUTATION 0 authorized", no deletion is performed.

[D-P1.R3-HK.A1.17] recommendation_when_deleted_minimal_diff: a future Housekeeping deletion would be a single edit removing lines 542-556 from [bty-app/src/data/scenario/index.ts](../bty-app/src/data/scenario/index.ts). No replacement export is required because no consumer exists.

[D-P1.R3-HK.A1.18] recommendation_when_deleted_post_check: post-deletion verification = (a) `grep -rn "patternFamilyCompatibilityMap" bty-app/` returns 0; (b) `npm run build:fast` and `npm test` pass; (c) Lock 5 boundary preserved (no scenario JSON edit).

---

## §5 Cross-references

- [bty-app/src/data/scenario/index.ts:542-556](../bty-app/src/data/scenario/index.ts#L542-L556) — declaration site
- [bty-app/src/domain/pattern-family.ts](../bty-app/src/domain/pattern-family.ts) — replacement authority `PATTERN_FAMILY_ALIAS`
- [bty-app/src/lib/bty/archetype/buildFingerprintInput.ts:27-29](../bty-app/src/lib/bty/archetype/buildFingerprintInput.ts#L27-L29) — sole consumer of `normalizePatternFamilyId`
- [docs/AL-2-B-cleanup-candidates.md](AL-2-B-cleanup-candidates.md) — Phase 1 status lock + 8-row conflict table + 4-row match table + 1 phantom row
- [docs/AL-2-A-vocabulary-lineage.md:179](AL-2-A-vocabulary-lineage.md#L179) — AL-2-A T5 dead artifact verification
- [docs/AL-2_SPRINT_CLOSURE.md §3.6 + §5.4](AL-2_SPRINT_CLOSURE.md) — sprint closure carry-forward (deletion deferred to Housekeeping)
- [docs/AL-2-C-decision-lock.md:107](AL-2-C-decision-lock.md#L107) — Housekeeping bucket includes compat map deletion
