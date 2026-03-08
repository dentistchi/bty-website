# 언어 선택에 따른 시나리오·안내·대답 통일 (NEXT_TASKS_2 §1-5)

**목적**: 한국어 선택 시 한국어, 영어 선택 시 영어로 시나리오·안내·시스템 대답이 나오도록 통일.

---

## KO 콘텐츠 경로·포맷 (도메인 데이터)

- **경로**: `bty-app/src/lib/bty/scenario/scenarios.ts` (시나리오 상수), `types.ts` (타입 정의).
- **포맷**: 각 시나리오/선택지에 optional 한글 필드 사용. locale 분기는 API 또는 UI에서 수행.
  - 시나리오: `titleKo`, `contextKo`
  - 선택지: `labelKo`, `resultKo`, `microInsightKo`, `followUp.promptKo`, `followUp.optionsKo`
- **getContextForUser** (engine): 영문 context에서 메타 문구(hidden risk, leadership challenge 등) 제거용. `contextKo`는 그대로 사용(한글 메타 문구 없음).

---

## 적용 내용 요약

### 1. 시나리오·레벨 콘텐츠

- **GET /api/arena/unlocked-scenarios**: 쿼리 파라미터 `?locale=ko` 또는 `?locale=en` 지원. 각 레벨에 `displayTitle` 반환 (ko → title_ko, en → title).
- **대시보드**: `unlocked-scenarios` 호출 시 `locale` 쿼리 전달. ArenaLevelsCard에 전달되는 levels에 `displayTitle` 포함.
- **Arena run 페이지** (bty-arena): URL `locale`로 `displayTitle`/`displayContext` (titleKo/contextKo), 선택지·결과·따라하기는 시나리오 데이터의 labelKo/resultKo/microInsightKo/followUp.*Ko 사용. ScenarioIntro, ChoiceList, OutputPanel에서 locale 분기.

### 2. API·도메인 locale 분기

- **POST /api/bty-arena/submit**: body에 optional `locale: "ko" | "en"` 포함 시, `computeResult`가 해당 언어의 result/microInsight/followUp 반환.
- **도메인**: `src/lib/bty/scenario/engine.ts` `computeResult(payload)` — `payload.locale === "ko"`일 때 resultKo, microInsightKo, followUp.promptKo/optionsKo 사용.
- **POST /api/arena/free-response**: body에 `locale` 포함 시, praise·suggestion 해당 언어로 반환.

### 3. 안내 문구

- 대시보드·멘토·리더보드 등 UI는 `getMessages(locale)`·URL `[locale]` 기반 i18n 사용.

---

## 확인

- URL/경로의 locale (예: /ko/bty-arena, /en/bty-arena)으로 언어 결정.
- 시나리오 데이터에 titleKo·contextKo·labelKo·resultKo·microInsightKo·followUp.*Ko 있으면 ko 선택 시 사용. SCENARIOS 상수에 ko 필드 반영 시 UI·API 자동 적용.

---

*작성: NEXT_TASKS_2 §1-5 산출물. Arena 한국어 locale 분기·ko 경로/포맷 반영.*
