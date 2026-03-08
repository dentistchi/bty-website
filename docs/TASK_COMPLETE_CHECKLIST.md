# 작업 완료 시 서류 갱신 체크리스트

작업을 완성한 Cursor(C2/C3/C4 등)는 **반드시** 아래를 수행한다.  
갱신을 하지 않으면 다음 `auto`/`검증`이 **같은 대기 작업**을 계속 선택한다.

## 1. CURSOR_TASK_BOARD.md

- **현재 작업** 표에서 **자기가 한 작업**에 해당하는 행을 찾는다.
- **상태**: `<span style="color:red">대기</span>` → `<span style="color:blue">완료</span>` 로 변경.
- **비고**: 한 줄 요약 (예: `LoadingFallback withSkeleton 적용. lint [x] Exit.`).

## 2. CURRENT_TASK.md

- **Completion Log** 또는 **이번에 구현할 기능** 섹션에 완료 1줄 추가.  
  예: `- [UI] admin/users loading skeleton 보강: LoadingFallback 적용. lint [x] Exit.`

## 3. 스크립트 사용 (선택)

```bash
cd ~/Dev/btytrainingcenter
./scripts/mark-task-complete.sh "할 일 컬럼과 동일한 문자열" "비고 한 줄"
```

예:

```bash
./scripts/mark-task-complete.sh "[UI] admin/users loading skeleton 보강" "LoadingFallback withSkeleton 적용. lint [x] Exit."
```

실행 후 `./scripts/orchestrate.sh` 또는 `검증`을 돌리면 다음 대기 작업이 First Task로 선택된다.

## 4. 검증/done

- 코드 변경 후 `검증`으로 lint/test/build 통과 확인.
- 통과하면 `done` 또는 `./scripts/done-commit-suggest.sh` 로 wrap 반영.
