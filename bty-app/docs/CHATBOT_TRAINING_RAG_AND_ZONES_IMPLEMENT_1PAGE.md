# 챗봇 훈련 — RAG·구역별 예시 구현 설계 1페이지

**갱신일**: 2026-03-06  
**근거**: `CHATBOT_TRAINING_RAG_AND_ZONES_1PAGE.md`, `CHATBOT_TRAINING_CHECKLIST.md`, `buildChatMessages.ts`.  
**목적**: RAG 도입·구역별 예시 확장 구현 시 개발용 단일 페이지. UI는 변경 없음(API/프롬프트만).  
**RAG 2차·구역별 확장 설계**: `CHATBOT_TRAINING_RAG_2ND_AND_ZONES_1PAGE.md` 참고.

---

## 1. RAG 구현

| 항목 | 구현 요약 |
|------|------------|
| **1차(MVP)** | 모드별 고정 스펙 조합 유지. `buildChatMessages.ts`에서 mode에 따라 NVC_COACHING_SPEC·HEALING_COACHING_SPEC·META_AND_INTRO_GUIDE 조합만 사용. 문서화만 반영. |
| **주입 위치** | 시스템 블록: BTY_CHAT_GLOBAL_OVERRIDE → "Current mode" → (선택) RAG 스니펫 → NVC/HEALING/META. 기존 순서 유지. |
| **소스 후보** | NVC_COACHING_SPEC, HEALING_COACHING_SPEC, META_AND_INTRO_GUIDE, 모드별 금지/말투(BTY_CHAT_GLOBAL_OVERRIDE 내). Few-shot은 별도 상수(CHAT_FEWSHOT_*). |
| **2차(선택)** | 의도/키워드 기반 스펙 검색·주입. 스펙 문단 메타데이터(모드, 태그) 저장 후 검색 API 또는 프리셋 매핑. 별도 1페이지 설계. |

---

## 2. 구역별 예시 확장 구현

| 구역 | 파일·상수 | 구현 내용 |
|------|-----------|-----------|
| **center** | `buildChatMessages.ts` CHAT_FEWSHOT_CENTER | Dear Me·자존감 회복 톤 예시 2~3턴 추가. "안전해요", "그대로 괜찮아요" 톤. 기존 3~4턴 유지·추가 후 6메시지 이하 제약 확인. |
| **foundry** | CHAT_FEWSHOT_FOUNDRY | Dojo·역지사지·리더십 질문 2~3턴 추가. "다른 관점은?", "가치와 일치해?" 예시. |
| **arena** | CHAT_FEWSHOT_ARENA | 시나리오·결정·트레이드오프 2~3턴 추가. 관찰형·결과 중심 톤. |
| **bty / today-me** | mode 전달·i18n | pathname `/bty` → foundry/arena, `/dear-me` 등 → center. 구역 레이블 명시 시 해당 CHAT_FEWSHOT_*만 사용. Chatbot.tsx·route에서 mode 일관 전달 확인. |

**제약**: 대화 6메시지 이하일 때만 few-shot 삽입(기존 동일). 예시 확장 시 토큰 상한 확인.

---

## 3. 구현 체크리스트

- [x] RAG 1차: 현재 모드별 고정 조합 문서화(buildChatMessages 주석)·CHAT_FEWSHOT_CENTER/FOUNDRY/ARENA 각 2턴 추가 완료.
- [x] center: CHAT_FEWSHOT_CENTER 2~3턴 추가 후 테스트.
- [x] foundry: CHAT_FEWSHOT_FOUNDRY 2~3턴 추가 후 테스트.
- [x] arena: CHAT_FEWSHOT_ARENA 2~3턴 추가 후 테스트.
- [ ] RAG 2차: 의도/키워드 기반 스펙 검색·주입 — `CHATBOT_TRAINING_RAG_2ND_AND_ZONES_1PAGE.md` 설계 참고.
- [ ] 구역별 예시 2차 확장: center/foundry/arena 각 1~2턴 추가(토큰 상한 점검).
- [ ] bty vs today-me: mode·pathname 매핑 및 구역별 few-shot 사용 경로 검증.

---

*참고: `CHATBOT_TRAINING_RAG_AND_ZONES_1PAGE.md`, `buildChatMessages.ts`, `CHATBOT_SYSTEM_PROMPT_AND_VOICE.md`.*
