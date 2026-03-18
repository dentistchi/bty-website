# Auto 4 — 각 Cursor에게 붙여 넣을 프롬프트

**갱신**: 2026-03-18 — 보드 **SPRINT 56**.  
**사용법**: 아래 해당 Cursor 블록을 **그대로** 복사. 완료 시 보드 `[x]` + `CURRENT_TASK.md` + (Gate 시) `BTY_RELEASE_GATE_CHECK.md`.

**할 일 단일 진실**: **`docs/CURSOR_TASK_BOARD.md`** "이번 런" 표 — 자기 **OWNER** 행 중 **`[ ]`** 만.

---

## C1 (Commander / 문서)

**복사용:**

다음 작업 해줘.

**할 일**: [C1(DOCS)] 보드 **SPRINT 56** C1 TASK **2·3·5·7**. TASK 2: NEXT_PHASE·NEXT_BACKLOG + S55·S54 잔여. TASK 3: 문서 점검 **154·155·156**차. TASK 5: 다음 배치(선택). TASK 7: §·**SPRINT 57** 예고. **C5 Gate 56 미완 시** 문서만 선행.

**완료 시**: (1) `CURSOR_TASK_BOARD.md` 해당 행 `[x]` (2) `CURRENT_TASK.md` 완료 1줄 (3) "작업 완료. 보드·CURRENT_TASK 반영했습니다."

---

## C2 (Gatekeeper)

**복사용:**

다음 작업 해줘.

**할 일**: [C2] **C5 TASK1 (Release Gate 56차) 완료 후**, 다음 **`origin/main` 배포 push** 시 Gate 문서·수치 **재1회** 동기.

**완료 시**: Gate 문서 갱신 + 보드 C2 메모.

---

## C3 (Domain / Arena API 테스트)

**복사용:**

다음 작업 해줘.

**할 일**: [C3] 보드 S56 **TASK 8·9**: Arena **domain** + **`src/app/api` route** 테스트 각 1건. vitest 통과. **C5 TASK1 (Gate 56) [x] 후 착수.**

**완료 시**: 보드 `[x]`·`CURRENT_TASK.md` 1줄·"작업 완료. 보드·CURRENT_TASK 반영했습니다."

---

## C4 (UI / 접근성)

**복사용:**

다음 작업 해줘.

**할 일**: [C4] 보드 S56 **TASK 4** — Center/Foundry **추가 접근성 1곳**. **`/bty`·My Page·Growth 제외** 권장. render-only. **C5 Gate 56 [x] 후 착수.**

**완료 시**: 보드 `[x]`·`CURRENT_TASK.md`·"작업 완료. 보드·CURRENT_TASK 반영했습니다."

---

## C5 (VERIFY / First Task)

**복사용:**

다음 작업 해줘.

**할 일**: [C5] 보드 S56 **First TASK 1** — [VERIFY] Release Gate A~F **Foundry 56차**. bty-release-gate.mdc A~F. Lint·Test·Build. `BTY_RELEASE_GATE_CHECK.md`·보드·`CURRENT_TASK.md`. **TASK 6**: 엘리트 3차 체크리스트 1회·§3.

**완료 시**: Gate 문서·보드·CURRENT_TASK 반영·"작업 완료. 보드·CURRENT_TASK 반영했습니다."

---

## C6 (Test/Fix)

**복사용:**

다음 작업 해줘.

**할 일**: [C6] 보드 S56 **TASK 10** — `npm run test:q237-smoke` + `self-healing-ci.sh`. 수치 **`SPRINT_LOG.md`**. **TASK1·6과 병행 가능.**

**완료 시**: 보드 `[x]`·`CURRENT_TASK.md`·로그 수치.

---

*출처: 보드 SPRINT 56. First Task = C5 TASK1 Gate 56.*
