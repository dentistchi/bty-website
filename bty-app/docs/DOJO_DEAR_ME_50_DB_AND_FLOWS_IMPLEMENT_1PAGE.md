# Dojo·Dear Me — 50문항 DB화·연습 플로우 구현 설계 1페이지

**갱신일**: 2026-03-06  
**근거**: `DOJO_DEAR_ME_50_AND_2FLOWS_1PAGE.md`, `DOJO_DEAR_ME_NEXT_CONTENT.md` §1-4·§7.  
**목적**: 50문항 DB·연습 플로우 2종 구현 시 개발용 단일 페이지 설계. UI는 API/도메인 값만 렌더(render-only).

---

## 1. 50문항 DB화

| 항목 | 설계 |
|------|------|
| **문항 테이블** | `dojo_questions` (id, area, order_in_area, text_ko, text_en, scale_type). area = 역지사지|소통경청|리더십책임|갈등협상|팀협업. scale_type = likert_5. |
| **선택지** | 5단계 리커트 공통: 1~5 라벨(i18n). 별도 테이블 없이 코드/상수로 처리 가능. |
| **응답 저장** | `dojo_50_responses` (user_id, question_id, value 1~5, created_at). 또는 제출 시 한 번에 저장(세션/배치). |
| **API** | GET `/api/dojo/questions` → 문항 목록(영역순). POST `/api/dojo/50-submit` → { answers: [{ questionId, value }] } 검증·저장·결과(영역별 점수) 반환. 도메인: `validateDojo50Submit`, `computeDojo50Result`(flow.ts). |

---

## 2. 연습 플로우 1: 역지사지 구현

| 단계 | 구현 요약 |
|------|------------|
| 진입·1단계 | `/bty` → `/bty/mentor`(훈련 선택) → "역지사지" 시 `/bty/integrity`. 기존 구현 유지. |
| 2. 안내 | integrity 페이지 상단 안내 문구(i18n). |
| 3. 시나리오 | 상황 텍스트 + 선택지 또는 자유 입력. POST `/api/mentor` 또는 Dojo 전용. `validateIntegritySubmit`. |
| 4. 피드백 | API 응답 코멘트만 표시. XP 연동은 API에서 `activity_xp_events` 기록. |
| 5. 완료 | "오늘의 연습 완료" 문구 + 링크(멘토/대시보드). |

---

## 3. 연습 플로우 2: Dear Me 자존감 훈련 구현

| 단계 | 구현 요약 |
|------|------------|
| 진입 | `/dear-me` entryIntro + startCta. 기존 구현 유지. |
| 1. 오늘의 나 | (선택) 기분·에너지 1~3문항. 문항은 상수 또는 소규모 테이블. |
| 2. 편지 쓰기 | 텍스트 영역 + 제출. POST `/api/dear-me/letter` → 저장. 테이블: `dear_me_letters`(user_id, body, created_at). |
| 3. 답장/피드백 | API가 LLM 또는 템플릿으로 격려 메시지 반환. 응답만 표시. |
| 4. 완료 | "오늘의 편지 완료" + Dear Me 대시/챗 링크. |

---

## 4. 구현 체크리스트

- [x] 50문항: `dojo_questions` 마이그레이션·시드 50건. GET questions API. (2026-03-06 갱신)
- [ ] 50문항: POST 50-submit 검증·저장·결과 반환. 도메인 flow.ts 연동.
- [x] 역지사지: 진입·1단계·대시/assessment 링크 연동. integrity 안내·시나리오·피드백·완료 화면 정합성.
- [ ] Dear Me: POST letter API·저장. 답장/완료 화면.
- [ ] UI: 모든 점수·결과·메시지는 API/도메인 값만 표시. XP·랭킹 계산 금지.

---

*참고: `DOJO_DEAR_ME_50_AND_2FLOWS_1PAGE.md`, `DOJO_DEAR_ME_NEXT_CONTENT.md` §7, `src/domain/dojo/flow.ts`.*
