# AL-2-C R3 Decision Lock

**Sprint context**: AL-2-C R3 closure + mutation phase
**Decision authority**: Hanbit Commander (BTY Semantic Council session)
**Source**: [docs/AL-2-C-R3-decision-template.csv](AL-2-C-R3-decision-template.csv)
**Lock date**: 2026-05-09

---

## §1 Recommended-default 7 row (ALL ACCEPTED)

| ID | Decision | Rationale |
|----|----------|-----------|
| R3.1.1 | preserve (7 archetype v1) | Lock 4 carry-forward |
| R3.1.2 | Method X (axis-only ruleMatches) | architecture preserve |
| R3.1.3 | No (preserve 18 conditions) | axis condition stable |
| R3.2.1 | Option B (courage defer to AL-2-D) | production evidence 0 |
| R3.2.2 | Option B (identity defer to AL-2-D) | production evidence 0 |
| R3.5.1 | swap-B (preserve v1 anchor delegation_deflection) | Council cardinality lock |
| R3.5.2 | defer to AL-2-D backlog | activePatterns gap → AL-2-D |

Mutation impact: **0** (all 7 are no-mutation locks).

---

## §2 Semantic decision 12 row (Hanbit Commander semantic lock)

### §2.1 NEW_AXIS-dependent — 4 row

| ID | family | freq | resolution | rationale |
|----|--------|--:|------------|-----------|
| R3.3.1 | `private_intention` | 10 | `self_protection` (control) | control / vulnerability avoidance > truth |
| R3.3.2 | `group_conformity` | 4 | `reputation_protection` (visibility) | reputation alignment > control (V-1-A unlocked) |
| R3.3.3 | `successor_protection` | 2 | `authority_protection` (authority) | authority lineage preservation |
| R3.3.4 | `system_defensiveness` | 2 | `authority_protection` (authority) | structure / legitimacy / governance defense |

### §2.2 Phase 4 alias — 7 row

| ID | family | freq | resolution | rationale |
|----|--------|--:|------------|-----------|
| R3.3.5 | `avoidance_behavior` | 9 | **DEPRECATE** | signal specificity too low; ontology density degradation risk |
| R3.3.6 | `closure_rush` | 4 | **unique NEW** (Option β, axis deferred) | semantic compression loss too high — ambiguity intolerance / forced resolution / premature closure / discomfort termination |
| R3.3.7 | `accountability_application` | 2 | `explanation_substitution` (accountability) | rationalizing > owning |
| R3.3.8 | `boundary_definition` | 1 | **unique NEW** (Option β, axis deferred) | self-definition / relational perimeter / psychological sovereignty distinct from simple distancing |
| R3.3.9 | `misuse_correction` | 1 | `truth_naming` (truth) | identification + naming + correction trigger |
| R3.3.10 | `re_engagement` | 1 | **unique NEW** (Option β, axis deferred) | reconnect / resume trust / return after rupture — temporal semantic distinct |
| R3.3.11 | `visible_correction` | 1 | `truth_naming` (truth) | public acknowledgment / observable repair |

### §2.3 group_conformity focused (cross-reference R3.3.2)

| ID | decision | rationale |
|----|----------|-----------|
| R3.4.1 | visibility (Option B) | R3.3.2 정합 — reputation alignment stronger than control framing |

---

## §3 Override notes (Hanbit Commander)

- **3 unique NEW rows** (`closure_rush` / `boundary_definition` / `re_engagement`): semantic compression loss too high → unique NEW preserved, axis assignment deferred (Option β). No alias entry, no axis assignment.
- **`avoidance_behavior`**: signal specificity too low → DEPRECATE. No alias entry; production data passthrough preserved.
- **`visible_correction` / `misuse_correction`**: integrity-truth alignment via `truth_naming` (naming-as-correction semantic).
- **`group_conformity`**: control vs visibility ambiguity → visibility (reputation alignment stronger). Reverses Phase 2 V-1-A lock.
- **Exit-direction merge minimization**: most exit-direction signals routed to unique NEW (deferred) or DEPRECATE rather than forced into entry-direction canonical.
- **Method Y** (R3.1.2 — patternRequires field): architecture extension → AL-2-D 이후 검토.
- **activePatterns normalization gap** (R3.5.2): production-traffic-before-resolution → AL-2-D.

---

## §4 Mutation summary

| category | count | impact |
|---|--:|---|
| alias dictionary additions (semantic decisions ratified to canonical) | **7** | R3.3.1, R3.3.2, R3.3.3, R3.3.4, R3.3.7, R3.3.9, R3.3.11 |
| DEPRECATE | 1 | R3.3.5 (`avoidance_behavior`) — mutation 0 |
| Unique NEW deferred | 3 | R3.3.6, R3.3.8, R3.3.10 — mutation 0 |
| Cross-reference (R3.4.1 → R3.3.2) | 1 | mutation 0 |
| Recommended-default ratifications | 7 | mutation 0 |

Total alias dictionary entries post-AL-2-C: **52 + 7 = 59**

Cluster distribution post-AL-2-C:
- `ownership_escape`: 7 (Phase 1, preserved)
- `future_deferral`: 1 (Phase 1, preserved)
- `delegation_deflection`: 5 (Phase 1, preserved)
- `explanation_substitution`: 6 + **1** = 7 (`+accountability_application`)
- `repair_avoidance`: 4 (Phase 1, preserved)
- `truth_naming`: 7 + **2** = 9 (`+misuse_correction`, `+visible_correction`)
- `integrity_compromise`: 12 (Phase 2, preserved)
- `authority_protection`: 5 + **2** = 7 (`+successor_protection`, `+system_defensiveness`)
- `self_protection`: 5 + **1** = 6 (`+private_intention`)
- `reputation_protection`: 0 + **1** = 1 (`+group_conformity`, V-1-A unlocked)

---

## §5 Forward backlog

- **AL-2-D (fingerprint / specificity sprint)**:
  - courage / identity pen() shape change (R3.2.1, R3.2.2)
  - activePatterns normalization gap (R3.5.2)
  - 3 unique NEW axis assignment (`closure_rush`, `boundary_definition`, `re_engagement` — see [AL-2-C-deprecate-and-unique-new.md](AL-2-C-deprecate-and-unique-new.md))
  - FINGERPRINT_VERSION bump
  - metric source reassignment
  - Layer 2-norm storage normalization
  - tensionAxisToAxisVector consumer wiring
- **AL-2-D OR Housekeeping**: `avoidance_behavior` DEPRECATE migration
- **AL-2-E**: `bty_tension_axis` literal re-tag, 12 Type 4 OUTSIDE literal rewrite
- **Housekeeping**: `patternFamilyCompatibilityMap` deletion, 37 DEPRECATE LOW rows pruning
- **Method Y candidate** (R3.1.2 post-AL-2-D): patternRequires field architecture extension

---

## §6 Cross-references

- [docs/AL-2-C-R3-decision-template.csv](AL-2-C-R3-decision-template.csv) — 19-row R3 source
- [docs/AL-2-C-R3-archetype-inventory.md](AL-2-C-R3-archetype-inventory.md) — 7 archetype semantic inventory
- [docs/AL-2-C-R3-courage-identity-deferral.md](AL-2-C-R3-courage-identity-deferral.md) — courage/identity audit
- [docs/AL-2-C-R3-low-row-archetype-resolution.md](AL-2-C-R3-low-row-archetype-resolution.md) — 11 LOW row resolution
- [docs/AL-2-C-R3-anchor-swap-review.md](AL-2-C-R3-anchor-swap-review.md) — anchor swap review (incl. R3.5.2 finding)
- [docs/AL-2-C-deprecate-and-unique-new.md](AL-2-C-deprecate-and-unique-new.md) — DEPRECATE + Option β detail
- [docs/AL-2-B-low-confidence-deferred.md](AL-2-B-low-confidence-deferred.md) — Phase 3 closure baseline
- [bty-app/src/domain/pattern-family.ts](../bty-app/src/domain/pattern-family.ts) — alias dictionary (59 entries post-AL-2-C)
