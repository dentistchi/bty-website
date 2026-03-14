# BTY PROJECT SYSTEM DIAGRAM

BTY 프로젝트 전체 구조 지도

```
                         ┌──────────────────────────┐
                         │        C1 COMMANDER      │
                         │  Task Selection / Auto   │
                         └────────────┬─────────────┘
                                      │
                    ┌─────────────────┴─────────────────┐
                    │                                   │
           ┌────────▼────────┐                ┌────────▼────────┐
           │   PROJECT DOCS   │                │   PROJECT CODE  │
           │                  │                │                 │
           │ CURSOR_TASK_BOARD│                │ src/domain      │
           │ CURRENT_TASK     │                │ src/lib/bty     │
           │ MASTER_PLAN      │                │ src/app/api     │
           │ PROJECT_MEMORY   │                │ src/app         │
           └────────┬─────────┘                └────────┬────────┘
                    │                                   │
                    │                                   │
                    │                        ┌──────────▼──────────┐
                    │                        │    ARCHITECTURE      │
                    │                        │                      │
                    │                        │ UI → API → SERVICE → DOMAIN
                    │                        └──────────┬──────────┘
                    │                                   │
                    │                                   │
      ┌─────────────▼───────────────────────────────────▼─────────────┐
      │                        BTY SYSTEMS                             │
      │                                                               │
      │     ┌───────────────┐    ┌───────────────┐    ┌───────────────┐ │
      │     │     ARENA     │    │     CENTER    │    │    FOUNDRY    │ │
      │     │               │    │               │    │               │ │
      │     │ Leaderboard   │    │ Dear Me       │    │ Dojo Training │ │
      │     │ XP System     │    │ Resilience    │    │ Mentor        │ │
      │     │ Scenario      │    │ Emotional     │    │ Integrity     │ │
      │     │ Reflection    │    │ Support       │    │ Growth        │ │
      │     │ Mentor        │    │               │    │               │ │
      │     └───────────────┘    └───────────────┘    └───────────────┘ │
      │                                                               │
      └───────────────────────────────┬───────────────────────────────┘
                                      │
                                      │
                         ┌────────────▼────────────┐
                         │        CHAT SYSTEM      │
                         │                         │
                         │  shared runtime         │
                         │        │                │
                         │  ┌─────┴─────┐          │
                         │  arena center foundry   │
                         └────────────┬────────────┘
                                      │
                                      │
                     ┌────────────────▼────────────────┐
                     │         AGENT SYSTEM             │
                     │                                  │
                     │ C2 Gatekeeper  → Architecture    │
                     │ C3 Domain Eng   → Business Logic │
                     │ C4 UI Eng       → Interface      │
                     │ C5 Integrator   → Verification   │
                     └────────────────┬────────────────┘
                                      │
                                      │
                         ┌────────────▼────────────┐
                         │        CI PIPELINE      │
                         │                         │
                         │ lint                    │
                         │ test                    │
                         │ build                   │
                         │ auto merge              │
                         └────────────┬────────────┘
                                      │
                                      │
                         ┌────────────▼────────────┐
                         │        DEV LOOP         │
                         │                         │
                         │  SPRINT                 │
                         │  AUTO                   │
                         │  SELF HEAL              │
                         │  PROJECT MEMORY         │
                         └─────────────────────────┘
```

---

## 개발 흐름

```
C1 COMMANDER
      ↓
MASTER PLAN
      ↓
TASK BOARD
      ↓
C3 / C4 구현
      ↓
C2 구조 검사
      ↓
C5 통합 검증
      ↓
CI
      ↓
AUTO MERGE
```

---

## 시스템 경계

```
Arena   → 경기 시스템
Center  → 감정 안정 시스템
Foundry → 훈련 시스템
```

각 시스템은 자기 domain / service / ui 코드만 수정한다.

---

## 코드 계층

```
src/app            → UI
src/app/api        → API
src/lib/bty        → Service
src/domain         → Domain
```

의존 방향

```
UI
↓
API
↓
SERVICE
↓
DOMAIN
```

Domain은 최하위 계층이다.

---

## Agent 역할

```
C1 → 작업 선택 / 자동 루프
C2 → 아키텍처 규칙 검사
C3 → 비즈니스 로직
C4 → UI
C5 → 통합 검증
```

---

## 자동화 시스템

BTY는 다음 자동화를 사용한다.

- **MASTER_PLAN → NEXT_BACKLOG_AUTO4 → CURSOR_TASK_BOARD**: C1이 작업 후보를 채우는 체인
- **SPRINT / AUTO / SELF HEAL**: 개발 루프
- **CI (lint, test, build)**: C5 통합 검증 후 auto merge
