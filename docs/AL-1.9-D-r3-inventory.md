# AL-1.9-D R3 Inventory — STILLWATER strict matching scope verify

**Status**: NO-FIX CLOSE (R3 inventory only, AL-2 escalate)
**Date**: 2026-05-08
**Predecessor**: AL-1.9-C (My-page Stage display fix, STILLWATER caveat)
**Spec authority**: docs/specs/ARCHETYPE_DETERMINISM_LOCK_V1.md

---

## § 1. Sprint identity + R3 evidence-only outcome

### Sprint scope (implied from backlog cite)
- AL-1.9-D = backlog candidate (CURSOR_TASK_BOARD.md:3 + :21 cite — spec doc 0)
- Implied scope: "archetype mapping cutoff 검토" (CURSOR_TASK_BOARD.md:21)
- Predecessor anchor: AL-1.9-C closure caveat — "STILLWATER 표시는 별 layer (archetype cutoff strict — Gap 2)"

### R3 evidence-only outcome (4 phase complete)
- Phase 1: scope verify (AL-1.9-D actual scope wording)
- Phase 2: signature pipeline current state
- Phase 3: signals → axisVector path + STILLWATER cutoff feasibility
- Phase 4: pattern_family + axis source path

### No-fix close rationale (high-level)
R3 evidence base 에서 STILLWATER cutoff 충족 영역 = vocabulary unification 영역.
Vocabulary unification = spec § 0 L17 의 "구조 변경 금지" 위반 → AL-2 scope.
Forced fix 회피 = honest scope discipline. R3 evidence carry-over to AL-2.

---

## § 2. R3 Phase 1 — Scope verify

### AL-1.9-D 의 actual cite (only 2 hits in docs)

**[CURSOR_TASK_BOARD.md:3]** AL-1.9-E-P1.1-A LIVE entry, "다음 entry candidates":
> ...AL-1.9-B-2 verify · AL-1.9-D (archetype cutoff) · DB schema audit...

**[CURSOR_TASK_BOARD.md:21]** AL-1.9-C RESOLVED entry, caveat + 다음:
> Caveat: STILLWATER 표시는 별 layer (archetype cutoff strict — Gap 2, AL-1.9 series 차후 cycle backlog).
> 다음: AL-1.9-B (UX completion 분석) 또는 AL-1.9-D (archetype mapping cutoff 검토)

### Spec authority cite (AL-1.9-D scope envelope)

**[ARCHETYPE_DETERMINISM_LOCK_V1.md:11-15]** § 0 Sprint Discipline:
> AL-1.5에서는 Determinism Lock 신뢰성 복원이 우선이다.
> 7개 archetype 전체의 product-level 재정의는 AL-2로 넘긴다.
> STILLWATER는 spec drift의 진앙이므로 v1에서 완전 정의한다.

**[ARCHETYPE_DETERMINISM_LOCK_V1.md:17]** AL-1.7 reservation:
> AL-1.7: 운영 4주 데이터 기반 ENTRY/EXIT_THRESHOLD 미세조정. STILLWATER axis cutoff 매칭률 검증 및 ±0.05 범위 내 tuning만 허용. 구조 변경 금지 (pattern/axis 정의 변경 금지).

**[ARCHETYPE_DETERMINISM_LOCK_V1.md:18]** AL-2 reservation:
> AL-2: 7개 archetype product-level re-definition. axis 구조 재설계. patternRequires 재정의. archetype 의미/서사/Foundry path 재설계.

### AL-1.7 actual sprint vs reservation
- Spec § 0 L17 reservation = threshold tuning sprint
- AL-1.7 actual (CURRENT_TASK.md L41+L45, 2026-05-03~04, worker `27a8f394`) = AL17-0 Phase 1 BINDING_V1_SECOND meta fix (3 file)
- AL-1.7 Phase 2 ("signature fix vs alternative source vs cutoff adjustment") = deferred (spec § 10 L585-586)

→ AL-1.9-D 의 implied scope = AL-1.7 reservation 의 잔여 영역 + AL-1.9-C caveat 의 후속.

---

## § 3. R3 Phase 2 — Signature pipeline current state

### File:line evidence (sole INSERT path)
- [src/lib/bty/arena/patternSignatureUpsert.server.ts:111-113] — `from("user_pattern_signatures").upsert(...)` on `user_id,pattern_family,axis` conflict
- [src/app/api/arena/re-exposure/validate/route.ts:325] — sole production caller

### AL-1.7 Phase 1 fix landed (worker 27a8f394, 2026-05-04)
- **File 1** [src/app/api/arena/choice/route.ts:544-545,774-776] — tradeoff block direction + pattern_family meta 주입
- **File 2** [src/lib/bty/arena/reexposureValidation.server.ts:64] — `.in("event_type", ["SECOND_CHOICE_CONFIRMED", "BINDING_V1_SECOND"])`
- **File 3** [src/lib/bty/arena/patternSignatureUpsert.server.ts:35] — `[pattern_signature][skip]` warn log

### Production data (Hanbit SQL evidence, R3 phase 2 T6+T7)
- `user_pattern_signatures` row count: **5 rows / 3 users** (post AL-1.7 Phase 1 deploy 누적)
- pattern_family distribution: **4 distinct, 0 canonical**
  - `truth_naming`, `integrity_compromise`, `reputation_protection`, `performance_blame`
- canonical 5-list match: **0**
- `delegation_deflection` row count: **0** (STILLWATER conflict cutoff 충족 prerequisite missing)

### Spec § 10 L578-582 prediction validation
> 7개 archetype cutoff 어느 것도 운영에서 충족 불가능

→ AL-1.7 Phase 1 deploy 후 row 누적 시작했으나, vocabulary mismatch 로 axis penalty 발동 영역 밖. spec prediction 운영 입증.

---

## § 4. R3 Phase 3 — Signals → axisVector path + STILLWATER cutoff feasibility

### Pipeline evidence (verbatim cite)

**[buildFingerprintInput.ts:14-48]** axis vector 산출:
- input: `signals` (from `bty_arena_signals`), `patterns` (from `user_pattern_signatures`), counts
- `activePatterns = new Set(patterns.map(p => p.pattern_family.toLowerCase()))`
- `pen(family, base) = activePatterns.has(family) ? max(0, base - 0.3) : base`
- `axisVector.conflict = pen("delegation_deflection", operationalBias)`
- `axisVector.repair = pen("repair_avoidance", TII)`
- `axisVector.integrity = TII`

**[computeMetrics.ts:17-64]** signals → metrics:
- `relationalBias = relationalSum / count` (from `signal.meta.relationalBias`)
- `operationalBias = operationalSum / count` (from `signal.meta.operationalBias`)
- `TII = (integritySum + relationalSum) / (2 * count)` (Integrity trait + relationalBias)

### Production axis distribution evidence (Hanbit SQL T6-C)

| user_id | signals | avg_relational | avg_operational | avg_emotional |
|---|---|---|---|---|
| 85bd8f1f-... | 27 | 0.494 | 0.500 | 0.530 |
| 2322beb7-... | 20 | 0.524 | 0.486 | 0.630 |
| ee9d2075-... | 20 | 0.485 | 0.500 | 0.538 |
| 38ce28d2-... | 18 | 0.485 | 0.484 | 0.622 |
| 3c732192-... | 9 | 0.653 | 0.544 | 0.687 |

→ Spec § 10 L580 "axis 분포 baseline 0.50 ± 0.06" 운영 입증 (4/5 users in [0.484, 0.544] cluster).

### STILLWATER cutoff substitution

**[rules.ts:69-77]** STILLWATER conditions:
```ts
{ axis: "conflict",  max: 0.40 },
{ axis: "repair",    max: 0.40 },
{ axis: "integrity", min: 0.40, max: 0.70 },
```

#### Penalty 0 시 (current — `delegation_deflection` row count 0)

| user_id | conflict (=opBias) | conflict ≤ 0.40 |
|---|---|---|
| 85bd8f1f | 0.500 | ❌ |
| 2322beb7 | 0.486 | ❌ |
| ee9d2075 | 0.500 | ❌ |
| 38ce28d2 | 0.484 | ❌ |
| 3c732192 | 0.544 | ❌ |

→ **5/5 users fail STILLWATER `conflict ≤ 0.40` cutoff** under current production state.

#### Penalty -0.30 시 (가정 — `delegation_deflection` active 시)
- All 5 users: conflict ∈ [0.184, 0.244] → all ✅
- 단 production state 와 미정합 (가정 영역).

---

## § 5. R3 Phase 4 — Pattern_family + axis source mismatch

### 3-vocabulary mismatch evidence

#### Vocabulary 1 — Canonical (rules.ts + pattern-family.ts)
**[src/domain/pattern-family.ts:5-11]**:
```ts
export const CANONICAL_PATTERN_FAMILIES = [
  "ownership_escape",
  "repair_avoidance",
  "explanation_substitution",
  "delegation_deflection",
  "future_deferral",
] as const;
```

**[rules.ts axisVector keys]**: `conflict`, `repair`, `integrity`, `truth`, `accountability`, `ownership`, `time`, `authority`, `visibility`, `courage`, `control`, `identity` (lowercase, 12 dim).

#### Vocabulary 2 — Compatibility map (data/scenario/index.ts:542-556)
13 entries (5 canonical + 8 non-canonical):
- canonical: `repair_avoidance`, `delegation_deflection`, `future_deferral`, `explanation_substitution`
- non-canonical: `truth_naming`, `integrity_compromise`, `conflict_avoidance`, `ownership_act → ownership_claim`, `system_thinking → accountability_system`, `blame_shift → accountability_deflection`, `courage_act`, `control_fixation`, `self_protection → identity_drift`

→ identity-mapping (most pass through unchanged). Canonical normalization wiring 0.

#### Vocabulary 3 — Scenario data + axis literal
**[scenario JSON files]** pattern_family vocabulary:
- `truth_naming` (core_23, core_25)
- `integrity_compromise` (compatibility map + scenario JSONs)
- `reputation_protection` (core_25)
- `performance_blame` (core_01)
- (additional scenarios)

**[chainWorkspaceToEliteScenario.server.ts L161/182/203, ownRe02R1EliteScenario.server.ts:116]** `bty_tension_axis` literal (human-readable):
- `"Blame vs. Structural Honesty"`
- `"Empathy Loyalty vs. Structural Authority"`
- `"Operational Compliance vs. Patient Safety Integrity"`
- `"Structural Honesty vs. Face-Saving"`

→ scenario `bty_tension_axis` = title-case sentence. canonical `AxisVector` keys = lowercase 12 dim. **Vocabulary overlap 0.**

### Spec drift surface (§ 5.1 L261)

**[ARCHETYPE_DETERMINISM_LOCK_V1.md:261]**:
> conflict ≤ 0.40: conflict_avoidance 패턴 active 시 baseline에서 -0.30 적용. active 상태에서 자연스럽게 충족.

**[buildFingerprintInput.ts:33]**:
```ts
conflict: pen("delegation_deflection", operationalBias),
```

→ spec wording = `conflict_avoidance` (NOT canonical), code wording = `delegation_deflection` (canonical). spec drift evidence.
→ `conflict_avoidance` = scenario data 영역 only (compatibility map 안 identity-map), axis penalty wiring 0.

### Pattern flow (R3 phase 2 + 3 + 4 통합)
```
[Scenario data]
  pattern_family: "truth_naming" | "integrity_compromise" | etc.
  bty_tension_axis: "Blame vs. Structural Honesty" | etc.
       ↓
[arena_events.meta — choice/route.ts:758-784]
  meta.pattern_family = picked.pattern_family (scenario vocabulary)
       ↓
[reexposureValidation.server.ts → patternSignatureUpsert.server.ts]
  payload.after_pattern_family = scenario vocabulary (no canonical normalization)
  payload.after_axis = bty_tension_axis (title-case sentence)
       ↓
[user_pattern_signatures]
  pattern_family ∈ {truth_naming, integrity_compromise, reputation_protection, performance_blame}
  axis ∈ {"Blame vs. Structural Honesty", ...}
       ↓
[buildFingerprintInput.ts:23]
  activePatterns = {scenario vocabulary names}
       ↓
[axis penalty check]
  pen("repair_avoidance", TII)         → false (canonical not in activePatterns)
  pen("delegation_deflection", opBias) → false
       ↓
[STILLWATER cutoff]
  ❌ 5/5 users fail (penalty 0 → conflict = operationalBias ≥ 0.484 > 0.40)
```

---

## § 6. Close Decision — NO-FIX, AL-2 Escalate

### Decision
**AL-1.9-D close: NO-FIX (R3 inventory only). Vocabulary unification deferred to AL-2.**

### Rationale (spec authority cite)

**[ARCHETYPE_DETERMINISM_LOCK_V1.md § 0 L11-15]**:
> 7개 archetype 전체의 product-level 재정의는 **AL-2로 넘긴다**.

**[ARCHETYPE_DETERMINISM_LOCK_V1.md § 0 L17]**:
> AL-1.7: 운영 4주 데이터 기반 ENTRY/EXIT_THRESHOLD 미세조정. STILLWATER axis cutoff 매칭률 검증 및 **±0.05 범위 내 tuning만 허용. 구조 변경 금지 (pattern/axis 정의 변경 금지).**

**[ARCHETYPE_DETERMINISM_LOCK_V1.md § 0 L18]**:
> AL-2: 7개 archetype product-level re-definition. **axis 구조 재설계. patternRequires 재정의.** archetype 의미/서사/Foundry path 재설계.

### Scope envelope analysis

| 영역 | AL-1.9-D scope envelope | spec authority |
|---|---|---|
| ±0.05 threshold tuning | ✅ in scope | § 0 L17 |
| Matching rate 검증 | ✅ in scope | § 5.1 L267 ("AL-1.7 Validation Scope: 매칭률 검증만 수행") |
| **Vocabulary unification** | **❌ out of scope** | § 0 L18 (AL-2 axis 구조 재설계) |
| **Spec § 5.1 L261 wording 정정** (`conflict_avoidance` → `delegation_deflection`) | **❌ out of scope** | § 0 L18 (patternRequires 재정의 영역) |
| **Compatibility map 13 entry 정리** | **❌ out of scope** | § 0 L18 |

### R3 evidence base 의 fix 영역

R3 phase 4 evidence 기준, STILLWATER cutoff 충족 가능성 회복은 다음 중 1+ 필요:
1. Vocabulary unification: scenario `pattern_family` → canonical 5 mapping
2. Axis vocabulary unification: `bty_tension_axis` → canonical lowercase axis name
3. buildFingerprintInput penalty wiring 의 vocabulary alignment
4. Spec § 5.1 L261 의 `conflict_avoidance` wording 정정

→ 4 영역 모두 spec § 0 L18 의 "axis 구조 재설계 / patternRequires 재정의" 영역.
→ AL-1.9-D scope (±0.05 tuning) 안에서 fix 0.

### Honest scope discipline lesson

R3 inventory entry 시점의 implied scope ("archetype mapping cutoff 검토") 는 spec § 0 envelope 안 ±0.05 tuning 영역으로 가정.

R3 evidence 누적 후 actual scope 가 vocabulary unification (구조 변경) 영역임이 확정.

→ Forced fix (spec § 0 L17 "구조 변경 금지" 위반) 회피 = honest scope discipline.
→ NO-FIX close + R3 evidence carry-over to AL-2 = 정합 path.

---

## § 7. AL-2 Entry Context (별 sprint scope decision input)

### Carry-over evidence summary

#### 1. 3-vocabulary mismatch (R3 phase 4 evidence)

| vocabulary | source | sample |
|---|---|---|
| Canonical pattern (5) | [src/domain/pattern-family.ts:5-11] | ownership_escape, repair_avoidance, explanation_substitution, delegation_deflection, future_deferral |
| Compatibility map (13) | [src/data/scenario/index.ts:542-556] | identity-mapping, 5 canonical + 8 non-canonical |
| Scenario data (~) | scenario JSON files | truth_naming, integrity_compromise, reputation_protection, performance_blame, ... |
| Canonical AxisVector (12 dim) | [src/lib/bty/archetype/rules.ts] | conflict, repair, integrity, truth, accountability, ... (lowercase) |
| Scenario `bty_tension_axis` | [src/lib/bty/arena/chainWorkspaceToEliteScenario.server.ts:161/182/203] | "Blame vs. Structural Honesty", "Empathy Loyalty vs. Structural Authority", ... (title-case sentence) |

→ overlap canonical ∩ scenario = 0 (pattern_family + axis 둘 다).

#### 2. Production statistical evidence (Hanbit SQL)

**user_pattern_signatures** (post AL-1.7 Phase 1 deploy):
- 5 rows / 3 users
- 4 distinct pattern_family, 0 canonical match
- delegation_deflection row count = 0 → STILLWATER conflict cutoff penalty 영역 도달 0

**bty_arena_signals avg_meta** (5 users with most signals):
| user_id (truncated) | signals | avg_relational | avg_operational | avg_emotional |
|---|---|---|---|---|
| 85bd8f1f | 27 | 0.494 | 0.500 | 0.530 |
| 2322beb7 | 20 | 0.524 | 0.486 | 0.630 |
| ee9d2075 | 20 | 0.485 | 0.500 | 0.538 |
| 38ce28d2 | 18 | 0.485 | 0.484 | 0.622 |
| 3c732192 | 9 | 0.653 | 0.544 | 0.687 |

→ baseline 0.50 ± 0.06 cluster (spec § 10 L580 운영 입증).

#### 3. STILLWATER cutoff feasibility evidence

| condition | code source | feasibility (penalty 0) | feasibility (penalty -0.30) |
|---|---|---|---|
| conflict ≤ 0.40 | pen("delegation_deflection", opBias) | 5/5 fail | 5/5 pass |
| repair ≤ 0.40 | pen("repair_avoidance", TII) | depends on TII | depends on TII |
| integrity ∈ [0.40, 0.70] | TII | depends on TII | depends on TII |

→ penalty 영역 도달 = 운영 vocabulary 가 canonical 와 align 필요 (현재 0).

#### 4. Spec drift surface

**[docs/specs/ARCHETYPE_DETERMINISM_LOCK_V1.md:261]** (spec wording):
> conflict ≤ 0.40: **conflict_avoidance** 패턴 active 시 baseline에서 -0.30 적용.

**[bty-app/src/lib/bty/archetype/buildFingerprintInput.ts:33]** (code wording):
```ts
conflict: pen("delegation_deflection", operationalBias),
```

→ spec wording `conflict_avoidance` ≠ code wording `delegation_deflection`.
→ `conflict_avoidance` = compatibility map identity-mapped, canonical 외, axis penalty wiring 0.

#### 5. Compatibility map inventory (identity-mapping 13 entries)

[src/data/scenario/index.ts:542-556]:
| key | value | canonical? |
|---|---|---|
| ownership_act | ownership_claim | ❌ |
| system_thinking | accountability_system | ❌ |
| blame_shift | accountability_deflection | ❌ |
| **truth_naming** | **truth_naming** | ❌ (production hit) |
| future_deferral | future_deferral | ✅ |
| delegation_deflection | delegation_deflection | ✅ |
| **integrity_compromise** | **integrity_compromise** | ❌ (production hit) |
| repair_avoidance | repair_avoidance | ✅ |
| courage_act | courage_act | ❌ |
| control_fixation | control_fixation | ❌ |
| self_protection | identity_drift | ❌ |
| explanation_substitution | explanation_substitution | ✅ |
| conflict_avoidance | conflict_avoidance | ❌ (spec § 5.1 L261 cite) |

### AL-2 entry decision points (Commander 영역)

1. **Vocabulary unification direction**: scenario → canonical (compress) OR canonical → scenario (expand)?
2. **Compatibility map role**: normalization layer? deprecate? merge into pattern-family.ts?
3. **`bty_tension_axis` 의 canonical AxisVector 와의 mapping**: 1:1 mapping 정의 영역
4. **Spec § 5.1 L261 wording 정정**: `conflict_avoidance` → actual canonical pattern (or accept spec drift as historical)
5. **Forward-only vs backfill**: post-AL-2 user_pattern_signatures의 historical row 처리

### AL-2 entry blockers (carry-over)

- `FINGERPRINT_VERSION` bump (spec § 6) — vocabulary 변경은 fingerprint 영향
- §3.3.2 specificity 매트릭스 freeze (spec § 3.3.2) — vocabulary 변경 시 재계산
- archetype 의미/서사/Foundry path 재설계 (spec § 0 L18)
