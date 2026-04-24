# Foundry Domain Spec

> 단일 참조 문서. **갱신: 2026-03-09** (SPRINT 13 작성 → 17 스펙 갱신 → 18 동기화).

**관련 스펙**: [Arena Domain Spec](./ARENA_DOMAIN_SPEC.md) — 경쟁·XP·리더보드·시즌은 Arena. 시나리오 50개·Leadership Engine·Elite는 본 스펙(Foundry)과 Arena에서 공유 참조.  
**로드맵 교차 참조**: Feature 우선순위·연도별 마일스톤은 `docs/plans/FOUNDRY_ROADMAP.md` 참조.

---

## 1. 시스템 범위

Foundry는 **기술·역량 훈련** 시스템이다. 사용자의 리더십·소통·갈등관리 역량을 진단하고, 시나리오 기반 훈련과 AI 멘토 코칭을 제공한다.

| 하위 시스템 | 설명 |
|---|---|
| **Dojo** | 50문항 5영역 역량 진단 (리커트 5점) |
| **Integrity (역지사지)** | 시나리오 입력 → Dr. Chi AI 피드백 |
| **Mentor (Dr. Chi)** | AI 멘토 대화 (듀얼 ko/en few-shot) |
| **Scenario Engine** | 리더십 시나리오 **50개** — 선택지·XP·히든 스탯 |
| **Beginner Scenario** | 7-step 초보자 성찰 시나리오 |
| **Leadership Engine** | Stage 전이·AIR·TII·LRI·Certified·Forced Reset |
| **Elite** | 주간 상위 5% — 특별 시나리오·멘토 신청·배지 |
| **Healing/Awakening** | 치유·각성 페이지 (phase 전환) |

### 경로 규칙 (System Boundary)

| 계층 | 경로 |
|---|---|
| Domain | `src/domain/dojo/`, `src/domain/leadership-engine/`, `src/domain/foundry/` |
| Service | `src/lib/bty/scenario/`, `src/lib/bty/mentor/` |
| UI | `src/app/[locale]/bty/(protected)/` |

---

## 2. 도메인 모듈 목록

### 2-1. `src/domain/dojo/flow.ts`

50문항 진입·제출·결과 순수 함수.

| 함수 / 타입 | 역할 |
|---|---|
| `DOJO_50_AREAS` | 5영역 상수 (`perspective_taking`, `communication`, `leadership`, `conflict`, `teamwork`) |
| `Dojo50Answers` | `Record<number, number>` — 문항 1~50 → 리커트 1~5 |
| `Dojo50Result` | `{ scores: Record<area, 0~100>, summaryKey: "high"│"mid"│"low" }` |
| `canEnterDojo(isAuthenticated)` | 진입 가능 여부 (현재: 인증만) |
| `validateDojo50Submit(answers)` | 50개·범위 1~5 검증 |
| `computeDojo50Result(answers)` | 5영역별 10문항 합 → 0~100 스케일 → summaryKey |
| `validateIntegritySubmit(payload)` | 역지사지 제출 검증 (text 또는 choiceId 필수). 입력 타입 `IntegritySubmitPayload` (→ integrity.ts) |

### 2-2. `src/domain/dojo/integrity.ts`

역지사지(Integrity) 타입·검증.

| 타입 / 함수 | 역할 |
|---|---|
| `IntegritySubmitPayload` | `{ text?, choiceId? }` — 제출 페이로드 |
| `IntegrityScenario` | 시나리오 메타 (id, situationKo/En, choices) |
| `IntegritySubmission` | 제출 기록 (userId, scenarioId, text, choiceId, createdAt) |
| `validateIntegrityResponse(text, choiceId)` | text 또는 choiceId 필수, text ≤ 5000자 |

### 2-3. `src/domain/dojo/questions.ts`

DB/API 문항 타입·매핑.

| 함수 / 타입 | 역할 |
|---|---|
| `DojoQuestion` | `{ id, area, orderInArea, textKo, textEn, scaleType }` |
| `DOJO_LIKERT_5_VALUES` | `[1, 2, 3, 4, 5]` |
| `mapDojoQuestionRow(row)` | DB snake_case → API camelCase 변환 |

### 2-4. `src/domain/leadership-engine/`

Leadership Engine 핵심 도메인 (6 모듈 re-export via `index.ts`).

| 모듈 | 핵심 타입/함수 | 규칙 |
|---|---|---|
| `stages.ts` | `Stage` (1~4), `getNextStage(current, context)` | 1→2 delegation 없이 반복, 2→3 corrective 없이 반복, 3→4 AIR < threshold, 4→1 완료 |
| `air.ts` | `AIRInputs`, `computeWeightedAIR(inputs)` | micro_win 가중 1.0, reset 2.0. 미스 -0.10 패널티. 3연속 미스 → integrity_slip |
| `tii.ts` | `TIIInputs`, `computeTII(inputs)` | TII = AIR×0.60 + MWD×0.25 + TSP×0.15. 팀 점수만 공개 |
| `lri.ts` | `LRIInputs`, `computeLRI(inputs)` | LRI = AIR_14d×0.50 + MWD×0.30 + pulse×0.20. ≥0.80 + no slip → readiness |
| `certified.ts` | `CertifiedInputs`, `evaluateCertified(inputs)` | AIR_14d ≥ 0.80, MWD ≥ threshold, reset compliance, no integrity_slip 14d |
| `forced-reset.ts` | `ResetEvalInputs`, `evaluateForcedReset(inputs)` | 4가지 중 2개 충족 → Stage 4 트리거. AIR 주간 조건: **AIR_7d &lt; 0.80** 2주 연속(고밴드 미만), reason **`air_7d_below_high_band_two_consecutive_weeks`**. 최대 48h 지연 가능. *(구 문서의 0.70 컷오프는 폐기.)* |

### 2-5. `src/domain/foundry/index.ts` (re-export hub)

`dojo/flow` + `dojo/questions` + `leadership-engine/*` 를 단일 네임스페이스로 re-export.

---

## 3. 서비스 모듈 목록

### 3-1. `src/lib/bty/mentor/`

| 파일 | 역할 |
|---|---|
| `drChiCharacter.ts` | Dr. Chi 인격 — philosophy·few-shot 예제 로드 (v1·v1.1 dataset) |
| `mentor_fewshot_dropin.ts` | 듀얼(ko/en) few-shot 번들 빌드·언어 감지 |
| `mentorFewshotRouter.ts` | 가중 regex 라우터 — 번들 선택 |
| `drChiExamples.json` | 스크립트 예제 |
| `mentor_training_dataset_v1.json` | Dr. Chi 실제 학습 데이터 |
| `mentor_training_dataset_v1_1.json` | v1.1 학습 데이터 |

### 3-2. `src/lib/bty/scenario/`

| 파일 | 역할 |
|---|---|
| `types.ts` | `Scenario`, `ScenarioChoice`, `ScenarioSubmitPayload/Result`, `HiddenStatKey` |
| `scenarios.ts` | 시나리오 JSON 로드·배열 |
| `engine.ts` | `getScenarioById`, `getRandomScenario`, `computeResult`, `getContextForUser` |
| `beginnerTypes.ts` | `BeginnerScenario`, `computeBeginnerMaturityScore`, `getMaturityFeedback` |
| `beginnerScenarios.ts` | 초보자 시나리오 배열·선택 |

---

## 4. API 엔드포인트 계약

### 4-1. `GET /api/dojo/questions`

문항 50건 + 선택지 조회.

| 항목 | 값 |
|---|---|
| Auth | 불필요 (public) |
| Response 200 | `{ questions: DojoQuestion[], choiceValues: [1,2,3,4,5] }` |
| Response 500 | `{ error: string }` |

### 4-2. `POST /api/dojo/submit`

50문항 제출 → 영역별 점수 + Dr. Chi 코멘트.

| 항목 | 값 |
|---|---|
| Auth | Required (session) |
| Body | `{ answers: Record<string, number> }` (문항 "1"~"50" → 1~5) |
| Response 200 | `{ submissionId, scores: Record<area, 0~100>, summaryKey, mentorComment? }` |
| Response 400 | `{ error: "invalid_body" │ "answers_count" │ "invalid_range" }` |
| Response 401 | `{ error: "UNAUTHENTICATED" }` |
| Domain calls | `validateDojo50Submit`, `computeDojo50Result` |

### 4-3. `GET /api/dojo/submissions`

사용자의 Dojo 제출 이력 (최근 20건).

| 항목 | 값 |
|---|---|
| Auth | Required (session + RLS) |
| Response 200 | `{ submissions: { id, scores_json, summary_key, created_at }[] }` |
| Response 401 | `{ error: "UNAUTHENTICATED" }` |

### 4-4. `POST /api/mentor`

Dr. Chi AI 멘토 대화.

| 항목 | 값 |
|---|---|
| Auth | Rate-limited (IP) |
| Body | `{ message, messages?, lang?, topic? }` |
| Response 200 | `{ message: string, redirectCenter?: boolean }` |
| Safety | 자존감 저하 패턴 감지 → Center 리다이렉트 메시지 |
| Domain calls | `buildMentorMessagesDual`, `inferLang`, safety valve regex |

### 4-5. `GET /api/me/mentor-request`

Elite 멘토 1:1 신청 상태 조회.

| 항목 | 값 |
|---|---|
| Auth | Required (session) |
| Response 200 | `{ request: null │ { id, status, message?, mentorId, createdAt, updatedAt, respondedAt?, respondedBy? } }` |
| Response 401 | `{ error: "UNAUTHENTICATED" }` |

### 4-6. `POST /api/me/mentor-request`

Elite 멘토 1:1 신청 생성.

| 항목 | 값 |
|---|---|
| Auth | Required (session, Elite only) |
| Body | `{ message?: string }` (최대 500자) |
| Response 201 | `{ id, status: "pending", createdAt }` |
| Response 400 | `{ error: "message_too_long" }` |
| Response 403 | `{ error: "ELITE_ONLY" │ "PENDING_EXISTS" }` |
| Domain calls | `canRequestMentorSession`, `validateMentorRequestPayload` |

---

## 5. 시나리오 파일 구조

### 위치

`docs/specs/scenarios/` — **50개** (SCN_*_.json). 전체 목록은 **`docs/specs/scenarios/SCENARIOS_LIST.md`** 참조.

### 스키마 (`bty_scenario_v1`)

```json
{
  "schema_version": "bty_scenario_v1",
  "scenario_id": "SCN_XX_NNNN",
  "title": "...",
  "summary": "...",
  "context_type": "relationship | ...",
  "stage_mapping": { "primary_stage": 1, "stage_flow": [1,2,3,4] },
  "roles_supported": ["Doctor","Staff","Manager","DSO","Executive"],
  "default_viewpoint": "Leader",
  "supports_reset": false,
  "tags": { "org": ["BTY"], "setting": [...], "themes": [...], "sensitivity": "low|med|high" },
  "scene": {
    "setting": "...",
    "characters": [{ "id": "...", "role_type": "...", "label": "..." }],
    "beats": [{ "beat_id": "b1", "narration": "...", "dialogue": [...] }]
  },
  "choices": [
    {
      "choice_id": "A",
      "label": "...",
      "intent": "...",
      "xp_base": 10,
      "difficulty": 1.0,
      "hidden_delta": { "integrity": 5, "communication": 3 },
      "result": "...",
      "micro_insight": "...",
      "follow_up": { "enabled": true, "prompt": "...", "options": ["..."] }
    }
  ],
  "coach_notes": { "what_this_trains": ["integrity"], "why_it_matters": "..." }
}
```

### ID 규칙

`SCN_{PREFIX}_{4자리 번호}` — PREFIX는 시나리오 주제 약어 (PT=Patient Treatment, FD=Front Desk 등).

### 파일 목록 (50건)

| # | 파일명 | 비고 |
|---|--------|------|
| 1–45 | SCN_PT_0001 … SCN_YR_0045 | 일반 시나리오 |
| 46 | SCN_EC_0046.json | 윤리적 용기 |
| 47 | SCN_CG_0047.json | 세대 간 갈등 |
| 48 | SCN_RM_0048.json | 원격 근무 리더십 |
| 49 | SCN_WA_0001.json | 특수 플로우 |
| 50 | SCN_RESET_0001.json | Stage 4 Reset 전용 |

전체 50건 상세 목록·ID 규칙: **`docs/specs/scenarios/SCENARIOS_LIST.md`**

---

## 6. 비즈니스 규칙 요약

| 규칙 | 소스 | 설명 |
|---|---|---|
| Dojo 50문항 검증 | `validateDojo50Submit` | 50개 응답, 각 1~5 리커트 |
| 영역 점수 계산 | `computeDojo50Result` | 10문항×1~5 → 0~100 스케일, avg ≥70 high / ≥50 mid / else low |
| 역지사지 검증 | `validateIntegritySubmit` | text 또는 choiceId 중 1개 필수 |
| Stage 전이 | `getNextStage` | 4단계 순환 (반복 없는 위임·교정 실패 시 진행) |
| AIR 계산 | `computeWeightedAIR` | 가중합 / 선택 가중합. 미스 -0.10, 3연속 → slip |
| TII 계산 | `computeTII` | AIR 60% + MWD 25% + TSP 15% |
| LRI 계산 | `computeLRI` | AIR_14d 50% + MWD 30% + pulse 20%. ≥0.80 → readiness |
| Certified 평가 | `evaluateCertified` | AIR_14d ≥ 0.80 + MWD + reset compliance + no slip |
| Forced Reset | `evaluateForcedReset` | 4조건 중 2개 → Stage 4, 최대 48h 지연 |
| 멘토 Safety Valve | API `/api/mentor` | 자존감 저하 regex → Center 리다이렉트 메시지 |
| Elite 멘토 신청 | `canRequestMentorSession` | Elite=true + pending 없음 |

---

## 7. DB 테이블

| 테이블 | 용도 |
|---|---|
| `dojo_questions` | 50문항 (area, text_ko, text_en, scale_type) |
| `dojo_submissions` | 사용자 Dojo 제출 (answers_json, scores_json, summary_key) |
| `elite_mentor_requests` | Elite 1:1 멘토 신청 (status, message, mentor_id) |

---

## 8. UI 라우트

| 라우트 | 설명 |
|---|---|
| `/bty/(protected)/` | Foundry 메인 (대시보드) |
| `/bty/(protected)/dashboard/` | 대시보드 — XP·코드네임·Leadership Engine |
| `/bty/(protected)/dojo/` | Dojo 50문항 stepper |
| `/bty/(protected)/dojo/result/` | Dojo 결과 — 5영역 바 차트 + Dr. Chi 코멘트 |
| `/bty/(protected)/integrity/` | 역지사지 연습 — 시나리오 입력 → Dr. Chi 피드백 |
| `/bty/(protected)/mentor/` | Dr. Chi 멘토 대화 |
| `/bty/(protected)/elite/` | Elite 페이지 — 배지·멘토 신청 |
| `/bty/(protected)/healing/awakening/` | 치유·각성 phase 전환 |
| `/bty/(protected)/profile/` | 프로필 |
| `/bty/(protected)/profile/avatar/` | 아바타 설정 |
| `/bty/(protected)/test-avatar/` | 아바타 테스트 |
| `/bty/leaderboard/` | 리더보드 (Overall/Role/Office) |

---

*참조: `docs/architecture/DOMAIN_LAYER_TARGET_MAP.md`, `docs/architecture/ARCHITECTURE_MAP.md`, `docs/spec/ARENA_DOMAIN_SPEC.md`, `docs/plans/FOUNDRY_ROADMAP.md`*
