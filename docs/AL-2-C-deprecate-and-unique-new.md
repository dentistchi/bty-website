# AL-2-C DEPRECATE + Unique NEW (axis deferred)

**Sprint context**: AL-2-C mutation phase
**Decision authority**: Hanbit Commander (R3 decision lock)
**Date**: 2026-05-09
**Force-map invariant**: 4 row 영역 안 axis assignment 0 (deferred to future sprint)

---

## §1 DEPRECATE row (mutation 0)

### §1.1 `avoidance_behavior`

| field | value |
|---|---|
| Council CSV confidence | LOW |
| Council CSV `candidate_canonical` | `MERGE_INTO=delegation_deflection` |
| Council CSV `frequency` | 9 |
| R3.3.5 decision | **DEPRECATE** (override Council target) |
| Rationale | signal specificity too low; ontology density degradation risk |

#### Resolution path

- alias dictionary 추가 entry: **0**
- production data 등장 시: passthrough (no canonical match, raw flow preserved at write side via `normalizePatternFamilyId` returning `t` unchanged)
- future sprint candidate (AL-2-D / AL-2-E / Housekeeping): explicit deletion candidate (단 production data 영향 분석 선행)

#### Decomposition guidance (future scenario authoring, informational)

If scenarios eventually need to express `avoidance_behavior` semantics, suggested decomposition into existing/proposed canonical signals:

- `conflict_avoidance` (existing canonical via Phase 1 alias to `delegation_deflection`)
- `repair_avoidance` (existing canonical, Phase 1)
- `emotional_withdrawal` (candidate, not yet authored)
- `responsibility_avoidance` (candidate, not yet authored)

Authoring decisions remain Commander/Council scope (force-map invariant).

---

## §2 Unique NEW row (Option β, axis deferred, mutation 0)

### §2.1 `closure_rush`

| field | value |
|---|---|
| Council CSV `candidate_canonical` | `MERGE_INTO=future_deferral` (time) |
| Council CSV `frequency` | 4 |
| R3.3.6 decision | **unique NEW** (Option β, axis deferred) |
| Rationale | semantic compression loss too high under MERGE — distinct from time-axis deferral |

Distinctive semantic dimensions (not currently expressible in 12-dim AxisVector via single canonical):
- ambiguity intolerance
- forced resolution
- premature closure
- discomfort termination

| field | value |
|---|---|
| Axis assignment | **deferred** (force-map invariant 정합) |
| Future axis candidate (informational only) | time / control / identity |
| Forward sprint | AL-2-D OR future semantic sprint |
| Archetype interest | STILLWATER (premature closure as conflict avoidance proxy) / NIGHTFORGE (forced resolution as courage signal) |
| alias dictionary entry | 0 |

### §2.2 `boundary_definition`

| field | value |
|---|---|
| Council CSV `candidate_canonical` | `MERGE_INTO=repair_avoidance` (repair) |
| Council CSV `frequency` | 1 |
| R3.3.8 decision | **unique NEW** (Option β, axis deferred) |
| Rationale | simple distancing 영역 외; healthy boundary semantic preserve |

Distinctive semantic dimensions:
- self-definition
- relational perimeter
- psychological sovereignty

| field | value |
|---|---|
| Axis assignment | **deferred** |
| Future axis candidate (informational only) | identity / control |
| Forward sprint | AL-2-D OR future semantic sprint |
| alias dictionary entry | 0 |

Note: this is an **exit-direction** signal (mature boundary-setting). Merging into `repair_avoidance` (entry-direction) was the Council CSV target but R3 review judged this lossy per spec §4.1 entry/exit conflation caveat.

### §2.3 `re_engagement`

| field | value |
|---|---|
| Council CSV `candidate_canonical` | `MERGE_INTO=repair_avoidance` (repair) |
| Council CSV `frequency` | 1 |
| R3.3.10 decision | **unique NEW** (Option β, axis deferred) |
| Rationale | 복귀 패턴, distinct temporal semantic |

Distinctive semantic dimensions:
- reconnect
- resume trust
- return after rupture

| field | value |
|---|---|
| Axis assignment | **deferred** (temporal semantic distinct from current 12-dim layout) |
| Future axis candidate (informational only) | repair / time / ownership |
| Forward sprint | AL-2-D OR future semantic sprint |
| alias dictionary entry | 0 |

Note: **exit-direction** signal — same lossy concern as `boundary_definition` if forced into `repair_avoidance` canonical.

---

## §3 Force-map invariant

본 4 row 영역 안 axis assignment 영역 안 force-map 0:

- DEPRECATE 1 row (`avoidance_behavior`): alias dictionary 0 entry
- Unique NEW 3 row (`closure_rush`, `boundary_definition`, `re_engagement`): alias dictionary 0 entry, axis 0 assignment

"Implementation does not decide ontology" invariant 정합 ✓

Production runtime impact:
- 0 entry in `PATTERN_FAMILY_ALIAS` for these 4 families
- `normalizePatternFamilyId("avoidance_behavior")` → returns `"avoidance_behavior"` (raw passthrough)
- Same for all 3 unique NEW families
- `pen()` lookup at `buildFingerprintInput.ts:23-25` — these 4 family names appear in `activePatterns` Set as themselves; no canonical pen() call references them → no penalty applied
- (Compounding with R3.5.2 finding: `activePatterns` Set built from raw `pattern_family.toLowerCase()` bypasses alias dictionary regardless — these 4 families have no behavioral effect at runtime, both before and after AL-2-C)

---

## §4 Cross-reference

- [docs/AL-2-C-decision-lock.md](AL-2-C-decision-lock.md) — full 19-row lock (this doc = §2 detail)
- [docs/AL-2-C-R3-decision-template.csv](AL-2-C-R3-decision-template.csv) — R3 closure source
- [docs/AL-2-B-low-confidence-deferred.md](AL-2-B-low-confidence-deferred.md) — Phase 3 closure baseline
- [docs/AL-2-C-R3-low-row-archetype-resolution.md](AL-2-C-R3-low-row-archetype-resolution.md) — 11 LOW row inventory + exit-direction concern
