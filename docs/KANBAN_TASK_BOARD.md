# BTY KANBAN TASK BOARD

BTY 프로젝트의 작업 진행 상태를 시각적으로 관리하는 보드.

---

## ARENA SYSTEM

### TODO

- [DOMAIN] leaderboard tie-break rule 구현
- [DOMAIN] weekly XP ranking rule 구현
- [DOMAIN] scenario decision rule 구현
- [DOMAIN] mentor request state 정의

### IN PROGRESS

- [API] leaderboard status endpoint 구현
- [API] XP gain endpoint 구현

### REVIEW

- [UI] leaderboard page 구현
- [UI] XP progress bar 구현

### DONE

- [DOMAIN] leaderboard state type 정의
- [DOMAIN] core XP type 정의

---

## CENTER SYSTEM

### TODO

- [DOMAIN] resilience path rule 구현
- [DOMAIN] emotional state type 정의

### IN PROGRESS

- [API] dear me letter save endpoint 구현

### REVIEW

- [UI] dear me letter form 구현

### DONE

- [DOMAIN] emotional support rule 정의

---

## FOUNDRY SYSTEM

### TODO

- [DOMAIN] dojo training rule 구현
- [DOMAIN] mentor evaluation rule 정의

### IN PROGRESS

- [API] mentor session endpoint 구현

### REVIEW

- [UI] dojo training page 구현

### DONE

- [DOMAIN] mentor state type 정의

---

## BOARD STATUS

전체 진행률

| Arena | Center | Foundry |
|-------|--------|---------|
| TODO / IN PROGRESS / REVIEW / DONE | TODO / IN PROGRESS / REVIEW / DONE | TODO / IN PROGRESS / REVIEW / DONE |

---

## TASK TAG RULE

TASK 태그는 담당 Agent를 결정한다.

```
[DOMAIN] → C3
[API]    → C3
[UI]     → C4
[AUTH]   → C2
[DOCS]   → C1
[VERIFY] → C5
```

---

## C1 TASK SELECTION

C1은 다음 규칙으로 작업을 선택한다.

1. **IN PROGRESS** 작업이 있으면 먼저 확인
2. **TODO**에서 다음 작업 선택
3. **SYSTEM MODE**와 일치하는 작업 선택

**예**

```
MODE ARENA
```

→ Arena 작업만 선택

---

## DEVELOPMENT FLOW

```
TODO
  ↓
IN PROGRESS
  ↓
REVIEW
  ↓
DONE
```

---

## SPRINT WORKFLOW

**예**

```
MODE ARENA
SPRINT 5
```

→ Arena TODO에서 작업 5개 선택

---

## AGENT WORKFLOW

```
C1 → 작업 선택
C3 → Domain/API 구현
C4 → UI 구현
C2 → 구조 검사
C5 → 통합 검증
```

---

## MEMORY 기록

작업 완료 시 `docs/agent-runtime/PROJECT_MEMORY.md`에 기록한다.

---

## 핵심 원칙

작업은 항상 다음 계층 순서를 따른다.

```
DOMAIN
  ↓
API
  ↓
UI
```

그리고 항상 **Arena / Center / Foundry** 시스템 경계를 유지한다.
