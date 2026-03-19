# Auto 4 — 각 Cursor에게 붙여 넣을 프롬프트

**갱신**: 2026-03-18 — 보드 **SPRINT 66**. **할 일 읽는 법:** **`docs/agent-runtime/HOW_TO_READ_TASKS.md`** (bty-app이면 `../docs/agent-runtime/HOW_TO_READ_TASKS.md`).  
**사용법**: 아래 블록 **그대로** 복사. 완료 시 보드 `[x]` + `CURRENT_TASK.md` + (Gate 시) `BTY_RELEASE_GATE_CHECK.md`.

**할 일 단일 진실**: **`docs/CURSOR_TASK_BOARD.md`** "이번 런" 표 — 자기 **OWNER** 행 중 **`[ ]`**.

---

## C1 (Commander / 문서)

**복사용:**

다음 작업 해줘.

**할 일**: [C1(DOCS)] 보드 **SPRINT 66** C1 TASK **2·3·5·7**. TASK 2: NEXT_PHASE·NEXT_BACKLOG + **S65** 잔여. TASK 3: 문서 점검 **178·179·180**차(미처리분). TASK 5: 다음 배치(선택). TASK 7: §·**SPRINT 67** 예고. **C5 Gate 66와 병행 가능한 문서만 먼저 해도 됨.**

**완료 시**: 보드 `[x]`·`CURRENT_TASK.md`·"작업 완료. 보드·CURRENT_TASK 반영했습니다."

---

## C2 (Gatekeeper)

**복사용:**

다음 작업 해줘.

**할 일**: [C2] **C5 TASK1 (Release Gate 66차) 완료 후**, 다음 **`origin/main` 배포 push** 시 Gate 문서·수치 **재1회** 동기.

**완료 시**: Gate 문서 갱신 + 보드 C2 메모.

---

## C3 (Domain / Arena)

**복사용:**

다음 작업 해줘.

**할 일**: [C3] 보드 **S66** **TASK 8·9** — Arena **domain** + **`src/app/api` route** 테스트 각 1건. vitest 통과.

**완료 시**: 보드 `[x]`·`CURRENT_TASK.md`.

---

## C4 (UI / 접근성)

**복사용:**

다음 작업 해줘.

**할 일**: [C4] 보드 **S66** **TASK 4** — Center/Foundry 접근성 1곳. **`/bty`·My Page·Growth·Dojo History·Integrity 제외.** render-only.

**완료 시**: 보드 `[x]`·`CURRENT_TASK.md`.

---

## C5 (VERIFY / First Task)

**복사용:**

다음 작업 해줘.

**할 일**: [C5] 보드 **S66 First TASK 1** — [VERIFY] Release Gate A~F **Foundry 66차**. Lint·Test·Build. `BTY_RELEASE_GATE_CHECK.md`·보드·`CURRENT_TASK.md`. **TASK 6**: 엘리트 3차 §3.

**완료 시**: Gate 문서·보드·CURRENT_TASK.

---

## C6 (Test/Fix)

**복사용:**

다음 작업 해줘.

**할 일**: [C6] 보드 **S66 TASK 10** — `npm run test:q237-smoke` + `self-healing-ci.sh`. 수치 **`SPRINT_LOG.md`**. **TASK1·6과 병행 가능.**

**완료 시**: 보드 `[x]`·로그 수치.

---

*출처: SPRINT 66. 할 일 읽는 법: HOW_TO_READ_TASKS.md. First Task = C5 Gate 66.*
