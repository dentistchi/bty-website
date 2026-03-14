# IMPORT BOUNDARY

BTY 프로젝트의 코드 의존 방향을 정의한다.

## 목적

1. 아키텍처 계층을 유지한다.
2. 순환 의존을 방지한다.
3. domain / service / api / ui 역할을 명확히 한다.
4. AI Agent(C1~C5)가 올바른 코드 위치를 선택하도록 한다.

---

## 계층 구조

BTY 프로젝트는 다음 계층 구조를 가진다.

```text
UI
↓
API
↓
Service
↓
Domain
```

**구체적인 경로**

| 계층 | 경로 |
|------|------|
| **UI** | src/app/**, src/components/** |
| **API** | src/app/api/** |
| **Service** | src/lib/bty/** |
| **Domain** | src/domain/** |

---

## 의존 방향 규칙

**허용**

- UI → API, UI → Service
- API → Service
- Service → Domain

**예**

- `src/app/bty-arena/page.tsx` → `src/lib/bty/arena/services/getLeaderboardView.ts`
- `src/app/api/arena/leaderboard` → `src/lib/bty/arena/services/getLeaderboardView.ts`
- `src/lib/bty/arena/services/getLeaderboardView.ts` → `src/domain/arena/leaderboard/applyTieBreak.ts`

---

## 금지 규칙

다음 import는 금지한다.

### Domain → Service

- `src/domain/**` → `src/lib/bty/**`
- Domain은 service 계층을 알면 안 된다.

### Domain → API

- `src/domain/**` → `src/app/api/**`
- Domain은 API 계층을 알면 안 된다.

### Domain → UI

- `src/domain/**` → `src/app/**`
- `src/domain/**` → `src/components/**`
- Domain은 UI 계층을 알면 안 된다.

### Service → UI

- `src/lib/bty/**` → `src/app/**`
- `src/lib/bty/**` → `src/components/**`
- Service 계층은 UI 계층을 알면 안 된다.

---

## Domain Layer 독립성

Domain 계층은 **가장 아래 계층**이다.

즉 `src/domain` 은 다음만 import 할 수 있다.

- `src/domain`
- 표준 라이브러리

**예**

- **허용**  
  `import { SeasonPolicy } from "@/domain/arena/season"`
- **금지**  
  `import { supabase } from "@/lib/supabase"`

---

## Service Layer 책임

Service 계층은 **Domain 규칙을 조합하고 외부 시스템과 연결한다.**

**위치** `src/lib/bty/**`

**역할**

- domain 규칙 호출
- repository 호출
- adapter 호출
- 여러 domain 규칙 조합
- UI/API에서 사용 가능한 shape 생성

---

## API Layer 책임

API 계층은 **진입점**이다.

**위치** `src/app/api/**`

**역할**

1. request parsing
2. validation
3. service 호출
4. response 반환

API handler **내부에 비즈니스 로직을 직접 구현하지 않는다.**

---

## UI Layer 책임

UI 계층은 **render-only** 원칙을 따른다.

**위치** `src/app/**`, `src/components/**`

**역할**

- 데이터 표시
- interaction 처리
- loading / skeleton / empty state

**금지**

- XP 계산
- leaderboard 규칙
- 상태 전이 판단

---

## 예시 구조

```text
src/
  domain/
    arena/
      xp/
      leaderboard/
      season/
  lib/
    bty/
      arena/
        services/
        repositories/
  app/
    api/
      arena/
    bty-arena/
  components/
```

---

## Import Flow 예시 — Arena leaderboard 조회

```text
UI page
  ↓
API endpoint
  ↓
Service
  ↓
Domain rule
```

**예**

- page.tsx  
  ↓  
- /api/arena/leaderboard  
  ↓  
- getLeaderboardView.ts  
  ↓  
- applyTieBreak.ts

---

## C2 Gatekeeper 검사 규칙

다음 위반을 검사한다.

1. `src/domain` → `src/lib`
2. `src/domain` → `src/app`
3. `src/lib/bty` → `src/app`
4. UI에서 domain 규칙 직접 구현
5. API handler 내부 비즈니스 로직

---

## 관련 문서

이 문서는 다음 문서와 함께 사용한다.

- docs/architecture/ARCHITECTURE_MAP.md
- docs/architecture/DOMAIN_LAYER_TARGET_MAP.md
- docs/architecture/CHAT_SYSTEM_BOUNDARY.md
- .cursor/rules/bty-import-direction.mdc
- .cursor/rules/bty-layer-import.mdc

---

## 최종 원칙

BTY 프로젝트는 다음 규칙을 따른다.

| 역할 | 경로 |
|------|------|
| **규칙** | src/domain |
| **서비스** | src/lib/bty |
| **진입점** | src/app/api |
| **렌더** | src/app, src/components |

**의존 방향은 항상 위에서 아래로만 흐른다.**
