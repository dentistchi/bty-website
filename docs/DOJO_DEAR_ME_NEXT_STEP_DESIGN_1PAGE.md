# Dojo·Dear Me 콘텐츠 심화 — 다음 단계 설계 1페이지

**갱신일**: 2026-03-06  
**목적**: 50문항 DB화·연습 플로우 구현 **후보**를 한 페이지로 정리. 보드·다음 배치 선정 시 이 문서를 참고해 구현 작업을 고른다.  
**기준**: `DOJO_DEAR_ME_50_AND_2FLOWS_1PAGE.md` §0·§5, `DOJO_DEAR_ME_50_DB_AND_FLOWS_IMPLEMENT_1PAGE.md`, `DOJO_50_SUBMIT_RESULT_API_1PAGE.md`, `DEAR_ME_LETTER_API_1PAGE.md`.

---

## 0. 현재 상태

| 항목 | 상태 | 비고 |
|------|------|------|
| **50문항 DB·GET API** | ✅ 완료 | `dojo_questions` 시드 50건. GET `/api/dojo/questions`. domain/dojo/questions. |
| **연습 플로우 2종 진입·연동** | ✅ 완료 | 대시보드 Dojo 카드 → 역지사지/assessment. `/bty/integrity`, `/assessment` 연동. |
| **50문항 제출·결과 API** | 설계 완료 | `DOJO_50_SUBMIT_RESULT_API_1PAGE.md`. POST submit·영역별 점수·Dr. Chi 코멘트. |
| **Dear Me 편지 API** | 설계 완료 | `DEAR_ME_LETTER_API_1PAGE.md`. POST letter·답장(템플릿/LLM). 구현·저장은 2차. |

---

## 1. 다음 단계 구현 후보

| 후보 | 내용 | 참고 스펙 | 우선순위 |
|------|------|------------|----------|
| **50문항 제출·결과** | POST `/api/dojo/submit` 검증·도메인(flow.ts)·영역별 점수·summaryKey·Dr. Chi 코멘트(템플릿). 결과 화면(assessment/result) 연동. | DOJO_50_SUBMIT_RESULT_API_1PAGE | 1 |
| **Dear Me 편지 API·UI** | POST `/api/dear-me/letter` 구현·답장 표시. 저장(테이블)은 2차 선택. | DEAR_ME_LETTER_API_1PAGE | 2 |
| **연습 플로우 2종 화면 보강** | 역지사지: 안내·시나리오·피드백·완료 단계 정합성. Dear Me: 편지 쓰기·답장·완료 화면. | DOJO_DEAR_ME_50_DB_AND_FLOWS_IMPLEMENT_1PAGE §2·§3 | 3 |
| **50문항·Dear Me 저장(2차)** | dojo_submissions·dear_me_letters 테이블·RLS·이력 조회(선택). | 각 API 설계 §저장 | 4 |
| **콘텐츠 확장** | 문항 텍스트·i18n 보강. 연습 시나리오 문구 추가. | DOJO_DEAR_ME_NEXT_CONTENT §1-4 | 5 |

---

## 2. 권장 구현 순서

1. **50문항 제출·결과**: API(POST submit) → i18n(코멘트) → 결과 페이지(영역별 점수·Dr. Chi 표시).
2. **Dear Me 편지**: API(POST letter·답장) → 편지 쓰기·답장·완료 UI. 저장은 선택.
3. **연습 플로우 보강**: 역지사지 단계별 문구·Dear Me 1~4단계 화면 연동.
4. **저장·콘텐츠**: 제출 이력·편지 저장(2차), 문항/시나리오 콘텐츠 확장.

---

*참고: NEXT_PROJECT_RECOMMENDED §2 A, DOJO_DEAR_ME_50_AND_2FLOWS_1PAGE §5.*
