# BTY 페이지 분리 구현 계획

BTY Arena의 화면을 App Router 기준으로 먼저 분리하고, 그 다음 공통 UI와 테마 토큰을 입히기 위한 실행 계획입니다.

원칙:
- 구조를 먼저 잠근다
- 색감은 구조 이후에 입힌다
- Arena / Growth / My Page를 각각 독립적인 page route로 둔다
- 공통 UI는 재사용 가능한 작은 컴포넌트로 분리한다

---

## 1. 구현 순서

### Phase 1. Route 분리

다음 페이지를 먼저 분리합니다.

```text
bty-app/src/app/[locale]/bty-arena/page.tsx          (기존 라이브 Arena 플레이 — Phase 1 유지)
bty-app/src/app/[locale]/bty-arena/wireframe/page.tsx  (Phase 1: 새 IA Arena 첫 화면 스텁)
bty-app/src/app/[locale]/bty-arena/result/page.tsx
bty-app/src/app/[locale]/growth/page.tsx
bty-app/src/app/[locale]/my-page/page.tsx
bty-app/src/app/[locale]/my-page/progress/page.tsx
bty-app/src/app/[locale]/my-page/team/page.tsx
bty-app/src/app/[locale]/my-page/leader/page.tsx
```

목적:
- 각 화면의 책임을 분리
- route 단위 테스트와 진입점 확인 가능
- 이후 스타일링과 state 연결을 안전하게 진행

### Phase 2. Shared Components 분리

공통 컴포넌트를 먼저 추출합니다.

```text
bty-app/src/components/bty/layout/ScreenShell.tsx
bty-app/src/components/bty/ui/PrimaryButton.tsx
bty-app/src/components/bty/ui/SecondaryButton.tsx
bty-app/src/components/bty/ui/InfoCard.tsx
bty-app/src/components/bty/ui/ProgressBar.tsx
bty-app/src/components/bty/ui/TabPills.tsx
bty-app/src/components/bty/navigation/BottomNav.tsx
```

목적:
- Arena / Growth / My Page 공통 구조 재사용
- 버튼, 카드, 탭, 진행률 표시를 하나의 언어로 통일
- 향후 색감 변경을 컴포넌트 단위로 처리

### Phase 3. Theme Token 적용

Tailwind utility 또는 CSS variables로 BTY 색감 토큰을 적용합니다.

핵심 범위:
- background / surface / soft surface
- primary / secondary / muted text
- brand navy / steel blue
- muted gold / soft bronze
- stable / warning / risk 상태 색상

목적:
- 구조가 확정된 뒤 시각 시스템 적용
- 페이지마다 다른 색이 아니라 BTY 전체의 톤 일관성 확보

### Phase 4. Navigation 연결

BottomNav, top nav, tab pills를 route와 연결합니다.

예시:
- Arena entry → Result
- My Page → Progress / Team / Leader tabs
- Growth → Return to Arena

목적:
- 화면을 쪼갠 뒤 사용자의 이동 흐름을 자연스럽게 연결

### Phase 5. Polish

마지막에 아래를 정리합니다.

- spacing
- typography scale
- button hierarchy
- card borders / shadows
- empty states / system messages

---

## 2. 파일별 책임

### `src/app/[locale]/bty-arena/page.tsx`

- Arena 첫 진입 화면
- Play Game / Continue / Weekly Ranking 중심
- 최우선 행동 유도

### `src/app/[locale]/bty-arena/result/page.tsx`

- 시뮬레이션 결과 화면
- XP와 system message 중심
- 다음 행동으로 연결

### `src/app/[locale]/growth/page.tsx`

- Growth 메인 진입점
- Dojo 50 / Integrity Mirror / Guidance / Reflection
- 학습보다 회복·정렬에 집중

### `src/app/[locale]/my-page/page.tsx`

- My Page 개요
- Identity / Progress / Team 3카드
- 상세 데이터는 탭 뒤로 숨김

### `src/app/[locale]/my-page/progress/page.tsx`

- Core XP / Weekly XP / Consistency
- 상태와 진행 감시 중심

### `src/app/[locale]/my-page/team/page.tsx`

- TII / Team Status / Team Rank
- 팀 단위 상태만 표시

### `src/app/[locale]/my-page/leader/page.tsx`

- Leader readiness / certification status
- 숫자보다 상태를 우선

---

## 3. 공통 컴포넌트 책임

### `ScreenShell`

- 상단 헤더
- 본문 padding
- 공통 frame 구조

### `PrimaryButton`

- 핵심 행동 버튼
- Arena / Continue / Continue to next state

### `SecondaryButton`

- 보조 행동 버튼
- Return / Back / Alternate action

### `InfoCard`

- identity / stats / message block
- 카드 레이아웃 통일

### `ProgressBar`

- Core Progress / Weekly Progress
- 시각적 진행 표현

### `TabPills`

- Overview / Progress / Team / Leader / Account
- 탭 상태 통일

### `BottomNav`

- Arena / Growth / My Page
- 하단 기본 네비게이션

---

## 4. 구현 체크포인트

- route는 먼저 분리한다
- props는 route별로 나눈다
- 공통 UI는 최소 단위로 뽑는다
- theme는 나중에 입힌다
- 데이터는 하드코딩보다 props와 상위 state로 빼는 방향을 우선한다

---

## 5. 완료 기준

다음 조건을 만족하면 1차 구조 분리는 완료입니다.

- 각 화면이 별도 route로 존재
- 공통 컴포넌트가 재사용 가능
- Arena / Growth / My Page의 책임이 겹치지 않음
- color token 없이도 구조가 읽힘
- 이후 테마 적용이 route 변경 없이 가능

