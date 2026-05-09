# AL-2-A Vocabulary Lineage — 4 Layer Inventory

**Status**: Audit phase only (AL-2-A scope, no mutation)
**Date**: 2026-05-08
**Predecessor**: AL-1.9-D R3 inventory (docs/AL-1.9-D-r3-inventory.md)

---

## Frame purpose

BTY 안 vocabulary 가 4 layer 분리. 각 layer 의 source / authority / cross-layer mapping 영역을 evidence-only inventory.

Canonical preservation bias 회피 — production vocabulary (scenario data) 가 BTY behavioral richness 의 actual production source. Canonical 5 가 "정답" 가정 0.

---

## Layer 1 — Canonical AxisVector (BTY core axis, lowercase 12 dim)

### Source
- [src/lib/bty/archetype/rules.ts](../bty-app/src/lib/bty/archetype/rules.ts) — `RULE_REGISTRY` 의 `axis` field
- [src/lib/bty/archetype/fingerprint.ts] — `AxisVector` type definition

### Vocabulary (12 keys, lowercase single-word)
```
ownership, time, authority, truth, repair, conflict,
integrity, visibility, accountability, courage, control, identity
```

### Authority scope
- Authoritative for: archetype rule matching (rules.ts conditions), fingerprint hash, selectArchetype 알고리즘
- ENTRY_THRESHOLD / EXIT_THRESHOLD 의 axis dimension reference

### Cross-layer mapping
- → Layer 2 (`bty_tension_axis`): mapping 0 (vocabulary overlap 0)
- → Layer 3 (scenario capitalized): mapping 0
- → Layer 4 (scenario labeled): mapping 0

### Spec authority
- ARCHETYPE_DETERMINISM_LOCK_V1.md § 5.1 (STILLWATER 정의 conditions)
- ARCHETYPE_DETERMINISM_LOCK_V1.md § 5.2~§ 5.7 (other archetypes)
- § 0 L18: AL-2 reservation = "axis 구조 재설계"

---

## Layer 2 — bty_tension_axis (QR/behavior layer, title-case sentence)

### Source
- [src/lib/bty/arena/eliteScenariosCanonical.server.ts:44](../bty-app/src/lib/bty/arena/eliteScenariosCanonical.server.ts#L44) — type field declaration
- [src/lib/bty/arena/chainWorkspaceToEliteScenario.server.ts:161,182,203](../bty-app/src/lib/bty/arena/chainWorkspaceToEliteScenario.server.ts#L161) — literal values
- [src/lib/bty/arena/ownRe02R1EliteScenario.server.ts:116](../bty-app/src/lib/bty/arena/ownRe02R1EliteScenario.server.ts#L116)

### Vocabulary (sentence form)
```
"Blame vs. Structural Honesty"
"Empathy Loyalty vs. Structural Authority"
"Operational Compliance vs. Patient Safety Integrity"
"Structural Honesty vs. Face-Saving"
... (additional elite scenarios)
```

### Authority scope
- Authoritative for: elite scenario lookup (`getEliteScenarioById`), ReexposureValidationPayload `before_axis` / `after_axis` field
- Stored in `user_pattern_signatures.axis` column (string form)
- QR validation / behavior snapshot reference

### Cross-layer mapping
- ← Layer 3 / Layer 4 (scenario JSON 안 axis literal): partial overlap 영역 미정 (scenario 의 capitalized + labeled axis 와 elite 의 title-case sentence 사이 mapping 0)
- → Layer 1 (canonical AxisVector): mapping 0

### Spec authority
- 0 (ARCHETYPE_DETERMINISM_LOCK_V1.md 안 `bty_tension_axis` mention 0)
- elite scenario authoring convention 영역

---

## Layer 3 — Scenario JSON axis literal (capitalized single-word)

### Source
- scenario JSON files (`src/data/scenario/core_*/{ko,en}.json`) — `axis` field 안 capitalized single-word value

### Vocabulary samples (frequency-weighted)
```
"Truth"          (top frequency in core_23_manager_truth_block 등)
"Conflict"       (core_06_external_exposure 등)
"Time"           (core_23, core_25 등)
"Authority"      (core_01, core_04 등)
"Ownership"      (core_01, core_03 등)
"Control"        (core_06 등)
"Repair"         (core_25, core_17 등)
"Integrity"      (multiple)
"Accountability" (multiple)
"Support"        (subset)
"belonging"      (lowercase outlier — adaptive_alignment family)
```

### Authority scope
- Authoritative for: scenario second_choice metadata, BINDING_V1_SECOND event meta (via `picked.axis` flow)
- Authored narrative anchor (writer-facing vocabulary)

### Cross-layer mapping
- → Layer 1 (canonical lowercase 12): partial overlap (`Truth` ↔ `truth`, `Conflict` ↔ `conflict`, `Time` ↔ `time`, `Authority` ↔ `authority`, `Ownership` ↔ `ownership`, `Repair` ↔ `repair`, `Integrity` ↔ `integrity`, `Accountability` ↔ `accountability`, `Control` ↔ `control`) — case-only difference
- Outlier: `Support` (Layer 1 미존재), `belonging` (lowercase outlier — adaptive_alignment family)

### Spec authority
- 0 (scenario JSON authoring convention, not formally specced)

---

## Layer 4 — Scenario JSON axis labeled form

### Source
- scenario JSON files — `axis` field 안 `"Axis N — Name"` long-form label

### Vocabulary samples
```
"Axis 1 — Ownership"
"Axis 2 — Time"
"Axis 3 — Authority"
"Axis 4 — Truth"
... (additional labeled axes)
```

### Authority scope
- Authoritative for: scenario authored narrative reference (writer-facing, more verbose form)
- BINDING_V1_SECOND event meta 안 직접 stored (label form 그대로 passes through)

### Cross-layer mapping
- → Layer 3 (capitalized): same content + label prefix (e.g. `"Axis 4 — Truth"` ↔ `"Truth"`) — label suffix matches Layer 3
- → Layer 1: same as Layer 3 mapping (case-only difference + label prefix strip)

### Spec authority
- 0 (scenario authoring convention)

---

## Cross-layer summary table

| layer | source | vocabulary form | authority scope | spec authority |
|---|---|---|---|---|
| 1 — canonical AxisVector | rules.ts + fingerprint.ts | lowercase 12 | rule engine matching | ARCHETYPE_DETERMINISM_LOCK_V1.md |
| 2 — bty_tension_axis | eliteScenariosCanonical.server.ts | title-case sentence | elite scenario / QR / payload.axis | 0 |
| 3 — scenario capitalized | scenario JSONs | "Truth", "Conflict", ... | scenario second_choice metadata | 0 |
| 4 — scenario labeled | scenario JSONs | "Axis N — Name" | scenario narrative anchor | 0 |

### Cross-layer mapping status

| from → to | overlap | translation | status |
|---|---|---|---|
| 1 → 2 | 0 | none | gap |
| 1 → 3 | partial (case-only) | none | gap (despite case-only difference) |
| 1 → 4 | partial (case + label prefix) | none | gap |
| 2 → 3/4 | partial (single token contained in sentence) | none | gap |
| 3 → 4 | full (label prefix added/stripped) | none | label form is verbose variant |

---

## Pattern_family vocabulary lineage (separate from axis lineage)

R3 phase 5 evidence anchor:

| layer | source | count | sample |
|---|---|---|---|
| Pattern Layer A (canonical) | src/domain/pattern-family.ts:5-11 | 5 | ownership_escape, repair_avoidance, explanation_substitution, delegation_deflection, future_deferral |
| Pattern Layer B (compatibility map) | src/data/scenario/index.ts:542-556 | 13 (5 canonical + 8 non-canonical) | [see compat map cross-ref] |
| Pattern Layer C (scenario JSON) | scenario JSONs | 110 unique / 748 occurrences | truth_naming (89), future_deferral (70), conflict_avoidance (34), ... |
| Pattern Layer D (production) | user_pattern_signatures | 4 distinct (5 rows / 3 users) | truth_naming, integrity_compromise, reputation_protection, performance_blame |

→ Pattern vocabulary 도 4 layer. Layer C → Layer D 의 normalization 영역 0 (scenario JSON 그대로 production 저장).

---

## Authoritative gap inventory

| gap | impact area | evidence |
|---|---|---|
| Layer 1 ↔ Layer 3 case difference | rule matching 영역 미연결 | rules.ts axis = `"conflict"`, scenario axis = `"Conflict"` |
| Layer 1 ↔ Pattern Layer A (5 vs 12) | axis penalty wiring 5/12 | buildFingerprintInput.ts pen() 5 sites |
| Pattern Layer A ↔ Pattern Layer C (5 vs 110) | scenario coverage 14.3% | R3 phase 5 T1 evidence |
| Pattern Layer B normalization 0 | compatibility map dead | rg `patternFamilyCompatibilityMap` import = 0 |
| Layer 2 spec authority 0 | elite scenario vocabulary unspecced | ARCHETYPE_DETERMINISM_LOCK_V1.md 안 cite 0 |
| Layer 3/4 spec authority 0 | scenario authoring vocabulary unspecced | spec 안 axis literal 정의 0 |
