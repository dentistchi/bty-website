---
description: Apply minimal safe bug fix
argument-hint: [optional context]
---

# Bug Fix (Minimal Safe Change)

## 원칙

- **가장 작은 안전한 변경**을 한다
- **관련 없는 코드를 리팩토링하지 않는다**
- **기존 로직과 네이밍을 보존**한다
- 전체 파일 재작성보다 **변경된 코드 블록만** 수정 선호
- 확신 없으면 **수정 전에 물어본다**

## 절차

1. Plan Mode로 진입 (`Shift+Tab` 두 번 권장)
2. Root cause 확인 (없으면 `/bug-analyze` 먼저)
3. 최소 변경 diff 제안 — **아직 구현하지 마**
4. 사용자 승인 후 구현
5. 영향받은 영역만 테스트
6. 테스트 베이스라인 회귀 없는지 확인

## 출력 형식

```
## Root Cause
[확정된 원인]

## Minimal Diff
[수정될 파일 1-3개, 변경 라인 최소]

## Risk Assessment
- 기존 테스트 영향: [예/아니오]
- 다른 기능 영향: [예/아니오 + 설명]
- Invariant 위반 여부: [확인 결과]

## Verification
- [ ] 영향받은 단위 테스트 통과
- [ ] 기존 테스트 베이스라인 유지
- [ ] (해당 시) E2E 통과
```

**$ARGUMENTS**: $ARGUMENTS
