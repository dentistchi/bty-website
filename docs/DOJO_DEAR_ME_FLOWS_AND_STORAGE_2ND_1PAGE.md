# Dojo·Dear Me — 연습 플로우 2종·저장 2차 설계 1페이지

**갱신일**: 2026-03-06  
**목적**: DOJO_DEAR_ME_NEXT_STEP_DESIGN_1PAGE §1 후보 3(연습 플로우 2종 화면 보강)·후보 4(저장 2차)를 한 페이지로 정리.  
**기준**: `DOJO_DEAR_ME_50_DB_AND_FLOWS_IMPLEMENT_1PAGE.md` §2·§3, `DEAR_ME_LETTER_API_1PAGE.md` §2, `DOJO_50_SUBMIT_RESULT_API_1PAGE.md` §4.

---

## 1. 연습 플로우 2종 화면 보강 (후보 3)

### 1-1. 역지사지 연습

| 단계 | 설계 요약 | 참고 |
|------|------------|------|
| 진입·1단계 | `/bty` → `/bty/mentor`(훈련 선택) → "역지사지" 시 `/bty/integrity`. | 구현 유지. |
| 2. 안내 | integrity 페이지 상단 안내 문구(i18n). guideMessage·intro 등. | DOJO_DEAR_ME_50_DB_AND_FLOWS §2. |
| 3. 시나리오 | 상황 텍스트 + 선택지 또는 자유 입력. POST `/api/mentor`. validateIntegritySubmit. | 기존 유지. |
| 4. 피드백 | API 응답 코멘트만 표시. | render-only. |
| 5. 완료 | "오늘의 연습 완료" 문구 + 링크(멘토/대시보드/50문항 진단). | doneTitle·doneSub·doneCtaAssessment 등. |

**보강 포인트**: 안내(2)·시나리오(3)·피드백(4) 단계별 i18n·정합성 점검. 완료 단계 링크 정리.

### 1-2. Dear Me 자존감 훈련

| 단계 | 설계 요약 | 참고 |
|------|------------|------|
| 진입 | `/dear-me` entryIntro + startCta. | 구현 유지. |
| 1. 오늘의 나 | (선택) 기분·에너지 1~3문항. | 2차 확장. |
| 2. 편지 쓰기 | 텍스트 영역 + 제출. POST `/api/dear-me/letter`. | API 구현됨. |
| 3. 답장/피드백 | API replyMessage 표시. | DEAR_ME_LETTER_API_1PAGE. |
| 4. 완료 | "오늘의 편지 완료" + completedTitle·completedSub·Center/챗 링크. | center i18n 재사용. |

**보강 포인트**: 편지 쓰기 → 답장 → 완료 흐름 명확화. 완료 후 링크 1곳 정리.

---

## 2. 저장 2차 설계 (후보 4)

### 2-1. 50문항 제출 이력

| 항목 | 설계 |
|------|------|
| **테이블 후보** | `dojo_submissions` (user_id, answers_json, scores_json, summary_key, created_at). PK id. RLS: 본인만 읽기. |
| **API 확장** | POST `/api/dojo/submit` 성공 시 INSERT(선택). GET 목록은 2차. |
| **참고** | DOJO_50_SUBMIT_RESULT_API_1PAGE §4. 1차 무상태 유지 시 저장 생략 가능. |

### 2-2. Dear Me 편지 저장

| 항목 | 설계 |
|------|------|
| **테이블** | `dear_me_letters` (user_id, letter_text, reply_text, created_at). PK id. RLS: 본인만 읽기. |
| **API 확장** | POST `/api/dear-me/letter` 성공 시 INSERT. GET 목록(선택) 2차. |
| **참고** | DEAR_ME_LETTER_API_1PAGE §2. 보관·개인정보 정책 1줄 명시 후 구현. |

### 2-3. 구현 순서

1. 마이그레이션: dojo_submissions(선택), dear_me_letters.
2. RLS 정책·본인만 읽기.
3. API에서 저장 호출 추가. 기존 응답 계약 유지.

---

## 3. 체크리스트

- [ ] 역지사지: 안내(2)·시나리오(3)·피드백(4)·완료(5) 단계별 문구·링크 점검.
- [ ] Dear Me: 편지 쓰기·답장·완료 화면 흐름·i18n 점검.
- [ ] (2차) dojo_submissions 또는 dear_me_letters 마이그레이션·RLS·API 저장 연동.

---

*참고: DOJO_DEAR_ME_NEXT_STEP_DESIGN_1PAGE §1, DOJO_DEAR_ME_50_DB_AND_FLOWS_IMPLEMENT_1PAGE §2·§3·§4.*
