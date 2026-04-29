# 챗봇 훈련 — RAG 2차·구역별 예시 확장 설계 1페이지

**갱신일**: 2026-03-06  
**목적**: RAG 1차(모드별 고정 조합·구역별 few-shot 2턴) 완료 후, **RAG 2차**(의도/키워드 기반 스펙 주입)와 **구역별 예시 확장** 방향을 1페이지로 정리.  
**기준**: `CHATBOT_TRAINING_RAG_AND_ZONES_IMPLEMENT_1PAGE.md`, `CHATBOT_TRAINING_RAG_AND_ZONES_1PAGE.md`, `buildChatMessages.ts`.

---

## 0. 1차·2차 완료 요약

| 항목 | 상태 | 비고 |
|------|------|------|
| **RAG 1차** | ✅ 완료 | 모드별 고정 스펙 조합. buildChatMessages 주석·BTY_CHAT_GLOBAL_OVERRIDE → Current mode → NVC/HEALING/META. |
| **RAG 2차(프리셋)** | ✅ 완료 | RAG_SPEC_CHUNKS(id, content, modes)·getRagSpecForMode(mode). buildSystemPrompt에서 getRagSpecForMode 사용. |
| **구역별 few-shot** | ✅ 완료 | CHAT_FEWSHOT_CENTER/FOUNDRY/ARENA 각 2턴(1차)+ 1~2턴(2차). center: 자연스러워요/한 번에 하나, foundry: 장기적 영향/의미, arena: 결과 해석·다음 행동. |
| **제약** | 유지 | 대화 6메시지 이하일 때만 few-shot 삽입. 토큰 상한 확인. |

---

## 1. RAG 2차 설계 (의도/키워드 기반 스펙 주입)

| 항목 | 설계 요약 |
|------|-----------|
| **목표** | 사용자 발화·모드에 따라 **해당하는 스펙 문단·예시만** 검색해 시스템 프롬프트에 주입. 토큰 절감·맥락 정확도 향상. |
| **소스** | NVC_COACHING_SPEC, HEALING_COACHING_SPEC, META_AND_INTRO_GUIDE 문단 단위. Few-shot 대화(구역별)는 별도 상수 유지. |
| **메타데이터** | 각 문단에 모드(center|foundry|arena), 태그(예: 감정명확화, 트리거, NVC4요소, 메타질문) 부여. 키워드 목록 또는 짧은 설명문. |
| **검색 시점** | 요청 시(실시간). 모드 + (선택) 사용자 마지막 발화 키워드 추출 → 매칭 문단 ID 목록 → 해당 문단만 concat. |
| **주입 위치** | buildChatMessages: 시스템 블록 내 "Current mode" 다음, 기존 고정 스펙 앞. RAG 2차 미구현 시에는 1차와 동일(전체 고정 조합). |
| **인덱스 옵션** | (A) 프리셋 매핑: 모드+태그 → 문단 ID 배열(정적). (B) 키워드 매칭: 발화에서 키워드 추출 → 태그 매칭 → 문단. (C) 벡터 검색: 2차 이후, 임베딩·유사도 검색. |
| **제약** | 주입 총 길이 토큰 상한(예: 500~800). 검색 지연 < 100ms 목표. fallback: RAG 실패 시 1차 방식(전체 고정) 사용. |

---

## 2. 구역별 예시 확장 설계

| 구역 | 1차(완료) | 2차 확장 방향 |
|------|-----------|----------------|
| **center** | CHAT_FEWSHOT_CENTER 2턴. 안전해요/그대로 괜찮아요 톤. | 1~2턴 추가: "지금 느끼는 건 자연스러워요", "한 번에 하나만 보면 돼요". 6메시지 이하 제약 유지. |
| **foundry** | CHAT_FEWSHOT_FOUNDRY 2턴. 다른관점/가치일치. | 1~2턴 추가: "장기적으로 어떤 영향이 있을까요?", "이 선택이 당신에게 어떤 의미가 있나요?". |
| **arena** | CHAT_FEWSHOT_ARENA 2턴. 트레이드오프·우선순위. | 1~2턴 추가: 시나리오 결과 해석·다음 행동 한 문장 유도. 관찰형 톤 유지. |
| **공통** | — | 예시 품질: 1~3문장 응답, 금지 표현 없음, 모드 톤 일치. 확장 후 시스템+few-shot 토큰 로그·상한 점검. |

---

## 3. 구현 우선순위·체크리스트

| 순서 | 항목 | 비고 |
|------|------|------|
| 1 | RAG 2차: 스펙 문단 메타데이터(모드·태그) 정의 | 문단 단위 분리·태그 부여. buildChatMessages 또는 별도 JSON/상수. |
| 2 | RAG 2차: 프리셋 매핑(모드 → 문단 ID 배열) | 1차 fallback 유지. 주입 길이 제한. |
| 3 | (선택) 키워드 추출·태그 매칭 | 마지막 발화에서 단어 추출 → 태그 매칭 → 문단 필터. |
| 4 | 구역별 예시: center/foundry/arena 각 1~2턴 추가 | CHAT_FEWSHOT_* 상수 확장. 토큰 상한 확인. |

---

*참고: CHATBOT_TRAINING_RAG_AND_ZONES_IMPLEMENT_1PAGE.md, CHATBOT_TRAINING_RAG_AND_ZONES_1PAGE.md, buildChatMessages.ts, NEXT_PROJECT_RECOMMENDED §2 B.*
