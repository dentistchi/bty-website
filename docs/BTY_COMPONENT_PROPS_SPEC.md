# BTY 공통 컴포넌트 Props 설계

BTY Arena의 페이지 분리 이후, 공통 컴포넌트를 안정적으로 재사용하기 위한 props 설계 문서입니다.

설계 원칙:
- props는 작고 명시적으로 유지
- 시각 스타일보다 의미를 우선
- business logic은 넣지 않음
- 상태 표현은 문자열/variant 중심으로 통일

---

## 1. `ScreenShell`

역할:
- 화면의 공통 컨테이너
- top nav, title, body spacing 제공

추천 props:

```ts
type ScreenShellProps = {
  title: string;
  subtitle?: string;
  menuLabel?: string;
  children: React.ReactNode;
  className?: string;
};
```

사용 규칙:
- `title`은 화면의 최상위 라벨
- `subtitle`은 보조 설명
- `menuLabel`은 `≡` 버튼의 접근성 라벨

---

## 2. `PrimaryButton`

역할:
- 가장 중요한 행동 버튼

추천 props:

```ts
type PrimaryButtonProps = {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
};
```

사용 규칙:
- 각 화면에서 가장 먼저 눌러야 하는 행동에만 사용
- 색을 바꿔서 의미를 바꾸지 않음

---

## 3. `SecondaryButton`

역할:
- 보조 행동 버튼

추천 props:

```ts
type SecondaryButtonProps = {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
};
```

사용 규칙:
- Continue, Return, Alternate action에 사용
- Primary와 시각 계층을 분명히 구분

---

## 4. `InfoCard`

역할:
- identity, progress summary, system message, team summary

추천 props:

```ts
type InfoCardProps = {
  title: string;
  children: React.ReactNode;
  tone?: "default" | "soft" | "warning" | "stable";
  className?: string;
};
```

사용 규칙:
- `tone`은 상태를 표현할 때만 사용
- 내부에 숫자나 설명을 넣더라도 카드는 메시지 단위로 유지

---

## 5. `ProgressBar`

역할:
- Core Progress, Weekly Progress

추천 props:

```ts
type ProgressBarProps = {
  value: number;
  max?: number;
  label?: string;
  showPercent?: boolean;
  className?: string;
};
```

사용 규칙:
- `value`는 0~max 범위
- 퍼센트 표기는 필요할 때만

---

## 6. `TabPills`

역할:
- My Page 하위 탭 표시

추천 props:

```ts
type TabItem = {
  label: string;
  href?: string;
  active?: boolean;
};

type TabPillsProps = {
  items: TabItem[];
  className?: string;
};
```

사용 규칙:
- active는 하나만
- tab label은 짧게 유지
- 탭 내부에서 상세 계산 금지

---

## 7. `BottomNav`

역할:
- Arena / Growth / My Page 기본 하단 네비

추천 props:

```ts
type BottomNavItem = {
  label: string;
  href: string;
  active?: boolean;
};

type BottomNavProps = {
  items: BottomNavItem[];
  className?: string;
};
```

사용 규칙:
- 3개 메뉴만
- active 상태는 라우트 기준으로 결정
- 기능 메뉴를 늘리지 않음

---

## 8. 공통 타입 원칙

### 권장

- `title`, `subtitle`, `label`, `href`, `active`, `tone`, `children`
- 의미가 분명한 props

### 비권장

- `variant1`, `style2`, `modeX`
- 의미가 불분명한 이름
- 컴포넌트 내부 비즈니스 규칙을 계산하는 props

---

## 9. 실제 적용 순서

1. `ScreenShell` 먼저 만든다
2. `PrimaryButton`, `SecondaryButton`을 통일한다
3. `InfoCard`를 화면 전반에 사용한다
4. `ProgressBar`와 `TabPills`를 붙인다
5. 마지막에 `BottomNav`를 연결한다

---

## 10. 완료 기준

- 화면마다 버튼/카드 모양이 다르지 않음
- props가 읽기 쉬움
- 각 컴포넌트의 책임이 겹치지 않음
- theme 토큰이 바뀌어도 props 구조는 유지됨

