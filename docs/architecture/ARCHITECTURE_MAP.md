# BTY Architecture Map

이 문서는 BTY 프로젝트 **전체 시스템 구조**를 설명한다.

## 목적

1. **Agent(C1~C5)**가 프로젝트 구조를 이해하도록 한다.
2. **Arena / Center / Foundry** 경계를 명확히 한다.
3. **Domain / API / UI** 책임을 분리한다.

---

## SYSTEM OVERVIEW

BTY는 **3개의 주요 시스템**으로 구성된다.

- **Arena**
- **Center**
- **Foundry**

각 시스템은 독립적으로 개발되며 **Boundary 규칙**을 따른다.

---

## ARENA

| 항목 | 내용 |
|------|------|
| **의미** | 의사결정 / 리더십 시나리오 / XP / Leaderboard |
| **위치** | `src/app/[locale]/bty-arena/`, `src/components/bty-arena/`, `src/lib/bty/arena/`, `src/app/api/arena/`, `src/app/api/bty-arena/` |
| **주요 기능** | scenario, leaderboard, xp system, arena profile, reflection |

---

## CENTER

| 항목 | 내용 |
|------|------|
| **의미** | 감정 안정 / Dear Me / 회복 / 자존감 |
| **위치** | `src/app/[locale]/dear-me/`, `src/domain/center/`, `src/app/api/center/` |
| **주요 기능** | dear-me letter, resilience path, emotional reflection |

---

## FOUNDRY

| 항목 | 내용 |
|------|------|
| **의미** | 훈련 / 질문 / 역지사지 / 멘토 |
| **위치** | `src/app/[locale]/bty/(protected)/`, `src/domain/dojo/`, `src/app/api/dojo/` |
| **주요 기능** | mentor system, dojo questions, integrity training |

---

## DOMAIN LAYER

- **비즈니스 로직 위치**: `src/domain/**`
- **예**: leaderboard rules, xp calculation, resilience logic, dojo question flow

---

## API LAYER

- **서버 엔드포인트**: `src/app/api/**`
- **역할**: request validation, domain 호출, response 반환
- **비즈니스 로직 금지**

---

## UI LAYER

- **사용자 인터페이스**: `src/app/**`, `src/components/**`
- **역할**: **render-only**
- **비즈니스 계산 금지**

---

## AI AGENT SYSTEM

BTY 프로젝트는 **Multi-Agent 개발 구조**를 사용한다.

| Agent | 역할 |
|-------|------|
| **C1 Commander** | 작업 관리 / Auto Loop / Task Scheduling |
| **C2 Gatekeeper** | 아키텍처 규칙 검사 |
| **C3 Domain Engineer** | Domain / API 구현 |
| **C4 UI Engineer** | UI 구현 |
| **C5 Integrator** | API / UI 연결 상태 검사 |

---

## DEVELOPMENT PIPELINE

```
MODE 선택 (ARENA | CENTER | FOUNDRY | PLATFORM)
    ↓
Feature Pipeline
    ↓
Task 생성
    ↓
C3 Domain/API
    ↓
C4 UI
    ↓
C2 Gate 검사
    ↓
C5 Integration
    ↓
TASK MEMORY 기록
    ↓
Release Gate
    ↓
Deploy
```

---

## CORE RULES

1. **Domain logic**은 `src/domain` 또는 `src/lib/bty`에만 존재
2. **API handler**는 validation + domain 호출만 수행
3. **UI**는 render-only
4. **Arena / Center / Foundry** Boundary 유지
5. **Release Gate** 통과 후 배포
