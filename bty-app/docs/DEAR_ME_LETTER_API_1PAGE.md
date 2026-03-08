# Dear Me 편지 저장·답장 API 설계 1페이지

**갱신일**: 2026-03-15  
**목적**: 편지 저장·답장 API를 1페이지로 정리. 구현 시 DOJO_DEAR_ME_NEXT_CONTENT §2·기존 멘토/챗 패턴 참고.  
**기준**: `DOJO_DEAR_ME_NEXT_CONTENT.md` §2, `DOJO_DEAR_ME_50_AND_2FLOWS_1PAGE.md` §3.

---

## 1. API 계약

| 항목 | 내용 |
|------|------|
| **엔드포인트** | `POST /api/dear-me/letter` |
| **인증** | 세션 필수. 미인증 시 401. |
| **Request body** | `{ letterText: string }` — 편지 본문. 최소 1자, 최대 길이 제한(예: 2000자) 권장. |
| **Response 200** | `{ replyMessage: string }` — Dr. Chi/Dear Me 톤의 격려 답장 1~3문장. (저장 후 생성 또는 저장 없이 생성) |
| **Response 400** | `{ error: "missing_text" \| "text_too_long" }` — 본문 없음 또는 초과. |
| **Response 401** | 미인증. |

---

## 2. 저장 정책

| 항목 | 내용 |
|------|------|
| **테이블 후보** | `dear_me_letters` (user_id, letter_text, reply_text, created_at). PK id. RLS: 본인만 읽기. |
| **비공개** | 편지·답장은 해당 사용자만 조회. 목록 API(GET)는 2차. |
| **보관** | 개인정보·보관 기간 정책은 운영 정책 문서에 1줄 명시 후 구현. |

**1차**: 저장 optional. 응답만 생성해 반환해도 됨. 저장 구현은 2차.

---

## 3. 답장 생성

| 방식 | 내용 |
|------|------|
| **A. 템플릿** | 편지 길이·키워드 무관 1~2문장 격려 문구. i18n `dearMe.replyDefault`(ko/en). |
| **B. LLM** | 기존 `/api/mentor` 또는 Dear Me 전용 프롬프트에 letterText 주입, 1~3문장 격려 생성. (챗/멘토 패턴 재사용.) |

**1차 권장**: A 또는 B. B 선택 시 Dr. Chi/Dear Me 톤(자존감·비판 없음·따뜻한 격려) 유지.

---

## 4. XP·연동

- **XP**: `DOJO_DEAR_ME_XP_SPEC.md`에 따라 Dear Me 편지 제출 시 XP 기록. API에서 activity_xp_events 또는 전용 이벤트 호출(2차).
- **플로우**: `/dear-me` 진입 → 편지 쓰기 폼 → POST → 답장 표시 → 완료.

---

## 5. 구현 체크리스트

- [x] POST `/api/dear-me/letter` 라우트. body 파싱 → letterText 검증(필수·최대 2000자) → 답장 생성(템플릿) → 200 { replyMessage }. **구현됨.** 400 missing_text/text_too_long, 401.
- [x] 답장 문구(ko/en). **구현됨.** getDearMeReplyTemplate(lang)로 ko/en 격려 문구 반환. (i18n 키 dearMe.replyDefault로 이전 시 유지보수 용이.)
- [ ] (2차) 저장: dear_me_letters 마이그레이션·INSERT·RLS.
- [ ] (2차) XP 기록. UI: 편지 입력 폼·답장 표시(이미 /dear-me·DearMeClient 등 존재 여부 확인 가능).

**구현 점검 (2026-03-06)**: 1차 API·답장 템플릿 완료. 저장·XP·UI 연동은 2차.

*참고: DOJO_DEAR_ME_NEXT_CONTENT.md §2, DOJO_DEAR_ME_50_AND_2FLOWS_1PAGE.md §3, /api/mentor 패턴.*
