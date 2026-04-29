# Dojo 50문항 제출·결과 API 설계 1페이지 (POST 50-submit·영역별 점수·Dr. Chi 코멘트)

**갱신일**: 2026-03-15  
**목적**: POST 제출·영역별 점수·Dr. Chi 코멘트 API를 1페이지로 정리. 구현 시 domain/dojo/flow.ts만 사용.  
**기준**: `DOJO_DEAR_ME_50_AND_2FLOWS_1PAGE.md` §0·§4, `DOJO_DEAR_ME_NEXT_CONTENT.md` §7.

---

## 1. API 계약

| 항목 | 내용 |
|------|------|
| **엔드포인트** | `POST /api/dojo/submit` (또는 `POST /api/dojo/50-submit`) |
| **인증** | 세션 필수. 미인증 시 401. |
| **Request body** | `{ answers: Record<number, number> }` — 키 1..50, 값 1..5(리커트). |
| **Response 200** | `{ scores: Record<Dojo50AreaId, number>, summaryKey: "high"|"mid"|"low", mentorComment?: string }`. scores는 영역별 0~100. |
| **Response 400** | `{ error: "answers_count" | "invalid_range" }` — validateDojo50Submit 실패. |
| **Response 401** | 미인증. |

---

## 2. 도메인 사용 (필수)

| 단계 | 도메인 | 설명 |
|------|--------|------|
| 검증 | `validateDojo50Submit(answers)` | 50개 응답·각 1~5. 실패 시 400. |
| 결과 | `computeDojo50Result(answers)` | 5영역별 0~100 점수·summaryKey(high/mid/low). |

**위치**: `src/domain/dojo/flow.ts`. API는 검증·도메인 호출·응답만. 비즈니스 규칙은 도메인에만 둠.

---

## 3. Dr. Chi 코멘트

| 방식 | 내용 |
|------|------|
| **A. 템플릿** | summaryKey별 1~2문장 고정 문구. i18n 키 예: `dojo.resultCommentHigh`, `resultCommentMid`, `resultCommentLow`. |
| **B. LLM** | 기존 `/api/mentor` 또는 Dojo 전용 프롬프트에 scores·summaryKey 주입해 1~2문장 생성. (선택, 2차) |

**1차 권장**: A. 템플릿. 응답에 `mentorComment: string` 포함. 언어는 Accept-Language 또는 세션 locale.

---

## 4. 저장 정책 (선택)

| 옵션 | 내용 |
|------|------|
| **무상태** | 제출 이력 미저장. 매 제출마다 answers만 받아 결과·코멘트만 반환. |
| **저장** | `dojo_submissions`(user_id, answers_json, scores_json, summary_key, created_at) 등 테이블 설계 후 2차. |

**1차**: 무상태. 저장은 2차 설계.

---

## 5. 구현 체크리스트

- [x] POST `/api/dojo/submit` 라우트 추가. body 파싱 → validateDojo50Submit → computeDojo50Result → 200 반환. **보완**: summaryKey별 mentorComment 템플릿 미반환(응답에 mentorComment 필드 없음).
- [ ] i18n: dojo.resultCommentHigh / resultCommentMid / resultCommentLow (ko/en) 1~2문장. **미구현**. (API에서 summaryKey별 코멘트 반환 시 사용 예정.)
- [x] 400/401 처리. **구현됨.** UI(assessment/result)는 POST /api/dojo/submit 호출 후 표시. **보완**: API가 scores·summaryKey만 반환하고 mentorComment·areaScores 형태 미제공 → ResultClient는 areaScores·drChiComment 기대. API 응답에 mentorComment 추가 및 scores→areaScores 매핑(API 또는 UI) 필요.

**구현 점검 (2026-03-06)**: 라우트·도메인·400/401 완료. mentorComment(템플릿)·i18n 코멘트 키·응답 shape(areaScores/drChiComment) 연동 보완 필요.

*참고: domain/dojo/flow.ts, DOJO_DEAR_ME_50_AND_2FLOWS_1PAGE.md §4, DOJO_DEAR_ME_NEXT_CONTENT.md §7.*
