# ARCHETYPE_DETERMINISM_LOCK_V1

**Status**: AL-1.5 Draft — C2 Review Ready
**Created**: 2026-05-01
**Author**: Commander (product) + C3 (reverse-doc)

---

## §0 Sprint Discipline Note

AL-1.5에서는 Determinism Lock 신뢰성 복원이 우선이다.
7개 archetype 전체의 product-level 재정의는 AL-2로 넘긴다.
STILLWATER는 spec drift의 진앙이므로 v1에서 완전 정의한다.

**Future sprints (planned)**:

- **AL-1.7**: 운영 4주 데이터 기반 ENTRY/EXIT_THRESHOLD 미세조정. STILLWATER axis cutoff 매칭률 검증 및 ±0.05 범위 내 tuning만 허용. 구조 변경 금지 (pattern/axis 정의 변경 금지).
- **AL-2**: 7개 archetype product-level re-definition. axis 구조 재설계. patternRequires 재정의. archetype 의미/서사/Foundry path 재설계.

---

## §1 Invariant

> AI proposes language. Rule engine decides identity.

아키타입 결정은 LLM이 아닌 RULE_REGISTRY + Selector가 내린다.
AI는 선택된 아키타입의 표현(description, mythos)에만 관여한다.
RULE_REGISTRY와 Selector에 LLM import는 금지된다.

Enforcement: `npm run lint:archetype-isolation` (scripts/archetype-isolation-check.mjs)

---

## §2 Earned Naming Threshold

아키타입 이름은 행동 증거가 충분히 쌓인 후 부여된다.
임계점 미달 사용자는 `PATTERN_FORMING` 상태로 유지된다.
이 상태에서는 아키타입 이름 대신 신호(signal)만 노출된다.

### §2.1 ENTRY_THRESHOLD

**Status**: v1 starter values
**Validation Plan**: AL-1.5 cutover 후 첫 4주간 운영 데이터 누적 → 사용자 인구의 임계점 분포 분석 → AL-1.7에서 조정 결정.
**Authority**: 조정은 product owner (Commander) 결정 필요. 자동 튜닝 금지.

| Dimension | Starter Value | DB Source | Filter | 시간성 |
|---|---|---|---|---|
| scenariosCompleted | 12 | `user_scenario_choice_history` | `WHERE user_id = ?` | **lifetime** (rotation 없음) |
| contractsCompleted | 3 | `bty_action_contracts` | `WHERE user_id = ? AND status = 'approved'` | **lifetime** (삭제 없음) |

**선택 근거 (T-3=Y_LIFETIME)**:
- `user_scenario_choice_history`: CHOICE_CONFIRMED마다 INSERT, 삭제/rotation 없음. `played_scenario_ids`는 rotation으로 감산되므로 ENTRY_THRESHOLD source로 부적합.
- `bty_action_contracts status='approved'`: Layer-2 validation 또는 QR 검증 완료 기준. legacy `status='completed'` 사용 금지. `user_action_contracts` 테이블은 마이그레이션 미존재 — 사용 금지.

**§3.4 Hysteresis와의 정합**: 두 source 모두 lifetime 누적이므로 "정상 사용자에게 archetype 사실상 영구적" 원칙 유지.

**v1 Dimension Scope (intentional)**:
v1 ENTRY_THRESHOLD는 2-dimension 설계다. `daysInSystem`과 `distinctAxesActivated`는 v1에 포함되지 않는다.
추가 검토 항목으로 §10 (AL17-1, AL17-2) deferred. 운영 4주 데이터 확인 후 AL-1.7에서 Commander 결정.
추가 시 `FINGERPRINT_VERSION` bump 필요 (§6 참조).

**Re-tuning Triggers** (AL-1.7 sprint 진입 조건):
- 운영 4주 경과 후
- PATTERN_FORMING 인구 비율 > 70% → 임계점 너무 높음 신호
- PATTERN_FORMING 인구 비율 < 10% → 임계점 너무 낮음 신호
- ENTRY 직후 EXIT 진동 사용자 비율 > 5%

### §2.2 EXIT_THRESHOLD (Hysteresis)

**Status**: v1 starter values
**Validation Plan**: §2.1과 동일 (AL-1.7에서 함께 조정).

한 번 아키타입이 부여된 사용자는 더 큰 후퇴 증거가 있어야만 PATTERN_FORMING으로 회귀한다.

| Dimension | Starter Value | DB Source | Origin |
|---|---|---|---|
| scenariosCompleted | 8 | `user_scenario_choice_history` (§2.1과 동일) | Hysteresis 33% 차감 (entry 12) |
| contractsCompleted | 2 | `bty_action_contracts WHERE status='approved'` (§2.1과 동일) | Hysteresis 33% 차감 (entry 3) |

**Hysteresis Ratio**: 0.67 (EXIT/ENTRY) — 진동 차단 권장 범위 0.60~0.70 내.

**DB Source**: §2.1 ENTRY_THRESHOLD와 동일 source. EXIT 판정도 동일한 lifetime 누적 count로 비교한다.

`lockService.resolveArchetypeForUser`에서 `hasExistingLock` 여부에 따라 ENTRY/EXIT 기준을 선택한다.

### §2.3 PATTERN_FORMING 반환 형태

```typescript
{
  archetypeName: 'PATTERN_FORMING',
  archetypeClass: 'identity',
  source: 'pattern_forming_threshold',
  blockReason: string,  // "12개 중 N개 시나리오 완료" — 사용자 표시용
}
```

PATTERN_FORMING 상태에서는 `bty_archetype_naming_locks`에 row가 생성되지 않는다.

---

## §3 Selector

### §3.1 흐름

```
lockService.resolveArchetypeForUser
  └─ (A0) Earned Naming Threshold gate
        └─ 미달 → PATTERN_FORMING 반환 (DB write 없음)
        └─ 통과 →
              (A) findActiveLockByHash  — cache re-read
              (B) findCurrentActiveLock — supersede 대상
              (C) checkTransitionEligibility — transition gate
              (D) selectArchetype(axisVector) — RULE_REGISTRY 평가
              (E) bty_create_archetype_lock RPC
```

### §3.2 selectArchetype 알고리즘

1. `RULE_REGISTRY.filter(r => ruleMatches(r, axisVector))` — 모든 매칭 rule 수집
2. specificity 내림차순 + name 알파벳 오름차순 정렬 (결정론적 tie-break)
3. 최고 specificity 승자 반환
4. 매칭 rule이 전혀 없는 경우: guard fallback (STILLWATER 정의 상 일반 운영에서 발생 불가)

### §3.3 Specificity Scheme

#### §3.3.1 v1 산정 규칙

```typescript
export function ruleSpecificity(rule: ArchetypeRule): number {
  return rule.specificity ?? rule.conditions.length * 100;
}
```

- **Default**: `conditions.length × 100` — axis 조건 수 기반 자동 산정
- **Explicit override**: rule에 `specificity` 필드가 명시되면 해당 값 사용
- **Tie-break**: 동일 specificity 시 `name` 알파벳 오름차순

#### §3.3.2 v1 Specificity 매트릭스 (freeze)

| Archetype | Specificity | Type | 비고 |
|---|---|---|---|
| STILLWATER | 70 | Explicit | §5.1 참조 |
| NIGHTFORGE | 100 | Default | conditions(1) × 100 |
| OPENHAND | 200 | Default | conditions(2) × 100 |
| QUIETFLAME | 200 | Default | conditions(2) × 100 |
| CLEARANCHOR | 300 | Default | conditions(3) × 100 |
| IRONROOT | 300 | Default | conditions(3) × 100 |
| TRUEBEARING | 300 | Default | conditions(3) × 100 |

**이 매트릭스는 v1에서 freeze된다.** 변경은 AL-2 scope.

#### §3.3.3 AL-2 이후 변경 시 주의

AL-2에서 새 archetype 추가 또는 dimension 확장 시:
- Default 공식(`conditions.length × 100`)이 새 dimension을 반영하도록 재설계 필요
- STILLWATER explicit value(70)와의 정합성 재계산 필요

### §3.4 Hysteresis Note — Identity 원칙과의 정합성

§2.2 EXIT_THRESHOLD는 archetype 회수가 아니라 **상태 머신의 안정화 메커니즘**이다.

일반 운영에서 사용자가 EXIT_THRESHOLD에 도달하는 경로는 사실상 존재하지 않는다 — 시나리오와 계약 완료 수는 누적되지 차감되지 않기 때문이다.

EXIT_THRESHOLD는 다음 두 예외 케이스만을 위해 존재한다:
1. Admin이 데이터 무결성 사유로 row를 의도적으로 삭제하는 경우
2. 사용자 데이터 대규모 재구성 (합병/분할 등)

따라서 정상 사용자에게 archetype은 사실상 영구적이다. `CLAUDE.md` Non-negotiable Invariants의 "Core XP is permanent (lifetime)" 원칙과 충돌하지 않으며, 같은 정신을 상태 머신 차원에서 구현한 것이다.

---

## §4 ruleMatches

```typescript
export function ruleMatches(rule: ArchetypeRule, axisVector: AxisVector): boolean {
  for (const cond of rule.conditions) {
    const v = axisVector[cond.axis];
    if (cond.min !== undefined && v < cond.min) return false;
    if (cond.max !== undefined && v > cond.max) return false;
  }
  return true;
}
```

### §4.1 Dimension Source Map (v1)

v1에서 `ruleMatches`는 `AxisVector`만 평가한다. `patternFamilies`, `airBand`, `volatility`, `growthDirection`는 ruleMatches에서 직접 평가되지 않는다.

이 dimensions는 `buildFingerprintInput`에서 axisVector로 인코딩된다:

| 원천 Dimension | v1 인코딩 방식 | 관련 axis |
|---|---|---|
| conflict_avoidance 패턴 | axisVector.conflict에 -0.30 페널티 | conflict |
| repair_avoidance 패턴 | axisVector.repair에 -0.30 페널티 | repair |
| future_deferral 패턴 | axisVector.time에 -0.30 페널티 | time |
| ownership_escape 패턴 | axisVector.ownership에 -0.30 페널티 | ownership |
| explanation_substitution 패턴 | axisVector.accountability에 -0.30 페널티 | accountability |
| delegation_deflection 패턴 | axisVector.conflict에 -0.30 페널티 | conflict |
| ArenaSignal 집계 (AIR) | axisVector.truth, accountability로 반영 | truth, accountability |
| ArenaSignal 집계 (TII) | axisVector.repair, integrity, identity로 반영 | repair, integrity, identity |

**v1 한계**: axis 페널티 인코딩은 lossy다. "패턴이 활성화되어 conflict가 낮음"과 "본래 conflict 점수가 낮음"이 동일한 axis 값으로 표현된다. AL-2에서 `patternRequires` 조건 추가로 이 모호성을 해소할 수 있다 (§10 AL2-3 참조).

**Forbidden in input_snapshot**: raw score 값 (airRaw, lriRaw 등). 오직 정규화된 axis 값만 fingerprint에 사용된다 (`ENGINE_ARCHITECTURE_V1.md` "Philosophy Lock §9 equivalent — internal pattern/family identifiers non-exposure to clients").

**§4.2 ENTRY_THRESHOLD DB Source (Stage 3 target 구현)**

Stage 3에서 `lockService.resolveArchetypeForUser` 또는 별도 `earnedNaming.ts` 헬퍼가 사용해야 하는 쿼리:

```typescript
// scenariosCompleted — lifetime, rotation 없음
const { count: scenariosCompleted } = await supabase
  .from("user_scenario_choice_history")
  .select("id", { count: "exact", head: true })
  .eq("user_id", userId);

// contractsCompleted — lifetime, approved 기준
const { count: contractsCompleted } = await supabase
  .from("bty_action_contracts")
  .select("id", { count: "exact", head: true })
  .eq("user_id", userId)
  .eq("status", "approved");
```

`isEarnedNamingEligible(scenariosCompleted, contractsCompleted)` 은 이 두 count를 받아 ENTRY/EXIT_THRESHOLD와 비교한다.

**Stage 3 수정 대상 파일 전체 목록**:

| 파일 | 변경 유형 | 내용 |
|---|---|---|
| `src/lib/bty/archetype/earnedNaming.ts` | 신규 생성 | `isEarnedNamingEligible(scenariosCompleted, contractsCompleted, hasExistingLock)` — ENTRY/EXIT_THRESHOLD 비교 + hysteresis |
| `src/lib/bty/archetype/lockService.ts` | 수정 | (A0) PATTERN_FORMING gate 추가; target queries 적용 |
| `src/lib/bty/archetype/rules.ts` | 수정 | `ArchetypeRule` 타입에 `specificity?: number` 추가; STILLWATER conditions 교체; `ruleSpecificity()` 함수 추가 |
| `src/lib/bty/archetype/selector.ts` | 수정 | `ruleSpecificity()` 사용하도록 sort 로직 업데이트 |
| `src/lib/bty/identity/getMyPageIdentityState.ts` | 수정 | broken queries 교체 (`user_scenario_history` → `user_scenario_choice_history`, `user_action_contracts` → `bty_action_contracts`) |
| `src/app/api/bty/archetype/route.ts` | 수정 | 동일 broken queries 교체 |

**신규 테스트 파일**:
- `src/lib/bty/archetype/earnedNaming.test.ts` — ENTRY/EXIT/hysteresis edge cases
- `src/lib/bty/archetype/selector.test.ts` — PATTERN_FORMING gate + STILLWATER new conditions 반영 (기존 파일 수정)

---

## §5 Archetype Definitions

### §5.1 STILLWATER *(v1 완전 정의)*

**Class**: stability
**Specificity**: 70 (explicit — §3.3.2)

**Match Conditions**:
```typescript
conditions: [
  { axis: 'conflict',  max: 0.40 },
  { axis: 'repair',    max: 0.40 },
  { axis: 'integrity', min: 0.40, max: 0.70 },
]
```

**조건 근거**:
- `conflict ≤ 0.40`: `conflict_avoidance` 패턴 active 시 baseline에서 -0.30 적용. active 상태에서 자연스럽게 충족.
- `repair ≤ 0.40`: `repair_avoidance` 패턴 동일 논리.
- `integrity 0.40~0.70`: 표면적 안정성. 0.40 미만은 붕괴 상태, 0.70 초과는 CLEARANCHOR/TRUEBEARING 조건 진입.

**Cutoff Value Status**: v1 spec values (Commander 결정).

**AL-1.7 Validation Scope**: 매칭률 검증만 수행 (분포, 비율, 과소/과대 탐지). threshold tuning 허용 범위: ±0.05.

**AL-2 Scope**: axis 구조 변경, patternRequires 추가, archetype 의미 재정의.

**매칭률 기준** (AL-1.7 re-tuning trigger):
- STILLWATER 매칭률 < 5% → cutoff 너무 좁음 신호
- STILLWATER 매칭률 > 30% → cutoff 너무 넓음 신호

**의미**: 겉으로는 차분하지만, 불편한 갈등과 복구 행동을 지연시키는 리더십 패턴.

**Shadow Pattern**: 평화를 유지하는 방식으로 문제를 미루는 경향.

**Growth Edge**: 차분함을 유지하면서도 필요한 대화를 더 빨리 시작하는 것.

---

### §5.2 CLEARANCHOR *(AL-2 재검토 대상)*

**Class**: truth | **Specificity**: 300

**Match Conditions** *(reverse-documented from RULE_REGISTRY v1)*:
```typescript
conditions: [
  { axis: 'truth',          min: 0.70 },
  { axis: 'accountability', min: 0.65 },
  { axis: 'integrity',      min: 0.65 },
]
```

---

### §5.3 IRONROOT *(AL-2 재검토 대상)*

**Class**: pressure | **Specificity**: 300

**Match Conditions** *(reverse-documented)*:
```typescript
conditions: [
  { axis: 'authority', min: 0.65 },
  { axis: 'control',   min: 0.65 },
  { axis: 'courage',   min: 0.55 },
]
```

---

### §5.4 TRUEBEARING *(AL-2 재검토 대상)*

**Class**: truth | **Specificity**: 300

**Match Conditions** *(reverse-documented)*:
```typescript
conditions: [
  { axis: 'truth',          min: 0.60 },
  { axis: 'identity',       min: 0.60 },
  { axis: 'accountability', min: 0.55 },
]
```

---

### §5.5 OPENHAND *(AL-2 재검토 대상)*

**Class**: identity | **Specificity**: 200

**Match Conditions** *(reverse-documented)*:
```typescript
conditions: [
  { axis: 'visibility', min: 0.65 },
  { axis: 'identity',   min: 0.65 },
]
```

---

### §5.6 QUIETFLAME *(AL-2 재검토 대상)*

**Class**: repair | **Specificity**: 200

**Match Conditions** *(reverse-documented)*:
```typescript
conditions: [
  { axis: 'repair', min: 0.60 },
  { axis: 'truth',  min: 0.50 },
]
```

---

### §5.7 NIGHTFORGE *(AL-2 재검토 대상)*

**Class**: courage | **Specificity**: 100

**Match Conditions** *(reverse-documented)*:
```typescript
conditions: [
  { axis: 'courage', min: 0.65 },
]
```

---

## §6 Fingerprint Determinism

### §6.1 buildArchetypeFingerprint

같은 `FingerprintInput` → 항상 같은 `inputHash`. 보장 메커니즘:

1. **Float truncation**: `Math.floor(x * 100) / 100` — float noise 흡수
2. **Axis key 정렬**: `Object.keys(input.axisVector).sort()` — insertion order 독립
3. **Pattern 정규화**: `dedup + sort + lowercase`
4. **Version stamp**: `v: FINGERPRINT_VERSION`

### §6.2 SHA-256 구현

`crypto.subtle.digest('SHA-256', ...)` — W3C global.
Node 18+ / Cloudflare Workers 양 환경에서 identical (V8 기반).
`node:crypto` import 없음.

---

## §7 Lock Storage (bty_archetype_naming_locks)

아키타입이 결정되면 `bty_create_archetype_lock` RPC로 원자적으로 저장된다.

- 이전 active lock: `superseded_at` timestamp 업데이트
- 새 lock: INSERT
- 두 작업이 단일 plpgsql 트랜잭션 안에서 실행 (SECURITY DEFINER)

PATTERN_FORMING 상태에서는 이 테이블에 row가 생성되지 않는다.

### §7.1 PATTERN_FORMING Response Contract

PATTERN_FORMING 상태의 lockService 응답 타입:

```typescript
type PatternFormingResolution = {
  ok: true;
  archetypeName: 'PATTERN_FORMING';
  archetypeClass: 'identity';
  source: 'pattern_forming_threshold';
  blockReason: string;
  // archetype 관련 field 포함 금지
};
```

API route (`GET /api/bty/archetype`)가 client에 노출하는 필드:

| Field | pattern_forming | archetype_assigned |
|---|---|---|
| `status` | `'pattern_forming'` | `'archetype_assigned'` |
| `archetypeName` | 없음 | archetypeName |
| `archetypeClass` | 없음 | archetypeClass |
| `progress` | scenariosCompleted 등 | 없음 |
| `threshold` | ENTRY_THRESHOLD 값 | 없음 |

**Client exposure 금지 필드**: `lockId`, `inputHash`, `input_snapshot`, `selectedBy`, `selectionReason`, `candidatePool`.

---

## §8 Retry Semantics (lockService)

동시성 충돌(23P01 exclusion violation) 발생 시:

1. `MAX_RETRIES = 3`
2. 각 attempt 시작 시 `findActiveLockByHash`로 cache 재조회
3. `input_hash` 일치 → `cached_match` 반환 (경쟁 요청이 이미 생성한 lock 사용)
4. `input_hash` 불일치 → transition gate 재평가
5. 3회 소진 시 `ArchetypeLockExhaustedError` throw

---

## §9 AI Isolation

`src/lib/bty/archetype/` 내 모든 파일에서 LLM client import 금지.

금지 패턴: `anthropic`, `@anthropic-ai/*`, `openai`, `@ai-sdk/*`, `cohere-ai`, `@mistralai/*`, `@/lib/llm`

Enforcement: `npm run lint:archetype-isolation`

---

## §10 Open Items

### AL-1.7 Deferred — Refocused after AL-1.5 Closure

**Priority 1 (blocking cutover):** Signature system investigation

| ID | 항목 | 우선순위 |
|---|---|---|
| AL17-0 | **BINDING_V1_SECOND 메타 결함 → signature pipeline 복구** — 근본 원인 확정, C2 PASS, C3 구현 대기 (§10 AL17-0 상세 참조) | **Critical** |

#### AL17-0 상세: Pipeline N 결함 — 근본 원인, 검증, fix 계획

**조사 완료일**: 2026-05-03  
**C2 Spec Guard**: PASS (4/4, 조건 1개)

##### 근본 원인

2026-04-26 canonical hard cut 이후 `choice/route.ts`가 tradeoff 단계의 event를 `BINDING_V1_SECOND`로 기록하지만, 해당 event의 `meta`에 `direction`과 `pattern_family`가 포함되지 않음.

```
사용자 tradeoff 선택
  → choice/route.ts: BINDING_V1_SECOND event 삽입 (meta: direction/pattern_family 없음)
  → re-exposure/validate/route.ts → reexposureValidation.server.ts
  → fetchSecondChoiceConfirmedRow: event_type='SECOND_CHOICE_CONFIRMED' 쿼리
  → 결과: null (SECOND_CHOICE_CONFIRMED는 legacy run/step에서만 생성)
  → after_pattern_family: null
  → upsertUserPatternSignatureFromValidation: 조건 미충족 → 조용한 early return
  → user_pattern_signatures: INSERT 없음 (운영 전체 total_rows=0)
```

**레거시 이벤트 생성 위치** (`run/step/route.ts` line 363):
```typescript
insertEventType = "SECOND_CHOICE_CONFIRMED";
meta: { second_choice_id, escalation_branch_key, direction, pattern_family }
```
→ 이 라우트는 2026-04-26 hard cut으로 제거됨.

**현재 생성 위치** (`choice/route.ts` ~line 544):
```typescript
insertEventType = "BINDING_V1_SECOND";
meta: { /* direction, pattern_family 없음 */ }
```
→ `picked` 객체는 line 516에서 이미 조회되어 `picked.direction` 접근 가능하나 meta에 포함되지 않음.

##### C2 Spec Guard 검증 결과 (PASS 4/4)

| # | 검증 항목 | 결과 |
|---|---|---|
| 1 | `direction` 도메인 = "entry"\|"exit" 한정 (null·undefined 포함 0 인스턴스) | **PASS with 조건**: `direction`이 undefined일 경우 warn log 추가 필수 |
| 2 | `pattern_family` 도메인 = 시나리오 파일 기반 ~100+ 패밀리 (5개 canonical에 한정 아님) | **PASS** |
| 3 | 레거시 `SECOND_CHOICE_CONFIRMED` + 신규 `BINDING_V1_SECOND` 혼용 안전 (created_at desc 정렬) | **PASS** |
| 4 | `binding_phase==="tradeoff"` 조건이 Phase 1 fix 범위로 충분함 | **PASS** |

**도메인 정정 (AL-1.5 Commander 오류)**:  
`user_pattern_signatures` 테이블은 5개 canonical pattern families만 수용한다고 가정했으나, 실제로는 시나리오 데이터 기반 ~100+ 패밀리 전체를 수용함.  
Canonical 5개(`ownership_escape`, `repair_avoidance`, `explanation_substitution`, `delegation_deflection`, `future_deferral`)는 action contract subset에 한정.  
`normalizePatternFamilyId`는 "explanation" alias만 정규화하며, 5개로 필터링하지 않음.

##### Invariants (이 fix로 확립)

1. `BINDING_V1_SECOND` event의 `binding_phase === "tradeoff"` 경우 `meta.direction`과 `meta.pattern_family`가 **반드시** 포함되어야 함.
2. `direction`이 undefined일 경우 event를 삽입하기 **전에** `console.warn("[choice][tradeoff] direction undefined")` 기록 필수.
3. `fetchSecondChoiceConfirmedRow`는 `SECOND_CHOICE_CONFIRMED`와 `BINDING_V1_SECOND` 두 event type을 모두 처리해야 함 (레거시 호환성).
4. `patternSignatureUpsert.server.ts`의 silent early return에는 warn log가 수반되어야 함.

##### Fix 범위 (C3 구현 대상)

**File 1** — `bty-app/src/app/api/arena/choice/route.ts` (~2–3줄)  
tradeoff block에서 `picked.direction`과 `picked.pattern_family`를 캡처하여 event meta에 추가 + undefined 경우 warn log.

**File 2** — `bty-app/src/lib/bty/arena/reexposureValidation.server.ts` line 64 (~1줄)  
`.eq("event_type", "SECOND_CHOICE_CONFIRMED")` → `.in("event_type", ["SECOND_CHOICE_CONFIRMED", "BINDING_V1_SECOND"])`

**File 3** — `bty-app/src/lib/bty/arena/patternSignatureUpsert.server.ts` line 34 (~1줄)  
silent early return 직전에 `console.warn("[pattern_signature][skip]", { patternKey, axis, userId })` 추가.

**총 변경**: ~5–8줄, 3개 파일, 신규 테이블/마이그레이션 없음.

**Priority 2 (post-signature-fix):** Original AL-1.7 items

| ID | 항목 | 우선순위 |
|---|---|---|
| AL17-1 | ENTRY_THRESHOLD에 `daysInSystem` dimension 추가 필요성 검토 (source: `auth.users.created_at` or 첫 시나리오 응답일) | Medium |
| AL17-2 | ENTRY_THRESHOLD에 `distinctAxesActivated` dimension 추가 필요성 검토 (활성 기준 정의 필요: baseline 0.5 이상? 또는 baseline에서 변화?) | Medium |
| AL17-3 | **IT3-POLICY**: EXIT threshold 위반 시 기존 active lock 처리 정책. v1 default = IT3-B (lock 유지, 응답만 pattern_forming). IT3-A (lock supersede)로 변경 시 §3.4 "사실상 영구적" 원칙과의 정합성 재검토 필요. 운영에서 EXIT 위반 케이스 발생 빈도 확인 후 결정. | Low |

추가 결정 시 `FINGERPRINT_VERSION` bump 필수 (§6). AL17-1, AL17-2 두 항목 모두 fingerprint에 영향.

### AL15-CLOSURE: Official Sprint Closure (2026-05-02)

**Status**: HALTED — cutover deferred to AL-1.7

**Sprint timeline**:
- Spec design: 14 dialogue stages
- Stage 1–4 implementation: 67 tests + 9 invariants
- Stage 2 C2 review: APPROVED
- Soak T+0: 2026-05-02 13:18:50 PT (Worker `3f2befe3`)
- AL-1.5.1 hotfix: selector fallback removal + pattern filter (`06f0a478`)
- AL-1.5.2 hotfix: try/catch wrap for SelectorInvariantError (`e0a5fea7`)
- Soak T+5h: HALTED upon empty signatures discovery

**Final state (production safe)**:
- Worker `e0a5fea7` active — graceful degrade prevents 500 errors
- `bty_archetype_naming_locks`: 1 row (superseded fallback)
- User UX: existing archetype display maintained; new assignments not emitting (source gap)

**Discoveries — 12 silent assumptions, all closed before cutover**:

Spec/code/operational fact mismatches (1–6):
1. STILLWATER conditions=[] (Stage 0)
2. Wrong source table: `arena_runs` vs `user_scenario_choice_history` (Stage 1.5)
3. `status='completed'` is legacy (Stage 1.5b)
4. `played_scenario_ids` rotation (Stage 1.5b)
5. Method Y → X silent downgrade (Stage 3.A halt)
6. Single environment (worker name: `bty-arena-staging`)

Visual evidence misinterpretation (7):
7. STILLWATER UI display ≠ system working (Hanbit caught)

Code regressions (8–10):
8. `selector.ts` fallback code not removed (Discovery during Soak)
9. `selector.test.ts` line 26 fallback intent persistence
10. `fetchUserPatternSignatures` missing `current_state` filter

Operational data mismatch (11–12):
11. User `85bd8f1f` has 0 `user_pattern_signatures` rows
12. `user_pattern_signatures` table EMPTY across all 12 users (total_rows: 0)

**Root cause for cutover deferral**:
Pipeline N의 `user_pattern_signatures` 생성 단계가 운영에서 작동 안 함.
→ `buildFingerprintInput` input source 부재
→ axis 분포 baseline 0.50 ± 0.06에 머무름
→ 7개 archetype cutoff 어느 것도 운영에서 충족 불가능
→ `SelectorInvariantError` + graceful degrade (UX 영향 0)

**Deferred to AL-1.7**:
- AL17-0: Signature system investigation (Phase 1 — blocking)
- Decision: signature fix vs alternative source vs cutoff adjustment (Phase 2)
- Re-deploy + new soak (Phase 3)

**Lesson for future sprints**:
Spec consistency + code tests + CI invariants do NOT guarantee operational validity.
Operational data fact-check (single SQL: `SELECT COUNT(*) FROM user_pattern_signatures`) was
the only layer that revealed the v1 design assumption failure.
Always include operational distribution audit in soak gates — not just post-cutover monitoring.

---

### AL-2 Scope (구조 변경 필요)

| ID | 항목 | 우선순위 |
|---|---|---|
| AL2-1 | §5.2~§5.7 archetype conditions product-level 재정의 | Medium |
| AL2-2 | STILLWATER axis cutoff 운영 데이터 검증 (Gate 3 audit) | High |
| AL2-3 | `ruleMatches` 확장 — patternFamilies/airBand/volatility 조건 지원 | Medium |
| AL2-4 | Anti-Archetype 시스템 (STILLWATER ↔ NIGHTFORGE 등) | Low |
| AL2-5 | ESLint `no-restricted-imports` 활성화 (ajv override 해결 후) | Low |

---

## §11 Sprint Discipline Enforcement

### §11.1 Enforcement Layers

문서 선언만으로는 spec drift를 막지 못한다. 4개 레이어로 강제한다.

**Layer 1 — Code-level**:
- `RULE_REGISTRY`는 `readonly` export
- `ruleSpecificity` 함수 signature: `rule.specificity ?? rule.conditions.length * 100` (변경 금지)
- STILLWATER `conditions` 변경은 PR에서 §0 Sprint Discipline 위반 여부 확인 필수

**Layer 2 — CI gate** *(AL-1.5 Stage 4에서 구현)*:
- `scripts/archetype-spec-drift-check.mjs`: 다음을 검증
  - STILLWATER가 `conditions: []` 상태로 회귀하지 않았는지 (Gate 0 회귀 차단)
  - PATTERN_FORMING gate가 `lockService`에 존재하는지
  - §3.3.2 specificity 매트릭스 snapshot과 현재 RULE_REGISTRY 일치 여부
- push마다 실행

**Layer 3 — Sprint label gate** *(AL-1.5 Stage 4에서 구현)*:
- `src/lib/bty/archetype/` 변경 PR은 commit message에 sprint label 필수:
  - `[AL-1.7]`: ENTRY/EXIT_THRESHOLD 또는 STILLWATER cutoff ±0.05 범위 변경만
  - `[AL-2]`: archetype 의미/conditions/dimensions 구조 변경
- 라벨 없으면 CI에서 경고

**Layer 4 — Spec change log**:
- 이 문서 변경 시 §12 Change Log에 `sprint | date | author | rationale` 4-tuple 기록 필수

---

## §12 Change Log

| Sprint | Date | Author | Change |
|---|---|---|---|
| AL-1.5 | 2026-05-01 | Commander + C3 | v1.0 최초 작성 — Gate 0 spec drift 해소, STILLWATER 완전 정의, PATTERN_FORMING gate 신설 |
| AL-1.5 | 2026-05-02 | Commander + C3 | Method X (axis-only) decision trail 기록. Stage 3.A dispatch 직전 RUN block이 Method Y를 포함해 spec과 충돌 발견 → C3 HALT → spec을 fact ground로 확인 후 Method X 확정. ruleMatches 확장(patternRequires/airBands/volatility)은 AL-2 scope (§10 AL2-3). 결정 trail: 초기 Gate 0 결정은 "Method Y"였으나 spec drafting 과정에서 §4.1/§5.1/§10 AL2-3에 Method X로 수렴됨. |
| AL-1.5 | 2026-05-02 | Commander + C3 | **SPRINT CLOSURE.** Soak HALT + 12 silent assumptions documented. AL-1.5.1 hotfix: SelectorInvariantError (selector fallback 제거) + current_state filter (fetchUserPatternSignatures). AL-1.5.2 hotfix: try/catch wrap lockService step D. 근본 원인 확정: user_pattern_signatures 테이블 전체 공백 (Pipeline N gap). Graceful degrade 작동 중 (Worker e0a5fea7). §10 AL17-0 신설 (signature system investigation, Critical). §10 AL17 section refocused. AL-1.7로 cutover 이관. |
