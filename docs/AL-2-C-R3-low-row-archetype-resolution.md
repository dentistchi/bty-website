# AL-2-C R3: 11 LOW Row Archetype Semantic Resolution

**Sprint context**: AL-2-C R3 (decision template)
**Date**: 2026-05-09
**Decision authority**: Hanbit Commander
**Force-map invariant**: 11 row × archetype destination = R3 input only; decision = Commander

---

## §1 Source

- [docs/AL-2-B-low-confidence-deferred.md](AL-2-B-low-confidence-deferred.md) (Phase 3 closure)
- Filter: `destination == "AL-2-C (NEW_AXIS-dependent)"` (4 rows) + `"AL-2-C / Phase 4 alias"` (7 rows)
- Total: 11 rows

The remaining 37 LOW rows (DEPRECATE candidates) are routed to Housekeeping per Phase 3 categorization, not to AL-2-C archetype resolution.

---

## §2 NEW_AXIS-dependent — 4 rows

These 4 rows are MERGE candidates whose target is a Phase 2 NEW_AXIS anchor (Phase 2 V-1-A and HIGH+MEDIUM-only admit rule excluded them from AL-2-B Phase 2 alias dictionary).

| # | pattern_family | freq | NEW_AXIS cluster | Council CSV deferral reason | proposed semantic | dest archetype impact | confidence |
|--:|---|--:|---|---|---|---|:--:|
| 1 | `private_intention` | 10 | `self_protection` / control | "could alternatively map to explanation_substitution (covert vs overt) — control framing chosen for semantic distinctness; depends on NEW_AXIS=control adoption" | covert public-private gap; control axis distortion (alt: accountability via covert path) | IRONROOT (control ≥ 0.65 cutoff) | LOW |
| 2 | `group_conformity` | 4 | `reputation_protection` / visibility | "could alternatively go to control axis" — V-1-A deferred (Phase 2 visibility cluster alias=0) | image management for group OR in-group dominance | OPENHAND (visibility ≥ 0.65) **or** IRONROOT (control ≥ 0.65) | LOW |
| 3 | `successor_protection` | 2 | `authority_protection` / authority | "depends on NEW_AXIS=authority adoption" | protecting successor's authority position | IRONROOT (authority ≥ 0.65) | LOW |
| 4 | `system_defensiveness` | 2 | `authority_protection` / authority | "depends on NEW_AXIS=authority adoption" | system defensiveness as authority protection mechanism | IRONROOT (authority ≥ 0.65) | LOW |

**Aggregate**: 18 occurrences across 4 rows. Phase 2 deferred per HIGH+MEDIUM-only admit rule. AL-2-C decision = ratify Council CSV target OR redirect.

---

## §3 Phase 4 alias — 7 rows (existing canonical merge candidates)

These 7 rows propose merging into existing canonical-5 anchors but at LOW confidence per Council CSV.

| # | pattern_family | freq | proposed canonical | Council CSV rationale | dest archetype impact | confidence |
|--:|---|--:|---|---|---|:--:|
| 5 | `avoidance_behavior` | 9 | `delegation_deflection` (conflict) | "generic name; ideally scenario-author rename to specific mechanism" | STILLWATER (conflict ≤ 0.40) ↑ likelihood | LOW |
| 6 | `closure_rush` | 4 | `future_deferral` (time) | "could alternatively map to integrity_compromise (premature closure as principle compromise); time framing chosen for axis-dimension cleanness" | (no archetype gates time) — alt would gate STILLWATER/CLEARANCHOR via integrity | LOW |
| 7 | `accountability_application` | 2 | `explanation_substitution` (accountability) | "exit direction of accountability dimension; current_axis literal `integrity` is empirical drift" | CLEARANCHOR/TRUEBEARING accountability gate | LOW |
| 8 | `boundary_definition` | 1 | `repair_avoidance` (repair) | "repair-dimension exit" | STILLWATER/QUIETFLAME repair gate | LOW |
| 9 | `misuse_correction` | 1 | `repair_avoidance` (repair) | "repair-dimension exit" | STILLWATER/QUIETFLAME repair gate | LOW |
| 10 | `re_engagement` | 1 | `repair_avoidance` (repair) | "repair-dimension exit" | STILLWATER/QUIETFLAME repair gate | LOW |
| 11 | `visible_correction` | 1 | `repair_avoidance` (repair) | "repair-dimension exit" | STILLWATER/QUIETFLAME repair gate | LOW |

**Aggregate**: 19 occurrences across 7 rows. 4 of 7 (rows 8-11) are exit-direction repair signals — semantically signal the *opposite* valence from `repair_avoidance` (entry direction). Their merge would conflate entry/exit penalty wiring (lossy per spec §4.1).

---

## §4 group_conformity Focused Audit (Phase 2 V-1-A deferred)

**Cross-reference**: §2 row #2.

### §4.1 Phase 2 V-1-A deferred reason

- Council CSV note: "could alternatively go to control axis"
- Phase 2 V-1-A lock: `reputation_protection` cluster Phase 2 alias = 0 entry
- Anchor preserve: visibility axis still wired via [buildFingerprintInput.ts:35](../bty-app/src/lib/bty/archetype/buildFingerprintInput.ts#L35) — `pen("reputation_protection", relationalBias)`

### §4.2 Audit dimension

| axis candidate | semantic alignment | archetype impact | downside |
|---|---|---|---|
| **control** (`self_protection` cluster) | group conformity = self-conformity dynamics; in-group dominance | IRONROOT (control ≥ 0.65) ↓ likelihood | overloads control cluster (already 5 entries); semantic anchor is "self_protection", not group |
| **visibility** (`reputation_protection` cluster) | group conformity = group reputation / social visibility | OPENHAND (visibility ≥ 0.65) ↓ likelihood | reverses Phase 2 V-1-A lock; only 1 entry would join visibility cluster |
| **DEPRECATE** | meta belonging narrative; not a behavioral distortion | none | loses 4 occurrences of empirical signal |

### §4.3 Production evidence

- 0 user_pattern_signatures rows for `group_conformity` (5 production users)
- inactive-state proof intact

### §4.4 Decision options

- **Option group_conformity-A**: control axis lock — add `group_conformity → self_protection` alias to Phase 2 control cluster
- **Option group_conformity-B**: visibility axis lock — unlock V-1-A; add `group_conformity → reputation_protection` alias
- **Option group_conformity-C**: DEPRECATE — defer to Housekeeping (lose 4 occurrences)

---

## §5 Aggregate impact analysis

If Commander ratifies all 11 rows per Council CSV target (worst-case sensitivity):

| canonical anchor | new alias additions | archetype gating density |
|---|---:|---|
| `self_protection` (control, IRONROOT) | +1 (private_intention) | ~6 entries |
| `reputation_protection` (visibility, OPENHAND) | +1 (group_conformity) | ~1 entry (still sparse) |
| `authority_protection` (authority, IRONROOT) | +2 (successor_protection, system_defensiveness) | ~7 entries |
| `delegation_deflection` (conflict, STILLWATER) | +1 (avoidance_behavior) | ~6 entries |
| `future_deferral` (time, no archetype gate) | +1 (closure_rush) | unchanged |
| `explanation_substitution` (accountability, CLEARANCHOR/TRUEBEARING) | +1 (accountability_application) | ~7 entries |
| `repair_avoidance` (repair, STILLWATER/QUIETFLAME) | +4 (boundary_definition, misuse_correction, re_engagement, visible_correction) | ~8 entries |
| **Total alias additions** | **+11** | dictionary 52 → 63 |

But: 4 of 11 rows (boundary_definition, misuse_correction, re_engagement, visible_correction) are **exit-direction** signals merging into entry-direction canonical. Per spec §4.1 lossy-encoding caveat, this conflates "active mature repair behavior" with "active repair avoidance" — semantic invariant violation candidate.

---

## §6 Semantic decision surface (Hanbit Commander 영역)

Per row × decision options enumerated in [decision-template.csv](AL-2-C-R3-decision-template.csv) §R3.3.1-§R3.3.11.

Cross-cutting concerns for Commander:

1. **Exit-direction merge concern** (rows 8-11): merging exit-direction families into entry-direction canonicals is semantically lossy. Alternative: DEPRECATE these 4 rows OR introduce explicit direction flag (Method Y precondition).
2. **avoidance_behavior generic-name concern** (row 5): freq=9 is non-trivial, but Council notes "ideally scenario-author rename" — points to AL-2-E coupling (rename in scenario JSON instead of merge).
3. **closure_rush dual-axis concern** (row 6): future_deferral (time) vs integrity_compromise (integrity) — Commander chooses which axis dimension takes precedence.
4. **group_conformity 3-way** (row 2 / §4): control vs visibility vs DEPRECATE — V-1-A reversal vs preservation.

---

## §7 Output → decision-template.csv

11 row decisions populate [decision-template.csv](AL-2-C-R3-decision-template.csv) §R3.3.1-§R3.3.11 (4 NEW_AXIS-dep + 7 Phase 4 alias rows).
group_conformity focused audit options populate §R3.4 (cross-reference to §R3.3.2).

Force-map invariant honored: no axis assignment imposed; all 11 rows enter R3 with multiple option lanes.
