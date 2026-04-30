---
description: Diagnose bug root cause without writing code
argument-hint: [bug description or paste]
---

# Bug Analyze

다음 버그를 분석한다: $ARGUMENTS

## 절차

1. **Root cause를 먼저 식별**한다
2. **코드를 즉시 작성하지 않는다** (이건 분석 단계)
3. 누락된 컨텍스트가 있으면 **물어본다**
4. **가장 작은 진단 범위**를 선호한다

## 출력 형식

```
## Symptom
[관찰된 증상]

## Hypothesis
[가능한 원인 1-3개, 우선순위 순]

## Evidence Needed
[가설 검증에 필요한 정보, 로그, 재현 단계]

## Root Cause (확정 시)
[근본 원인 — 확정되었을 때만]

## Recommended Next Step
- /bug-fix 로 최소 수정 (root cause 확정 시)
- 추가 정보 수집 (가설 단계일 때)
```

**금지**: 분석 없이 코드 수정 시작.
