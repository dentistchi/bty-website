# Auto 4 — 각 Cursor에게 붙여 넣을 프롬프트 (splint 10 산출물)

**생성 시점**: splint 10 — SPRINT 45 전량 10/10 완료 → SPRINT 46 생성 (2026-03-12).  
**사용법**: 아래 C1~C5 중 해당 Cursor에 **복사용 문장**을 그대로 복사해 붙여 넣기. 완료 시 보드 해당 행 **완료** + `docs/CURRENT_TASK.md` 완료 1줄 추가 후 **「작업 완료. 보드·CURRENT_TASK 반영했습니다.»** 라고 하면 됨.

**SPRINT 46 (2026-03-12)**: 이번 런 **0/10 [x]**. First Task = TASK 1 [VERIFY] Release Gate 46차 (C5). 할 일 = **docs/CURSOR_TASK_BOARD.md** "이번 런" 표 TASK 1~10 중 **[ ]** 인 항목.

**진행 에이전트(C2–C6) 할 일 확인**: **docs/CURSOR_TASK_BOARD.md** "이번 런" 표에서 자기 OWNER(C1~C5) 행 중 **[ ]** 인 TASK만 수행. (별도 "C2 TASK QUEUE" 파일 없음 — 보드 표가 단일 큐.)

---

## C1 (Commander / 문서)

**복사용 (아래 문장 전체를 그대로 복사):**

다음 작업 해줘.

**할 일**: [C1(DOCS)] 보드 이번 런(SPRINT 46) C1 TASK 2·3·5·7·10 — TASK 1(C5 Release Gate 46차) [x] 된 뒤 진행. TASK 2: NEXT_PHASE·NEXT_BACKLOG 대기 갱신. TASK 3: 문서 점검 124·125·126차. TASK 5: 다음 배치 선정(선택). TASK 7: § 다음 작업 정리. TASK 10: Arena·Center·Foundry 대기 목록 동기화.

**완료 시 반드시**: (1) docs/CURSOR_TASK_BOARD.md 해당 행 완료 표시 (2) docs/CURRENT_TASK.md 완료 1줄 추가 (3) "작업 완료. 보드·CURRENT_TASK 반영했습니다."

---

## C2 (Gatekeeper / AUTH)

**복사용 (아래 문장 전체를 그대로 복사):**

다음 작업 해줘.

**할 일**: [C2(AUTH)] 보드 이번 런(SPRINT 46)에 C2 할당 없음. **해당 없음 Exit.**

**완료 시**: 작업·보드 갱신 없이 종료.

---

## C3 (Domain/API)

**복사용 (아래 문장 전체를 그대로 복사):**

다음 작업 해줘.

**할 일 (선택·필요 시):**
1. [DOMAIN] Center/Foundry 미커버 경계 테스트 1건 — 미커버 1곳 *.test.ts. npm test 통과. *(보드 SPRINT 46 TASK 8)*
2. [TEST] Center/Foundry route 테스트 1건 — POST/GET route 401·200 등. npm test 통과. *(보드 SPRINT 46 TASK 9)*

**완료 시 반드시**: (1) docs/CURSOR_TASK_BOARD.md에서 해당 행 완료 표시 (2) docs/CURRENT_TASK.md에 완료 1줄 추가 (3) "작업 완료. 보드·CURRENT_TASK 반영했습니다."라고 해줘.

---

## C4 (UI)

**복사용 (아래 문장 전체를 그대로 복사):**

다음 작업 해줘.

**할 일**: [UI] Center/Foundry 추가 접근성 1곳 — dear-me·assessment·center·dojo·integrity·mentor·elite 중 미적용 1곳 aria-label·aria-describedby. render-only. npm run lint 통과. *(보드 SPRINT 46 TASK 4)*

**완료 시 반드시**: (1) docs/CURSOR_TASK_BOARD.md에서 해당 행 완료 표시 (2) docs/CURRENT_TASK.md에 완료 1줄 추가 (3) "작업 완료. 보드·CURRENT_TASK 반영했습니다."라고 해줘.

---

## C5 (VERIFY)

**복사용 (아래 문장 전체를 그대로 복사):**

다음 작업 해줘.

**할 일**: [C5(VERIFY)] 보드 이번 런(SPRINT 46) **First Task** — TASK 1 [VERIFY] Release Gate A~F Foundry 46차. bty-release-gate.mdc A~F. Lint·Test·Build. BTY_RELEASE_GATE_CHECK·보드·CURRENT_TASK 반영. TASK 6: 엘리트 3차 체크리스트 1회(6항목). Elite=Weekly XP만·시즌 미반영.

**완료 시 반드시**: (1) docs/CURSOR_TASK_BOARD.md 해당 행 완료 (2) docs/BTY_RELEASE_GATE_CHECK.md·docs/CURRENT_TASK.md 반영 (3) "작업 완료. 보드·CURRENT_TASK 반영했습니다."

---

## C6 (Test/Fix)

**할 일**: 보드 "이번 런" 표에 OWNER C6 행 없음. C3 테스트·수정 보조 시 C3 완료 표시에 연동. **해당 없음 Exit.** — 큐는 **docs/CURSOR_TASK_BOARD.md** "이번 런" 표가 단일 기준.

---

*출처: splint 10 (2026-03-12) — SPRINT 45 전량 10/10 완료 → SPRINT 46 생성. First Task = Release Gate 46차.*
