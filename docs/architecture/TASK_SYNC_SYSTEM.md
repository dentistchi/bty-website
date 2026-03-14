# TASK SYNC SYSTEM

BTY 프로젝트의 작업 문서 동기화 규칙.

## 목적

1. MASTER PLAN, KANBAN BOARD, CURSOR TASK BOARD를 연결한다.
2. C1이 일관된 기준으로 작업을 선택하게 한다.
3. 작업 누락 / 중복 / 상태 불일치를 방지한다.

---

## 핵심 문서 역할

### 1. MASTER PLAN

**위치**

```
docs/plans/*.md
```

**역할**

- 장기 계획
- Feature 정의
- Phase 정의
- Task 후보 정의

**예**

```
docs/plans/ARENA_MASTER_PLAN.md
```

MASTER PLAN은 **기능 계획의 원본**이다.

---

### 2. KANBAN TASK BOARD

**위치**

```
docs/KANBAN_TASK_BOARD.md
```

**역할**

- 시각적 진행 상태
- TODO / IN PROGRESS / REVIEW / DONE 관리
- 사람이 전체 상황을 한눈에 보는 용도

KANBAN BOARD는 **사람 중심 시각화 보드**다.

---

### 3. CURSOR TASK BOARD

**위치**

```
docs/CURSOR_TASK_BOARD.md
```

**역할**

- C1이 실제로 작업을 집는 보드
- 실행 단위 작업 관리
- owner / 상태 / note 관리

CURSOR TASK BOARD는 **실행 단위의 단일 진실**이다.

---

## 문서 간 관계

```
MASTER PLAN
     ↓
KANBAN TASK BOARD
     ↓
CURSOR TASK BOARD
```

**의미**

1. MASTER PLAN에서 기능과 작업 후보가 정의된다.
2. KANBAN TASK BOARD에서 시각적 상태가 관리된다.
3. CURSOR TASK BOARD에서 실제 실행 작업이 선택된다.

---

## 단일 진실 원칙

### 실행 단위 단일 진실

실제 실행 상태의 단일 진실은 `docs/CURSOR_TASK_BOARD.md`이다.

C1은 항상 CURSOR TASK BOARD를 기준으로 작업을 선택한다.

### 계획 단위 단일 진실

기능 계획의 단일 진실은 `docs/plans/*.md`이다.

### 시각화 단위 단일 진실

시각적 진행판의 단일 진실은 `docs/KANBAN_TASK_BOARD.md`이다.

---

## 동기화 규칙

### Rule 1

MASTER PLAN에 새로운 기능/작업 후보가 추가되면

- KANBAN TASK BOARD TODO에 반영할 수 있다
- 실행할 수준이면 CURSOR TASK BOARD에도 추가한다

### Rule 2

CURSOR TASK BOARD에서 작업이 완료되면

- KANBAN TASK BOARD 상태도 DONE으로 반영한다
- 필요하면 MASTER PLAN에서 해당 task를 완료로 표시한다

### Rule 3

KANBAN TASK BOARD만 수정하고 CURSOR TASK BOARD를 수정하지 않은 상태로 두지 않는다.

KANBAN은 시각 보드일 뿐, 실행 상태는 CURSOR TASK BOARD가 기준이다.

### Rule 4

CURSOR TASK BOARD에 없는 작업은 C1이 직접 실행 대상으로 선택하지 않는다.

먼저 MASTER PLAN 또는 NEXT_BACKLOG에서 끌어와 CURSOR TASK BOARD에 추가한 뒤 실행한다.

---

## C1 동작 규칙

C1은 다음 순서로 작업을 선택한다.

1. `docs/CURSOR_TASK_BOARD.md`에서 상태가 **대기**인 작업을 찾는다.
2. 없으면 `docs/NEXT_BACKLOG_AUTO4.md`, `docs/plans/*.md`를 확인한다.
3. 작업 후보를 찾으면 먼저 `docs/CURSOR_TASK_BOARD.md`에 추가한다.
4. 그 후 owner를 지정하고 실행 프롬프트를 만든다.

즉, C1은 **직접 MASTER PLAN 작업을 실행하지 않고** 항상 CURSOR TASK BOARD를 거쳐 실행한다.

---

## KANBAN 상태 매핑

KANBAN 상태는 다음 기준으로 CURSOR TASK BOARD와 연결한다.

| KANBAN | 의미 |
|--------|------|
| **TODO** | CURSOR TASK BOARD에 아직 없거나 상태가 대기 |
| **IN PROGRESS** | 현재 진행 중, owner가 할당되어 작업 중 |
| **REVIEW** | 구현 완료, C2 Gate / C5 Integration / verify 대기 |
| **DONE** | 구현 완료, 검증 완료, 보드 반영 완료 |

---

## 상태 동기화 예시

**MASTER PLAN**

- [UI] mentor request form 구현

↓

**KANBAN** — TODO

- [UI] mentor request form 구현

↓

**CURSOR TASK BOARD**

| Feature | [UI] mentor request form 구현 | 대기 | render-only |

작업 진행 후

↓

**KANBAN** — IN PROGRESS

- [UI] mentor request form 구현

작업 완료 후

↓

**KANBAN** — DONE

- [UI] mentor request form 구현

**CURSOR TASK BOARD**

| Feature | [UI] mentor request form 구현 | 완료 | form 완료 및 보드 반영 |

---

## 자동 동기화 원칙

BTY는 완전 자동 동기화를 목표로 하지만, 현재는 **C1 중심 반자동 동기화**를 기본으로 한다.

- C1이 CURSOR TASK BOARD를 기준으로 실행
- 완료 시 KANBAN 반영 여부를 함께 확인
- MASTER PLAN 후속 작업은 C1이 NEXT_BACKLOG로 연결

---

## 문서별 권장 수정 주체

| 문서 | 수정 주체 |
|------|-----------|
| **MASTER PLAN** | 사람, C1 (후보 생성 보조) |
| **KANBAN TASK BOARD** | 사람, C1 (완료 반영 보조) |
| **CURSOR TASK BOARD** | C1, 실행 Agent 완료 시 반영 |

---

## 관련 문서

- `docs/plans/ARENA_MASTER_PLAN.md`
- `docs/KANBAN_TASK_BOARD.md`
- `docs/CURSOR_TASK_BOARD.md`
- `docs/NEXT_BACKLOG_AUTO4.md`
- `docs/BTY_DEV_OPERATING_MANUAL.md`

---

## 최종 원칙

BTY의 작업 흐름은 항상 다음을 따른다.

```
MASTER PLAN
     ↓
KANBAN
     ↓
CURSOR TASK BOARD
     ↓
C1 실행
```

실행 상태의 단일 진실은 항상 `docs/CURSOR_TASK_BOARD.md`이다.
