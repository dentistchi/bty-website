# 태스크 타입별 Cursor 셋업

**Feature / Fix·Polish / Explore·Plan** 세 개 창으로 나눌 때, 각 창에서 **어떤 파일을 열고**, **공동 파일(태스크 보드)을 어떻게 쓰는지** 정리한 문서.

---

## 1. 창별로 열어둘 파일

같은 프로젝트 폴더(`btytrainingcenter`)를 **3번** 연다 → Cursor 창 3개.

### Cursor 1: **Feature** (기능 개발)

**브랜치:** `feature/xxx` (작업 주제에 맞게, 예: `feature/leaderboard-season`)

**항상 열어둘 파일:**
- `docs/CURSOR_TASK_BOARD.md` — 공동 태스크 보드 (작업 가져갈 때·완료 시 여기 표 업데이트)
- 이번에 손댈 영역 1~2개:
  - 예: `bty-app/src/app/api/arena/leaderboard/route.ts`
  - 예: `bty-app/src/lib/bty/arena/activeLeague.ts`

**첫 메시지 예시:**  
“이 창은 **Feature**용이야. 지금 할 일: [보드에서 가져온 작업]. feature 브랜치에서만 수정해. 작업 끝나면 태스크 보드 상태를 **완료**로 바꿔줘.”

---

### Cursor 2: **Fix/Polish** (버그·다듬기·문서)

**브랜치:** `main` 또는 `fix/xxx`

**항상 열어둘 파일:**
- `docs/CURSOR_TASK_BOARD.md` — 공동 태스크 보드
- 이번에 손댈 파일 1~2개:
  - 예: 버그면 해당 페이지/API 파일
  - 예: 문서면 `docs/xxx.md`, README

**첫 메시지 예시:**  
“이 창은 **Fix/Polish**용이야. 지금 할 일: [보드에서 가져온 작업]. main(또는 fix 브랜치)에서 수정해. 작업 끝나면 태스크 보드 상태를 **완료**로 바꿔줘.”

---

### Cursor 3: **Explore/Plan** (조사·설계)

**브랜치:** `main` (보통 수정 없음) 또는 조사만

**항상 열어둘 파일:**
- `docs/CURSOR_TASK_BOARD.md` — 공동 태스크 보드
- `docs/MULTI_CURSOR_WORKFLOW.md` — 워크플로우 참고
- 조사할 영역 (필요할 때만):
  - 예: `bty-app/src/lib/bty/arena/` (폴더만 열어두고 Chat으로 질문)

**첫 메시지 예시:**  
“이 창은 **Explore/Plan**용이야. 코드 수정은 최소로 하고, 조사·설계·다음 작업 목록 정리해줘. 지금 할 일: [보드에서 가져온 작업]. 작업 끝나면 태스크 보드 상태를 **완료**로 바꿔줘.”

---

## 2. 공동 프로젝트 파일(태스크 보드) 쓰는 법

- **파일 하나**: `docs/CURSOR_TASK_BOARD.md`
- **역할**: 지금 누가 무슨 일을 하는지 적어두고, 서로 업데이트해서 겹치지 않게 함.

### 진행 순서

1. **작업 정하기**  
   - 할 일이 생기면 태스크 보드를 연다.
   - 표 맨 위에 새 행을 하나 추가한다:  
     `| Feature | Leaderboard 시즌 API 연동 | 진행 중 | |`

2. **Cursor에서 작업**  
   - 해당 타입 Cursor에서 그 행의 할 일을 그대로 지시한다.  
     “태스크 보드에 있는 **Leaderboard 시즌 API 연동** 이거 해줘.”

3. **완료 후**  
   - AI가 작업을 마치면:
     - 태스크 보드에서 그 행의 상태를 `완료`로 바꾸고,  
       필요하면 비고에 한 줄 요약(예: “GET /api/arena/league/active 연동 완료”)을 적게 한다.
     - **Mac 알림**은 프로젝트 규칙으로 자동 실행된다(아래 3절).

4. **다른 Cursor에서**  
   - `git pull` 한 뒤 `CURSOR_TASK_BOARD.md`를 다시 열어서 완료된 일·진행 중인 일을 확인한다.

---

## 3. 작업 완료 시 Mac 알림

이 프로젝트에는 **작업 완료 시 Mac 알림** 규칙이 들어 있다.  
모든 Cursor 창에서, AI가 사용자 요청을 끝냈을 때 자동으로 다음 알림이 뜨도록 되어 있다.

- **규칙 파일:** `.cursor/rules/complete-notify.mdc`
- **동작:** 응답 마지막에 `osascript`로 macOS 알림을 한 번 띄운다.

그래서 **창을 나눠도** Feature / Fix·Polish / Explore·Plan 어느 쪽이든, 작업이 끝나면 Mac에서 알람(알림)이 뜨도록 설정되어 있다.

---

## 4. 요약 체크리스트

- [ ] Cursor 3개 창을 같은 프로젝트 폴더로 연다.
- [ ] 창마다 역할을 정한다: Feature / Fix·Polish / Explore·Plan.
- [ ] 각 창에 `docs/CURSOR_TASK_BOARD.md`를 열어둔다.
- [ ] 할 일이 있으면 태스크 보드 표에 한 줄씩 추가하고, 해당 Cursor에서 그 할 일을 지시한다.
- [ ] 작업이 끝나면 태스크 보드 상태를 `완료`로 바꾸고, 다른 창은 `git pull` 후 보드를 새로고침한다.
- [ ] 완료 시 Mac 알림은 규칙으로 자동 실행된다.
