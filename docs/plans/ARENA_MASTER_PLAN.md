# ARENA MASTER PLAN

Arena 시스템의 **전체 기능 로드맵**이다.

## 목적

- Arena 기능 개발 계획 정의
- C1이 작업을 자동 생성할 수 있게 한다
- Feature → Phase → Task 구조로 관리한다

---

## SYSTEM

**Arena** — BTY의 **경기 시스템**이다.

**핵심 개념:** Scenario, Decision, XP, Leaderboard, Reflection, Mentor

---

## FEATURE PIPELINE

Arena 기능은 다음 **순서**로 개발된다.

```text
Leaderboard
XP System
Scenario Engine
Reflection System
Mentor System
Elite System
```

---

## FEATURE: Leaderboard

**설명:** Arena 사용자 순위를 관리하는 시스템.

**위치**

```text
src/domain/arena/leaderboard
src/lib/bty/arena
src/app/api/arena/leaderboard
src/app/[locale]/bty-arena
```

### PHASE 1 — Domain Rules

- [DOMAIN] leaderboard tie-break rule 구현
- [DOMAIN] weekly xp ranking rule 구현
- [DOMAIN] leaderboard state type 정의

### PHASE 2 — API

- [API] leaderboard status endpoint 구현
- [API] leaderboard list endpoint 구현

### PHASE 3 — UI

- [UI] leaderboard page 구현
- [UI] leaderboard row component 구현
- [UI] leaderboard loading skeleton 구현

---

## FEATURE: XP SYSTEM

**설명:** Arena 경험치 계산 시스템.

**위치**

```text
src/domain/arena/xp
src/lib/bty/arena
src/app/api/arena/xp
```

### PHASE 1 — Domain Rules

- [DOMAIN] XP calculation rule 구현
- [DOMAIN] weekly XP rule 정의
- [DOMAIN] core XP type 정의

### PHASE 2 — API

- [API] XP gain endpoint 구현
- [API] XP history endpoint 구현

### PHASE 3 — UI

- [UI] XP display component 구현
- [UI] XP progress bar 구현

---

## FEATURE: SCENARIO ENGINE

**설명:** Arena 시나리오 기반 의사결정 시스템.

**위치**

```text
src/domain/arena/scenario
src/lib/bty/arena
src/app/api/bty-arena
```

### PHASE 1 — Domain Rules

- [DOMAIN] scenario decision rule 구현
- [DOMAIN] scenario state type 정의

### PHASE 2 — API

- [API] scenario submit endpoint 구현
- [API] scenario load endpoint 구현

### PHASE 3 — UI

- [UI] scenario decision page 구현
- [UI] scenario card component 구현

---

## FEATURE: REFLECTION SYSTEM

**설명:** 사용자 reflection 기록 시스템.

**위치**

```text
src/domain/arena/reflection
src/lib/bty/arena
src/app/api/arena/reflection
```

### PHASE 1 — Domain Rules

- [DOMAIN] reflection entry type 정의
- [DOMAIN] reflection rule 구현

### PHASE 2 — API

- [API] reflection save endpoint 구현
- [API] reflection list endpoint 구현

### PHASE 3 — UI

- [UI] reflection form 구현
- [UI] reflection list page 구현

---

## FEATURE: MENTOR SYSTEM

**설명:** Elite mentor 대화 요청 시스템.

**위치**

```text
src/domain/arena/mentor-request
src/lib/bty/arena
src/app/api/arena/mentor-request
```

### PHASE 1 — Domain Rules

- [DOMAIN] mentor request state 정의
- [DOMAIN] mentor request transition rule 구현

### PHASE 2 — API

- [API] mentor request create endpoint 구현
- [API] mentor request list endpoint 구현
- [API] mentor request status patch endpoint 구현

### PHASE 3 — UI

- [UI] mentor request form 구현
- [UI] mentor request status badge 구현
- [UI] mentor request list page 구현

---

## TASK TAG RULE

TASK 태그는 **owner**를 결정한다.

```text
[DOMAIN] → C3
[API]    → C3
[UI]     → C4
[AUTH]   → C2
[DOCS]   → C1
[VERIFY] → C5
```

---

## C1 TASK GENERATION RULE

C1은 다음 규칙으로 작업을 선택한다.

1. **PHASE 순서** — Domain → API → UI
2. **완료된 TASK**는 건너뛴다.
3. **MODE가 ARENA**일 때 Arena 작업만 선택한다.
4. **TASK**를 CURSOR_TASK_BOARD로 이동한다.

**MASTER_PLAN → BACKLOG → TASK_BOARD 흐름**

- C1이 작업을 채울 때: **ARENA_MASTER_PLAN**(이 문서)에서 미완료 TASK를 읽어 → **NEXT_BACKLOG_AUTO4**(`docs/NEXT_BACKLOG_AUTO4.md`)의 "다음 배치 목록"에 반영한 뒤 → **CURSOR_TASK_BOARD**의 대기 행을 그 백로그에서 채운다.
- 백로그·보드 갱신 시 이 MASTER_PLAN을 참조한다. 자세한 규칙은 `docs/NEXT_BACKLOG_AUTO4.md` § MASTER PLAN 연결.

---

## NEXT TASK SELECTION

C1은 다음 **우선순위**로 작업을 선택한다.

1. 현재 PHASE unfinished task
2. 다음 PHASE task
3. 다음 FEATURE task
