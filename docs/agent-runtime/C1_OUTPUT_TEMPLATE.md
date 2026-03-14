# C1 OUTPUT TEMPLATE

항상 아래 형식으로만 출력한다.

---

## 필드 정의

| 필드 | 설명 | 허용값/예시 |
|------|------|-------------|
| **RESULT** | 실행 결과 | AUTO / AUTO LOOP / SPRINT READY / VERIFY PASS / VERIFY FAIL / HEALTH OK / HEALTH WARNING / SELF HEAL READY |
| **MODE** | 현재 시스템 모드 | ARENA / CENTER / FOUNDRY / PLATFORM |
| **ROUND** | 라운드 번호 | ROUND \<number> |
| **FEATURE** | 현재 작업이 속한 기능 그룹 | Leaderboard / XP System / Mentor System / Reflection System 등 |
| **VERIFY** | 검증 결과 | PASS / FAIL / WARNING |
| **LAST TASK** | 방금 끝난 작업 한 줄 요약 | 없으면 NONE |
| **NEXT OWNER** | 다음 작업 담당 Agent | C2 / C3 / C4 / C5 / C1 |
| **TASK LINE** | CURSOR_TASK_BOARD에 들어갈/있는 작업 한 줄 | 보드 형식 그대로 |
| **NEXT ACTION** | 해당 Agent에게 복붙할 한 줄 명령 | 짧고 직접 실행 가능 |
| **FILES TO CHECK** | 먼저 확인할 파일/폴더 | 3~8개 이내 |
| **KANBAN UPDATE** | KANBAN 상태 반영 | move to IN PROGRESS / REVIEW / DONE |
| **MEMORY NOTE** | PROJECT_MEMORY에 남길 한 줄 | 반복 버그/구조 변경/follow-up 요약 |
| **BOARD UPDATE** | CURSOR_TASK_BOARD 상태 변경 | 대기→진행, 진행→완료, note update only |
| **CURRENT_TASK UPDATE** | CURRENT_TASK.md에 추가할 한 줄 | 진행 중 / 완료 요약 |
| **FOLLOW UP** | 다음 라운드 이어질 작업 1~3개 | 없으면 NONE |
| **FINAL** | 마무리 문장 | 작업 완료. 보드·CURRENT_TASK 반영했습니다. |

---

## 템플릿 (복사용)

```
RESULT:
- 

MODE:
- 

ROUND:
- ROUND 

FEATURE:
- 

VERIFY:
- 

LAST TASK:
- 

NEXT OWNER:
- 

TASK LINE:
- 

NEXT ACTION:
- 

FILES TO CHECK:
- 
- 
- 

KANBAN UPDATE:
- 

MEMORY NOTE:
- 

BOARD UPDATE:
- 

CURRENT_TASK UPDATE:
- 

FOLLOW UP:
- 

FINAL:
- 작업 완료. 보드·CURRENT_TASK 반영했습니다.
```

---

## 출력 예시 1 — AUTO LOOP

```
RESULT:
AUTO LOOP

MODE:
ARENA

ROUND:
ROUND 12

FEATURE:
Mentor System

VERIFY:
PASS

LAST TASK:
- [API] mentor request create endpoint 구현 완료

NEXT OWNER:
- C4

TASK LINE:
- [UI] mentor request form 구현

NEXT ACTION:
- mentor request form UI를 render-only로 구현하고 loading, empty state, aria를 포함하라.

FILES TO CHECK:
- src/app/[locale]/bty-arena/
- src/components/bty-arena/
- src/types/arena.ts
- docs/specs/ARENA_SPEC_1PAGE.md

KANBAN UPDATE:
- move to IN PROGRESS

MEMORY NOTE:
- mentor request는 API 응답 기준으로만 상태를 표시하고 UI에서 재판단하지 않는다.

BOARD UPDATE:
- 대기 → 진행

CURRENT_TASK UPDATE:
- [UI] mentor request form 구현 진행 중

FOLLOW UP:
- [UI] mentor request list page 구현
- [VERIFY] mentor request integration check

FINAL:
- 작업 완료. 보드·CURRENT_TASK 반영했습니다.
```

---

## 출력 예시 2 — VERIFY FAIL

```
RESULT:
VERIFY FAIL

MODE:
ARENA

ROUND:
ROUND 18

FEATURE:
Leaderboard

VERIFY:
FAIL

LAST TASK:
- [UI] leaderboard page 구현 완료

NEXT OWNER:
- C3

TASK LINE:
- [API] leaderboard response shape mismatch 수정

NEXT ACTION:
- leaderboard endpoint의 response shape를 UI 계약과 맞추고 type mismatch를 해결하라.

FILES TO CHECK:
- src/app/api/arena/leaderboard/
- src/lib/bty/arena/services/
- src/domain/arena/leaderboard/
- src/types/arena.ts

KANBAN UPDATE:
- move to REVIEW

MEMORY NOTE:
- leaderboard response shape mismatch가 반복되고 있으므로 domain type과 service output을 같이 점검해야 한다.

BOARD UPDATE:
- note update only

CURRENT_TASK UPDATE:
- [API] leaderboard response shape mismatch 수정 필요

FOLLOW UP:
- [VERIFY] integration re-check
- [UI] leaderboard row render polish

FINAL:
- 작업 완료. 보드·CURRENT_TASK 반영했습니다.
```

---

## 출력 규칙

1. **순서 유지** — 항상 이 필드 순서를 유지한다.
2. **상단 5개** — RESULT, MODE, ROUND, FEATURE, VERIFY를 맨 위에 둔다.
3. **NEXT ACTION** — 반드시 복붙 가능한 실행 문장으로 쓴다.
4. **FILES TO CHECK** — 구체적 경로를 쓰고, 3~8개 이내로 제한한다.
5. **BOARD / CURRENT_TASK** — BOARD UPDATE, CURRENT_TASK UPDATE를 반드시 포함한다.
6. **FINAL** — 작업이 실제 완료된 경우 FINAL 문장을 반드시 그대로 넣는다.
7. **진행 단계** — 작업이 아직 진행 단계여도 FINAL 문장은 형식상 유지하되, BOARD UPDATE와 CURRENT_TASK UPDATE에 현재 상태를 정확히 적는다.
8. **C1 역할** — src 코드를 직접 수정하지 않는다.
9. **단일 진실** — 항상 `docs/CURSOR_TASK_BOARD.md`를 실행 상태의 단일 진실로 본다.
10. **KANBAN vs 보드** — KANBAN은 시각화 보드이고, 실행 상태 판단은 CURSOR_TASK_BOARD 기준으로 한다.

---

## 관련 문서

- `docs/agent-runtime/C1_MASTER_COMMANDER.md` — C1 역할·명령·TASK SELECTION
- `docs/architecture/TASK_SYNC_SYSTEM.md` — MASTER PLAN / KANBAN / CURSOR TASK BOARD 동기화
- `docs/CURSOR_TASK_BOARD.md` — 실행 단위 단일 진실 보드
- `docs/KANBAN_TASK_BOARD.md` — 시각화 보드
