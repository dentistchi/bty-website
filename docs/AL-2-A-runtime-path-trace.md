# AL-2-A Runtime Path Trace — 6 path × vocabulary authority

**Status**: Audit phase only (AL-2-A scope, no mutation)
**Date**: 2026-05-08
**Companion**: docs/AL-2-A-vocabulary-lineage.md

---

## Frame purpose

각 runtime path 별 vocabulary input/output authority + translation 영역 + mismatch 발생 영역 evidence-only trace. Pattern_family + axis 두 vocabulary track.

---

## Path 1 — Selector (rule engine)

### Path
```
fingerprintInput → selectArchetype(axisVector) → RULE_REGISTRY filter → SelectedArchetype
```

### Vocabulary
- Input: `AxisVector` (Layer 1, canonical lowercase 12 dim)
- Authority: [src/lib/bty/archetype/selector.ts:33](../bty-app/src/lib/bty/archetype/selector.ts#L33), [rules.ts](../bty-app/src/lib/bty/archetype/rules.ts) RULE_REGISTRY
- Output: `SelectedArchetype.name` (canonical archetype name: STILLWATER, NIGHTFORGE, ...)

### Translation
- 0 (input은 이미 canonical AxisVector form, RULE_REGISTRY가 동일 vocabulary로 matching)

### Mismatch surface
- 직접 mismatch 0 (input ↔ matching 동일 layer)
- 단 input 산출 path (Path 3 fingerprint) 의 vocabulary 가 다른 layer 와 mismatch 시 영향 받음

### File:line evidence
- selector.ts:33-62 — selectArchetype implementation
- rules.ts:19-78 — RULE_REGISTRY (7 archetypes)
- rules.ts:84-91 — ruleMatches function

---

## Path 2 — Penalty wiring (axis vector 산출 시 pattern penalty 적용)

### Path
```
patterns: UserPatternSignaturePublic[] → activePatterns Set → pen() check → axis -0.30
```

### Vocabulary
- Input pattern_family: Pattern Layer D (production user_pattern_signatures) → flowing as Pattern Layer C/scenario vocabulary
- Penalty check argument: Pattern Layer A (canonical 5) only
- Output: AxisVector (Layer 1)

### Translation
- 0 (lowercase normalization only — `p.pattern_family.toLowerCase()`)
- 정식 normalization wiring 부재 (compatibility map 미적용)

### Mismatch surface
- **Critical**: production patterns (Pattern Layer C/D vocabulary) 가 canonical 5 (Pattern Layer A)에 매칭되지 않으면 penalty 미발동
- R3 phase 5 evidence: 110 scenario family 중 canonical 5 등장 = 4/5 (ownership_escape 부재), 운영 user_pattern_signatures 안 canonical 0 hits

### File:line evidence
- [buildFingerprintInput.ts:23-25](../bty-app/src/lib/bty/archetype/buildFingerprintInput.ts#L23-L25) — `activePatterns` Set 산출 + `pen()` 정의
- buildFingerprintInput.ts:28-39 — 5 pen() call sites:
  - L28: `pen("ownership_escape", relationalBias)` → axis: ownership
  - L29: `pen("future_deferral", emotionalRegulation)` → axis: time
  - L32: `pen("repair_avoidance", TII)` → axis: repair
  - L33: `pen("delegation_deflection", operationalBias)` → axis: conflict
  - L36: `pen("explanation_substitution", AIR)` → axis: accountability

### Production effect
- 5 axis penalty wiring × Pattern Layer A canonical
- Pattern Layer A canonical 의 production user_pattern_signatures 등장 = 0
- → 5 penalty wiring 운영 발동 빈도 = 0
- → `axisVector.{ownership, time, repair, conflict, accountability}` = base metric (no penalty)

---

## Path 3 — Fingerprint (FingerprintInput 산출)

### Path
```
signals (bty_arena_signals) + patterns (user_pattern_signatures) + counts
  → buildFingerprintInput → FingerprintInput { axisVector, patternFamilies, scenariosCompleted, contractsCompleted }
  → buildArchetypeFingerprint hash
```

### Vocabulary
- Input signals: ArenaSignal type (`meta: {relationalBias, operationalBias, emotionalRegulation}` numeric)
- Input patterns: user_pattern_signatures rows (Pattern Layer C/D vocabulary)
- Output axisVector: Layer 1 (canonical lowercase 12)
- Output patternFamilies: pattern_family list (Pattern Layer C/D vocabulary, NOT normalized)

### Translation
- signals → axis: numeric metric mapping (computeMetrics)
- patterns → axis: Pattern Layer A penalty check (Path 2)
- patterns → patternFamilies field: identity (no normalization)

### Mismatch surface
- Output `patternFamilies` 의 vocabulary 가 Pattern Layer C/D form 으로 fingerprint hash 에 직접 들어감
- FingerprintInput hash 의 stability = pattern vocabulary stability 의존

### File:line evidence
- [buildFingerprintInput.ts:14-48](../bty-app/src/lib/bty/archetype/buildFingerprintInput.ts#L14-L48) — full function
- [computeMetrics.ts:17-64](../bty-app/src/features/arena/logic/computeMetrics.ts#L17-L64) — signals → metrics
- buildFingerprintInput.ts:42-47 — return object:
  ```ts
  return {
    axisVector,
    patternFamilies: patterns.map((p) => p.pattern_family),  // ← no normalization
    scenariosCompleted,
    contractsCompleted,
  };
  ```

---

## Path 4 — AIR/LRI (computeMetrics → leadership state)

### Path
```
signals → computeMetrics → LeadershipMetrics { AIR, TII, biases, ... }
  → computeLeadershipState (with archetypeName override)
  → mergeLeadershipReflectionLayer → LeadershipState (UI render)
```

### Vocabulary
- Input: ArenaSignal (numeric meta + traits)
- Output: LeadershipMetrics + LeadershipState (numeric scores + label strings via i18n)

### Translation
- 0 vocabulary translation — numeric 영역
- archetypeName override (selector output) → leadership state codeName field

### Mismatch surface
- 직접 vocabulary mismatch 0 (numeric path)
- 단 archetypeName override 의 input source = Path 1 (selector)

### File:line evidence
- [computeMetrics.ts](../bty-app/src/features/arena/logic/computeMetrics.ts) — full path
- [computeLeadershipState.ts:7](../bty-app/src/features/my-page/logic/computeLeadershipState.ts#L7) — `DEFAULT_CODE_NAME = "STILLWATER"` (UI fallback)
- [getMyPageIdentityState.ts:90-92](../bty-app/src/lib/bty/identity/getMyPageIdentityState.ts#L90-L92) — metrics + leadershipState merge

---

## Path 5 — Re-exposure (validation → user_pattern_signatures upsert)

### Path
```
arena_events (BINDING_V1_SECOND meta)
  → fetchSecondChoiceConfirmedRow → metaPatternFamily / metaDirection
  → ReexposureValidationPayload {after_pattern_family, after_axis}
  → upsertUserPatternSignatureFromValidation
  → user_pattern_signatures upsert
```

### Vocabulary
- Source pattern_family: scenario JSON `picked.pattern_family` (Pattern Layer C, ~110 unique)
- Source axis: `elite.bty_tension_axis` (Layer 2, title-case sentence)
- Stored: `user_pattern_signatures.pattern_family` + `user_pattern_signatures.axis`

### Translation
- normalizeFamilyKey:
  - `normalizePatternFamilyId(raw)` — only "explanation" legacy alias normalize
  - else: `raw.toLowerCase()` if normalize result null
- → 사실상 identity transform (toLowerCase only)
- compatibilityMap: 0 application (dead artifact, T5 evidence)

### Mismatch surface
- **Critical**: pattern_family stored 그대로 (Pattern Layer C vocabulary) — Pattern Layer A canonical 로 normalize 미수행
- axis stored 그대로 (Layer 2 sentence) — Layer 1 canonical 로 normalize 미수행
- → 운영 user_pattern_signatures 의 pattern_family / axis 가 Pattern Layer A / Axis Layer 1 와 vocabulary mismatch
- → Path 2 penalty wiring 발동 0

### File:line evidence
- [arena/choice/route.ts:758-784](../bty-app/src/app/api/arena/choice/route.ts#L758-L784) — BINDING_V1_SECOND event meta INSERT
- [reexposureValidation.server.ts:55-82](../bty-app/src/lib/bty/arena/reexposureValidation.server.ts#L55-L82) — fetchSecondChoiceConfirmedRow
- reexposureValidation.server.ts:194-289 — payload 산출
- [patternSignatureUpsert.server.ts:21-117](../bty-app/src/lib/bty/arena/patternSignatureUpsert.server.ts#L21-L117) — upsert path
- patternSignatureUpsert.server.ts:13-19 — normalizeFamilyKey (toLowerCase only fallback)
- patternSignatureUpsert.server.ts:111-113 — sole user_pattern_signatures INSERT

---

## Path 6 — Foundry narrative (mythos / description)

### Path
```
SelectedArchetype.name → archetype description / mythos i18n key → UI render
SelectedArchetype.name → Foundry path entry (별 system)
```

### Vocabulary
- Input: archetype name (canonical: STILLWATER, NIGHTFORGE, ...)
- Output: description / mythos string (i18n authored copy)

### Translation
- archetype name → i18n key (1:1 mapping)
- archetype name → Foundry path identifier (별 mapping)

### Mismatch surface
- 직접 vocabulary mismatch 0 (archetype name 만 input)
- 단 Foundry path / mythos / description 의 authoring vocabulary 가 Pattern Layer C/Layer 3 영역 (writer-facing)
- → Path 6 의 narrative authoring 이 Pattern Layer C 영역 → Path 5 storage 와 vocabulary 정합 (writer 의 직관 정합)

### File:line evidence
- [src/lib/i18n.ts](../bty-app/src/lib/i18n.ts) — archetype description / mythos i18n keys
- ARCHETYPE_DETERMINISM_LOCK_V1.md § 5.1 — STILLWATER 의 "의미" / "Shadow Pattern" / "Growth Edge"
- spec § 0 L18: AL-2 reservation = "archetype 의미/서사/Foundry path 재설계"

---

## Cross-path summary

| path | vocabulary input | vocabulary output | translation | mismatch effect |
|---|---|---|---|---|
| 1 Selector | Layer 1 axisVector | canonical archetype name | 0 | 0 (input/output 동일) |
| 2 Penalty wiring | Pattern Layer C/D | Layer 1 axisVector | toLowerCase only | **5 wiring 운영 발동 0** |
| 3 Fingerprint | signals + patterns | axisVector + patternFamilies | numeric + identity | hash stability ↔ vocabulary stability |
| 4 AIR/LRI | numeric signals | numeric scores | 0 | 0 |
| 5 Re-exposure | Layer 2 + Pattern Layer C | user_pattern_signatures storage | toLowerCase fallback only | **storage 가 canonical 와 misalign** |
| 6 Foundry narrative | canonical archetype name | i18n authored copy | 1:1 | 0 (narrative authoring 영역) |

### Critical translation gaps

1. **Path 5 storage vocabulary** = Pattern Layer C/D form (110 unique pattern_family, sentence-form axis)
2. **Path 2 penalty wiring** = Pattern Layer A canonical only (5 wiring × 1 toLowerCase)
3. **gap = Path 5 → Path 2 normalization wiring 0** (compatibilityMap dead, T5 evidence)
4. → **operational consequence**: Path 5 가 Pattern Layer A 로 normalize 안 하므로 Path 2 penalty 발동 0 → axis vector 가 base metric 그대로 → STILLWATER cutoff 충족 0 (R3 phase 3 T6-C evidence: 5/5 users fail)

---

## AL-2 mapping decision dependency

AL-2-A audit phase 의 4 layer × 6 path inventory 가 AL-2-B (patternRequires 재정의) / AL-2-C (archetype 의미 재설계) / AL-2-D (FINGERPRINT_VERSION bump) 의 input.

본 doc = decision input only. Mapping decision 자체는 별 product session (BTY Semantic Council) 영역.
