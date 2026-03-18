# BTY Tailwind / CSS Variable Theme Tokens

BTY Arena의 구조 분리 이후 적용할 디자인 토큰 문서입니다.

원칙:
- 먼저 구조를 분리하고, 그 다음 색을 입힌다
- 토큰은 의미 중심으로 관리한다
- 페이지별 하드코딩 색상은 피한다

---

## 1. 색감 방향

BTY의 톤:
- Professional Pride
- Calm Authority
- Structured Growth
- Arena Language

비주얼 방향:
- 밝은 stone/slate 기반
- 진한 navy-charcoal 텍스트
- muted gold 또는 disciplined blue 포인트
- 위험/경고는 낮은 채도의 amber/red
- 성공은 깊은 green-gray

---

## 2. 추천 토큰

### Base

```text
--bty-bg: #F6F4EE
--bty-surface: #FFFFFF
--bty-surface-soft: #F1EEE6
```

### Text

```text
--bty-text: #1F2937
--bty-text-secondary: #667085
--bty-text-muted: #98A2B3
```

### Brand / Arena

```text
--bty-brand-navy: #1E2A38
--bty-brand-steel: #405A74
```

### Prestige / Identity

```text
--bty-muted-gold: #B08D57
--bty-soft-bronze: #8B6B4A
```

### Status

```text
--bty-stable: #4D6B57
--bty-warning: #A06A3A
--bty-risk: #8A4D4D
```

---

## 3. Tailwind 적용 방식

### 방식 A: CSS variables + Tailwind color mapping

`globals.css` 또는 theme layer에 변수를 정의하고 Tailwind가 참조하도록 매핑합니다.

장점:
- runtime theme 변경이 쉬움
- 페이지별 일관성 유지

### 방식 B: Tailwind utility 직접 사용

빠른 프로토타입에서는 `bg-[#F6F4EE]` 같은 방식으로 시작할 수 있습니다.

장점:
- 빠름

단점:
- 유지보수 시 색상이 흩어지기 쉬움

권장:
- 프로토타입은 방식 B
- 실제 제품은 방식 A

---

## 4. 권장 CSS 변수 구조

```css
:root {
  --bty-bg: #F6F4EE;
  --bty-surface: #FFFFFF;
  --bty-surface-soft: #F1EEE6;

  --bty-text: #1F2937;
  --bty-text-secondary: #667085;
  --bty-text-muted: #98A2B3;

  --bty-brand-navy: #1E2A38;
  --bty-brand-steel: #405A74;

  --bty-muted-gold: #B08D57;
  --bty-soft-bronze: #8B6B4A;

  --bty-stable: #4D6B57;
  --bty-warning: #A06A3A;
  --bty-risk: #8A4D4D;
}
```

---

## 5. Tailwind에서의 사용 예

```ts
// 예시 개념
theme: {
  extend: {
    colors: {
      bty: {
        bg: "var(--bty-bg)",
        surface: "var(--bty-surface)",
        soft: "var(--bty-surface-soft)",
        text: "var(--bty-text)",
        secondary: "var(--bty-text-secondary)",
        muted: "var(--bty-text-muted)",
        navy: "var(--bty-brand-navy)",
        steel: "var(--bty-brand-steel)",
        gold: "var(--bty-muted-gold)",
        bronze: "var(--bty-soft-bronze)",
        stable: "var(--bty-stable)",
        warning: "var(--bty-warning)",
        risk: "var(--bty-risk)",
      },
    },
  },
}
```

---

## 6. UI 매핑 규칙

### Arena

- 배경은 `bg-bty-bg`
- Primary button은 `bg-bty-navy`
- 보조 텍스트는 `text-bty-secondary`

### Growth

- 카드 표면은 `bg-bty-surface`
- 섹션 구분은 `bg-bty-surface-soft`
- 안정 메시지는 `text-bty-stable`

### My Page

- identity / progress / team 카드는 모두 같은 surface 계열
- status는 tone으로만 구분
- TII는 team section에서만 강조

---

## 7. 주의사항

- 선명한 게임 색을 과하게 쓰지 않는다
- 위험 상태를 빨간 경고창처럼 만들지 않는다
- 성공을 축하 배너처럼 과장하지 않는다
- 각 화면의 의미는 색보다 구조로 먼저 읽히게 한다

---

## 8. 완료 기준

- 페이지를 분리해도 색 체계가 유지됨
- 카드 / 버튼 / 탭이 하나의 팔레트 안에서 움직임
- theme 변경이 한 군데에서 가능
- 구조와 색감이 분리되어 관리됨

