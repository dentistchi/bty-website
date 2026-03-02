# 챗봇·Safe Mirror·Integrity Mirror — 로케일(영어/한국어) 통일 수정

**목적**: `/en/...` 일 때는 모든 AI 응답·고정 문구가 **영어**로, `/ko/...` 일 때는 **한국어**로 나오도록 수정한다.

**기준**: NEXT_TASKS_2 §1-5(언어 선택 시나리오·안내·대답 통일), PROJECT_BACKLOG §6.

---

## 1. 현상

- **영어 URL**(`/en/bty`, `/en/dear-me`, `/en/bty/mentor` 등)에서 사용 중인데, **챗봇·멘토·Safe Mirror·Integrity Mirror**에서 한국어 응답이나 한국어 고정 문구가 나온다.
- **Arena 가입 카드**는 이미 수정됨: 승인 시 상세 숨김 + `arenaMembership` i18n으로 로케일별 문구 적용.

---

## 2. 원인 요약

| 대상 | 원인 |
|------|------|
| **챗봇** (/api/chat) | 클라이언트는 `lang: locale` 전달함. 하지만 **시스템 프롬프트**가 한국어 본문 위주라, 모델이 영어 사용자에게도 한국어로 답할 수 있음. `lang === "en"` 일 때 **"Respond only in English"** 같은 명시적 지시가 없음. |
| **멘토** (/api/mentor) | 클라이언트는 `lang: locale` 전달함. **SAFETY_VALVE_MESSAGE**·**fallback** 문구가 **한국어 하드코딩**. 시스템 프롬프트(Dr. Chi + bundle)에 **영어만 답하라**는 지시가 없을 수 있음. |
| **Safe Mirror** (/api/safe-mirror) | **요청 body에 locale/lang 없음.** 시스템 프롬프트는 "Use the same language as the user"로만 되어 있어, 사용자 입력이 한국어면 한국어로 답함. `/en` 사용자가 영어로 써도 모델이 한국어로 답할 수 있음. |
| **Integrity Mirror** | 현재는 **API 미사용.** `t.reply` 등 i18n 메시지만 사용하므로 **UI 문구는 이미 로케일 반영됨.** 추후 AI 연동 시에는 요청에 locale 전달 + 응답 언어 고정 필요. |

---

## 3. 수정 방향 (공통)

1. **API 요청 시 `locale`(또는 `lang`) 전달**  
   클라이언트가 `locale`을 body에 넣어 보내고, API는 이를 신뢰하여 응답 언어를 결정한다.
2. **시스템 프롬프트에 응답 언어 고정**  
   - `locale === "en"` → `"You must respond only in English. All your replies must be in English."` (또는 동일 의미 문장)  
   - `locale === "ko"` → `"한국어로만 답하세요. 모든 응답은 한국어로 작성하세요."`
3. **고정 문구(밸브·폴백·에러 메시지) 로케일별 처리**  
   API 내 하드코딩 한국어 문구를 제거하고, `locale`에 따라 ko/en 메시지를 반환한다.

---

## 4. 대상별 상세

### 4.1 챗봇 (BTY Chat)

| 항목 | 현재 | 수정 |
|------|------|------|
| locale 전달 | ✅ `Chatbot.tsx`에서 `lang: locale` 전달 | 유지 |
| 시스템 프롬프트 | `buildChatMessages.ts` — NVC/치유 스펙 등 한국어 위주 | `lang === "en"` 일 때 **맨 앞에** "Respond only in English. All your replies must be in English." 추가. `lang === "ko"` 일 때 "한국어로만 답하세요." 추가(선택). |
| fallback·메타 답변 | `getFallbackMessage`, `getMetaReply`, `getSafetyValveMessage`, `getDojoRecommendMessage` 등에서 `lang` 사용 | 이미 lang 반영됨. 동작 확인만. |

**파일**

- `src/app/api/chat/route.ts` — body.lang 사용 확인.
- `src/lib/bty/chat/buildChatMessages.ts` — 시스템 메시지 조합 시 `lang`에 따른 **응답 언어 고정 문장** 삽입.
- `src/components/Chatbot.tsx` — 이미 `lang: locale` 전달. 변경 없음.

---

### 4.2 멘토 (Dr. Chi)

| 항목 | 현재 | 수정 |
|------|------|------|
| locale 전달 | ✅ `mentor/page.client.tsx`에서 `lang: locale` 전달 | 유지 |
| SAFETY_VALVE_MESSAGE | 한국어 하드코딩 | `locale === "en"` 일 때 영어 메시지 반환. (예: "Hold on—you look really worn out. Before we work on skills, it might help to rest in Dear Me for a bit. Would you like to go there and check in with how you're feeling?") |
| fallback (OpenAI 미사용 시) | 한국어 하드코딩 | `lang === "en"` 일 때 영어 문구 반환. |
| 시스템 프롬프트 | `buildMentorMessagesDual(..., { lang })` — bundle에서 lang 사용 | `lang === "en"` 일 때 시스템 메시지 **앞에** "Respond only in English." 추가. (mentor_fewshot_dropin 또는 route 내 처리) |

**파일**

- `src/app/api/mentor/route.ts` — `SAFETY_VALVE_MESSAGE` ko/en 분기, fallback ko/en 분기, `buildOpenAIMessages` 호출 전/후에 영어 전용 지시 추가.
- `src/lib/bty/mentor/mentor_fewshot_dropin.ts` — 시스템 메시지에 `lang` 기준 응답 언어 문장 추가(또는 route에서 system 메시지 수정).

---

### 4.3 Safe Mirror

| 항목 | 현재 | 수정 |
|------|------|------|
| locale 전달 | ❌ body에 없음 | **요청 body에 `locale`(또는 `lang`) 추가.** |
| 시스템 프롬프트 | "Use the same language as the user" | **locale 기준으로 고정:** `locale === "en"` → "Respond only in English." / `locale === "ko"` → "한국어로만 답하세요." (기존 “same language as user” 대체 또는 보강) |
| fallback | `/[가-힣]/` 로 입력 언어 추정 | **locale** 기준으로 ko/en fallback 선택. |

**파일**

- `src/app/api/safe-mirror/route.ts` — body에서 `locale`(또는 `lang`) 읽기, 시스템 프롬프트에 응답 언어 고정, fallback을 locale 기준으로 선택.
- `src/components/SafeMirror.tsx` — `locale`을 body에 포함해 전달. (예: `body: JSON.stringify({ message: trimmed, messages: ..., locale })`)

---

### 4.4 Integrity Mirror

| 항목 | 현재 | 수정 |
|------|------|------|
| AI 응답 | 없음. `t.reply` 등 i18n만 사용 | 현재 구조에서는 **추가 수정 불필요.** |
| 추후 API 연동 시 | — | 요청에 `locale` 전달 + 시스템 프롬프트에 응답 언어 고정 적용. |

**파일**

- `src/app/[locale]/bty/(protected)/integrity/page.client.tsx` — 현재는 `getMessages(locale).integrity` 사용. 추후 API 호출 시 `locale` 전달만 추가하면 됨.

---

## 5. 체크리스트 (구현·검증)

구현 시 아래 순서로 진행하고, 각 항목 완료 후 [x] 표시.

### 5.1 챗봇

- [x] `buildChatMessages.ts`: `buildChatMessagesForModel`(또는 시스템 메시지를 만드는 함수)에서 `lang === "en"` 이면 시스템 메시지 **맨 앞**에 "Respond only in English. All your replies must be in English." 추가.
- [x] `lang === "ko"` 일 때 "한국어로만 답하세요." 추가할지 결정 후, 필요 시 동일 방식으로 추가. → **추가함** (맨 앞에 languageFirst 블록으로 en/ko 고정).
- [ ] `/en/dear-me`, `/en/bty` 등에서 챗봇에 영어로 말했을 때 **응답이 전부 영어**인지 확인.

### 5.2 멘토

- [x] `mentor/route.ts`: `SAFETY_VALVE_MESSAGE`를 `lang === "en"` / `lang === "ko"` 로 분기 (상수 또는 헬퍼 함수).
- [x] `mentor/route.ts`: fallback 문구("요즘 어떤 부분이...")를 `lang === "en"` 일 때 영어로 반환.
- [x] `mentor/route.ts` 또는 `mentor_fewshot_dropin.ts`: 시스템 메시지에 `lang === "en"` 일 때 "Respond only in English." 추가.
- [ ] `/en/bty/mentor`에서 영어로 입력 시 **응답·밸브·폴백 모두 영어**인지 확인.

### 5.3 Safe Mirror

- [x] `SafeMirror.tsx`: `/api/safe-mirror` 호출 시 `body`에 `locale` 포함.
- [x] `safe-mirror/route.ts`: `body.locale`(또는 `body.lang`) 읽기, 없으면 입력에서 추정(기존 방식) fallback.
- [x] `safe-mirror/route.ts`: 시스템 프롬프트에 `locale === "en"` → "Respond only in English.", `locale === "ko"` → "한국어로만 답하세요." 반영.
- [x] `safe-mirror/route.ts`: fallback 메시지를 `locale` 기준으로 선택 (기존 FALLBACK_KO / FALLBACK_EN 활용).
- [ ] Safe Mirror가 노출되는 페이지에서 `/en` 일 때 영어로 입력 → **응답이 영어**인지 확인.

### 5.4 Integrity Mirror

- [x] 현재는 API 미사용이므로 **로케일 수정 없음.** (이미 i18n 사용)
- [ ] 추후 AI 연동 시: 요청에 `locale` 전달 + API에서 응답 언어 고정 적용 후, 위와 동일 방식으로 검증.

### 5.5 통합 검증

- [ ] `/ko/...` 전 경로: 챗봇·멘토·Safe Mirror에서 **한국어만** 나오는지 스팟 체크.
- [ ] `/en/...` 전 경로: 챗봇·멘토·Safe Mirror에서 **영어만** 나오는지 스팟 체크.
- [ ] 메타 질문·밸브·폴백 등 **고정 문구**가 로케일별로 나뉘는지 확인.

---

## 6. 참고 파일

| 용도 | 파일 |
|------|------|
| 챗봇 API | `src/app/api/chat/route.ts` |
| 챗봇 메시지 조합 | `src/lib/bty/chat/buildChatMessages.ts` |
| 챗봇 UI | `src/components/Chatbot.tsx` |
| 멘토 API | `src/app/api/mentor/route.ts` |
| 멘토 few-shot·시스템 | `src/lib/bty/mentor/mentor_fewshot_dropin.ts`, `drChiCharacter.ts` |
| 멘토 UI | `src/app/[locale]/bty/(protected)/mentor/page.client.tsx` |
| Safe Mirror API | `src/app/api/safe-mirror/route.ts` |
| Safe Mirror UI | `src/components/SafeMirror.tsx` |
| Integrity Mirror UI | `src/app/[locale]/bty/(protected)/integrity/page.client.tsx` |
| 로케일·i18n | `src/lib/i18n.ts` |

---

## 7. 완료 기록

| 일시 | 내용 |
|------|------|
| 2026-02-28 | **5.1 챗봇**: `buildChatMessages.ts` — `buildSystemPrompt`에서 시스템 메시지 맨 앞에 응답 언어 고정 문장 추가. `lang === "en"` → "Respond only in English. All your replies must be in English." / `lang === "ko"` → "한국어로만 답하세요. 모든 응답은 한국어로 작성하세요." |
| 2026-02-28 | **5.2 멘토**: `mentor/route.ts` — SAFETY_VALVE: `getSafetyValveMessage(lang)` (en이면 영어 밸브, 아니면 기존 한국어). fallback: `getMentorFallbackMessage(lang)`. 시스템 프롬프트: `buildOpenAIMessages`에서 시스템 메시지 앞에 `langPrefix` 추가 (en → "Respond only in English...", ko → "한국어로만 답하세요..."). |
| 2026-02-28 | **5.3 Safe Mirror**: `SafeMirror.tsx` — `/api/safe-mirror` 호출 시 `body: JSON.stringify({ message, messages, locale })`. `safe-mirror/route.ts` — `body.locale`/`body.lang` 읽기, 없으면 입력 한글 여부로 ko/en 추정. `getSystemPromptWithLocale(locale)`로 시스템 프롬프트 맨 앞에 en/ko 응답 언어 고정. API fallback을 locale 기준 선택 (ko → FALLBACK_KO, 아니면 FALLBACK_EN). |
| 2026-02-28 | **5.4 Integrity Mirror**: API 미사용·i18n만 사용하므로 코드 변경 없음. |
| — | **검증(수동 확인 권장)**: `/en/bty`, `/en/dear-me`, `/en/bty/mentor`에서 영어 입력 시 응답·밸브·폴백이 모두 영어인지; Safe Mirror 노출 페이지에서 `/en` + 영어 입력 시 응답이 영어인지; `/ko/...` 경로에서 한국어만 나오는지 스팟 체크. i18n.ts 332행 부근 오류는 이번 로케일 수정과 별개이므로 해당 파일만 따로 수정. |

---

*이 문서는 「챗봇/미러 API에 locale 전달 및 응답 언어 고정」 next step용 체크리스트입니다. 수정 후 RUNBOOK·CURRENT_TASK에 반영할 것.*
