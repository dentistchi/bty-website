# 작업 완료 시 서류 갱신 체크리스트

작업을 완성한 Cursor(C2/C3/C4 등)는 **반드시** 아래를 수행한다.  
갱신을 하지 않으면 다음 `auto`/`검증`이 **같은 대기 작업**을 계속 선택한다.

---

## 매번 작업 완료 시 갱신할 서류

| # | 서류 | 갱신 위치 | 내용 |
|---|------|-----------|------|
| 1 | **CURSOR_TASK_BOARD.md** | § **완료 이력** (하단) | 완료 1줄 추가. 예: `- **[태스크명] (날짜)**: 요약. **완료.**` |
| 2 | **CURRENT_TASK.md** | § **이번에 구현할 기능** 상단 | `**[태스크명]**: [x] **완료.** 요약. 보드·CURRENT_TASK 반영.` 형식 1줄 |
| 3 | **CURSOR_TASK_BOARD.md** | § **이전 런** (상단) | 해당 SPRINT/TASK 완료 시 이전 런 블록에 완료 1줄 추가 |
| 4 | **BTY_RELEASE_GATE_CHECK.md** | 해당 시만 | Gate/Release/검증 관련 작업 시 §2 또는 해당 섹션에 결과·반영 1줄 |

**요약**: 매번 완료 시 → **보드 완료 이력** + **CURRENT_TASK 완료 1줄** + (해당 시) **이전 런** + (해당 시) **BTY_RELEASE_GATE_CHECK**.

---

## 1. CURSOR_TASK_BOARD.md

- **현재 작업** 표에서 **자기가 한 작업**에 해당하는 행을 찾는다.
- **상태**: `<span style="color:red">대기</span>` → `<span style="color:blue">완료</span>` 로 변경.
- **비고**: 한 줄 요약 (예: `LoadingFallback withSkeleton 적용. lint [x] Exit.`).
- **§ 완료 이력** (문서 하단): 완료 1줄 추가. 예: `- **[태스크명] (날짜)**: 요약. **완료.**`

## 2. CURRENT_TASK.md

- **§ 이번에 구현할 기능** 섹션 **상단**에 완료 1줄 추가.  
  예: `**[태스크명]**: [x] **완료.** 요약. 보드·CURRENT_TASK 반영.`
- 형식: `**[OWNER/태스크]**: [x] **완료.** 한 줄 요약. 보드·CURRENT_TASK 반영.`

## 3. BTY_RELEASE_GATE_CHECK.md (해당 시)

- **Gate/Release/검증** 관련 작업 완료 시: §2 Release Gate Results 아래 또는 해당 Gate §에 실행·완료 1줄 반영.
- 예: `- **C2 Gatekeeper gate check 실행·완료 (날짜)**: 요약. 서류 반영: 보드·CURRENT_TASK·완료 이력 갱신.`

## 4. 스크립트 사용 (선택)

```bash
cd ~/Dev/btytrainingcenter
./scripts/mark-task-complete.sh "할 일 컬럼과 동일한 문자열" "비고 한 줄"
```

예:

```bash
./scripts/mark-task-complete.sh "[UI] admin/users loading skeleton 보강" "LoadingFallback withSkeleton 적용. lint [x] Exit."
```

실행 후 `./scripts/orchestrate.sh` 또는 `검증`을 돌리면 다음 대기 작업이 First Task로 선택된다.

## 5. 검증/done

- 코드 변경 후 `검증`으로 lint/test/build 통과 확인.
- 통과하면 `done` 또는 `./scripts/done-commit-suggest.sh` 로 wrap 반영.
