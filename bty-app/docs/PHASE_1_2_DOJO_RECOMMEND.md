# Phase 1-2: 전역 챗봇 Dojo 추천

전역 챗봇에서 **학습/연습 필요** 패턴이 감지되면 LLM 호출 없이 Dojo 추천 메시지 + **훈련장(Dojo) 링크**를 반환한다. (멘토·역지사지)

---

## 동작

1. **POST /api/chat** 에서 사용자 메시지가 들어오면 `isDojoRecommendSignal(userContent)` 로 패턴 검사.  
   (Phase 1-1 낮은 자존감 감지 이후에 검사.)
2. 감지 시: `getDojoRecommendMessage(lang)` 메시지와 `suggestDojo: true` 를 JSON으로 반환. (OpenAI 호출 없음)
3. **Chatbot** 클라이언트: `suggestDojo === true` 이면 메시지 아래에 **"훈련장(Dojo)으로 가기 →" / "Go to Dojo →"** 링크 표시. (`/en/bty`, `/ko/bty`)

---

## 패턴 (chatGuards.ts)

- **한국어:** 배우고 싶, 어떻게 해야, 연습하고 싶, 도와줘, 가이드/가르쳐/알려줘, 멘토, 역지사지/다른 사람 입장 등.
- **영어:** how to, learn to/about/how, want to learn/practice, help me with, teach me, mentor 등.

패턴 추가·수정은 `src/lib/bty/chat/chatGuards.ts` 의 `DOJO_RECOMMEND_PATTERNS` 에서.

---

## 관련 파일

- `src/app/api/chat/route.ts` — Dojo 추천 감지 시 응답 (전역, mode 무관)
- `src/lib/bty/chat/chatGuards.ts` — `isDojoRecommendSignal`, `getDojoRecommendMessage`
- `src/components/Chatbot.tsx` — `suggestDojo` 시 Dojo 링크 렌더
