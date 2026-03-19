# 다음 배치 (Auto 4 — 기본 5건 완료 시 보드에 추가할 후보)

**목적**: 대기 작업이 없을 때 `scripts/next-project-fill-board.sh`가 여기서 다음 작업을 읽어 보드에 추가한다.  
**기준**: `docs/NEXT_PROJECT_RECOMMENDED.md` §1·§2.  
**갱신일**: 2026-03-18 — 보드 **SPRINT 63** 이번 런. 다음 = **64**.

---

## MASTER PLAN 연결

C1이 작업을 자동으로 채우는 **흐름**은 다음과 같다.

```text
MASTER_PLAN  →  NEXT_BACKLOG_AUTO4  →  CURSOR_TASK_BOARD
```

1. **MASTER_PLAN** — Feature → Phase → Task 정의.  
   - Arena: `docs/plans/ARENA_MASTER_PLAN.md`  
   - (추후 Center/Foundry MASTER_PLAN 추가 시 동일 방식)
2. **NEXT_BACKLOG_AUTO4** — 이 문서. MASTER_PLAN에서 **미완료 Task**를 가져와 "다음 배치 목록"에 반영한다.
3. **CURSOR_TASK_BOARD** — 백로그(이 문서)의 목록을 **대기**로 채운다. (`next-project-fill-board.sh` 또는 C1이 동일 규칙 적용)

**C1 동작**
- MODE가 **ARENA**일 때: `ARENA_MASTER_PLAN`의 FEATURE → PHASE 순서대로 미완료 TASK를 확인하고, 이 문서(다음 배치 목록)에 추가한 뒤 보드에 반영한다.
- 완료된 TASK는 건너뛴다. PHASE 순서: Domain → API → UI.
- TASK 태그([DOMAIN], [API], [UI] 등)에 따라 owner(C2/C3/C4)를 결정한다.

---

## 작업 행 형식

아래 목록은 한 줄이 하나의 보드 행 후보다. 형식: `타입|할 일 한 줄(태그 포함)|비고`

- **타입**: `Fix/Polish` 또는 `Feature`
- **할 일**: `[AUTH]`, `[API]`, `[DOMAIN]`, `[UI]`, `[DOCS]`, `[VERIFY]` 중 하나 포함.
- 스크립트는 이미 보드에 **완료** 또는 **대기**로 있는 할 일과 동일한 텍스트는 추가하지 않는다.
- **문서·AUTH N차 점검**: 반복 추가하지 않음. 배포 전 1회 [VERIFY] Release Gate·문서 점검 수행.

---

## 다음 배치 목록 — FOUNDRY **SPRINT 58**

```
Fix/Polish|[VERIFY] Release Gate 58차|C5. 보드 S58 TASK1.
Fix/Polish|[DOCS] BACKLOG + S57·S56 잔여|C1. S58 TASK2·3·5·7.
Fix/Polish|[UI] Center/Foundry 접근성|C4. S58 TASK4.
Fix/Polish|[DOMAIN]·[TEST] Arena|C3. S58 TASK8·9.
Fix/Polish|[VERIFY] q237-smoke + self-healing-ci|C6. S58 TASK10.
```

*(2026-03-18: SPRINT 58.)*

---

## 갱신 방법

- **대기 0건**이면 `next-project-fill-board.sh`가 이 파일의 **다음 배치 목록**에서 아직 보드에 없는 할 일을 읽어 보드에 추가한다. (목록이 "구현 배치"면 N차 자동 증가 없음.)
- **기본 5건 + 이 배치까지 모두 완료**되면: 이 파일 § "다음 배치 목록"을 로드맵·NEXT_PROJECT_RECOMMENDED §2 대안 기준으로 수정해 새 후보를 추가할 수 있다.
- 또는 **[DOCS] 다음 배치 선정** 작업으로 이 파일을 수동 갱신한 뒤 보드에 반영한다.

*참고: `docs/NEXT_PROJECT_RECOMMENDED.md`, `docs/NEXT_PHASE_AUTO4.md`, `docs/plans/ARENA_MASTER_PLAN.md`, `scripts/next-project-fill-board.sh`*
