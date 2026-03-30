# Scenario content guidelines

**Purpose:** Single reference for authors and reviewers writing Arena scenario JSON. Aligns with current domain contracts (numeric structure, interpretation, leadership signal mapping). Resolves **PENDING-002**.

**Arena routing (catalog / mirror / perspective-switch):** 시나리오 JSON 작성 규칙과는 별개로, **어떤 경로로 시나리오가 선택되는지**는 `getNextScenarioForSession` rotation 계약을 따른다. 운영·파일럿·테스트 시 참고: **[`docs/SCENARIO_ROTATION_CONTRACT.md`](./SCENARIO_ROTATION_CONTRACT.md)** (코드 기준 정본).

---

## 1. 원칙

- **시나리오 본문(`body` 등 플레이어 대면 서사)에 임의 수치 삽입 금지.** 수치가 필요하면 반드시 `numericStructure`에 두고, 본문은 그 의미만 서술한다.
- **모든 구조적 수치는 `numericStructure` 필드 기반**이다. 해석·엔진·검증은 이 필드를 신뢰한다.
- **`getPlayerFacingScenarioBody`** (`src/lib/bty/scenario/engine.ts`)는 서사/미러 메타 제거·로케일 선택 등 **표시용 문자열만** 다룬다. **본문 안에 이미 들어간 숫자를 구조적으로 차단하지는 않는다** (런타임 한계). 따라서 **본문 무수치는 작성 규칙과 리뷰로 보장**한다.

---

## 2. 허용 수치 표현

수치·한도·시간 박스는 아래에만 둔다.

| 영역 | 설명 |
|------|------|
| **`numericStructure.impact`** | `percent` · `dollars` · `count` 중 **하나 이상이 유한 수이고 &gt; 0** (0 전용 측정값은 거부). `narrativeEn` 필수, `narrativeKo` 선택. |
| **`resourceConstraintEn` / `resourceConstraintKo`** | 예산·인력·용량 등 **구체적 제약 문구** (여기서 금액·퍼센트 표현 허용). |
| **`timeConstraintEn` / `timeConstraintKo`** | SLA·마감·시간 박스. |

- **본문 직접 수치 삽입 금지:** 예를 들어 `body`에 “30%”, “$4,200만”처럼 **단독으로** 박아 넣지 않는다. 동일 정보는 `impact` 또는 `resourceConstraint*`에 반영한다.

---

## 3. 도메인 불변 조건 정렬

현재 시행 중인 계약(요약):

1. **`impact` &gt; 0 필수** — `ScenarioSchema`의 `measurableImpactSchema` **Zod `.refine`** (`src/data/scenarios/schema.validator.ts`) 및 **`parseScenarioNumericStructure`** (`src/domain/arena/scenarioNumericStructure.ts`)가 측정값 0·비측정·추상만 거부.
2. **abstract-only 시나리오 금지** — `impact`에 유효한 `percent` / `dollars` / `count` 중 최소 하나 없으면 파싱 실패.
3. **DB `numeric_structure` jsonb NOT NULL + DEFAULT** — 마이그레이션 `20260431140000_scenarios_numeric_structure_notnull.sql` 등과 일치; 동기화 시 JSON에서 채움.
4. **Ko 선택 · En 필수 (fallback)** — `impact.narrativeEn` 필수; `narrativeKo`, `timeConstraintKo`, `resourceConstraintKo`는 선택. 로케일별 표시는 엔진/UI 정책에 따름.
5. **`ScenarioCategory` 명시 필수** — 시나리오 JSON `category` 필드, Zod `scenarioCategoryZodEnum`.
6. **`interpretArenaDecision`** — intent가 규칙에 매칭되지 않으면 **`unknown`이 아닌 `intentClassification === "unknown"` 경로에서 `decisionPattern` / `behavioralTendency` / `leadershipSignal`는 `null`** (추측 매핑 없음).
7. **`mapToLeadershipSignal`** (`src/domain/arena/leadershipSignal.ts`) — **`unknown` 시그널 또는 미등록 문자열 → `null` 반환** (강제 매핑 없음). ⑥과 동일하게 “모를 때는 null”.

---

## 4. 콘텐츠 검토 체크리스트

- □ 본문에 **임의 수치·단독 %·$** 없음 (허용 필드에만 수치)
- □ **`numericStructure` 완비** (time/resource/risk/impact)
- □ **`impact` &gt; 0** (`percent` / `dollars` / `count` 중 하나 이상)
- □ **`impact.narrativeEn` 작성됨**
- □ **`category` 명시됨**
- □ **Ko 미제공 시** UI/표시가 En 또는 정책 fallback으로 일관되는지 확인

---

## 5. 위반 예시

**나쁜 예**

- 본문: “팀 예산이 30% 초과됐습니다” (수치가 본문에만 있고 `numericStructure`와 무관할 수 있음)

**좋은 예**

- `numericStructure.impact.percent = 30` (또는 동등한 측정값)
- 본문: “예산 초과 상황입니다” 또는 맥락 서술만 (수치는 impact/constraint 쪽)

---

## 6. Zod 차단 범위

- **차단 가능:** `numericStructure` **구조·타입·impact refine** 위반 (로드 시 `ScenarioValidationError`).
- **차단 불가:** **`body` / `title` 등 자유 텍스트 안의 숫자** — 스키마가 문장 단위 수치를 검사하지 않음.
- → **본문 무수치·허용 필드 집중은 콘텐츠 작성자·리뷰어 책임** (섹션 1·4 참고).

---

## 7. 기존 JSON 샘플 점검 결과

| 파일 | 결과 |
|------|------|
| `bty-app/src/data/scenarios/en/patient_refuses_treatment_001.json` | `category`, `numericStructure` 전체(time/resource/risk/`impact.percent` 34 + `narrativeEn`/`narrativeKo`) **완비 확인** |
| `bty-app/src/data/scenarios/ko/patient_refuses_treatment_001.json` | 동일 시나리오 로케일 페어 — 구조 동일하게 유지 권장 |

---

*Last aligned with: `scenarioNumericStructure`, `schema.validator.ts` (Zod), `interpretArenaDecision`, `leadershipSignal.mapToLeadershipSignal`.*
