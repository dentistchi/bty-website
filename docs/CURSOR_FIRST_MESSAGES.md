# Cursor 창별 첫 메시지 (복사해서 쓰기)

각 창을 열고 Chat을 시작할 때 **아래 중 하나를 복사**한 뒤, `[보드에서 가져온 작업]`만 태스크 보드 내용으로 바꿔서 붙여넣으면 된다.

---

## Cursor 1: Feature (기능 개발)

**이 창에서 열어둘 것:**  
`docs/CURSOR_TASK_BOARD.md` + 이번에 수정할 파일 1~2개 (예: `bty-app/src/app/api/arena/leaderboard/route.ts`, `bty-app/src/lib/bty/arena/activeLeague.ts`)

**브랜치:** `feature/xxx` (예: `feature/leaderboard-season`)

**첫 메시지 (복사):**

```
이 창은 Feature용이야. 지금 할 일: [보드에서 가져온 작업]. feature 브랜치에서만 수정해. 작업 끝나면 태스크 보드 상태를 완료로 바꿔줘.
```

**예시 (할 일을 적었을 때):**

```
이 창은 Feature용이야. 지금 할 일: Leaderboard 시즌 API 연동 (active league 기준 정렬). feature 브랜치에서만 수정해. 작업 끝나면 태스크 보드 상태를 완료로 바꿔줘.
```

---

## Cursor 2: Fix/Polish (버그·다듬기·문서)

**이 창에서 열어둘 것:**  
`docs/CURSOR_TASK_BOARD.md` + 수정할 파일 (버그/문서 해당)

**브랜치:** `main` 또는 `fix/xxx`

**첫 메시지 (복사):**

```
이 창은 Fix/Polish용이야. 지금 할 일: [보드에서 가져온 작업]. main(또는 fix 브랜치)에서 수정해. 작업 끝나면 태스크 보드 상태를 완료로 바꿔줘.
```

---

## Cursor 3: Explore/Plan (조사·설계)

**이 창에서 열어둘 것:**  
`docs/CURSOR_TASK_BOARD.md` + `docs/MULTI_CURSOR_WORKFLOW.md`

**브랜치:** `main` (보통 수정 없음)

**첫 메시지 (복사):**

```
이 창은 Explore/Plan용이야. 코드 수정은 최소로 하고, 조사·설계·다음 작업 목록 정리해줘. 지금 할 일: [보드에서 가져온 작업]. 작업 끝나면 태스크 보드 상태를 완료로 바꿔줘.
```

---

`[보드에서 가져온 작업]`은 `docs/CURSOR_TASK_BOARD.md` 표에 적어 둔 "할 일 (한 줄)" 내용으로 바꾸면 된다.
