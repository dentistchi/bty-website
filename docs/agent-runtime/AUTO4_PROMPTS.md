# Auto 4 — 각 Cursor에게 붙여 넣을 프롬프트 (splint 10 산출물)

**생성 시점**: splint 10 확인 — SPRINT 42 검증 7/10 [x]. 새 스프린트 미생성. **다음 할 일** = [ ]인 TASK 4 (C4), 8·9 (C3)만.  
**사용법**: 아래 C1~C5 중 해당 Cursor에 **복사용 문장**을 그대로 복사해 붙여 넣기. 완료 시 보드 해당 행 **완료** + `docs/CURRENT_TASK.md` 완료 1줄 추가 후 **「작업 완료. 보드·CURRENT_TASK 반영했습니다.»** 라고 하면 됨.

**SPRINT 42 (2026-03-11)**: 이번 런 **7/10 [x]**. 미완료 3건 = TASK 4 (C4), 8·9 (C3). C1·C2·C5는 이번 런 자기 TASK 전부 [x] → **해당 없음 Exit.**

**진행 에이전트(C2–C6) 할 일 확인**: **docs/CURSOR_TASK_BOARD.md** "이번 런" 표에서 자기 OWNER(C1~C5) 행 중 **[ ]** 인 TASK만 수행. (별도 "C2 TASK QUEUE" 파일 없음 — 보드 표가 단일 큐.)

---

## C1 (Commander / 문서)

**복사용 (아래 문장 전체를 그대로 복사):**

다음 작업 해줘.

**할 일**: [C1(DOCS)] 보드 이번 런(SPRINT 42)에서 C1 TASK 2·3·5·7·10 전부 [x]. **해당 없음 Exit.**

**완료 시**: 작업·보드 갱신 없이 종료.

---

## C2 (Gatekeeper / AUTH)

**복사용 (아래 문장 전체를 그대로 복사):**

다음 작업 해줘.

**할 일**: [C2(AUTH)] 보드 이번 런(SPRINT 42)에 C2 할당 없음. **해당 없음 Exit.**

**완료 시**: 작업·보드 갱신 없이 종료.

---

## C3 (Domain/API)

**복사용 (아래 문장 전체를 그대로 복사):**

다음 작업 해줘.

**할 일 (선택·필요 시):**
1. [DOMAIN] Center/Foundry 미커버 경계 테스트 1건 — 미커버 1곳 *.test.ts. npm test 통과. *(보드 SPRINT 42 TASK 8)*
2. [TEST] Center/Foundry route 테스트 1건 — POST/GET route 401·200 등. npm test 통과. *(보드 SPRINT 42 TASK 9)*

**완료 시 반드시**: (1) docs/CURSOR_TASK_BOARD.md에서 해당 행 완료 표시 (2) docs/CURRENT_TASK.md에 완료 1줄 추가 (3) "작업 완료. 보드·CURRENT_TASK 반영했습니다."라고 해줘.

---

## C4 (UI)

**복사용 (아래 문장 전체를 그대로 복사):**

다음 작업 해줘.

**할 일**: [UI] Center/Foundry 추가 접근성 1곳 — dear-me·assessment·center·dojo·integrity·mentor·elite 중 미적용 1곳 aria-label·aria-describedby. render-only. npm run lint 통과. *(보드 SPRINT 42 TASK 4)*

**완료 시 반드시**: (1) docs/CURSOR_TASK_BOARD.md에서 해당 행 완료 표시 (2) docs/CURRENT_TASK.md에 완료 1줄 추가 (3) "작업 완료. 보드·CURRENT_TASK 반영했습니다."라고 해줘.

---

## C5 (VERIFY)

**복사용 (아래 문장 전체를 그대로 복사):**

다음 작업 해줘.

**할 일**: [C5(VERIFY)] 보드 이번 런(SPRINT 42)에서 C5 TASK 1·6 전부 [x]. **해당 없음 Exit.**

**완료 시**: 작업·보드 갱신 없이 종료.

---

## C6 (Test/Fix)

**할 일**: 보드 "이번 런" 표에 OWNER C6 행 없음. C3 테스트·수정 보조 시 C3 완료 표시에 연동. **해당 없음 Exit.** — 큐는 **docs/CURSOR_TASK_BOARD.md** "이번 런" 표가 단일 기준.

---

*출처: splint 10 확인 (2026-03-11) — SPRINT 42 검증 7/10 [x]. 새 스프린트 미생성. 다음 할 일 = TASK 4 (C4), 8·9 (C3). 10/10 [x] 되면 C1 splint 10 재실행 → SPRINT 43 생성.*
