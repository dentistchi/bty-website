# BTY Arena: Tenure-Based Level Unlock Policy
생성 시각(UTC): 2026-02-26T21:11:29.076312Z

## 목표
BTY Arena는 **빠른 레벨업 게임**이 아니라, **현실 시간과 동기화된 수련(훈련) 시스템**입니다.
- 레벨 오픈은 **근무 시간(tenure)** 로만 결정합니다.
- tier/XP는 **참여도·진척도 표시**만 담당합니다(레벨 오픈에 영향 없음).

## 핵심 원칙
1. **Level unlock = tenure only**
2. **tier/XP는 unlock에 영향 없음**
3. **레벨 스킵 금지**
4. **현실 시간 동기화(느리지만 단단한 성장)**

## Tenure(경력) 정의 (단일 기준)
### Staff Track
- `tenure_months = monthsSince(joinedAt)`

### Leader Track
- `tenure_months = monthsSince(leaderStartedAt)`
- `leaderStartedAt`가 없으면 `joinedAt`으로 **fallback**

### 신입 강제 규칙 (유지)
- `joinedAt` 기준 **30일 미만**이면 무조건 **staff 트랙**만 사용

## 레벨별 최소 경력(min_tenure_months)
### Staff
- S1: 0개월
- S2: 3개월
- S3: 12개월

### Leader (leaderStartedAt 기준)
- L1: 24개월
- L2: 60개월
- L3: 120개월

> 이 값들은 정책 변경이 쉬우도록 **설정 파일에서만 관리**합니다.

## 경계 케이스 정책
### 1) 이직 후 재입사
- `joinedAt`은 **재입사일**로 설정
- 이전 근속 자동 합산 없음(필요하면 관리자 수동 override)

### 2) 트랙 전환(Staff → Leader)
- leader track tenure는 **leaderStartedAt부터**만 계산
- Staff 경력이 길어도 L1을 즉시 오픈하지 않음
- 단, "미리보기(preview)" 콘텐츠 제공은 가능(잠금 해제는 아님)

### 3) 파트타임/계약직
- 현재는 단순화를 위해 **달력 기준 월수만** 적용
- 향후 필요 시 `workRatio`로 가중(옵션)

## 구현 가이드 (권장)
- `arena_program.json` 또는 동일한 설정 파일에 레벨별:
  - `min_tenure_months`
  - `tenure_basis`(joinedAt / leaderStartedAt)
- `program.ts`에 다음 함수:
  - `getTenureMonths(user, basis)`
  - `getMaxUnlockedLevel(track, user, programConfig)`
- 시나리오 서빙/UI는 `maxUnlockedLevel`까지만 노출

## 한 줄 요약
**레벨을 근무 경력(tenure)으로만 제한해, 같은 시간을 더 깊게 학습하도록 만든다.**
