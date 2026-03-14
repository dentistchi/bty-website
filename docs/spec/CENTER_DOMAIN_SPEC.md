# Center 도메인 스펙

Center는 BTY의 **자기 인식·자기 돌봄** 시스템이다. 사용자에게 자존감 진단(Assessment), 나에게 쓰는 편지(Dear Me), 회복 탄력성 트렉(Resilience)을 제공한다.

---

## 1. 시스템 범위

| 하위 기능 | 설명 | 사용자 플로우 |
|-----------|------|--------------|
| **Assessment** | 자존감 50문항 진단 (5영역 × 10문항, 리커트 5단계) | 문항 stepper → 결과(영역별 점수·패턴·추천 트랙) → 이력 조회 |
| **Dear Me** | 나에게 쓰는 편지 + Dr. Chi 답장 | 편지 입력 → 제출 → LLM/템플릿 답장 표시 → 이력 조회 |
| **Center Letter** | Center 페이지 편지 (mood·energy·oneWord 추가) | 편지 입력 → 제출 → LLM 답장 → Resilience 데이터 축적 |
| **Resilience** | 회복 탄력성 일별 트렉 | Center Letter의 energy 값 기반 일별 high/mid/low 표시 |

---

## 2. 도메인 모듈 (`src/domain/center/`)

| 모듈 | 파일 | 역할 |
|------|------|------|
| **paths** | `paths.ts` | CTA 경로 상수 (`CENTER_CTA_PATH = "/bty"`), 챗 열기 이벤트 (`CENTER_CHAT_OPEN_EVENT`), `getCenterCtaHref(locale)` |
| **resilience** | `resilience.ts` | `energyToLevel(energy)` — 1~5 → low/mid/high. `aggregateLetterRowsToDailyEntries(rows, { periodDays? })` — DB 행 → 날짜별 집계 |
| **letter** | `letter.ts` | `validateLetterBody(body)` — 빈 문자열·10000자 초과 거부. `LetterSubmission`, `LetterWithReply`, `LetterLocale` 타입 |
| **assessment** | `assessment.ts` | `validateAssessmentAnswers(answers, questionCount)` — 개수 불일치·범위 벗어남 거부. `AssessmentSubmission`, `AssessmentHistory` 타입 |

### 순수성 규칙

- DB, fetch, cookie, Next.js API, UI import **금지**.
- 계산, 판단, 타입, 검증만 허용.
- 테스트: `paths.test.ts`, `resilience.test.ts`, `resilience.edges.test.ts`, `letter.test.ts`, `assessment.test.ts`

---

## 3. 서비스 모듈 (`src/lib/bty/center/`)

| 모듈 | 파일 | 역할 |
|------|------|------|
| **letterService** | `letterService.ts` | Dear Me 편지 제출(`submitLetter`) + Center 편지 제출(`submitCenterLetter`) + 이력 조회(`getLetterHistory`). domain `validateLetterBody` 호출 → LLM/템플릿 답장 생성 → DB INSERT/SELECT. |

### 미생성 (향후 후보)

| 모듈 | 파일 | 역할 |
|------|------|------|
| assessmentService | `assessmentService.ts` | Assessment 제출(`submitAssessment`) + 이력 조회(`getAssessmentHistory`). domain `validateAssessmentAnswers` + `scoreAnswers`·`detectPattern` 호출 → DB INSERT/SELECT. |
| resilienceService | `resilienceService.ts` | Resilience 조회(`getResilienceEntries`). DB SELECT → domain `aggregateLetterRowsToDailyEntries` 호출. |

---

## 4. API 엔드포인트 계약

### 4.1 Center Letter

| 엔드포인트 | 메서드 | 인증 | request | response |
|-----------|--------|------|---------|----------|
| `/api/center/letter` | POST | 필수 | `{ body: string, mood?: string, energy?: number, oneWord?: string, lang?: string }` | `{ saved: true, reply: string }` or `{ error: string }` |

### 4.2 Resilience

| 엔드포인트 | 메서드 | 인증 | request | response |
|-----------|--------|------|---------|----------|
| `/api/center/resilience` | GET | 필수 | query `?period=7\|30` (optional, 1~365) | `{ entries: ResilienceDayEntry[] }` — 각 항목: `{ date, level, source }` |

### 4.3 Dear Me Letter

| 엔드포인트 | 메서드 | 인증 | request | response |
|-----------|--------|------|---------|----------|
| `/api/dear-me/letter` | POST | 필수 | `{ letterText: string, lang: "ko"\|"en" }` | `{ letterId: string\|null, replyMessage: string }` or `{ error: string }` |
| `/api/dear-me/letters` | GET | 필수 | (없음) | `{ letters: [{ id, locale, body, reply, created_at }] }` 최신 20건 |

### 4.4 Assessment

| 엔드포인트 | 메서드 | 인증 | request | response |
|-----------|--------|------|---------|----------|
| `/api/assessment/submit` | POST | 필수 | `{ answers: Record<string, number> }` (50개, 각 1~5) | `{ submissionId, scores, pattern, recommendedTrack }` or `{ error }` |
| `/api/assessment/submissions` | GET | 필수 | (없음) | `{ submissions: [{ id, scores_json, pattern_key, recommended_track, created_at }] }` 최신 20건 |

---

## 5. 비즈니스 규칙 요약

### validateLetterBody(body)

```
빈 문자열 또는 trim 후 0자 → { ok: false, error: "body_empty" }
10,000자 초과              → { ok: false, error: "body_too_long" }
그 외                      → { ok: true }
```

### validateAssessmentAnswers(answers, questionCount)

```
null/비객체          → { ok: false, error: "answers_empty" }
키 0개               → { ok: false, error: "answers_empty" }
키 수 ≠ questionCount → { ok: false, error: "answers_count_mismatch: ..." }
값이 정수 1~5 아님   → { ok: false, error: "answer_out_of_range: ..." }
그 외                → { ok: true }
```

### energyToLevel(energy)

```
null     → "mid"
≤ 2      → "low"
3        → "mid"
≥ 4      → "high"
```

### scoreAnswers (lib/assessment/score.ts)

- 50문항 × 5영역(core, compassion, stability, growth, social)
- reverse 문항은 `6 - raw` 적용
- 영역별 10문항 합산(10~50) → 0~100 스케일

### detectPattern (lib/assessment/score.ts)

- 영역별 점수 기반 패턴 판별: balanced, perfectionism, approval_seeking, fragile_self_esteem, low_self_compassion, growth_blocked, social_avoidance
- 패턴 → 추천 트랙 매핑: Stability First, Self-Compassion First, Core Confidence, Growth Momentum, Social Ease

---

## 6. 데이터베이스 테이블

| 테이블 | 용도 | RLS |
|--------|------|-----|
| `center_letters` | Center 편지 (mood, energy, oneWord, body, reply) | `auth.uid() = user_id` SELECT/INSERT |
| `dear_me_letters` | Dear Me 편지 (body, reply, locale) | `auth.uid() = user_id` SELECT/INSERT |
| `assessment_submissions` | Assessment 50문항 제출 이력 (answers_json, scores_json, pattern_key, recommended_track) | `auth.uid() = user_id` SELECT/INSERT |

---

## 7. UI 라우트

| 경로 | 설명 |
|------|------|
| `/[locale]/center` | Center 메인 — 5문항 진단·CTA·Resilience 그래프·종합 현황 |
| `/[locale]/dear-me` | Dear Me 편지 쓰기·답장·이력 |
| `/[locale]/assessment` | Assessment 50문항 stepper |
| `/[locale]/assessment/result` | Assessment 결과·이력 |

---

*참조: `docs/architecture/DOMAIN_LAYER_TARGET_MAP.md`, `docs/architecture/ARCHITECTURE_MAP.md`, `DOJO_DEAR_ME_DB_NEXT_PHASE_DESIGN.md`*
