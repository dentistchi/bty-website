# CONTINUE 시 붙여넣을 메시지 (다른 커서에 그대로 복사)

**"continue"만 보내면 결과가 같다** → 다른 커서는 규칙/문맥이 없어서 어떤 파일을 볼지 모름.  
**아래 둘 중 하나**만 쓰면 됨.

---

## 짧은 명령 (역할만 적어서 한 줄로)

매번 긴 블록 대신 **아래 한 줄만** 해당 커서에 붙여넣어도 됨. 그 커서가 CONTINUE_PROMPTS를 열고 자기 역할 절차를 따름.

| 역할 | 붙여넣을 한 줄 |
|------|------------------|
| C2 | `CONTINUE. 역할 C2. docs/agent-runtime/CONTINUE_PROMPTS.md 열어서 C2 블록 절차 그대로 실행해.` |
| C3 | `CONTINUE. 역할 C3. docs/agent-runtime/CONTINUE_PROMPTS.md 열어서 C3 블록 절차 그대로 실행해.` |
| C4 | `CONTINUE. 역할 C4. docs/agent-runtime/CONTINUE_PROMPTS.md 열어서 C4 블록 절차 그대로 실행해.` |
| C5 | `CONTINUE. 역할 C5. docs/agent-runtime/CONTINUE_PROMPTS.md 열어서 C5 블록 절차 그대로 실행해.` |
| C6 | `CONTINUE. 역할 C6. docs/agent-runtime/CONTINUE_PROMPTS.md 열어서 C6 블록 절차 그대로 실행해.` |

---

## 긴 명령 (전체 블록 — 위 한 줄이 안 통할 때만)

아래 해당 역할 블록 **전체**를 복사해서 붙여넣기.

---

## C2 Gatekeeper

```
CONTINUE.

지시: 아래 파일을 **지금 열어서** 내용을 확인한 뒤 행동해.
- 열 파일: **docs/CURSOR_TASK_BOARD.md**
- 그 파일에서 "이번 런" 제목 아래 **TASK 1~10 표**를 찾아.
- OWNER가 **C2** 인 행이 있는지 확인. 있으면 [ ] 인 TASK 수행, 없으면 "이번 런에 C2 할당 없음. N/A exit." 만 답하고 종료.

다른 파일(예: C2 TASK QUEUE)이나 예전 배치(SPRINT 39) 말고, **위 파일의 "이번 런" 표만** 기준으로 해.
```

---

## C3 Domain/API

```
CONTINUE.

지시: 아래 파일을 **지금 열어서** 내용을 확인한 뒤 행동해.
- 열 파일: **docs/CURSOR_TASK_BOARD.md**
- "이번 런" 제목 아래 **TASK 1~10 표**에서 OWNER **C3** 행만 봐. [ ] 인 TASK가 있으면 그게 할 일.
- 표에 "First Task 완료 전 다음 Task 시작 불가" 라고 되어 있으면, TASK 1이 [x]일 때까지 C3은 대기. TASK 1이 [ ]이면 "TASK 1 (C5) 완료 대기. Exit." 하고 종료.

다른 파일/예전 배치 말고 **위 파일의 "이번 런" 표만** 기준으로 해.
```

---

## C4 UI

```
CONTINUE.

지시: 아래 파일을 **지금 열어서** 내용을 확인한 뒤 행동해.
- 열 파일: **docs/CURSOR_TASK_BOARD.md**
- "이번 런" 제목 아래 **TASK 1~10 표**에서 OWNER **C4** 행만 봐. [ ] 인 TASK가 있으면 그게 할 일. 전부 [x]면 "C4 할 일 없음. Exit."
- First Task(TASK 1)가 [ ]이면 C4도 대기 후 "TASK 1 완료 대기. Exit." 가능.

다른 파일/예전 배치 말고 **위 파일의 "이번 런" 표만** 기준으로 해.
```

---

## C5 VERIFY

```
CONTINUE.

지시: 아래 파일을 **지금 열어서** 내용을 확인한 뒤 행동해.
- 열 파일: **docs/CURSOR_TASK_BOARD.md**
- "이번 런" 제목 아래 **TASK 1~10 표**에서 OWNER **C5** 행만 봐. [ ] 인 TASK가 있으면 순서대로 수행 (보통 TASK 1 Release Gate → TASK 6 엘리트 3차).
- 상세 지시: **docs/agent-runtime/AUTO4_PROMPTS.md** 의 C5 블록. 완료 시 보드·CURRENT_TASK·BTY_RELEASE_GATE_CHECK 반영.

다른 파일/예전 배치 말고 **위 두 파일**만 기준으로 해.
```

---

## C6 Test/Fix

```
CONTINUE.

지시: 아래 파일을 **지금 열어서** 내용을 확인한 뒤 행동해.
- 열 파일: **docs/CURSOR_TASK_BOARD.md**
- "이번 런" 표에 OWNER **C6** 행이 있으면 [ ] 인 TASK 수행. 없으면 "이번 런에 C6 행 없음. N/A exit." 만 답하고 종료.

다른 파일/예전 배치 말고 **위 파일의 "이번 런" 표만** 기준으로 해.
```

---

**요약**: "continue"만 치지 말고 (1) **위 표에서 역할에 맞는 한 줄**만 붙여넣기. 안 되면 (2) 아래 **역할 블록 전체** 복사해서 붙여넣기.
