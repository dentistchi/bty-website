# BTY 페이지 분리 + 컬러 토큰 적용 프롬프트

BTY Arena의 구현 순서를 고정하기 위한 문서입니다.

핵심 원칙:
1. **페이지 단위로 먼저 쪼갠다**
2. **그 다음 색감(테마 토큰)을 입힌다**

이 순서를 먼저 지키는 이유:
- 색을 먼저 입히면 구조 문제가 가려진다.
- BTY는 지금 **구조를 잠그는 단계**이므로 App Router 기준 화면 분리를 먼저 해야 한다.
- 화면 분리가 끝나야 공통 UI, theme token, page polish가 안정적으로 들어간다.

---

## 1. 추천 실행 순서

### 1단계: 현재 프로젝트 구조에 맞게 페이지 분리

Next.js App Router, locale prefix, `bty-arena` 경로를 기준으로 아래 구조로 나누는 것이 자연스럽습니다.

```text
bty-app/src/app/[locale]/bty-arena/page.tsx              -> Arena entry
bty-app/src/app/[locale]/bty-arena/result/page.tsx       -> Result
bty-app/src/app/[locale]/growth/page.tsx                 -> Growth main
bty-app/src/app/[locale]/my-page/page.tsx                -> My Page overview
bty-app/src/app/[locale]/my-page/progress/page.tsx       -> Progress tab
bty-app/src/app/[locale]/my-page/team/page.tsx           -> Team tab
bty-app/src/app/[locale]/my-page/leader/page.tsx        -> Leader Track tab
```

공통 컴포넌트는 아래처럼 분리하는 것이 좋습니다.

```text
bty-app/src/components/bty/layout/ScreenShell.tsx
bty-app/src/components/bty/ui/PrimaryButton.tsx
bty-app/src/components/bty/ui/SecondaryButton.tsx
bty-app/src/components/bty/ui/InfoCard.tsx
bty-app/src/components/bty/ui/ProgressBar.tsx
bty-app/src/components/bty/ui/TabPills.tsx
bty-app/src/components/bty/navigation/BottomNav.tsx
```

### 2단계: 색감 입히기

페이지 분리 후에 컬러 토큰과 공통 스타일을 입힙니다.

BTY 톤:
- Professional Pride
- Calm Authority
- Structured Growth
- Arena Language

색감 방향:
- 배경: 밝은 stone/slate 계열
- 텍스트: 진한 navy-charcoal
- 포인트: muted gold 또는 disciplined blue
- 위험/경고: 채도 낮은 amber/red
- 성공: 선명한 초록보다 깊은 green-gray

추천 팔레트 v1:

```text
Base
- Background: #F6F4EE
- Surface: #FFFFFF
- Soft Surface: #F1EEE6

Text
- Primary: #1F2937
- Secondary: #667085
- Muted: #98A2B3

Brand / Arena
- Deep Navy: #1E2A38
- Steel Blue: #405A74

Prestige / Identity
- Muted Gold: #B08D57
- Soft Bronze: #8B6B4A

Status
- Stable: #4D6B57
- Warning: #A06A3A
- Risk: #8A4D4D
```

이 방향은:
- 전문적이고
- 무게감 있고
- 과하지 않고
- 앱처럼 보이게 한다

---

## 2. 실행 가이드

### Step A

현재 React 와이어프레임을 App Router `page.tsx` + `components` 구조로 분리한다.

### Step B

Tailwind 기준으로 BTY theme tokens를 적용한다.

### Step C

Arena / Growth / My Page 3개 페이지만 먼저 실제처럼 보이게 만든다.

---

## 3. Cursor에 바로 넣는 프롬프트

```text
You are a senior Next.js 15 App Router engineer and product UI developer.

Refactor the existing BTY Arena wireframe React prototype into real page-based routes that match the current project structure.

Project context:
- Next.js App Router
- Locale prefix: /[locale]/...
- Existing BTY Arena route pattern exists under /[locale]/bty-arena
- Keep the architecture simple and production-ready

Goal:
Split the wireframe into page-level files and reusable components.

Create this route structure:

- src/app/[locale]/bty-arena/page.tsx
- src/app/[locale]/bty-arena/result/page.tsx
- src/app/[locale]/growth/page.tsx
- src/app/[locale]/my-page/page.tsx
- src/app/[locale]/my-page/progress/page.tsx
- src/app/[locale]/my-page/team/page.tsx
- src/app/[locale]/my-page/leader/page.tsx

Create reusable components:

- src/components/bty/layout/ScreenShell.tsx
- src/components/bty/ui/PrimaryButton.tsx
- src/components/bty/ui/SecondaryButton.tsx
- src/components/bty/ui/InfoCard.tsx
- src/components/bty/ui/ProgressBar.tsx
- src/components/bty/ui/TabPills.tsx
- src/components/bty/navigation/BottomNav.tsx

Apply a calm premium BTY visual system using Tailwind utility classes.

BTY design tone:
- Professional
- Calm authority
- Structured
- Premium but minimal
- No playful gamification colors

Suggested palette:
- background: #F6F4EE
- surface: #FFFFFF
- soft surface: #F1EEE6
- primary text: #1F2937
- secondary text: #667085
- brand navy: #1E2A38
- steel blue: #405A74
- muted gold: #B08D57
- stable green: #4D6B57
- warning amber: #A06A3A
- risk red: #8A4D4D

Rules:
- Arena first screen must prioritize “Play Game”
- Growth must feel calm, not educational
- My Page must stay minimal and hide advanced data
- Do not expose AIR raw score
- TII only in team-related page
- Leader page should show readiness/certification as status, not raw analytics

Output code only.
Use clean, reusable components.
Use server-safe page files unless interactivity is required.
```

---

## 4. 한 줄 요약

**먼저 페이지를 분리하고, 그 다음 색을 입힌다.**

이 순서가 BTY의 구조를 안전하게 잠그는 가장 자연스러운 진행 방식입니다.
