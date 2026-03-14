# Chat Layer Spec — src/lib/bty/chat

`src/lib/bty/chat` 은 **채팅 공통 런타임**과 **시스템별 chat 로직**을 분리한다.

*참조: `DOMAIN_LAYER_TARGET_MAP.md` (시스템 경계 Arena/Center/Foundry)*

---

## 최종 원칙

### chat 공통 런타임 (shared)

`src/lib/bty/chat` 루트·shared에는 **채팅 공통 런타임만** 둔다.

- mode 판별
- message build 공통 파이프라인
- guard 실행
- provider 호출 전 조립
- shared prompt utilities
- shared types

### 시스템별 chat 로직

각 시스템별 **의도, tone, examples, retrieval, policy**는 시스템별 하위 폴더로 분리한다.

- Arena 전용 chat 규칙 → `chat/arena`
- Center 전용 chat 규칙 → `chat/center`
- Foundry 전용 chat 규칙 → `chat/foundry`

---

## 목표 디렉터리 구조

```text
src/lib/bty/chat/
  shared/
    types.ts
    constants.ts
    buildBaseMessages.ts
    runChatPipeline.ts
    resolveChatMode.ts
    chatContext.ts
    promptUtils.ts
    guardRunner.ts

  arena/
    buildArenaMessages.ts
    arenaGuards.ts
    arenaFewShot.ts
    arenaTone.ts
    arenaRetriever.ts
    arenaPolicy.ts

  center/
    buildCenterMessages.ts
    centerGuards.ts
    centerFewShot.ts
    centerTone.ts
    centerRetriever.ts
    centerPolicy.ts

  foundry/
    buildFoundryMessages.ts
    foundryGuards.ts
    foundryFewShot.ts
    foundryTone.ts
    foundryRetriever.ts
    foundryPolicy.ts

  index.ts
```

---

## 레이어 역할

### 1. chat/shared — 공통 런타임

**채팅 엔진의 뼈대**만 둔다.

| 포함 | 금지 |
|------|------|
| types.ts | Arena 전용 문구 |
| resolveChatMode.ts | Center 전용 위로 문체 |
| runChatPipeline.ts | Foundry 전용 질문 흐름 |
| guardRunner.ts | 시스템별 few-shot 예시 |
| promptUtils.ts | |

→ 시스템별 문구·톤·few-shot·흐름은 **각 시스템 폴더**로 내린다.

**Mode router:** 공통 진입점은 `resolveChatMode(input)` + `switch (mode)` 로만 분기하고, 실제 메시지 빌드는 `buildArenaMessages` / `buildCenterMessages` / `buildFoundryMessages` 에 위임한다. (자세한 목표 코드는 아래 "2단계: mode router를 얇게 만들기" 참고.)

---

### 2. chat/arena — Arena 전용

**경기장형 대화 규칙**만 둔다.

- leaderboard 관련 응답 톤
- scenario / decision / XP / reflection 문맥
- Arena 전용 retrieval
- Arena 전용 few-shot
- Arena 전용 guard

---

### 3. chat/center — Center 전용

**회복형 대화 규칙**만 둔다.

- Dear Me 톤
- resilience
- 안전한 중심
- 감정 안정
- 위로/회복 중심 few-shot

---

### 4. chat/foundry — Foundry 전용

**훈련형 대화 규칙**만 둔다.

- mentor tone
- dojo question flow
- integrity training
- 역지사지 훈련
- 성장 유도형 prompt

---

## 이행 방식 (5단계)

한 번에 전부 뜯어고치지 말고 **3단계**로 진행한다.

### 1단계: 파일 성격 분류

현재 `src/lib/bty/chat` 안 파일들을 분류한다.

| 보관 위치 | 내용 |
|-----------|------|
| **shared** 로 남길 것 | types.ts, mode 해석, 공통 pipeline, 공통 helper, 공통 context 조립 |
| **arena** 로 보낼 것 | arena 관련 build messages, arena 관련 guard, arena 관련 examples |
| **center** 로 보낼 것 | today-me / dearme / center 톤, center guard, center examples |
| **foundry** 로 보낼 것 | dojo / mentor / bty tone, foundry guard, foundry examples |

### 2단계: mode router를 얇게 만들기

`buildChatMessages.ts`(또는 공통 message builder)가 **너무 많은 분기**를 갖지 않도록 한다.

**목표:** mode는 `resolveChatMode(input)`으로만 판별하고, 메시지 빌드는 시스템별 함수에 위임한다.

```typescript
const mode = resolveChatMode(input)

switch (mode) {
  case "arena":
    return buildArenaMessages(ctx)
  case "center":
    return buildCenterMessages(ctx)
  case "foundry":
    return buildFoundryMessages(ctx)
}
```

- **shared**: `resolveChatMode(input)`만 두고, arena/center/foundry 전용 분기·문구는 넣지 않는다.
- **시스템별 분기**: 각 `build*Arena*Messages`, `build*Center*Messages`, `build*Foundry*Messages` 안에서만 처리한다.

### 3단계: system policy 분리

**가장 중요한 부분이다.**  
지금은 chat guard / tone / examples가 한곳에 섞여 있을 수 있다. 아래처럼 **시스템별로 분리**하면 시스템 boundary와 chat boundary가 일치한다.

| 시스템 | 파일 |
|--------|------|
| **Arena** | arenaTone.ts, arenaPolicy.ts, arenaFewShot.ts |
| **Center** | centerTone.ts, centerPolicy.ts, centerFewShot.ts |
| **Foundry** | foundryTone.ts, foundryPolicy.ts, foundryFewShot.ts |

- tone / policy / fewShot을 시스템 폴더별로 나누면, Arena/Center/Foundry 경계와 chat 경계가 같아진다.
- guard는 각 시스템의 `*Guards.ts`에서, 실제 행동(메시지 빌드·retrieval)은 각 시스템의 build*Messages 등에서만 사용한다.

### 4단계: shared 정리

- shared에 남길 파일만 두고, 시스템별 문구·톤·예시는 제거하거나 해당 시스템 폴더로 이동.

### 5단계: 시스템 폴더 생성·이동

- `arena/`, `center/`, `foundry/` 폴더를 만들고, 분류한 파일을 옮긴 뒤 import·테스트를 갱신.

---

## Mode 해석 규칙

**mode 판정은 shared, mode별 행동은 각 시스템**에 둔다.

### 모드 매핑 (공통)

현재 대화 기준으로 다음 매핑을 사용한다. 이 규칙은 **`chat/shared/resolveChatMode.ts`에만** 둔다.

| 입력(모드/경로 등) | 시스템 |
|--------------------|--------|
| today-me, dearme | center |
| bty, dojo | foundry |
| 그 외 arena 관련 | arena |

- **resolveChatMode.ts**: 입력을 받아 `"arena"` | `"center"` | `"foundry"` 만 반환. 시스템별 문구·정책·예시는 포함하지 않는다.
- **mode별 행동**: 각 `chat/arena`, `chat/center`, `chat/foundry` 안의 build*Messages, *Tone, *Policy, *FewShot에서만 처리한다.

---

## 추천 import 방향 (chat 계층)

| 방향 | 허용/금지 |
|------|------------|
| shared → arena / center / foundry | **허용** (직접 import 가능) |
| arena / center / foundry → shared | **허용** |
| arena → center | **금지** |
| center → foundry | **금지** |
| foundry → arena | **금지** |

→ 한 시스템의 chat 모듈이 **다른 시스템의 chat 모듈을 직접 import 하면 안 된다.**  
→ mode 판정과 공통 파이프라인만 shared에 두고, 시스템별 tone/few-shot/guard/retriever는 각 하위 폴더에서만 참조한다.

---

## 관련 문서

- **DOMAIN_LAYER_TARGET_MAP.md** — 시스템 경계, lib/bty 역할
- **CHAT_SYSTEM_BOUNDARY.md** — chat 경계 요약 (목적·원칙·구조·예시)
- **CHAT_LAYER_SPEC.md** — chat 공통 런타임 vs 시스템별 구조, import 방향
- **bty-system-boundary.mdc** — Arena/Center/Foundry 영역 구분
- **bty-chat-boundary.mdc** — chat 경계·import 규칙 (C2 Gatekeeper 연동)
