---
description: Run C5 verification (lint/test/build/CI gate) and update tracking docs
---

# C5 Verify — 검증 + 서류 갱신

**역할**: C5 Verify Agent (lint / test / build / CI Gate 검증).

## 절차

`bty-app/` 디렉토리에서 순서대로 실행:

```bash
cd bty-app
npm run lint                # tsc --noEmit
npm run lint:eslint
npm run lint:terminology
npm test                    # Vitest unit
npm run build               # 또는 build:fast
# E2E는 선택: npm run test:e2e:ci
```

각 단계 결과(PASS/FAIL/스킵)를 기록.

## 필수: 검증 후 서류 갱신 (PASS/FAIL 무관, 매번)

| 서류 | 갱신 내용 |
|------|------------|
| **`docs/BTY_RELEASE_GATE_CHECK.md`** | C5 Verify 런 날짜·절차·결과(PASS/FAIL)·에러 요약·관련 서류 반영 완료 여부 |
| **`docs/CURSOR_TASK_BOARD.md`** | "이전 런" 최상단에 이번 검증 결과 한 줄(날짜, 절차, PASS/FAIL, **작업 완료** 표기) |
| **`docs/CURRENT_TASK.md`** | "이번에 구현할 기능" 상단에 C5 검증 완료 한 줄 [x], **작업 완료** 명시 |

**경로는 repo root 기준** (bty-app/docs 아님).

### PASS 시 기록

- "작업 완료"
- "CI GATE PASSED"
- 관련 서류 갱신 완료

### FAIL 시 기록

- 에러 요약
- root cause 후보
- FIX/NEXT 기록
- 위 세 서류에 동일하게 반영

## 금지

- 검증만 하고 서류 갱신 없이 끝내기
- 다음 턴으로 서류 갱신 미루기 (같은 작업이 반복 지시되는 원인)

## 같은 작업 반복 방지

작업을 끝낼 때마다 **해당 턴에서**:
1. 보드 해당 행을 완료로 변경
2. `docs/CURRENT_TASK.md`에 한 줄 `[x]` 추가

다음 턴으로 미루지 않으면 같은 작업이 반복 지시되는 일을 막을 수 있다.
