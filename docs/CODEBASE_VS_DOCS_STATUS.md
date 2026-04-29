# 코드베이스 vs 문서 기준 정리

다른 PC에서 작업한 뒤 `git restore`로 맞춘 **현재 코드**와 **docs에 적힌 기준(체크리스트·멘토 훈련 등)** 이 얼마나 맞는지 정리한 문서입니다.

---

## 1. 챗봇 (POST /api/chat) — CHATBOT_TRAINING_CHECKLIST.md 기준

| 항목 | 문서(체크리스트) | 현재 코드 |
|------|------------------|-----------|
| **BTY Dojo 페르소나** | 리더십 훈련 가이드, 질문 예("다른 관점은?", "장기적 영향?", "가치와 일치?"), 금지(답 주기·판단) | ⚠️ 짧은 코치 문구 수준 (개선 여지 있음) |
| **Dear Me 페르소나** | 안전한 공간, "지금 상태도 충분히 의미 있습니다" 등 예시, 금지(XP·리더보드·경쟁) | ⚠️ 짧은 "보호적 존재" 문구 (개선 여지 있음) |
| **detectLang** | 클라이언트 lang + 마지막 메시지 한글 여부로 보정 | ✅ chatGuards에서 detectLang 사용 |
| **Few-shot (Dojo)** | 대화 6메시지 이하일 때 3턴 예시 | ✅ conversationMessages.length ≤ 6 일 때 Dojo few-shot 적용 |
| **filterBtyResponse** | bty 모드에서 위로 문구 감지 시 대체 문장 | ✅ dojo 모드에서 filterBtyResponse 적용 |
| **토큰/히스토리** | 최근 8턴, max_tokens 200 | ✅ HISTORY_SLICE 8, max_tokens 200 |
| **usedFallback** | API 실패 시 클라이언트에 fallback 사용 알림 | ✅ API 응답에 usedFallback 포함, Chatbot UI에 "일시적으로 기본 메시지…" 표시 |

→ **챗 API**는 지금 **체크리스트에 적힌 detectLang, few-shot 조건, filterBtyResponse, 8턴/200토큰, usedFallback 이 반영된 상태**입니다. Dojo/Dear Me 상세 페르소나는 추가 개선 가능.  
---

## 2. 멘토 (POST /api/mentor)

| 항목 | 문서(DR_CHI_VOICE, MENTOR_DEPTH) | 현재 코드 |
|------|----------------------------------|-----------|
| **AI 엔진** | Gemini 또는 대체 | ✅ Gemini → 실패 시 **OpenAI 대체** 있음 |
| **usedFallback** | — | ✅ fallback 사용 시 `usedFallback: true` 반환 |
| **Dr. Chi 캐릭터/사상** | drChiCharacter.ts, 스타일 프로필 → 시스템 프롬프트 | ✅ **api/mentor/route.ts에서 DR_CHI_PHILOSOPHY·DR_CHI_FEW_SHOT_EXAMPLES 사용** |
| **Few-shot (멘토)** | mentorFewshotRouter, drChiExamples / mentor_training_dataset_v1 | ✅ **Dr. Chi 예시 최대 2턴 시스템에 삽입**, buildMentorMessagesDual와 함께 사용 |

→ **멘토 API**는 **Gemini/OpenAI 전환, usedFallback, Dr. Chi 캐릭터·few-shot** 이 **연결된 상태**입니다.

---

## 3. 그 밖에 문서에만 있는 것 (코드에 없음)

- **Dojo/Dear Me XP** (DOJO_DEAR_ME_XP_SPEC.md): `recordActivityXp`, `activity_xp_events` — ✅ **chat/mentor API에서 성공 시 recordActivityXp 호출함** (비로그인 시 미호출).
- **Chatbot.tsx**: 체크리스트의 "공간 라벨(Dojo · 연습 / Dear Me)"·"소개 문구" — **실제 구현 여부는 Chatbot.tsx 확인 필요**.
- **Arena 자유 입력** (ARENA_FREE_RESPONSE_SPEC.md): `POST /api/arena/free-response` — ✅ **API 구현됨**. ✅ **Arena UI**: "기타 (직접 입력)" 제출 시 free-response 호출, 피드백(praise/suggestion) + XP Step 3에 표시.

---

## 4. 정리

- **챗**: **detectLang, few-shot(6메시지 이하), filterBtyResponse, 8턴/200토큰, usedFallback** 이 **코드에 반영됨**. Dojo/Dear Me 상세 페르소나는 추가 개선 가능.
- **멘토**: **Gemini + OpenAI 대체, usedFallback, Dr. Chi 캐릭터·few-shot** 이 **연결됨**.
- **XP**: **chat/mentor API에서 성공 시 recordActivityXp 호출**함. Arena free-response는 API + UI 연동 완료.

추가로 맞출 항목이 있으면 (챗 상세 페르소나, 체크리스트 나머지 등) 알려주시면 그 순서로 적용하겠습니다.
