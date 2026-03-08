# Dojo·Dear Me 50문항·연습 플로우 다음 단계 설계 (NEXT_CONTENT §1 확장)

**갱신일**: 2026-03-09  
**목적**: `DOJO_DEAR_ME_NEXT_CONTENT.md` §1(Dojo 1차 콘텐츠 후보·50문항·연습 플로우)을 **다음 단계** 설계로 확장한 1페이지.  
**기준**: `DOJO_DEAR_ME_NEXT_CONTENT.md` §1-4·§6·§7, `DOJO_DEAR_ME_50_AND_2FLOWS_1PAGE.md` §0·§5, `DOJO_DEAR_ME_50_CONTENT_EXPANSION_1PAGE.md`, `DOJO_DEAR_ME_FLOWS_AND_STORAGE_2ND_1PAGE.md`.

---

## §1 확장 요약

NEXT_CONTENT §1의 **50문항 분석(1-1)·연습 플로우(1-2)·2차 스펙(1-4)** 이후의 다음 단계를 아래 §2·§3로 정리.

---

## 1. 50문항 다음 단계

| 구분 | 다음 단계 설계 |
|------|----------------|
| **콘텐츠** | 문항 텍스트·5단계 선택지 라벨(ko/en) i18n. 영역별 결과 해석 문구(1~2문장)·Dr. Chi 코멘트 톤 1차 목록. |
| **저장(2차)** | `dojo_submissions` 테이블·RLS(본인만 읽기)·POST submit 성공 시 INSERT(선택). GET 목록 2차. |
| **참고** | `DOJO_DEAR_ME_50_CONTENT_EXPANSION_1PAGE.md` §1·§3. `DOJO_DEAR_ME_FLOWS_AND_STORAGE_2ND_1PAGE.md` §2-1. |

---

## 2. 연습 플로우 2종 다음 단계

### 2-1. 역지사지 연습

| 구분 | 다음 단계 설계 |
|------|----------------|
| **안내(2단계)** | 역지사지 목표·방법 안내 문구 1~2문장 i18n(dojo.integrityIntro, integrityGoal 등). |
| **시나리오(3단계)** | 시나리오 3~5종 텍스트·선택지 라벨 i18n. validateIntegritySubmit·POST /api/mentor 유지. |
| **피드백·완료** | Dr. Chi 코멘트 톤·완료 문구·다음 제안(doneCtaAssessment 등) i18n 점검. |
| **참고** | `DOJO_DEAR_ME_50_CONTENT_EXPANSION_1PAGE.md` §2-1. `DOJO_DEAR_ME_FLOWS_AND_STORAGE_2ND_1PAGE.md` §1-1. |

### 2-2. Dear Me 자존감 훈련

| 구분 | 다음 단계 설계 |
|------|----------------|
| **오늘의 나(1단계)** | 기분·에너지 등 문항 1~3 목차·문구 설계. 선택지 또는 자유 텍스트. 2차 확장. |
| **편지·답장** | "나에게 쓰는 편지" 프롬프트·placeholder i18n. Dear Me 전용 답장 톤 가이드·격려 문구 템플릿. |
| **저장(2차)** | `dear_me_letters` 테이블·RLS·POST letter 성공 시 INSERT. GET 목록(선택) 2차. 보관·개인정보 정책 1줄 명시. |
| **참고** | `DOJO_DEAR_ME_50_CONTENT_EXPANSION_1PAGE.md` §2-2. `DOJO_DEAR_ME_FLOWS_AND_STORAGE_2ND_1PAGE.md` §1-2·§2-2. |

---

## 3. 체크리스트·우선순위

| 순서 | 내용 |
|------|------|
| 1 | 50문항: 영역별 결과 해석 문구·Dr. Chi 코멘트 톤 1차 목록. |
| 2 | 역지사지: 안내 문구 i18n·시나리오 3~5종 텍스트·선택지 라벨. |
| 3 | Dear Me: "오늘의 나" 문항 1~3 목차·편지 프롬프트·답장 톤 가이드. |
| 4 | (2차) dojo_submissions·dear_me_letters 마이그레이션·RLS·API 저장 연동. |

*참고: DOJO_DEAR_ME_NEXT_CONTENT.md §1, DOJO_DEAR_ME_50_AND_2FLOWS_1PAGE.md §5, NEXT_PROJECT_RECOMMENDED §2 A.*
