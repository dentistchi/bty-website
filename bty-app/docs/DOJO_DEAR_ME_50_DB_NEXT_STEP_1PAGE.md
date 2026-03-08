# Dojo·Dear Me 콘텐츠 다음 단계 설계 1건 (50문항 DB화 등)

**갱신일**: 2026-03-06  
**목적**: 50문항 DB화·저장 2차·연동을 **다음 단계 설계**로 1페이지 정리.  
**기준**: `DOJO_DEAR_ME_NEXT_CONTENT.md` §1-4·§7, `DOJO_DEAR_ME_50_AND_FLOWS_NEXT_STEP_1PAGE.md`, `DOJO_DEAR_ME_FLOWS_AND_STORAGE_2ND_1PAGE.md` §2.

---

## 1. 50문항 DB화 범위

| 구분 | 설계 요약 |
|------|------------|
| **문항 정의** | **옵션 A**: 문항 텍스트·선택지 라벨은 i18n 유지(키: dojo.questions.area_N_id_M, dojo.choices.L1~L5). **옵션 B**: `dojo_questions` 테이블(id, area_key, order_index, label_key_ko, label_key_en). 1차 권장 A(i18n). |
| **제출 저장** | `dojo_submissions` (user_id, answers_json, scores_json, summary_key, created_at). RLS 본인만 읽기. POST `/api/dojo/submit` 성공 시 INSERT. |
| **결과·코멘트** | 영역별 점수·summary_key는 도메인 `computeDojo50Result` 유지. Dr. Chi 코멘트는 i18n mentorComment by summaryKey. DB 저장 시 scores_json·summary_key 포함. |

---

## 2. 스키마·마이그레이션 요약

| 테이블 | 용도 | 주요 컬럼 |
|--------|------|------------|
| **dojo_submissions** | 50문항 제출 이력 | id, user_id(uuid), answers_json(jsonb), scores_json(jsonb), summary_key(text), created_at(timestamptz). RLS: auth.uid() = user_id. |
| **(선택) dojo_questions** | 문항 메타(옵션 B 시) | id, area_key, order_index, label_key_ko, label_key_en. 1차 생략 가능. |

**마이그레이션**: `dojo_submissions` 1개 파일. 인덱스: user_id, created_at DESC(목록 조회 2차).

---

## 3. API·도메인 연동

| 구분 | 내용 |
|------|------|
| **POST /api/dojo/submit** | 기존 validateDojo50Submit·computeDojo50Result 호출. 성공 시 dojo_submissions INSERT(저장 2차). 응답 shape 유지(scores, mentorComment 등). |
| **GET 목록(2차)** | GET `/api/dojo/submissions` 또는 `/api/me/dojo-submissions` — 본인 제출 이력. 페이지네이션·최대 N건 선택. |
| **도메인** | `src/domain/dojo/flow.ts` 순수 함수 유지. 저장은 API/서비스 레이어에서만. |

---

## 4. Dear Me·연습 플로우 연계

- **Dear Me 편지 저장**: `dear_me_letters` 설계는 `DOJO_DEAR_ME_FLOWS_AND_STORAGE_2ND_1PAGE.md` §2-2 유지.
- **역지사지 연습**: 제출 저장은 현재 없음. 50문항 DB화 완료 후 동일 패턴(integrity_submissions 등) 검토 가능.

---

## 5. 체크리스트

| 순서 | 내용 |
|------|------|
| 1 | 50문항 문항·선택지 i18n 키 정리(dojo.questions.*, dojo.choices.*). |
| 2 | dojo_submissions 마이그레이션·RLS 작성. |
| 3 | POST /api/dojo/submit 성공 시 INSERT 연동. 기존 응답 계약 유지. |
| 4 | (2차) GET 제출 목록 API·UI. |

---

*참고: DOJO_DEAR_ME_NEXT_CONTENT.md §7, DOJO_50_SUBMIT_RESULT_API_1PAGE.md, DOJO_DEAR_ME_FLOWS_AND_STORAGE_2ND_1PAGE.md §2-1.*
