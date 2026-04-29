# Phase 1-1: 전역 챗봇 Dear Me 안전 밸브

전역 챗봇에서 **낮은 자존감 패턴**이 감지되면 LLM 호출 없이 안전 밸브 메시지 + **Dear Me 링크**를 반환한다.

---

## 동작

1. **POST /api/chat** 에서 사용자 메시지가 들어오면 `isLowSelfEsteemSignal(userContent)` 로 패턴 검사.
2. 감지 시: `getSafetyValveMessage(lang)` 메시지와 `suggestDearMe: true` 를 JSON으로 반환. (OpenAI 호출 없음)
3. **Chatbot** 클라이언트: `suggestDearMe === true` 인 응답이면 메시지 아래에 **"Dear Me로 가기 →" / "Go to Dear Me →"** 링크를 표시. (`/en/dear-me`, `/ko/dear-me`)

---

## 패턴 (chatGuards.ts)

- **한국어:** 못하겠어, 지쳐, 포기, 그만둘게, 쓸모없, 가치 없, 의미 없, 자격 없어, 너무 힘들어 등.
- **영어:** I can't do/make/handle, I give up, I'm worthless/useless, too hard/tired, no point, I hate myself, feel like failure 등.

패턴 추가·수정은 `src/lib/bty/chat/chatGuards.ts` 의 `LOW_SELF_ESTEEM_PATTERNS` 에서.

---

## 관련 파일

- `src/app/api/chat/route.ts` — 낮은 자존감 감지 시 안전 밸브 응답
- `src/lib/bty/chat/chatGuards.ts` — `isLowSelfEsteemSignal`, `getSafetyValveMessage`, 패턴 정의
- `src/components/Chatbot.tsx` — `suggestDearMe` 시 Dear Me 링크 렌더
