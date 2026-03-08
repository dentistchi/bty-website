# 챗봇 훈련 심화 — RAG 2차·구역별 예시 확장 설계 1페이지

**목적**: RAG 2차(의도/키워드 기반 검색·주입)와 구역별(center/foundry/arena) 예시 확장을 1페이지로 설계.  
**기준**: CHATBOT_SYSTEM_PROMPT_AND_VOICE.md, buildChatMessages.ts, NEXT_PROJECT_RECOMMENDED §2 B.  
**갱신일**: 2026-03-06. RAG 2차 설계·구역별 구체 예시 문장 추가.

---

## 1. RAG 1차 (현재) 요약

| 항목 | 내용 |
|------|------|
| **방식** | 모드별 고정 프리셋. `RAG_PRESET_BY_MODE` → `getRagSpecForMode(mode)`로 NVC/HEALING/META 문단 concat. |
| **주입 위치** | 시스템 블록 내 "Current mode" 다음. |
| **인덱스** | `RAG_PARAGRAPHS`: id, content, modes, tags. 벡터 DB 없음. |

---

## 2. RAG 2차 설계 (의도/키워드 기반 검색·주입)

| 항목 | 내용 (스펙) |
|------|-------------|
| **목표** | 사용자 마지막 발화에 따라 추가 스펙 문단을 검색해 1차 프리셋 뒤에 한정적으로 주입. |
| **검색 키** | (1) 사용자 발화에서 키워드 추출(한/영): 감정·트리거·NVC·가치·결정·시나리오 등. (2) 또는 의도 라벨 1개(감정명확화, 트리거, NVC4요소, 메타질문 등). |
| **인덱스** | 기존 `RAG_PARAGRAPHS`의 `tags` + 선택적 `keywords: string[]` 확장. 모드 일치 문단만 후보. |
| **매칭** | 발화 키워드와 문단 tags/keywords 교집합. 이미 프리셋에 포함된 문단 제외. 상위 1~2개 문단만 추가. |
| **주입** | `getRagSpecForMode(mode)` 결과 뒤에 `getRagSpecExtraByIntent(lastUserMessage, mode)` concat. 총 문자 상한(`RAG_MAX_CHARS`) 유지. |
| **Fallback** | 매칭 없거나 초과 시 1차만 사용. 2차 비활성화 플래그 지원 시 1차만. |

**구현 순서**: (1) RAG_PARAGRAPHS에 keywords 선택 추가. (2) `getRagSpecExtraByIntent(text, mode)` 함수. (3) buildChatMessages에서 대화 히스토리 마지막 user content 전달해 2차 결과 붙이기.

---

## 3. 구역별 예시 확장

| 구역 | 현재 | 확장 방향·구체 예시 |
|------|------|----------------------|
| **center** | CHAT_FEWSHOT_CENTER 3~4턴 | Dear Me·자존감 회복 톤 2~3턴 추가. **예시**: user "오늘은 아무것도 안 하고 싶어요" → assistant "지금 그대로 괜찮아요. 하고 싶지 않다는 느낌도 자연스럽습니다. 오늘은 몸이 어떤지 한 번만 느껴 보실 수 있을까요?" / user "나는 잘못한 것 같아요" → assistant "여기는 안전한 공간이에요. 그런 생각이 들 때는 몸이 어떤지, 어디가 무거운지 잠깐만 느껴 보세요. 그다음에 그 느낌이 어떤 필요와 연결돼 있는지 같이 볼 수 있어요." |
| **foundry** | CHAT_FEWSHOT_FOUNDRY | Dojo·역지사지·리더십 질문 2~3턴 추가. **반영됨**: "상사가 제 아이디어를 무시했어요" → "다른 관점은?", "가치와 일치해?" / "지금 당장 승진 지원을 할까 말까" → "장기적으로 어떤 영향?", "이 선택이 당신에게 어떤 의미?" (buildChatMessages 내 주석 §2 foundry 2차). |
| **arena** | CHAT_FEWSHOT_ARENA | 시나리오·결정·트레이드오프 2~3턴 추가. **예시**: user "A팀 vs B팀 신규 프로젝트" → 관찰형·결과 지표 비교 한 줄 + 다음 행동 1개. (이미 1턴 구현됨.) 추가 제안: user "우선순위를 바꾸라고 상사가 압박해요" → assistant "선택은 '상사 기대 충족'과 '현재 우선순위 유지'의 트레이드오프입니다. 질문: 기한·목표 수치가 명확한가요? 다음 행동: 두 방향 각 1주일 결과(지표 1개)를 가정해 표로 적어보세요." |
| **bty / today-me** | 모드로 center/foundry 배정 | 구역 레이블 명시 시 해당 구역 전용 few-shot 1세트 추가는 i18n·mode 전달 경로 확인 후 결정. 현재는 모드(center/foundry/arena)만 사용. |

**제약**: 대화 6메시지 이하일 때만 few-shot 삽입. 예시 확장 시 토큰 상한 확인.

---

## 4. 검증·구현 체크리스트

- [x] RAG 1차: 모드별 고정 스펙 조합. 문서화·getRagSpecForMode 반영.
- [ ] RAG 2차: 의도/키워드 기반 검색·주입 구현(getRagSpecExtraByIntent, RAG_PARAGRAPHS keywords 확장).
- [ ] 구역별 예시: center 2~3턴 위 예시 문장으로 CHAT_FEWSHOT_CENTER 상수 갱신; arena 1턴 추가 제안 반영 여부 결정.
- [ ] bty vs today-me: 구역별 few-shot 분리 여부는 모드 전달 경로 확정 후.

*참고: CHATBOT_SYSTEM_PROMPT_AND_VOICE.md, src/lib/bty/chat/buildChatMessages.ts, NEXT_PROJECT_RECOMMENDED §2 B.*
