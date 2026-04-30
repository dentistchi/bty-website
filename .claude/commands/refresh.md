---
description: Run REFRESH procedure — output 5 tasks per role (C2-C6)
---

# REFRESH

`docs/agent-runtime/REFRESH_PROCEDURE.md` 따름. **매번 필수**.

## 절차

1. **점검 (필수)**
   - 이번 런 (현재 SPRINT)
   - `docs/CURRENT_TASK.md`
   - `docs/SPRINT_PLAN.md`

2. **C2·C3·C4·C5·C6 각 역할당 정확히 5개씩** 응답 인라인
   - 미정이면 `대기: …` 로 채움
   - C2-C6 각각 **정확히 5줄**

3. **권장 (선택)**
   - 보드에 `[REFRESH YYYY-MM-DD]` 한 줄 추가
   - `SPRINT_LOG` 한 줄 추가

## 병렬 실행 모드

병렬 5창에서 실행할 때: 자기 Cn 1~5만 수행.

## 현재 모드: 구현 단계

C2~C6 할 일은 **코드 생성·구현** 우선. 5줄을 검증 루틴만으로 채우지 않는다.

## 출력 형식

```
## SPRINT N — Refresh YYYY-MM-DD

### Current Status
- 이번 런: [요약]
- CURRENT_TASK: [요약]
- SPRINT_PLAN 정합성: [OK/이슈]

### C2 (5)
1. [task or 대기: ...]
2. ...
5. ...

### C3 (5)
1. ...
...

### C4 (5)
...

### C5 (5)
...

### C6 (5)
...
```

*참조: `docs/agent-runtime/REFRESH_PROCEDURE.md`*
