# 언어 선택에 따른 시나리오·안내·대답 통일 (NEXT_TASKS_2 §1-5)

**목적**: 한국어 선택 시 한국어, 영어 선택 시 영어로 시나리오·안내·시스템 대답이 나오도록 통일.

---

## 적용 내용 요약

### 1. 시나리오·레벨 콘텐츠

- **GET /api/arena/unlocked-scenarios**: 쿼리 파라미터 `?locale=ko` 또는 `?locale=en` 지원. 각 레벨에 `displayTitle` 반환 (ko → title_ko, en → title).
- **대시보드**: `unlocked-scenarios` 호출 시 `locale` 쿼리 전달. ArenaLevelsCard에 전달되는 levels에 `displayTitle` 포함.
- **ArenaLevelsCard**: 레벨 스텝 라벨에 `displayTitle`(또는 title_ko/title) 사용. locale prop으로 이미 i18n 적용.
- **Arena run 페이지** (bty-arena): URL의 `locale`로 시나리오 제목·설명 선택. `displayTitle = locale === "ko" && titleKo ? titleKo : title`, `displayContext` 동일. ScenarioIntro·h2·context 문단에 적용. (선택지·결과 문구의 ko 필드는 시나리오 데이터에 추가 시 확장 가능.)

### 2. API 응답 언어

- **POST /api/arena/free-response**: body에 `locale` (ko | en) 포함 시, `praise`·`suggestion`을 해당 언어로 반환. ko: "직접 문장으로 적어 주셨네요." / "다음에는 상황 맥락과 연결해 보세요."
- **Arena 페이지**: free-response 호출 시 `locale` 전달.

### 3. 안내 문구

- 대시보드·멘토·리더보드 등 UI는 기존 `getMessages(locale)`·URL `[locale]` 기반 i18n 사용. 변경 없이 유지.

---

## 확인

- URL/경로의 locale (예: /ko/bty-arena, /en/bty-arena)으로 언어 결정.
- 시나리오 데이터에 `titleKo`·`contextKo`가 있으면 ko 선택 시 사용. 현재 SCENARIOS에는 영어만 있어 ko 필드 추가 시 자동 반영.
- 선택지(label)·결과(result)·microInsight의 한국어는 시나리오 타입·데이터 확장 후 동일 패턴으로 적용 가능.

---

*작성: NEXT_TASKS_2 §1-5 산출물.*
