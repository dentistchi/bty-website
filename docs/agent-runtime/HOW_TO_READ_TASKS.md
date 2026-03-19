# 할 일 읽는 법 (진행 에이전트용)

**한 줄:** 할 일은 **보드 "이번 런" 표**에만 있다. 표에서 **자기 OWNER** 열의 **`[ ]`** 인 행이 곧 할 일.

---

## 1. 보드 파일 경로

| 워크스페이스 루트 | 보드 경로 |
|-------------------|-----------|
| **btytrainingcenter** (상위 폴더) | `docs/CURSOR_TASK_BOARD.md` |
| **bty-app** (하위 폴더만 열었을 때) | **`../docs/CURSOR_TASK_BOARD.md`** |

- **bty-app/docs/AI_TASK_BOARD.md** 는 요약용. **실제 할 일 목록은 반드시 위 보드 파일**에서 확인.

---

## 2. "이번 런" 표 찾기

1. 보드 파일을 연다.
2. **`## 이번 런: SPRINT N`** 제목을 찾는다 (맨 위 쪽).
3. 그 아래 **TASK 1~10 표**가 현재 배치다.  
   - 표 헤더: `| # | OWNER | TASK LINE | PROMPT |`  
   - 각 행: `| 1 | C5 | [ ] ...` 또는 `| 1 | C5 | [x] ...`

---

## 3. 자기 할 일만 고르기

- **OWNER**: C1(문서), C2(Gate), C3(domain/API), C4(UI), C5(VERIFY), **C6**(CI/스모크).
- 표에서 **OWNER가 자기 역할인 행**만 본다.
- 그중 **TASK LINE이 `[ ]`** 인 것만 **할 일**. `[x]`는 완료라서 건너뜀.

**예:** C4면 4번 행만 봄. `| 4 | C4 | [ ] [UI] ...` → 할 일 있음. `| 4 | C4 | [x] ...` → 할 일 없음.

---

## 4. 할 일이 없을 때

- **자기 OWNER 행이 전부 `[x]`** 이거나, 표에 자기 OWNER가 없으면 → **"할 일 없음"**이 맞다.
- 이때 **응답 예시**:  
  **「이번 런(SPRINT N)에서 내 OWNER(Cx) 행에 `[ ]` 없음. 할 일 없음. C1이 PARALLEL_QUEUE_REFILL 또는 splint 10 하면 새 TASK 생김.»**
- **이번 런이 10/10 [x]** 이면 → **「전량 완료. C1 splint 10으로 다음 스프린트.»**

---

## 5. 복사용 문장(상세 지시)

- **`docs/agent-runtime/AUTO4_PROMPTS.md`** (bty-app이면 **`../docs/agent-runtime/AUTO4_PROMPTS.md`**)  
- 거기서 자기 역할(C1~C6) 블록을 **그대로 복사**해 쓰면 됨.

---

*참조: .cursor/rules/bty-continue-read-board.mdc, CURSOR_TASK_BOARD.md*
