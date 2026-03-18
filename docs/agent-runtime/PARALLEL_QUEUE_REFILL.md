# 병렬 큐 보충 (Parallel queue refill)

**목적**: 이번 런에 **아직 끝나지 않은 TASK(`[ ]`)가 있는데**, C3·C4·C5·C6 중 **어느 역할도 자기 OWNER 행에 `[ ]`가 없으면** 병렬 Cursor는 전부 “할 일 없음”이 된다. **매번 그 상태가 되면** 아래 절차로 **작업을 채운 뒤** 다음 작업이 진행되게 한다.

---

## 1. 언제 실행하는가 (트리거)

| 상황 | 조치 |
|------|------|
| **A)** 이번 런 TASK 1~10이 **전부 `[x]`** | **병렬 보충 아님.** C1 **splint 10** → 다음 스프린트 10행 신설 (`SPLINT_10_PROCEDURE.md`). |
| **B)** 이번 런에 **`[ ]`가 하나라도 있는데**, **C3 또는 C4 또는 C5 또는 C6** 중 하나라도 **표에 나온 자기 행이 모두 `[x]`** | **본 절차 필수 (병렬 큐 보충).** |
| **C)** 사용자·에이전트가 **「할 일 없음」**이라고 함 | `scripts/check-parallel-task-queue.sh` 실행. **exit 2**면 본 절차. |

**불변식 (이번 런이 미완료인 동안)**: C3·C4·C5·C6 각각 **표에 OWNER 행이 있으면**, 그중 **최소 1개는 `[ ]`** 이어야 한다. (C1 문서만 남은 상태로 두지 않는다.)

---

## 2. 누가 하는가

- **C1 (Commander)** 또는 사용자가 **「큐 보충」** / **「병렬 큐 보충」** 으로 요청.
- **같은 턴에** 보드·`SPRINT_PLAN`·`NEXT_BACKLOG_AUTO4`·`AUTO4_PROMPTS`·`SPRINT_LOG`·`CURRENT_TASK` 까지 반영 (작업 완료 서류 규칙).

---

## 3. 무엇을 하는가 (표준 10행 재오픈)

1. **현재 이번 런**을 **이전 런**으로 내린다 (아카이브 표 + 완료/잔여 한 줄).
2. **새 이번 런** `SPRINT (N+1)` 을 연다 — **TASK 1~10 전부 `[ ]`**.  
   - **C5**: TASK1 Release Gate **(N+1)차**, TASK6 엘리트 3차.  
   - **C1**: 문서·백로그·§ 정리·대기 동기 등 **2·3·5·7·10** (이전 런 C1 잔여는 여기로 흡수).  
   - **C4**: TASK4 접근성 1곳 (직전에 한 화면 제외 권장).  
   - **C3**: TASK8 domain + TASK9 route 테스트 각 1건.  
   - **C6**: TASK10 q237-smoke + self-healing-ci.  
3. **`docs/SPRINT_PLAN.md`**: 활성 스프린트 번호 **+1** (예: 255→256), 보드 번호와 동기.  
4. **`docs/NEXT_BACKLOG_AUTO4.md`**: 다음 배치 목록을 **새 스프린트 번호**에 맞게 갱신.  
5. **`docs/agent-runtime/AUTO4_PROMPTS.md`**: 새 이번 런 기준 복사 블록.  
6. **`docs/SPRINT_LOG.md`**: 한 줄 — 병렬 큐 보충·스프린트 오픈 이유.  
7. **`docs/CURRENT_TASK.md`**: 상단 1줄 — 새 이번 런·First Task.

**First Task** 관행: **C5 TASK1 (Gate)** 유지.

---

## 4. 자동 점검

```bash
# repo 루트에서
bash scripts/check-parallel-task-queue.sh
```

- **exit 0**: 큐 정상이거나 스프린트 전량 완료.  
- **exit 2**: **병렬 큐 보충 필요** — 위 3절 실행.  
- **exit 1**: 보드 파싱 실패 (이번 런 섹션 확인).

---

## 5. REFRESH / CONTINUE와의 관계

- **CONTINUE**로 “할 일 없음”이 나왔을 때 → **먼저** 본 문서 1절 판단 또는 **check 스크립트**.  
- **REFRESH** 점검 시 → 이번 런에 C3~C6 기아가 보이면 응답에 **「큐 보충 필요」** 한 줄 넣고, C1 작업으로 **3절** 안내.

*참조: `CURSOR_TASK_BOARD.md` 상단 불변식, `SPLINT_10_PROCEDURE.md`.*
