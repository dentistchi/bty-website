# AL-2-C R3: delegation_deflection ↔ conflict_avoidance Anchor Swap Review

**Sprint context**: AL-2-C R3 (Council Flag 2 carry-forward from AL-2-B)
**Date**: 2026-05-09
**Decision authority**: Hanbit Commander
**Force-map invariant**: anchor swap = R3 audit + option only; decision = Commander

---

## §1 Current state (AL-2-B closure)

### Canonical anchor (Phase 1 wired)
- [pattern-family.ts:9](../bty-app/src/domain/pattern-family.ts#L9) — `CANONICAL_PATTERN_FAMILIES` includes `"delegation_deflection"`
- [buildFingerprintInput.ts:33](../bty-app/src/lib/bty/archetype/buildFingerprintInput.ts#L33) — `conflict: pen("delegation_deflection", operationalBias)`
- frequency: **21** (Council CSV anchor row)

### Alias (Phase 1 cluster)
- [pattern-family.ts:42](../bty-app/src/domain/pattern-family.ts#L42) — `conflict_avoidance: "delegation_deflection"`
- frequency: **34** (Council CSV merge row)

### Cardinality reversal
| family | freq | role |
|---|--:|---|
| `conflict_avoidance` | 34 | merged (alias) |
| `delegation_deflection` | 21 | canonical (anchor) |
| **delta** | **+13** | merged > anchor |

Semantic prototypicality mismatch: `conflict_avoidance` is empirically more common AND is the semantic-archetype name for conflict-axis distortion; `delegation_deflection` is one specific *mechanism* of conflict avoidance.

### v1 lock evidence
- AL-2-B Phase 1 + Phase 2 + Phase 3 preserved this v1 anchor lock ✓
- AL-2-C R3 = audit only, no swap ✓

---

## §2 Anchor swap rationale (Council CSV cite)

Per [AL-2-A-mapping-decision-template.csv](AL-2-A-mapping-decision-template.csv) row `conflict_avoidance` (notes column):

> "MEDIUM; semantically conflict_avoidance is the prototypical name and delegation_deflection is a sub-mechanism; cleaner ontology would invert (conflict_avoidance as anchor) but preserves canonical 5 stability for v1; AL-2-C may swap"

Spec rationale support: ARCHETYPE_DETERMINISM_LOCK_V1.md §4.1 lists `conflict_avoidance` (not `delegation_deflection`) as the canonical illustrative pattern for `axisVector.conflict` penalty — but the actual code uses `delegation_deflection`. Spec/code drift confirmed.

> | conflict_avoidance 패턴 | axisVector.conflict에 -0.30 페널티 | conflict |

---

## §3 Swap impact analysis

### §3.1 Code impact

#### `bty-app/src/domain/pattern-family.ts`

Current (Phase 1 wired):
```ts
export const CANONICAL_PATTERN_FAMILIES = [
  "ownership_escape",
  "repair_avoidance",
  "explanation_substitution",
  "delegation_deflection",        // ← swap candidate
  "future_deferral",
] as const;

const PATTERN_FAMILY_ALIAS = {
  // ... conflict cluster ...
  silence_avoidance: "delegation_deflection",
  silence_normalization: "delegation_deflection",
  conflict_avoidance: "delegation_deflection",  // ← swap candidate
  stability_preservation: "delegation_deflection",
  silence_alignment: "delegation_deflection",
};
```

Post-swap (Option swap-A):
```ts
export const CANONICAL_PATTERN_FAMILIES = [
  "ownership_escape",
  "repair_avoidance",
  "explanation_substitution",
  "conflict_avoidance",           // swapped
  "future_deferral",
] as const;

const PATTERN_FAMILY_ALIAS = {
  silence_avoidance: "conflict_avoidance",
  silence_normalization: "conflict_avoidance",
  delegation_deflection: "conflict_avoidance",  // reversed
  stability_preservation: "conflict_avoidance",
  silence_alignment: "conflict_avoidance",
};
```

#### `bty-app/src/lib/bty/archetype/buildFingerprintInput.ts:33`

Current:
```ts
conflict: pen("delegation_deflection", operationalBias),
```

Post-swap:
```ts
conflict: pen("conflict_avoidance", operationalBias),
```

#### `bty-app/src/data/source_scenarios_index.json` + scenario JSONs (Lock 5 boundary)

- `bty_tension_axis: "Conflict Avoidance vs. Cultural Ownership"` (already in [tensionAxisToAxisVector.ts](../bty-app/src/lib/bty/archetype/tensionAxisToAxisVector.ts) Set 2 lock → conflict)
- No change required — Layer 2 sentence vocabulary already favors "Conflict Avoidance" prototypicality.

#### Tests
- [pattern-family.test.ts](../bty-app/src/domain/pattern-family.test.ts) — 5 tests, currently asserts `isCanonicalPatternFamily("explanation_substitution")` and legacy alias. Need adjustment: `isCanonicalPatternFamily("conflict_avoidance")` becomes true; `isCanonicalPatternFamily("delegation_deflection")` becomes false.
- ad-hoc Phase 2 verify (`conflict_avoidance → delegation_deflection`) — would need inversion to `delegation_deflection → conflict_avoidance`.

### §3.2 Production data impact

| table | swap impact |
|---|---|
| `bty_arena_signals` | 0 historical rows for relevant axes (per AL-2-B Phase 1+2 24h post-deploy = 0 traffic). No impact. |
| `user_pattern_signatures.pattern_family` | Verify required (Hanbit SQL): if any production row carries `pattern_family="delegation_deflection"`, alias normalization at READ via `normalizePatternFamilyId()` resolves it to `conflict_avoidance` post-swap. Raw flow preserved (Lock 7 carry-forward); read-side normalization handles legacy data. |
| `bty_archetype_naming_locks` | indirect: 38ce28d2 (QUIETFLAME) and 85bd8f1f (STILLWATER) locks computed from axisVector, not pattern names. Anchor swap would not affect existing locks unless axisVector recomputation fires. Lock 4 invariant + § 7 lock-storage atomicity preserved. |

### §3.3 Archetype impact (Lock 4)

Per [AL-2-C-R3-archetype-inventory.md](AL-2-C-R3-archetype-inventory.md) §4 + §7 production locks:

| archetype | conflict-axis dependency | swap impact |
|---|---|---|
| STILLWATER | `conflict ≤ 0.40` | None at axis level — pen() output for active conflict-axis pattern still drops conflict by −0.30. The *family name* feeding pen() changes from `delegation_deflection` to `conflict_avoidance`, but the penalty is identical. |
| (others) | none gate conflict | No impact |

**Determinism risk**: 0 if pen()-input invariant preserved (`activePatterns.has("conflict_avoidance")` becomes the new gate rather than `activePatterns.has("delegation_deflection")`). Provided `normalizePatternFamilyId` correctly aliases legacy production data forward, archetype assignment is preserved.

### §3.4 ARCHETYPE_DETERMINISM_LOCK_V1.md spec impact

§4.1 already lists `conflict_avoidance` as the canonical conflict-axis pattern (spec was correct; code was wrong). Swap aligns code with spec — no spec mutation required. §11.2 spec drift CI check would actually IMPROVE post-swap (the existing drift would be resolved).

§5.1 STILLWATER `조건 근거` text mentions `conflict_avoidance` in the rationale: "`conflict ≤ 0.40`: `conflict_avoidance` 패턴 active 시 baseline에서 -0.30 적용." Spec/code alignment IMPROVED post-swap.

---

## §4 Decision options

### Option swap-A — Full anchor swap (conflict_avoidance becomes canonical)
- Mutate: `pattern-family.ts` (CANONICAL list + alias dict reverse), `buildFingerprintInput.ts:33` (pen() call), `pattern-family.test.ts` (assertion update)
- Mutation count: 3 files
- Spec drift: resolves §4.1 ↔ code mismatch ✓
- Risk: cumulative mutation across AL-2-C; new fingerprint hash (ALERT: pen() input string change → axisVector input → fingerprint hash drift → existing `bty_archetype_naming_locks` may need recompute or hash invalidation)
- **Hidden risk**: FINGERPRINT_VERSION bump may be required (Lock 6 unlock — AL-2-D coupling)

### Option swap-B — Preserve v1 lock (delegation_deflection remains canonical)
- Mutate: 0 in AL-2-C
- Cardinality reversal preserved
- Spec drift unresolved (rules.ts + buildFingerprintInput.ts vs ARCHETYPE_DETERMINISM_LOCK_V1.md §4.1)
- Docs cite refresh only (this doc + AL-2-C-R3-archetype-inventory.md)
- **Recommended default for v1 stability**: yes per AL-2-B v1 lock carry-forward

### Option swap-C — Hybrid (alias dict reverse only, pen() preserved)
- Mutate: `pattern-family.ts` alias dict reverse only
- Keep `pen("delegation_deflection", operationalBias)` unchanged
- Result: alias dict says `delegation_deflection → conflict_avoidance`, pen() looks up `delegation_deflection` in `activePatterns` (which is built from raw `pattern_family` values → never normalized)
- **Hidden defect**: this would make pen() **never fire** for either family because:
  - `activePatterns` is built from raw `p.pattern_family.toLowerCase()` ([buildFingerprintInput.ts:23](../bty-app/src/lib/bty/archetype/buildFingerprintInput.ts#L23)), which doesn't pass through `normalizePatternFamilyId`
  - production data with `pattern_family="conflict_avoidance"` populates `activePatterns` set with key `"conflict_avoidance"`
  - pen() searches for `"delegation_deflection"` → miss → no penalty applied
- → Option swap-C **would silently disable conflict-axis penalty wiring**. NOT recommended without first wiring `normalizePatternFamilyId` into `activePatterns` Set construction (separate consumer mutation, Lock 6 violation).

---

## §5 ⚠ activePatterns normalization gap (R3 incidental finding)

[buildFingerprintInput.ts:23](../bty-app/src/lib/bty/archetype/buildFingerprintInput.ts#L23):
```ts
const activePatterns = new Set(patterns.map((p) => p.pattern_family.toLowerCase()));
```

This **does not** call `normalizePatternFamilyId`. Therefore the AL-2-B Phase 1+2 alias dictionary has **0 effect at the pen() lookup site** — alias resolution only happens in:
- Action contract validation flows (5 sites, P0 cite)
- `patternSignatureUpsert.server.ts:17` (write-side)
- `recordPatternSignal.ts:25` (write-side)

The `pen()` lookup at line 25 uses raw `pattern_family.toLowerCase()` Set membership. If production data carries `pattern_family="conflict_avoidance"` (raw), `pen("delegation_deflection", …)` won't fire.

**This is an architectural finding orthogonal to the anchor swap** but directly relevant. The intended Phase 1 alias semantic ("conflict_avoidance is recognized as conflict-axis distortion") is **not actually applied at the penalty wiring site**. Phase 1 alias dictionary normalizes inputs at write side (DB upsert) and contract validation, but the read side (`buildFingerprintInput`) uses raw values.

**AL-2-D backlog candidate**: wire `normalizePatternFamilyId` into `activePatterns` Set construction. This would make the alias dictionary actually drive penalty behavior at runtime.

Per Phase 1 24h verify = 0 post-deploy traffic, this gap has no observed production impact yet (no `user_pattern_signatures` rows mean `patterns` array is empty → `activePatterns` empty → all pen() calls return base regardless).

---

## §6 Decision option ratings

| option | mutation cost | spec drift resolved | runtime correctness | recommended for AL-2-C |
|---|---|---|---|---|
| swap-A (full swap) | 3 files | ✓ | ✓ (with FINGERPRINT_VERSION bump consideration) | only if AL-2-C accepts AL-2-D coupling |
| swap-B (preserve) | 0 files | ✗ | ✓ (current behavior) | **yes — v1 stability default** |
| swap-C (hybrid) | 1 file | partial | ✗ silently disables | **no — defective** |

---

## §7 Output → decision-template.csv

§R3.5.1: `delegation_deflection_swap` decision row.

Plus §6 surfaces an additional R3.5.2 candidate: **activePatterns normalization gap** (AL-2-D backlog vs AL-2-C inclusion).

Force-map invariant honored: no swap imposed; Commander chooses A/B/C.
