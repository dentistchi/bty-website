# DOMAIN LAYER TARGET MAP

이 문서는 BTY 프로젝트의 **Domain Layer 목표 구조**를 정의한다.  
BTY의 시스템 경계(**Arena / Center / Foundry**)는 domain·lib 구조에도 동일하게 반영한다.  
문서 위치: `docs/architecture/` — 이후 C1/C2 규칙과 연결한다.

## 목적

1. `src/domain` 과 `src/lib/bty` 의 **역할을 분리**한다.
2. **Arena / Center / Foundry** 시스템 경계를 코드 구조에 반영한다.
3. **새 코드**는 목표 구조를 따르고, **기존 코드**는 점진적으로 이행한다.

---

## 핵심 원칙 (요약)

| 계층 | 역할 |
|------|------|
| **규칙** | `src/domain` |
| **조립** | `src/lib/bty` |
| **진입점** | `src/app/api` |
| **렌더** | `src/app`, `src/components` |

- **domain**: 순수 비즈니스 규칙만 (계산, 판단, 상태 전이, 정책, 타입, 에러, value object, **repository interface**). DB/fetch/cookie/Next/UI 금지.
- **lib/bty**: domain 호출, 조합, **repository 구현**/adapter, content 로드, API/UI용 shape 조립. 비즈니스 규칙 원본 정의 금지.
- **API**: request parsing → validation → service 호출 → response. 비즈니스 로직 직접 구현 금지.
- **UI**: render-only. 비즈니스 계산·정렬·상태 전이 판단·domain 규칙 직접 구현 금지.

---

## 시스템별 구조 원칙

### Arena

| 계층 | 내용 |
|------|------|
| **domain** | leaderboard 규칙, xp 계산, season progression, mentor request 상태 전이, reflection 규칙, **repository interface** |
| **lib/bty/arena** | leaderboard 조회 service, mentor request 생성/조회 service, reflection 저장 orchestration, content pack 로더, adapter, **repository 구현** |

---

### Center

| 계층 | 내용 |
|------|------|
| **domain** | resilience 규칙, dear-me 흐름 정책, emotional path 판단, **repository interface** |
| **lib/bty/center** | center response service, letter persistence service, center 관련 **repository 구현** / adapter |

---

### Foundry

| 계층 | 내용 |
|------|------|
| **domain** | mentor 규칙, dojo question flow, integrity 흐름, training 상태 전이, **repository interface** |
| **lib/bty/foundry** | mentor session service, dojo question service, foundry dashboard assemble, **repository 구현** / adapter |

---

### shared 원칙

| 경로 | 역할 | 예 |
|------|------|-----|
| **src/domain/shared** | 공통 비즈니스 개념 | 공통 타입, 공통 에러, 공통 정책, 공통 value object |
| **src/lib/bty/shared** | 앱 전역 기술 조립 요소 | auth, session, cookie, utils |

#### domain/shared/value-object/

도메인에서 반복적으로 사용하는 **개념적 값 객체**를 둔다. (대형 서비스 domain layer에서 흔히 쓰는 패턴.)

| 예 |
|---|
| XP |
| LeaderboardRank |
| MentorRequestStatus |
| EmotionalScore |

**예시 구조**

```text
src/domain/shared/value-object/
  XP.ts
  LeaderboardRank.ts
  MentorRequestStatus.ts
  EmotionalScore.ts
```

#### Repository Interface vs 구현

**Repository Interface는 domain에 둔다.** (실제 DDD 구조에서는 interface는 domain, 구현은 lib/bty가 적절하다.)

| 구분 | 위치 | 예 |
|------|------|---|
| **Interface** | `src/domain` | `src/domain/arena/leaderboard/LeaderboardRepository.ts` |
| **구현** | `src/lib/bty` | `src/lib/bty/arena/repositories/SupabaseLeaderboardRepository.ts` |

- domain 쪽에는 **추상(interface/type)** 만 두고, DB/Supabase 등 기술 의존성은 넣지 않는다.
- lib/bty의 repository 구현이 domain interface를 구현(implement)하고, API·service에서 해당 구현을 주입해 사용한다.

#### lib/bty 서비스 명명 규칙

**service 파일은 Use Case 단위로 만든다.** (한 파일 = 하나의 유스케이스.)

| 예 |
|---|
| `getLeaderboardView.ts` |
| `submitMentorRequest.ts` |
| `getMentorRequestList.ts` |
| `calculateArenaProfile.ts` |

- 동사(get/submit/calculate 등) + 명사/대상으로 파일명을 정하면 의도가 분명해지고, API·페이지에서 어떤 service를 쓸지 찾기 쉽다.

---

## import 방향 규칙

**domain이 가장 아래 계층**이다.

### Import Dependency Diagram

import 의존 방향은 **아래로만** 흐른다. (위 계층이 아래 계층을 참조.)

```text
UI (src/app, src/components)
        ↓
API (src/app/api)
        ↓
Service (src/lib/bty)
        ↓
Domain (src/domain)
```

- **금지**: Domain → Service, Domain → API, Domain → UI, Service → API, Service → UI, API → UI

| 구분 | 내용 |
|------|------|
| **허용** | `src/app/api` → `src/lib/bty` → `src/domain` |
| **허용** | `src/app` → `src/lib/bty` → `src/domain` |
| **금지** | `src/domain` → `src/lib/bty` |
| **금지** | `src/domain` → `src/app` |
| **금지** | `src/lib/bty` → `src/app` |

---

## 목표 디렉터리 구조

```text
src/domain/
  arena/
    leaderboard/
      applyTieBreak.ts
      LeaderboardRepository.ts
    xp/
      calculateXp.ts
    season/
  center/
  foundry/
  shared/
    value-object/
    errors/
    types/

src/lib/bty/
  arena/
    services/
      getLeaderboardView.ts
    repositories/
      SupabaseLeaderboardRepository.ts
    adapters/
    content/
  center/
  foundry/
  shared/
    auth/
    session/
    cookie/
```

---

## 재위치 목표 경로

| 현재 (bty-app/src) | 목표 | 설명 |
|--------------------|------|------|
| `domain/rules/leaderboard` | `domain/arena/leaderboard/` | Arena 리더보드 규칙 |
| `domain/rules/xp` | `domain/arena/xp/` | Arena XP 계산 규칙 |
| `domain/rules/season` | `domain/arena/season/` | Arena 시즌 규칙 |
| `domain/center/` | `domain/center/` | 유지하되 기능 하위 폴더로 세분화 |
| `domain/dojo/` | `domain/foundry/dojo/` | dojo는 Foundry 하위로 정리 |
| `domain/leadership-engine/` | `domain/arena/` 또는 `domain/shared/` | 실제 책임에 따라 분리 |
| `lib/bty/arena/` | `lib/bty/arena/services`, `repositories`, … | 계층 분리 |
| `lib/bty/chat/` | `lib/bty/chat/shared` + `chat/arena`, `chat/center`, `chat/foundry` | 공통 런타임은 shared, 시스템별 로직은 arena/center/foundry. *참조: CHAT_LAYER_SPEC.md* |
| `lib/bty/auth/` | `lib/bty/shared/auth/` | shared 기술 계층 |
| `lib/bty/session/` | `lib/bty/shared/session/` | shared 기술 계층 |
| `lib/bty/cookie/` | `lib/bty/shared/cookie/` | shared 기술 계층 |

---

## 이행 원칙

1. **한 번에 전체 이동하지 않는다.**
2. **새로 만드는 코드는 목표 구조를 따른다.**
3. **기존 코드는 기능 리팩터 시 해당 기능만 이동한다.**  
   예: mentor request 작업 시 관련 domain/lib만 새 구조로 이동; leaderboard 작업 시 leaderboard 관련 폴더만 이동.
4. **이동 시 import 경로와 테스트를 함께 갱신한다.**

---

## 우선 이행 추천 순서

1. **Arena 규칙부터 기능별 분리** — leaderboard, xp, season, mentor-request
2. **`src/lib/bty/arena`** 를 services, repositories, content, adapters 로 분리
3. **`src/domain/dojo`** 를 `src/domain/foundry/dojo` 로 점진 이동
4. **`src/lib/bty/auth` / `session` / `cookie`** 를 `src/lib/bty/shared/*` 로 정리

---

## C2 Gatekeeper 추가 검사 규칙

다음 항목을 Gatekeeper 점검 시 확인한다.

1. `src/domain` 은 `src/lib/bty` 를 import 하면 안 된다.
2. `src/domain` 은 `src/app` 을 import 하면 안 된다.
3. `src/lib/bty` 는 `src/app` 을 import 하면 안 된다.
4. `src/app/api` 는 비즈니스 규칙을 직접 구현하면 안 된다.
5. UI는 가능하면 `src/lib/bty` 경유로 데이터를 사용하고, `src/domain` 직접 import를 최소화한다.

*이 규칙은 `docs/agent-runtime/C2_GATEKEEPER_TASK.md` 에도 반영하여 점검 시 적용한다.*

---

## 최종 기준

- **규칙** → `src/domain`
- **조립** → `src/lib/bty`
- **진입점** → `src/app/api`
- **렌더** → `src/app`, `src/components`

---

## 추천 .cursor/rules 구조

계층·시스템 경계·import 방향을 위한 **추천 규칙 세트**는 아래 6개다.

```text
.cursor/rules/
  bty-domain-pure-only.mdc
  bty-service-layer.mdc
  bty-api-thin-handler.mdc
  bty-ui-render-only.mdc
  bty-system-boundary.mdc
  bty-import-direction.mdc
```

| 규칙 | 요약 |
|------|------|
| **bty-domain-pure-only** | domain 순수성 (계산·정책·타입·value object만, DB/Next/UI 금지) |
| **bty-service-layer** | lib/bty 역할 (domain 호출·조립만, 비즈니스 규칙 구현 금지) |
| **bty-api-thin-handler** | API 얇게 (parsing → validation → service 호출 → response) |
| **bty-ui-render-only** | UI render-only (데이터 표시·interaction만, 계산·정렬 금지) |
| **bty-system-boundary** | Arena / Center / Foundry 영역 구분, 자기 영역만 수정 |
| **bty-import-direction** | 의존 방향 UI→API→Service→Domain, 역방향 금지 |

---

## 관련 문서

- **ARCHITECTURE_MAP.md** — 시스템 개요, Arena/Center/Foundry 경계
- **CHAT_LAYER_SPEC.md** — src/lib/bty/chat 공통 런타임 vs 시스템별(arena/center/foundry) 구조
- **CHAT_SYSTEM_BOUNDARY.md** — chat 경계 요약 (목적·원칙·구조·모드 예시)
- **FEATURE_PIPELINE.md** — MODE별 작업 범위
- **C2_GATEKEEPER_TASK.md** — Gatekeeper 검사 규칙(import/계층 포함)
- **.cursor/rules/bty-layer-import.mdc** — 계층·import 검사 4항 (domain/lib/app)
- **.cursor/rules/bty-import-direction.mdc** — 의존 방향 (UI→API→Service→Domain)
- **.cursor/rules/bty-domain-pure-only.mdc** — domain 순수성 규칙
- **.cursor/rules/bty-service-layer.mdc** — service 계층 규칙
- **.cursor/rules/bty-api-thin-handler.mdc** — API 얇은 handler 규칙
- **.cursor/rules/bty-ui-render-only.mdc** — UI render-only 규칙
- **.cursor/rules/bty-system-boundary.mdc** — Arena/Center/Foundry 시스템 경계
- **.cursor/rules/bty-chat-boundary.mdc** — chat 경계·import (shared만 공통, 시스템 간 import 금지)
- **.cursor/rules/bty-arena-global.mdc** — XP/시즌/리더보드 불변 규칙

**다음 단계 권장:** C2 Gatekeeper 규칙 문서에 위 import 금지 규칙을 반영하여 PR/변경분 점검 시 일관 적용.
