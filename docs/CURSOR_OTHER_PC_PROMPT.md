# 다른 컴퓨터에서 Cursor에게 주는 공통 프롬프트

이 프로젝트(BTY Arena / btytrainingcenter)에서 **나(사용자)와 작업하는 방식**을 Cursor가 따르도록 아래 프롬프트를 **새 채팅 맨 처음**에 붙여 넣어 주세요.

---

## 붙여 넣을 프롬프트 (전체 복사)

```
이 프로젝트에서 나랑 작업할 때 아래 규칙으로 맞춰 줘.

**[작업 방식]**
1. **할 일 지시**  
   - "다음 작업 해줘" + **할 일** + **완료 시 반드시** 3가지가 오면, 그대로 실행한다.  
   - 완료 시 반드시: (1) `docs/CURSOR_TASK_BOARD.md`에서 해당 행 상태를 대기 → 완료, 비고 한 줄 (2) `docs/CURRENT_TASK.md`에 완료 1줄 추가 (3) 끝나면 반드시 **「작업 완료. 보드·CURRENT_TASK 반영했습니다.»** 라고 답한다.  
   - 긴 설명·옵션 메뉴 없이 바로 진행하고, 끝에 위 문구로 마무리한다.

2. **검증**  
   - "검증"이라고 하면 `./scripts/auto-agent-loop.sh`를 실행한다.  
   - 결과: CI Gate 통과 여부(lint·test·build) + `docs/agent-runtime/AUTO4_PROMPTS.md` 내용을 읽어서 **C1~C5 프롬프트를 답에 그대로 보여 준다.** (파일 열어 보라고만 하지 말고, 내용을 붙여 넣어서 보여 줘.)

3. **Auto 4**  
   - "auto 4"라고 하면 `./scripts/next-project-fill-board.sh`를 실행한다.  
   - 실행 후 `docs/agent-runtime/AUTO4_PROMPTS.md`를 읽어 **C1~C5 프롬프트를 답에 그대로 보여 준다.**

**[문서·보드]**
- 태스크 보드는 **`docs/CURSOR_TASK_BOARD.md` 하나만** 사용한다. 표만 수정하고, 완료 시 해당 행을 완료 + 비고 한 줄 넣는다.
- 완료 이력은 **`docs/CURRENT_TASK.md`**에 완료 1줄씩 추가한다.
- 다음 배치 후보는 **`docs/NEXT_BACKLOG_AUTO4.md`**. "[DOCS] 다음 배치 선정" 할 일이면 로드맵·`docs/NEXT_PROJECT_RECOMMENDED.md` 기준으로 이 파일을 갱신한 뒤 보드·CURRENT_TASK에 반영한다.
- bty-app 문서는 **`bty-app/docs/`** 아래. 스펙·체크리스트는 1페이지 분량으로 만들고, 보드·CURRENT_TASK 반영을 잊지 않는다.

**[BTY 규칙 (bty-app 관련)]**
- XP·시즌·리더보드 비즈니스 로직은 **bty-app/** 안에서만 적용. 시즌 진행이 리더보드 랭킹을 바꾸지 않음. Core XP는 영구, Weekly XP만 주간 랭킹용.
- UI는 API/도메인 결과만 렌더하고, XP·시즌·랭킹 규칙을 UI에서 다시 계산하지 않는다.
- 답할 때: 가정 먼저 → 구체적인 파일 경로·최소 diff(또는 함수 시그니처) → 마지막에 Next steps 체크리스트.

**[말투]**
- "할 일" 위주로 하고, 지시한 일만 처리한 뒤 위 완료 문구로 끝낸다. C1~C5 프롬프트는 답 안에 그대로 포함해서 보여 준다.
```

---

## 사용법

1. **다른 컴퓨터**에서 이 레포를 연다.
2. Cursor에서 **새 채팅**을 연다.
3. **위 "붙여 넣을 프롬프트" 전체**를 복사해서 **첫 메시지**로 붙여 넣고 전송한다.
4. 그 다음부터 "다음 작업 해줘", "검증", "auto 4" 등을 지시하면, 이 규칙대로 동작한다.

---

*이 파일: `docs/CURSOR_OTHER_PC_PROMPT.md` — 사용자가 다른 환경에서 Cursor 쓸 때 참고용.*
