---
description: Make code change while preserving test baseline
argument-hint: [change description]
---

# Test-Safe Change

테스트가 있는 영역의 코드 변경: $ARGUMENTS

## 원칙

- **기존 테스트를 깨지 않는다**
- **최소 변경**을 선호
- **엣지 케이스**를 간략히 언급
- 스타일 정리보다 **비즈니스 규칙 보존** 우선

## 절차

1. 변경 범위에 해당하는 테스트 식별
   ```
   영향 테스트 파일들:
   - src/.../foo.test.ts
   - src/.../foo.edges.test.ts
   ```
2. 변경 전 baseline 실행: `npm test -- <영향 테스트>`
3. 변경 구현
4. 변경 후 동일 테스트 실행 → 모두 통과 확인
5. 엣지 케이스 누락 없는지 점검:
   - 0/null/undefined 입력
   - 빈 배열/문자열
   - 경계값 (max, min, 마지막 day, 마지막 week)
   - 동시성 (해당 시)

## 출력 형식

```
## Change
[무엇을 바꾸는지 1-2문장]

## Affected Tests
[테스트 파일 목록]

## Edge Cases Considered
- [엣지케이스 1] — [어떻게 처리]
- [엣지케이스 2] — [어떻게 처리]

## Baseline
- Before: X tests passing
- After:  X tests passing (동일 — 회귀 없음)

## Business Rule Preservation
[변경이 비즈니스 규칙을 보존하는지 확인]
```
