# splint 10 절차 (C1 필수)

**splint 10이란**: 방금 끝난 작업을 **검증**하고, **다음 10개 작업**을 뽑아서, **C1–C5에게 붙일 프롬프트**를 생성하는 명령이다.

**목적**: "splint 10" 요청 시 C1이 **서류를 먼저 확인**한 뒤, 완료된 것만 반영해 **진짜 다음 할 일**을 선정하고, C1–C5용 프롬프트만 작성한다.  
**금지**: 서류 확인 없이 이전과 동일한 10개 명령을 그대로 다시 내는 것.

---

## 1단계: C2–C5 완료 상태 확인 (필수)

다음 문서를 **반드시 읽고** 이번 런(현재 스프린트) 기준 완료 여부를 확인한다.

| 문서 | 확인 내용 |
|------|-----------|
| **CURSOR_TASK_BOARD.md** | "이번 런" 표에서 TASK 1~10 각 행이 **[ ]** 인지 **[x]** 인지 |
| **CURRENT_TASK.md** | 상단 근처에 이번 런 TASK별 "[x] 완료" 또는 "전량 완료" 로그가 있는지 |
| **NEXT_PHASE_AUTO4.md** | 현재 대기 5건이 보드와 일치하는지 |
| **BTY_RELEASE_GATE_CHECK.md** | (VERIFY 실행 시) 최근 완료 줄에 이번 런 N차 반영 여부 |

- **이번 런 10개 전부 [x]** → 2단계에서 **새 스프린트 생성** 후 다음 10개 선정.
- **일부만 [x]** → 2단계에서 **[ ]인 TASK만** 다음 할 일로 선정하고, 이미 [x]인 건 C1–C5 프롬프트에서 **제외**하거나 "해당 없음 Exit"로만 넣는다.
- **전부 [ ]** → C2–C5가 아직 이번 런 작업을 하지 않은 상태. 다음 할 일 = 이번 런 10개 그대로. (작업 유형이 매 스프린트 같아서 **명령이 이전과 비슷해 보이는 것은 정상**.)

---

## 2단계: 다음 할 일 선정

- **10/10 [x]인 경우**:  
  - 보드 "이번 런"을 "이전 런"으로 옮기고 완료 요약 추가.  
  - 새 "이번 런" 스프린트 10행 추가(대기 5건 + 후보에서 5건).  
  - NEXT_PHASE·NEXT_BACKLOG·§ 다음 후보 갱신.  
  - **다음 할 일** = 방금 추가한 새 스프린트의 TASK 1~10.
- **일부 [x]인 경우**:  
  - **다음 할 일** = 이번 런에서 **[ ]인 TASK만**.  
  - C1–C5 프롬프트는 이 TASK들에 대해서만 작성 (완료된 OWNER는 "해당 없음 Exit" 또는 생략).

---

## 3단계: C1–C5 프롬프트 작성

- 2단계에서 정한 **다음 할 일**만 반영한다.
- 보드 OWNER별로 C1(문서), C2(AUTH), C3(Domain/API), C4(UI), C5(VERIFY)에 맞춰 **복사용 문장** 작성.
- `docs/agent-runtime/AUTO4_PROMPTS.md` 를 갱신한 뒤, **응답 시 반드시** 해당 파일의 C1–C5 블록을 응답 본문에 그대로 붙여서 보여준다. (규칙: `.cursor/rules/bty-auto4-prompts-inline.mdc`)
- **bty-app 워크스페이스**: bty-app/docs/CURSOR_TASK_BOARD.md·bty-app/docs/agent-runtime/AUTO4_PROMPTS.md 는 **상위 docs와 심볼릭 링크**이므로 별도 동기화 불필요. (복사본 아님.)

---

## C2–C6 CONTINUE 절차 (할 일 확인 방법)

**문제**: "C2 TASK QUEUE empty" — 별도 큐 파일이 없어서 발생. **단일 기준 = docs/CURSOR_TASK_BOARD.md "이번 런" 표.**

| 단계 | 행동 |
|------|------|
| 1 | **docs/CURSOR_TASK_BOARD.md** (repo root)를 연다. |
| 2 | **"이번 런"** 섹션의 **TASK 1~10 표**에서 자기 OWNER(C1, C2, C3, C4, C5) 행만 본다. |
| 3 | 자기 행 중 **[ ]** 인(미완료) TASK가 있으면 → 그 TASK 수행. 상세·복사용 문장은 **docs/agent-runtime/AUTO4_PROMPTS.md** 해당 블록 참고. |
| 4 | 자기 행이 전부 **[x]** 인데 **이번 런이 10/10 [x]가 아님** → **병렬 큐 기아.** Exit 말고 **즉시** 사용자에게 **「큐 보충」** 안내 또는 C1이 **`docs/agent-runtime/PARALLEL_QUEUE_REFILL.md`** 실행(새 이번 런 10행 `[ ]`). 점검: `bash scripts/check-parallel-task-queue.sh` (exit 2). |
| 5 | **"이번 런"이 10/10 [x]** 이면 → **C1 splint 10** 으로 다음 스프린트. Exit 시 "No work until C1 splint 10." |

**금지**: "C2 TASK QUEUE" 등 별도 큐 파일을 찾거나 생성하지 않는다. 보드 표가 유일한 큐다.

**할 일 없음 → 채우기 (필수 흐름)**  
1) `scripts/check-parallel-task-queue.sh` → **exit 2** → **`PARALLEL_QUEUE_REFILL.md`** (C1·같은 턴 서류 동기).  
2) **exit 0** 이고 메시지가 "전량 [x]" → **splint 10** (새 10행).  
3) **exit 0** 이고 "병렬 큐 정상" → 해당 OWNER는 실제로 할 일 있음; 보드·`AUTO4_PROMPTS` 재확인.

---

## 요약

| 질문 | 답 |
|------|----|
| C2–C5가 작업 후 서류를 안 갱신한 경우? | 보드/CURRENT_TASK에 [x]가 없으면 "미완료"로 간주. 다음 할 일은 그 [ ]인 TASK. 완료했는데 [x] 안 찍은 건 C2–C5가 보드·CURRENT_TASK 갱신해야 함. |
| C1이 확인을 안 한 경우? | 이 절차 1단계를 생략하면 "이전과 동일한 10개"를 그대로 내기 쉬움. **항상 1단계 먼저.** |
| 다 했는데 명령이 동일한 경우? | 이번 런이 전부 [ ]이면 "다음 할 일"이 곧 이번 런 10개와 동일. 스프린트 구조가 매번 같은 유형(Release Gate N차, 문서 점검, 접근성 등)이므로 **유형은 같고 N/영역만 바뀜** → 명령이 비슷해 보이는 것은 정상. |

---

**REFRESH** (refresh 명령): splint와 별도 — `docs/agent-runtime/REFRESH_PROCEDURE.md` (C2~C6 각 5작업·병렬 창).

*참조: docs/CURSOR_TASK_BOARD.md, docs/agent-runtime/AUTO4_PROMPTS.md*
