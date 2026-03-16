# BTY ARCHITECTURE MAP

BTY 프로젝트의 **전체 시스템 구조**를 보여주는 지도 문서.

## 목적

- 시스템 경계를 명확히 한다
- 코드 위치를 빠르게 찾는다
- C1이 작업 범위를 판단할 수 있게 한다
- Agent(C2 C3 C4)가 수정 범위를 혼동하지 않게 한다

---

## 전체 시스템

BTY 프로젝트는 **세 개의 핵심 시스템**으로 구성된다.

- **Arena**
- **Center**
- **Foundry**

각 시스템은 **자기 영역 코드만 수정한다.**

---

## 프로젝트 루트 구조

```text
bty-project/
  bty-app/
  docs/
  scripts/
  supabase/
  .github/
  workspace/
```

---

## 코드 구조

```text
src/
  domain/
  lib/
  app/
  components/
  types/
```

---

## Domain Layer

**위치** `src/domain`

**역할:** 비즈니스 규칙, 정책, 상태 전이, 계산  

Domain은 **외부 시스템을 알지 않는다.**

**금지:** DB, API, fetch, cookies, UI 코드

---

## Service Layer

**위치** `src/lib/bty`

**역할:** domain 호출, repository 호출, adapter 호출, 데이터 조립

---

## API Layer

**위치** `src/app/api`

**역할:** request parsing, validation, service 호출, response 반환  

API handler는 **얇게** 유지한다.

---

## UI Layer

**위치** `src/app`, `src/components`

**원칙:** render only  

**금지:** 계산, 비즈니스 규칙, leaderboard 정렬

---

## Arena System

Arena는 **경기 시스템**이다.

**위치**

```text
src/domain/arena
src/lib/bty/arena
src/app/[locale]/bty-arena
src/components/bty-arena
src/app/api/arena
```

**기능:** leaderboard, XP, season, reflection, mentor request

---

## Center System

Center는 **감정 안정 시스템**이다.

**위치**

```text
src/domain/center
src/lib/bty/center
src/app/[locale]/dear-me
src/app/api/center
```

**기능:** resilience, dear me letter, emotional support

---

## Foundry System

Foundry는 **훈련 시스템**이다.

**위치**

```text
src/domain/foundry
src/lib/bty/foundry
src/app/bty/(protected)
src/app/api/dojo
src/app/api/mentor
```

**기능:** dojo training, mentor session, integrity training

---

## Chat System

**위치** `src/lib/bty/chat`

**구조**

```text
shared
arena
center
foundry
```

- **shared** — chat runtime, mode resolution, pipeline
- **arena / center / foundry** — tone, policy, few shot, retriever, guard

---

## Agent System

BTY 개발은 **Agent 시스템**으로 운영된다.

```text
C1 Commander
C2 Gatekeeper
C3 Domain Engineer
C4 UI Engineer
C5 Integrator
```

---

## Agent 역할

- **C1** — 작업 선택, 검증, Agent 프롬프트 생성
- **C2** — 아키텍처 규칙 검사
- **C3** — 비즈니스 로직 구현
- **C4** — UI 구현
- **C5** — 통합 검증

---

## 문서 구조

**운영 문서 위치** `docs/`

**핵심 문서**

- docs/CURSOR_TASK_BOARD.md
- docs/CURRENT_TASK.md
- docs/NEXT_BACKLOG_AUTO4.md
- docs/NEXT_PROJECT_RECOMMENDED.md
- docs/BTY_RELEASE_GATE_CHECK.md

**아키텍처 문서** `docs/architecture/`

- ARCHITECTURE_MAP.md
- DOMAIN_LAYER_TARGET_MAP.md
- IMPORT_BOUNDARY.md
- CHAT_SYSTEM_BOUNDARY.md
- CHAT_LAYER_SPEC.md

**Agent Runtime 문서** `docs/agent-runtime/`

- C1_MASTER_COMMANDER.md
- C2_GATEKEEPER_TASK.md
- PROJECT_MEMORY.md

**비전·목표** `docs/`

- **INTEGRITY_ENGINE_VISION_SOURCE.md** — 큰 그림 소스: *The_Integrity_Engine.pptx*; **이 프레젠테이션을 구현하는 것이 목표**. Brief·명세·계획 문서 연결.

**명세·브리프** `docs/spec/`

- **BTY_DETERMINISTIC_LEADERSHIP_ENGINE_BRIEF.md** — Deterministic Leadership Engine 경영진용 브리프 (Why, 4 States, AIR, Reset, TII, Mirror, Certified, Arena/Foundry/Center, 구현 계획 요약)
- 기술 명세·로직 단일 소스: `bty-app/docs/LEADERSHIP_ENGINE_SPEC.md`  
- Phase·구현 계획: `bty-app/docs/ENGINE_ARCHITECTURE_DIRECTIVE_PLAN.md`

---

## 개발 루프

BTY 개발은 다음 **루프**로 동작한다.

```text
C1 작업 생성
↓
C3 C4 구현
↓
C2 구조 검사
↓
C5 통합 검증
↓
CI 실행
↓
자동 merge
```

---

## Sprint 개발 방식

작업은 **Sprint 단위**로 진행한다.

**예:** `MODE ARENA` + `SPRINT 10` → Arena 관련 작업 10개 생성

---

## Import 방향

의존 방향은 **항상 아래로** 흐른다.

```text
UI
↓
API
↓
SERVICE
↓
DOMAIN
```

Domain은 **최하위 계층**이다.

---

## 최종 목표

BTY 프로젝트는 다음 구조를 유지한다.

```text
규칙 → src/domain
서비스 → src/lib/bty
진입점 → src/app/api
렌더 → src/app, src/components
```

그리고 **Arena / Center / Foundry** 세 시스템 경계를 항상 유지한다.
