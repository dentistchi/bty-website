# RESIDENCY VALIDATION PROCEDURE

> **Status:** Constitutional rule (procedural codification)
> **Track:** PHASE3-GATE-1 — Residency Validation Procedure
> **Created:** 2026-05-15
> **Authority origin:** Commander 비가역 원칙 (α-1c + HK2-R2 학습 흡수)
> **Mutation footprint:** doc-only (mutation 0)

---

## §1 Purpose & Scope

### 1.1 비가역 원칙 (전문)

> **"No semantic subtraction authority without runtime residency verification."**
>
> 어떤 doc·classification·canonical authority도 runtime residency 검증 없이는
> semantic subtraction(의미 제거)을 결정할 권한을 갖지 못한다.
> Doc authority는 runtime 사실(scenario JSON, code path)에 종속되며,
> 그 역(逆)이 성립하지 않는다.

이 원칙은 2026-05-15 Commander 결정으로 **constitutional rule**로 격상되었으며,
본 procedure는 그 원칙의 절차적 codification이다.

### 1.2 Scope — 적용 대상

본 procedure는 **semantic subtraction 결정**에 한정하여 적용된다.
Semantic subtraction은 다음 3개 분류를 포함한다:

| 분류 | 정의 |
|---|---|
| **PRUNE** | pattern_family / canonical literal을 active 집합에서 제거 |
| **DEPRECATE** | literal·doc·table status를 dormant/deprecated로 강등 |
| **REMOVE** | runtime semantic(scenario JSON literal, lookup site)을 물리적 삭제 |

### 1.3 Scope — 적용 대상 외

**Addition(신규 추가)은 본 procedure 적용 대상이 아니다.**

- CANONICAL literal 신규 추가
- ALIAS 신규 추가
- doc-only addition (drift NOTE 등)

Addition은 기존 runtime 사실을 제거하지 않으므로 residency 위협이 없다.
단, addition이 direction/axis 충돌을 유발하는 경우는 별도 review 대상이다.

### 1.4 Procedure 자체의 권위 격위

본 procedure는 **constitutional rule**이다.
Procedural recommendation(권고)이 아니라 **의무(MUST)**이며,
§3 verification step 미충족 시 sprint 발행이 **금지**된다.
우회는 §6 Procedure Bypass 경로를 통해서만 가능하다.

---

## §2 Trigger Conditions

### 2.1 Procedure 적용이 의무화되는 dispatch 유형

다음 중 하나라도 해당하면 본 procedure가 **의무 적용**된다:

1. **pattern_family / canonical literal에 대한 prune / deprecate / remove 결정**
2. **doc 분류 변경** — 예: deprecate-low table status 갱신
3. **runtime semantic 제거** — 예: scenario JSON literal 삭제
4. **archetype / Lock 5 mutation 중 subtraction 성격을 갖는 변경**

### 2.2 명시 제외 (procedure 비적용)

다음 dispatch 유형은 본 procedure 적용 대상이 **아니다**:

- **doc-only addition** — 예: drift NOTE 추가
- **reclassification** — 예: α-1c-B LIVE 재분류.
  기존 분류 보존이 본질이며 subtraction이 아니다.
- **code refactor 중 semantic-neutral 변경** — 의미 보존 리팩터링

> **경계 판정 원칙:** dispatch가 §2.1과 §2.2 경계에 걸치면
> **§2.1(적용)으로 보수적 판정**한다. 의심 시 procedure 적용.

---

## §3 Required Verification Steps

Subtraction sprint 발행 **전**에 다음 step을 의무 수행한다.
모든 step의 근거는 dispatch에 §4 template 형식으로 기록한다.

### Step 3.1 — Scenario JSON residency verification

- inner repo grep 대상: `src/data/scenario/**/{ko,en,base}.json`
- target literal의 **occurrence count** 측정
- **occurrence ≥ 1 → LIVE 판정 → subtraction 금지**
- occurrence = 0 → 다음 step 진행

> LIVE 판정 시 해당 literal은 runtime-resident이므로
> doc authority만으로 제거할 수 없다 (§1.1 비가역 원칙).

### Step 3.2 — Direction & axis tag inspection

- target literal의 **direction 분포** 측정 (entry / exit)
- **axis tag 분포** 및 12-axis canon 정합 여부 확인
- **direction inversion 위험 surface**:
  - axis가 다른 family로의 alias/replace
  - direction이 반대인 family로의 alias/replace
  - → 위 두 경우는 **behavior inversion**으로 간주, subtraction 금지

### Step 3.3 — Code path verification

- target literal의 production code 참조 확인
  (예: `buildFingerprintInput.ts` 등)
- **capacity vs activation 분리 확인**:
  - **capacity** — dictionary에 정의가 존재함
  - **activation** — lookup site에서 실제 사용됨
- **dead lookup 여부 검증** — capacity는 있으나 activation이 없는 경우 명시

### Step 3.4 — Cross-repo file location verification

- target doc/file의 **outer / inner tracking 상태** 확인
- dispatch 작성 시 다음 패턴 중 하나를 명시 선택:
  - **outer-only** — outer repo 단독 변경
  - **inner + leak-integration** — inner 변경 후 outer leak-integration NOTE

### 3.5 Gate 규칙

> §3.1 ~ §3.4 중 **하나라도 미충족** 시 sprint 발행은 **금지**된다.
> 발행이 필요하면 Commander 결정 후 §6 경로로 procedure 우회 여부를 명시한다.

---

## §4 Dispatch Template (필수 적용)

Subtraction sprint dispatch 작성 시 다음 template을 사용한다.

```
Sprint name: <name>
Sprint type: <subtraction type — PRUNE / DEPRECATE / REMOVE>
Trigger: <원칙 reference + 배경>

Residency Verification (per Procedure §3):
- Step 3.1 (JSON residency): <occurrence count + 파일 경로>
- Step 3.2 (direction/axis): <direction 분포 + axis tag>
- Step 3.3 (code path): <production 참조 + capacity vs activation>
- Step 3.4 (file location): <outer/inner tracking 상태>
- Verdict: <PROCEED / STOP / Commander 결정 필요>

Scope: <doc / code / hybrid>
Out of scope: <명시 제외>
Validation: <git diff 범위 + commit message>
```

> `Verdict`가 `STOP`이거나 `Commander 결정 필요`이면 sprint를 발행하지 않는다.
> `PROCEED`는 §3 4-step 전부 충족 시에만 기재 가능하다.

---

## §5 Failure Modes (학습 흡수)

본 procedure는 α-1c + HK2-R2 학습 dataset에서 도출되었다.

### Failure mode 1 — Doc authority without runtime verification

- **사례:** deprecate-low #12 + 26 MISMATCH-LIVE (HK2-R2)
- **결과:** live scenario-resident family를 dormant로 오분류
- **방지:** §3.1 (JSON residency verification) 의무화

### Failure mode 2 — Semantic opposition treated as neighborhood

- **사례:** α-1c PRUNE 가정 (Axis 9 entry → Axis 4 exit 교체 제안)
- **결과:** capstone scenario behavioral inversion
- **방지:** §3.2 (direction & axis tag inspection) 의무화

### Failure mode 3 — File location inventory 누락

- **사례:** α-1c Task B directive (outer-only 가정 → inner-resident 파일 충돌)
- **결과:** cross-repo desync 위험
- **방지:** §3.4 (cross-repo file location verification) 의무화

---

## §6 Procedure Bypass

Commander가 procedure 우회를 결정하는 경우:

1. **bypass rationale 명시 필요** — 우회 사유를 dispatch에 기록
2. **bypass record는 §7 ledger에 누적**
3. **bypass 후 mutation 발생 시 회복 절차 정의 필요**
   — 우회로 인한 subtraction이 오류로 판명될 경우의 복구 경로를
   bypass 시점에 미리 명시한다.

> Bypass는 procedure를 무효화하지 않는다.
> Bypass 자체가 §7 ledger에 영구 기록되는 감사 대상이다.

---

## §7 Bypass Ledger

(현재 entry 0건)

| Date | Sprint | Bypassed step | Rationale | Commander |
|---|---|---|---|---|

---

## §8 Procedure Maintenance

- 본 procedure 자체의 수정은 **별도 sprint**로 수행한다.
- **maintenance sprint도 본 procedure 적용 대상이다** (메타-적용):
  procedure 변경 역시 subtraction 성격을 가질 수 있으므로,
  §1~§8의 일부를 제거·강등하는 maintenance는 §3 verification을 거친다.
- procedure addition(신규 §, 신규 step 추가)은 §1.3에 따라 적용 대상 외이나,
  추가가 기존 step의 의미를 약화·치환하면 subtraction으로 재분류한다.
