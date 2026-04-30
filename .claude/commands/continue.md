---
description: Read CURSOR_TASK_BOARD "이번 런" and resume work for current owner
argument-hint: [optional owner Cn]
---

# CONTINUE — 할 일 확인

## 단일 진실 (Single Source of Truth)

**할 일** = `docs/CURSOR_TASK_BOARD.md` 의 **"이번 런"** 섹션 내 TASK 1~10 표.

## 파일 경로

- 워크스페이스 루트가 **btytrainingcenter** (상위 폴더): `docs/CURSOR_TASK_BOARD.md`
- 워크스페이스 루트가 **bty-app**: `../docs/CURSOR_TASK_BOARD.md` (상위의 docs)

## 절차

1. 위 보드 파일을 읽는다
2. **"이번 런"** 제목 (예: SPRINT N) — 그 표가 현재 배치
3. 표에서 자기 **OWNER** (C1, C2, C3, C4, C5, C6) 행만 본다
4. **`[ ]`** 인 TASK가 있으면 그게 할 일

## 중요 사항

- **별도 "C2 TASK QUEUE" / "C4 queue" 파일은 없다.** 큐 = 위 보드의 "이번 런" 표
- **`bty-app/docs/AI_TASK_BOARD.md`** 는 요약만. 할 일 목록은 **반드시** repo root `docs/CURSOR_TASK_BOARD.md` 에서 확인
- **`docs/SPRINT_PLAN.md`** 는 타임라인·요약용. TASK·`[ ]` 판단은 **보드 표만** (불일치 시 보드 우선)
- **현재 배치 번호는 보드 "이번 런" 제목을 열 때마다 확인** (하드코딩 금지)

## 「할 일 없음」 케이스

이번 런이 **10/10 [x]가 아닌데** 자기 OWNER에 **`[ ]`가 없으면**:

> **「이번 런(SPRINT N)에서 내 OWNER(Cx) 행에 [ ] 없음. 할 일 없음. C1이 PARALLEL_QUEUE_REFILL 또는 splint 10 하면 새 TASK 생김.」**

(C1은 `docs/agent-runtime/PARALLEL_QUEUE_REFILL.md` 실행)

이번 런이 **전량 [x]**:

> **「전량 완료. C1 splint 10.」**

## 할 일 읽는 법 요약

`docs/agent-runtime/HOW_TO_READ_TASKS.md` (bty-app이면 `../docs/agent-runtime/HOW_TO_READ_TASKS.md`)

*참조: PARALLEL_QUEUE_REFILL.md, REFRESH_PROCEDURE.md, SPLINT_10_PROCEDURE.md, AUTO4_PROMPTS.md*

**Owner argument**: $ARGUMENTS (지정 안 되면 컨텍스트에서 추론)
