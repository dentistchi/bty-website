# AL-2-B Cleanup Candidates — Status Lock (no deletion)

**Status**: Phase 1 status-lock entry only. No mutation / no deletion.
**Date**: 2026-05-08
**Sprint**: AL-2-B Phase 1
**Scope**: cleanup deferred to housekeeping sprint OR AL-2-C archetype 재설계

---

## §1 patternFamilyCompatibilityMap — dead artifact

**File**: [bty-app/src/data/scenario/index.ts:542-556](../bty-app/src/data/scenario/index.ts#L542-L556)
**Definition line**: 542 (`export const patternFamilyCompatibilityMap: Record<string, string> = { ... }`)
**Entry count**: 13

### §1.1 Dead-status evidence (Phase 0 + Phase 1 re-verified)

```
$ grep -rn "patternFamilyCompatibilityMap" src/
src/data/scenario/index.ts:542:export const patternFamilyCompatibilityMap: Record<string, string> = {

$ grep -rn "import.*patternFamilyCompatibilityMap\|from.*patternFamilyCompatibilityMap" src/ | wc -l
0
```

- 1 definition site
- 0 imports
- 0 usages (no property access, no function call, no spread)
- Cross-check: AL-2-A T5 evidence ("compatibility map dead") confirmed twice

### §1.2 Council CSV ↔ compat map conflict (8 rows)

The existing 13-entry compat map disagrees with the Council CSV decision in 8 rows. Below:
authoritative target = Council CSV column 4 (candidate_canonical).
Source: [docs/AL-2-A-mapping-decision-template.csv](AL-2-A-mapping-decision-template.csv)

| key | compat map target | Council CSV decision | conflict type |
|---|---|---|---|
| `ownership_act` | `ownership_claim` | `MERGE_INTO=ownership_escape` | target divergence (compat map invents a non-canonical `ownership_claim`) |
| `system_thinking` | `accountability_system` | `DEPRECATE` | Council rejects compat-map promotion — meta/exit valence, no penalty target |
| `blame_shift` | `accountability_deflection` | `MERGE_INTO=explanation_substitution` | target divergence (compat map invents `accountability_deflection`) |
| `truth_naming` | `truth_naming` (identity) | `NEW_AXIS=truth` | canonical promotion mismatch (compat map = identity passthrough; Council = NEW_AXIS anchor) |
| `integrity_compromise` | `integrity_compromise` (identity) | `NEW_AXIS=integrity` | canonical promotion mismatch |
| `control_fixation` | `control_fixation` (identity) | `MERGE_INTO=self_protection` | Council subsumes into NEW_AXIS=control anchor |
| `self_protection` | `identity_drift` | `NEW_AXIS=control` | dual conflict: target divergence + canonical promotion (compat map invents `identity_drift`) |
| `conflict_avoidance` | `conflict_avoidance` (identity) | `MERGE_INTO=delegation_deflection` | semantic anchor inversion (compat map = identity; Council = merge to existing canonical) |

### §1.3 Council CSV ↔ compat map matches (4 rows — canonical identity)

The 4 canonical-5 rows where compat map identity passthrough matches Council CSV (canonical anchor preserved):

| key | compat map target | Council CSV |
|---|---|---|
| `future_deferral` | `future_deferral` | canonical (anchor preserved) |
| `delegation_deflection` | `delegation_deflection` | canonical (anchor preserved) |
| `repair_avoidance` | `repair_avoidance` | canonical (anchor preserved) |
| `explanation_substitution` | `explanation_substitution` | canonical (anchor preserved) |

### §1.4 Phantom entry (1 row)

| key | compat map target | Council CSV status |
|---|---|---|
| `courage_act` | `courage_act` (identity) | NOT IN INVENTORY (110-row scenario family inventory contains 0 occurrences) |

`courage_act` exists only in the compat map; no scenario JSON authors it. Cross-check: AL-2-A inventory (`docs/AL-2-A-vocabulary-inventory.csv`) returns 0 hits.

### §1.5 Resolution path

- **Phase 1 (this sprint)**: status lock only — no deletion. compat map remains in tree as dead-but-tolerated artifact.
- **Deferred to**: (a) housekeeping sprint for outright deletion, OR (b) AL-2-C archetype 재설계 영역 — depending on whether AL-2-C reuses any of the compat-map vocabulary as authoritative anchor.
- **Replacement authority**: `PATTERN_FAMILY_ALIAS` dictionary in [bty-app/src/domain/pattern-family.ts](../bty-app/src/domain/pattern-family.ts) (introduced in AL-2-B Phase 1) supersedes the compat map for all live alias resolution. compat map is structurally orphaned.

---

## §2 LOW-confidence MERGE rows deferred to Phase 3

Per Phase 1 directive (`col 7 confidence = HIGH/MEDIUM 영역 우선`), 7 LOW-confidence MERGE_INTO=canonical-5 rows are excluded from Phase 1 alias dictionary:

| row | candidate_canonical | confidence reason |
|---|---|---|
| `closure_rush` | `MERGE_INTO=future_deferral` | LOW; could alternatively map to `integrity_compromise` (premature closure as principle compromise) |
| `avoidance_behavior` | `MERGE_INTO=delegation_deflection` | LOW; generic name, ideally scenario-author rename to specific mechanism |
| `accountability_application` | `MERGE_INTO=explanation_substitution` | LOW; current_axis literal `integrity` is empirical drift |
| `boundary_definition` | `MERGE_INTO=repair_avoidance` | LOW; freq=1 |
| `misuse_correction` | `MERGE_INTO=repair_avoidance` | LOW; freq=1 |
| `re_engagement` | `MERGE_INTO=repair_avoidance` | LOW; freq=1 |
| `visible_correction` | `MERGE_INTO=repair_avoidance` | LOW; freq=1 |

Total deferred: 7 rows / 17 occurrences. Resolution: AL-2-B Phase 3 (post NEW_AXIS adoption verify) OR scenario-author rename in AL-2-E.
