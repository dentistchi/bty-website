# CHAT SYSTEM BOUNDARY

BTY 프로젝트의 Chat 시스템 구조를 정의한다.

## 목적

1. Arena / Center / Foundry 시스템 경계를 Chat 레이어에서도 유지한다.
2. 공통 Chat 런타임과 시스템별 Chat 정책을 분리한다.
3. AI Agent(C1~C5)가 Chat 구조를 일관되게 이해하도록 한다.

---

## 핵심 원칙

Chat 시스템은 두 계층으로 나뉜다.

1. **Shared Runtime**
2. **System-Specific Chat Logic**

즉

```text
shared (공통 엔진)
↓
arena / center / foundry (시스템별 정책)
```

---

## 목표 구조

```text
src/lib/bty/chat/

  index.ts

shared/
  types.ts
  constants.ts
  resolveChatMode.ts
  runChatPipeline.ts
  buildBaseMessages.ts
  guardRunner.ts
  promptUtils.ts
  chatContext.ts

arena/
  buildArenaMessages.ts
  arenaTone.ts
  arenaFewShot.ts
  arenaPolicy.ts
  arenaRetriever.ts
  arenaGuards.ts

center/
  buildCenterMessages.ts
  centerTone.ts
  centerFewShot.ts
  centerPolicy.ts
  centerRetriever.ts
  centerGuards.ts

foundry/
  buildFoundryMessages.ts
  foundryTone.ts
  foundryFewShot.ts
  foundryPolicy.ts
  foundryRetriever.ts
  foundryGuards.ts
```

---

## Shared Runtime

**위치** `src/lib/bty/chat/shared/`

**역할**

- Chat 모드 판정
- 공통 메시지 파이프라인
- guard 실행
- 공통 prompt utilities
- context 조립
- 공통 types 정의

**예**  
resolveChatMode.ts, runChatPipeline.ts, promptUtils.ts, guardRunner.ts, types.ts

**Shared Runtime은 시스템 정책을 포함하지 않는다.**

---

## Arena Chat

**위치** `src/lib/bty/chat/arena/`

Arena 전용 대화 정책을 둔다.

**예**

- leaderboard 설명
- XP 시스템 설명
- scenario 기반 대화
- reflection 응답
- Arena tone

**파일 예**  
buildArenaMessages.ts, arenaTone.ts, arenaFewShot.ts, arenaPolicy.ts, arenaRetriever.ts, arenaGuards.ts

---

## Center Chat

**위치** `src/lib/bty/chat/center/`

Center 전용 대화 정책을 둔다.

**예**

- Dear Me 편지 톤
- 감정 안정
- resilience path
- 위로 중심 대화

**파일 예**  
buildCenterMessages.ts, centerTone.ts, centerFewShot.ts, centerPolicy.ts, centerRetriever.ts, centerGuards.ts

---

## Foundry Chat

**위치** `src/lib/bty/chat/foundry/`

Foundry 전용 대화 정책을 둔다.

**예**

- mentor tone
- dojo 질문 흐름
- integrity training
- 성장 중심 대화

**파일 예**  
buildFoundryMessages.ts, foundryTone.ts, foundryFewShot.ts, foundryPolicy.ts, foundryRetriever.ts, foundryGuards.ts

---

## Mode Resolution

Chat 모드는 **shared 계층에서만 결정한다.**

**위치** `src/lib/bty/chat/shared/resolveChatMode.ts`

**예시 규칙**

| 입력 | 시스템 |
|------|--------|
| today-me, dearme | center |
| bty, dojo, mentor | foundry |
| 그 외 arena 관련 요청 | arena |

**mode 판정 로직은 한 곳에만 존재해야 한다.**

---

## Message Build Flow

Chat 메시지 생성 흐름

```text
resolveChatMode
↓
buildBaseMessages
↓
system specific builder
  arena   → buildArenaMessages
  center  → buildCenterMessages
  foundry → buildFoundryMessages
```

즉 **shared router → system builder**

---

## Import Rules

**허용**

- shared → arena, shared → center, shared → foundry
- arena → shared, center → shared, foundry → shared

**금지**

- arena → center, center → foundry, foundry → arena

즉 **시스템끼리 직접 의존하지 않는다.**

---

## Guard System

Guard 실행은 **shared 계층**에서 수행한다.

**위치** `src/lib/bty/chat/shared/guardRunner.ts`

시스템별 guard는 각 폴더에 둔다.

- arenaGuards.ts
- centerGuards.ts
- foundryGuards.ts

---

## Boundary Rule

Chat 시스템도 BTY의 **System Boundary**를 따른다.

- **Arena Chat** → Arena 기능만 참조
- **Center Chat** → Center 기능만 참조
- **Foundry Chat** → Foundry 기능만 참조

다른 시스템 domain을 직접 수정하거나 의존하지 않는다.

---

## 관련 문서

다음 문서와 함께 사용한다.

- docs/architecture/ARCHITECTURE_MAP.md
- docs/architecture/DOMAIN_LAYER_TARGET_MAP.md
- docs/architecture/CHAT_LAYER_SPEC.md
- .cursor/rules/bty-system-boundary.mdc
- docs/plans/FEATURE_PIPELINE.md (해당 시)

---

## 이행 전략

현재 구조에서 목표 구조로 이동할 때는 다음 원칙을 따른다.

1. 기존 chat 코드를 **한 번에 이동하지 않는다.**
2. **새로 작성하는** chat 로직부터 목표 구조를 따른다.
3. 리팩터 시 **해당 시스템 chat 코드만** 이동한다.

**예:** Arena 작업 시 `chat/arena/*` 로 이동.

---

## 최종 기준

Chat 구조도 BTY 시스템 경계를 그대로 따른다.

```text
shared runtime
↓
arena | center | foundry
```

- **Shared**는 공통 엔진.
- 각 시스템 폴더는 **대화 정책**을 담당한다.

이 문서를 추가하면 다음이 정렬된다.

- ARCHITECTURE_MAP
- DOMAIN_LAYER_TARGET_MAP
- SYSTEM_BOUNDARY (또는 bty-system-boundary.mdc)
- CHAT_SYSTEM_BOUNDARY

즉 **BTY 전체 아키텍처가 하나의 축으로 맞춰진다.**
