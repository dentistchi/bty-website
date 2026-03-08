# Dojo·Dear Me 콘텐츠 심화 — 50문항·연습 플로우 2종 설계 1페이지

**갱신일**: 2026-03-06  
**목적**: 50문항 목차 + 연습 플로우 2종을 한 페이지로 정리. 구현 상태 반영 후 콘텐츠 심화·다음 단계 명시.  
**기준**: `docs/DOJO_DEAR_ME_NEXT_CONTENT.md` §1-4·§6·§7·§2. **50문항 콘텐츠 확장 설계(목차·플로우)** → `DOJO_DEAR_ME_50_CONTENT_EXPANSION_1PAGE.md` 참고.

---

## 0. 구현 상태 갱신 (2026-03-06)

| 항목 | 상태 | 비고 |
|------|------|------|
| **50문항 DB·API** | ✅ 완료 | `dojo_questions` 마이그레이션·시드 50건. GET `/api/dojo/questions`. `domain/dojo/questions`·mapDojoQuestionRow. choiceValues [1..5]. |
| **연습 플로우 2종 진입·연동** | ✅ 완료 | 대시보드 Dojo 카드·역지사지/assessment 링크. `/bty/integrity`·`/assessment` 연동. |
| **50문항 제출·결과** | 설계 완료 | POST 제출·영역별 점수·Dr. Chi 코멘트 설계 → `DOJO_50_SUBMIT_RESULT_API_1PAGE.md`. 구현은 API·i18n·UI 순. |
| **Dear Me 편지 저장·API** | 설계 완료 | 편지 저장·답장 API 설계 → `DEAR_ME_LETTER_API_1PAGE.md`. 구현은 API·저장(2차)·UI 순. |

---

## 1. 50문항 목차 (Dojo 분석)

| 영역 | 문항 수 | 설명 | 입력 |
|------|---------|------|------|
| 역지사지 | 10 | 상대 입장 이해·역할 뒤집기 | 5단계 리커트 |
| 소통·경청 | 10 | 경청·질문·피드백 수용 | 5단계 리커트 |
| 리더십·책임 | 10 | 결정·위임·피드백 주기 | 5단계 리커트 |
| 갈등·협상 | 10 | 대립·타협·윈윈 | 5단계 리커트 |
| 팀·협업 | 10 | 팀 목표·역할·신뢰 | 5단계 리커트 |
| **총** | **50** | 진행: 한 번에 10문항 또는 전체 → 제출 → 영역별 점수 + Dr. Chi 코멘트 | |

**도메인**: `src/domain/dojo/flow.ts` — validateDojo50Submit, computeDojo50Result.

---

## 2. 연습 플로우 1종: 역지사지 연습

| 단계 | 내용 |
|------|------|
| 진입 | `/bty` entryIntro + startCta → `/bty/mentor`(훈련 선택) |
| 1단계 | 훈련 선택: 멘토 주제 또는 "역지사지 시뮬레이터" → `/bty/integrity` |
| 2. 안내 | 역지사지 목표·방법 1~2문장 |
| 3. 시나리오 | 상황 제시 + 선택지/텍스트 입력 |
| 4. 피드백 | Dr. Chi 코멘트 (`/api/mentor` 또는 Dojo 전용) |
| 5. 완료 | "오늘의 연습 완료" + 다음 연습/멘토로 |

**도메인**: validateIntegritySubmit. **구현**: `/bty/integrity`(integrity 페이지).

---

## 3. 연습 플로우 2종: Dear Me 자존감 훈련

| 단계 | 내용 (스펙) |
|------|-------------|
| 진입 | `/dear-me` entryIntro + startCta → 본문으로 |
| 1. 오늘의 나 | 기분·에너지 1~3문항 (선택). 문항 정의 2차 |
| 2. 편지 쓰기 | "나에게 쓰는 편지" 프롬프트 + 자유 텍스트. 저장·비공개 |
| 3. 답장/피드백 | Dr. Chi 또는 Dear Me 톤의 격려 메시지. LLM/템플릿 |
| 4. 완료 | "오늘의 편지 완료" + Dear Me 대시 또는 챗으로 |

**API 후보**: POST `/api/dear-me/letter`. **설계**: `DEAR_ME_LETTER_API_1PAGE.md`. **데이터**: 편지 텍스트·메타(날짜, 사용자) — 설계 1페이지 반영. **참고**: DOJO_DEAR_ME_NEXT_CONTENT §2.

---

## 4. 검증 체크리스트

- [x] 50문항: 문항 DB·GET API·시드 50건 완료. 도메인(flow.ts)·questions.ts 반영됨.
- [x] 역지사지 플로우: 진입·1단계·대시/assessment 링크 연동 완료. 2~5단계(안내·시나리오·피드백·완료)는 기존 integrity 유지.
- [ ] Dear Me 플로우: 진입 이후 1~4단계(오늘의 나·편지 쓰기·답장·완료). **편지 API 설계 완료** `DEAR_ME_LETTER_API_1PAGE.md`. 구현은 API·저장(2차)·UI 순.
- [ ] 50문항 제출: **설계 완료** `DOJO_50_SUBMIT_RESULT_API_1PAGE.md`. POST /api/dojo/submit·결과(영역별 점수·멘토 코멘트) API·UI 구현.

---

## 5. 콘텐츠 심화·다음 단계

| 구분 | 내용 |
|------|------|
| **50문항 확장** | 문항 텍스트·영역별 목차는 §1 유지. 실제 문항 콘텐츠 보강·i18n 확장은 콘텐츠 작업으로 진행. |
| **연습 플로우 2종 설계 갱신** | 역지사지: §2 유지. Dear Me: §3 단계별 상세(오늘의 나 문항 수·편지 저장 정책·답장 톤) 2차 설계. |
| **구현 우선순위** | 1) POST `/api/dojo/50-submit`·결과 화면 2) Dear Me letter API·저장 3) 콘텐츠 텍스트 확장. |

*참고: DOJO_DEAR_ME_NEXT_CONTENT.md, DOJO_DEAR_ME_50_DB_AND_FLOWS_IMPLEMENT_1PAGE.md, src/domain/dojo/flow.ts, NEXT_PROJECT_RECOMMENDED §2 A.*
