# BTY DEV OPERATING MANUAL

BTY 프로젝트의 **AI Agent 기반 개발 운영 규칙**이다.

이 문서는 **실제 개발 운영 루틴**을 정의한다.

---

## 1. 시스템 구조

BTY 프로젝트는 **세 시스템**으로 구성된다.

- **Arena**
- **Center**
- **Foundry**

각 시스템은 **자기 영역 코드만** 수정한다.

| 시스템 | 경로 |
|--------|------|
| **Arena** | src/domain/arena, src/lib/bty/arena, src/app/[locale]/bty-arena |
| **Center** | src/domain/center, src/lib/bty/center, src/app/[locale]/dear-me |
| **Foundry** | src/domain/foundry, src/lib/bty/foundry, src/app/bty/(protected) |

---

## 2. 코드 아키텍처

BTY는 다음 **계층 구조**를 따른다.

```text
UI
↓
API
↓
SERVICE
↓
DOMAIN
```

### Domain

**위치** `src/domain`

**역할:** 비즈니스 규칙, 정책, 상태 전이, 계산  

**금지:** DB, API, fetch, cookies, UI 코드

### Service

**위치** `src/lib/bty`

**역할:** domain 호출, repository 호출, adapter 호출, 여러 규칙 조합

### API

**위치** `src/app/api`

**역할:** (1) request parsing (2) validation (3) service 호출 (4) response 반환

### UI

**위치** `src/app`, `src/components`

**원칙:** render only  

**금지:** 계산, 비즈니스 규칙, leaderboard 정렬

---

## 3. Chat 시스템

**구조** `src/lib/bty/chat`

**구성:** shared, arena, center, foundry

- **shared** — chat runtime, mode resolution, pipeline
- **arena / center / foundry** — tone, policy, few-shot, retriever, guard

---

## 4. Agent 구조

BTY는 다음 **Agent 시스템**을 사용한다.

- **C1** Commander
- **C2** Gatekeeper
- **C3** Domain Engineer
- **C4** UI Engineer
- **C5** Integrator

### C1 Commander

**역할:** 작업 선택, 검증 수행, 다음 작업 생성, Agent 프롬프트 생성  

**명령:** health, MODE, next, auto, auto N, SPRINT N, verify, self heal

### C2 Gatekeeper

**역할:** 아키텍처 규칙 검사  

**검사:** domain purity, UI render-only, API thin handler, import boundary, system boundary

### C3 Domain Engineer

**작업 범위:** src/domain, src/lib/bty, src/app/api  

**역할:** 비즈니스 규칙 구현, service 로직 작성

### C4 UI Engineer

**작업 범위:** src/app, src/components  

**역할:** UI 구현, loading/skeleton, accessibility

### C5 Integrator

**역할:** 통합 검증  

**검사:** lint, test, build, CI, integration

---

## 5. 문서 단일 진실

**운영 문서**는 루트 docs에 둔다.

- docs/CURSOR_TASK_BOARD.md
- docs/CURRENT_TASK.md
- docs/NEXT_BACKLOG_AUTO4.md
- docs/NEXT_PROJECT_RECOMMENDED.md
- docs/BTY_RELEASE_GATE_CHECK.md

**앱 내부 기술 문서**는 `bty-app/docs`

---

## 6. 작업 보드

작업 보드는 **docs/CURSOR_TASK_BOARD.md** 하나만 사용한다.

**작업 상태:** 대기 / 진행 / 완료

**매번 작업 완료 시 서류 반영:** 태스크·검증·문서 점검이 완료될 때마다 아래 서류에 **반드시** 추가·갱신한다.

| 서류 | 반영 내용 |
|------|------------|
| **CURSOR_TASK_BOARD.md** | 해당 스프린트 표에서 TASK [x] 완료 표시, 이전 런에 완료 항목 한 줄 추가(작업명·날짜·결과 요약). |
| **CURRENT_TASK.md** | 완료한 작업을 [x] **완료.** 로 표시, 필요 시 상단에 완료 한 줄(작업명·날짜·Lint/Test 수치 등) 추가. |
| **BTY_RELEASE_GATE_CHECK.md** | Release Gate·VERIFY 실행 시 §2·[VERIFY] 블록·최근 완료 줄 갱신. |
| **ELITE_3RD_SPEC_AND_CHECKLIST.md** | 엘리트 3차 검증 실행 시 §3 검증 일시·결과 갱신. |
| **NEXT_PHASE_AUTO4.md / NEXT_BACKLOG_AUTO4.md** | 문서 점검·백로그 갱신 시 해당 문서도 함께 갱신. |

---

## 7. 개발 루틴

**매일 작업 루틴**

1. **상태 확인** — `health`
2. **작업 시스템 선택** — 예: `MODE ARENA`
3. **작업 생성** — `SPRINT 10` 또는 `auto`
4. **작업 수행** — Agent 실행 (C2, C3, C4)
5. **검증** — `verify`
6. **오류 수정** — `self heal`
7. **CI** — lint/test/build PASS 시 자동 merge

---

## 8. Project Memory

**작업 기록 위치:** docs/agent-runtime/PROJECT_MEMORY.md

**기록 내용:** 실패 원인, 반복 버그, 구조 변경, 후속 작업

---

## 9. Sprint 개발 방식

BTY는 **Sprint 방식**으로 개발한다.

**예:** `MODE ARENA` + `SPRINT 10` → Arena 관련 작업 10개 생성  

각 Agent가 **병렬**로 작업한다.

---

## 10. 최종 원칙

**BTY 개발 규칙**

| 역할 | 경로 |
|------|------|
| 규칙 | src/domain |
| 서비스 | src/lib/bty |
| 진입점 | src/app/api |
| 렌더 | src/app, src/components |

**의존 방향:** UI → API → SERVICE → DOMAIN  
항상 **위에서 아래 방향으로만** 의존한다.

---

## 핵심 운영 철학

BTY 개발 시스템은 다음 **루프**로 동작한다.

```text
작업 생성
  ↓
코드 작성
  ↓
검증
  ↓
자동 수정
  ↓
CI
  ↓
자동 merge
```

즉 **AI 기반 개발 운영 시스템**으로 운영한다.
