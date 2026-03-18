# NEXT_PHASE_AUTO4 — 대기 작업 단일 기준

**목적**: Auto 4(검증 + C2·C3·C4·C5 병렬 선정)와 **docs/CURSOR_TASK_BOARD.md**(루트 단일 진실)의 **대기 작업**을 같은 기준으로 유지한다.  
이 파일을 갱신할 때는 두 보드의 대기 행도 동일하게 맞춘다.  
**다음 프로젝트 추천**: `docs/NEXT_PROJECT_RECOMMENDED.md` — 엘리트 3차.

---

## 현재 대기 작업 (보드와 동일) — MODE FOUNDRY (SPRINT 46 잔여)

| 순서 | 할 일 (한 줄) | 보드 반영 |
|------|----------------|-----------|
| 1 | **[DOMAIN] Center/Foundry 미커버 경계 테스트 1건 (선택)** — C3. npm test 통과. | docs 보드 SPRINT 46 TASK 8 |
| 2 | **[TEST] Center/Foundry route 테스트 1건 (선택)** — C3. POST/GET 401·200 등. | docs 보드 SPRINT 46 TASK 9 |
| 3 | **C1 splint 10 → SPRINT 252** — Arena `SPRINT_PLAN`·CURSOR_TASK_BOARD TASK 1~10. Arena 251 종료 후. | C1 (다음 배치) |

*SPRINT 46: TASK 1~7·10 완료. 잔여 TASK 8·9는 선택. **다음 메인:** splint 252.*

---

## 다음 후보 (AUTO 시 2~3개 묶기용)

- C1 splint 10 → SPRINT 252 (Arena)
- [DOMAIN] Center/Foundry 미커버 (TASK 8, 선택)
- [TEST] Center/Foundry route (TASK 9, 선택)

*Auth·XP·리더보드 등 위험 구간은 1개만 First Task로 둔다.*

---

## 갱신 규칙

- **작업 완료 시**: 해당 항목을 위 표에서 제거하고, 다음 후보 중 하나를 "현재 대기"로 올린다. **docs/CURSOR_TASK_BOARD.md**(루트 단일 진실)의 대기 행을 같은 내용으로 수정한다.
- **대기 작업 변경 시**: 이 파일의 "현재 대기 작업" 표를 먼저 수정한 뒤, 두 보드 표를 동일하게 갱신한다.

---

*최종 갱신: 2026-03-20 — SPRINT 46 C1 TASK 5·7·10 완료. 대기 = TASK8·9(선택) + splint 252. NEXT_BACKLOG·보드와 동일.*
