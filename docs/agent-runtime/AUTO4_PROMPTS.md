# Auto 4 — 각 Cursor에게 붙여 넣을 프롬프트

**갱신**: 2026-03-20 (REFRESH 5) — 보드 **SPRINT 83** — 잔여 **`[ ]`:** C1 **TASK2·3·5·7** · **C4 TASK33** · **C5 TASK32** · **C3 TASK29** · **C6 TASK30** · C7 **`SPRINT_LOG` 334/2311** — **정본은 항상 `CURSOR_TASK_BOARD` 표**. **할 일 읽는 법:** **`docs/agent-runtime/HOW_TO_READ_TASKS.md`** (bty-app이면 `../docs/agent-runtime/HOW_TO_READ_TASKS.md`).  
**사용법**: 아래 블록 **그대로** 복사. 완료 시 보드 `[x]` + `CURRENT_TASK.md` + (Gate 시) `BTY_RELEASE_GATE_CHECK.md`.

**할 일 단일 진실**: **`docs/CURSOR_TASK_BOARD.md`** "이번 런" 표 — 자기 **OWNER** 행 중 **`[ ]`**.

---

## C1 (Commander / 문서)

**복사용:**

다음 작업 해줘.

**할 일**: [C1(DOCS)] 보드 **SPRINT 83** C1 TASK **2·3·5·7**. TASK 2: NEXT_PHASE·NEXT_BACKLOG + **S82** 잔여 동기. TASK 3: 문서 점검 **178·179·180**차(미처리분). TASK 5: 다음 배치(선택). TASK 7: §·**SPRINT 84** 예고.

**완료 시**: 보드 `[x]`·`CURRENT_TASK.md`·"작업 완료. 보드·CURRENT_TASK 반영했습니다."

---

## C2 (Gatekeeper)

**복사용:**

다음 작업 해줘.

**할 일**: [C2] Gate **83** — 최신 **334/2311** (C5 TASK27) — **다음 `origin/main` push** 시 `BTY_RELEASE_GATE_CHECK`·수치 **재동기** (REFRESH마다 전체 Gate 재실행 안 함).

**완료 시**: Gate 문서 갱신 + 보드 C2 메모.

---

## C3 (Domain / Arena)

**복사용:**

다음 작업 해줘.

**할 일**: [C3] 보드 **S83 TASK 29** `[ ]` — Arena **domain** + Vitest edges · `src/domain/arena` · app import 금지 · 기존 S83 규칙과 **중복 금지** *(TASK8·9·13·16·**22·26·28 [x]**.)*

**완료 시**: 보드 `[x]`·`CURRENT_TASK.md`.

---

## C4 (UI / 접근성)

**복사용:**

다음 작업 해줘.

**할 일**: [C4] 보드 **S83 TASK 33** `[ ]` — **한 화면** `<main>`/`aria` — 보드 PROMPT (**beginner·result·lab·record·wireframe·랜딩·train/day·play·run·resolve·hub·직전 C4** 등 제외) · `i18n` · render-only.

**완료 시**: 보드 `[x]`·`CURRENT_TASK.md`.

---

## C5 (VERIFY)

**복사용:**

다음 작업 해줘.

**할 일**: [C5] 보드 **S83 TASK 32** `[ ]` — Gate·엘리트·문서 (`BTY_RELEASE_GATE_CHECK`·`ELITE_3RD` · **334/2311** 기준 동기) · *(TASK1·6·14·18·21·23·**27 [x]**.)*

**완료 시**: 보드 `[x]`·`CURRENT_TASK.md`·(필요 시) `BTY_RELEASE_GATE_CHECK.md`·`ELITE_3RD`.

---

## C6 (Test/Fix)

**복사용:**

다음 작업 해줘.

**할 일**: [C6] 보드 **S83 TASK 30** `[ ]` — `npm run test:q237-smoke` + `bty-app/scripts/self-healing-ci.sh` · 수치 **`SPRINT_LOG.md`** · *(TASK10·12·17·**20 [x]** · **334/2311** 참고.)*

**완료 시**: 보드 `[x]`·로그 수치.

---

*출처: SPRINT 83. **병렬 `[ ]`:** C4 **TASK33** · C3 **TASK29** · C6 **TASK30** · C5 **TASK32** · C1 **TASK2·3·5·7**.*
