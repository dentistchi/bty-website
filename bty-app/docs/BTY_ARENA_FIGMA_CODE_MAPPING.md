# BTY Arena – Figma → Code 매핑 규칙 (React / Tailwind)

Figma Frame·컴포넌트·토큰과 **React 페이지/Feature/UI 컴포넌트·Tailwind** 간 1:1 매핑 원칙을 정의합니다.

**관련**: `BTY_ARENA_FIGMA_NAMING_GUIDE.md` (Frame/Component 네이밍), `BTY_ARENA_TECHNICAL_SPEC.md` (§7 라우트·API), `BTY_ARENA_DESIGN_TOKENS.md` (색·spacing·타이포), `BTY_ARENA_VISUAL_TOC.md` (화면·Frame ID)

---

## 1. 1:1 매핑 원칙 (Figma → Code)

| Figma | Code |
|-------|------|
| **Frame** = Page(라우트) 컴포넌트 | `src/app/[locale]/bty-arena/.../page.tsx` |
| **Section**(Hero/Progress/TeamBoard 등 큰 블록) = Feature 컴포넌트 | `src/features/{domain}/{feature}/...` |
| **Atomic Component**(Figma Component) = UI 컴포넌트 | `src/components/ui/...` |
| **Variant** | props로만 제어 (복붙 금지) |
| **Token** | Tailwind theme(token) 또는 CSS variable만 사용 (직접 값 금지) |

- **Frame 예**: `App/Arena/ArenaHome/Default` → `src/app/[locale]/bty-arena/page.tsx`
- Page는 **레이아웃 + 데이터 바인딩 + 섹션 컴포넌트 조립**만 담당.

---

## 2. 네이밍 매핑 규칙 (Figma 이름 → 코드 이름)

**A) Frame/ScreenName → Route + Page component**

| Figma ScreenName | Route | Page component |
|------------------|-------|----------------|
| ArenaHome | /bty-arena | ArenaHomePage |
| ArenaSimulation | /bty-arena/sim | ArenaSimulationPage |
| FoundryHome | /bty-arena/foundry | FoundryHomePage |
| CenterEntry | /bty-arena/center | CenterEntryPage |

**B) Component naming**

| Figma | Code |
|-------|------|
| Navigation/TopNav | `TopNav.tsx` (export function TopNav) |
| DataDisplay/ProgressRing | `ProgressRing.tsx` |

**C) 도메인 prefix 권장**

- Arena 전용: `ArenaHeroCard.tsx`, `ArenaTeamBoard.tsx`
- Foundry 전용: `FoundryDecisionReplay.tsx`
- Center 전용: `CenterSafeMirror.tsx`

---

## 3. 프로젝트 폴더 구조 (권장)

```
src/
├── app/
│   └── [locale]/
│       └── bty-arena/
│           ├── page.tsx                    # Arena Home
│           ├── sim/page.tsx                # Arena Simulation
│           ├── result/page.tsx             # Arena Result
│           ├── board/page.tsx              # Team Board
│           ├── foundry/
│           │   ├── page.tsx                 # Foundry Home
│           │   ├── decision/page.tsx
│           │   ├── stats/page.tsx
│           │   ├── trend/page.tsx
│           │   └── insights/page.tsx
│           ├── center/
│           │   ├── page.tsx                 # Center Entry
│           │   ├── safe-mirror/page.tsx
│           │   ├── small-wins/page.tsx
│           │   ├── self-esteem/page.tsx
│           │   └── recovery/page.tsx
│           ├── chat/mentor/page.tsx
│           └── settings/profile/page.tsx
├── features/
│   ├── arena/   (components, hooks, api)
│   ├── foundry/ (components, hooks, api)
│   └── center/  (components, hooks, api)
├── components/
│   └── ui/
│       ├── Button.tsx
│       ├── Card.tsx
│       ├── Chip.tsx
│       ├── Slider.tsx
│       ├── Modal.tsx
│       ├── EmptyState.tsx
│       ├── ErrorState.tsx
│       └── Skeleton.tsx
└── lib/
    ├── apiClient.ts
    ├── cn.ts
    └── i18n/
```

*실제 앱이 locale·네스팅 구조를 쓰면* `BTY_ARENA_ERROR_ACCESSIBILITY_MAPPING.md` §C와 맞춰 경로만 조정.

---

## 4. Tailwind 토큰 매핑 규칙 (Color / Spacing / Typography)

**원칙**: 토큰 이름 = Tailwind class 이름. CSS 변수 기반 + Tailwind 참조 (테마/도메인 전환 유리).

**A) 색상 토큰**

| Figma token | Code (Tailwind) |
|-------------|-----------------|
| Color/Arena/Primary | `text-arena-primary`, `bg-arena-primary`, `border-arena-primary` |
| Color/Center/Accent | `text-center-accent`, `bg-center-accent` |

**B) 간격 토큰 (8pt system)**

| Figma spacing | Code (프로젝트 단위 합의) |
|---------------|---------------------------|
| 8/16/24/32 | `p-2`/`p-4`/`p-6`/`p-8`, `gap-2`/`gap-4`/`gap-6`/`gap-8` |

**C) 타이포 토큰**

| Figma | Code |
|-------|------|
| Text/H1, H2, Body, Caption, Button | `text-h1`, `text-h2`, `text-body`, `text-caption`, `text-button` |
| (실제는 theme에 fontSize/lineHeight/letterSpacing 토큰으로 정의) | |

---

## 5. 레이아웃 매핑 (Auto Layout → Tailwind)

| Figma | Tailwind |
|-------|----------|
| Auto Layout Column | `flex flex-col` |
| Auto Layout Row | `flex flex-row` |
| gap 16 | `gap-4` (프로젝트 단위 기준) |
| padding 24 | `p-6` |
| center align | `items-center justify-center` |
| Card | `rounded-2xl border shadow-sm bg-*` |
| Section | `max-w` + `px` + `gap` |

---

## 6. 반응형 매핑 규칙 (Mobile-first)

- **base**: 모바일
- **md:** Tablet
- **lg:** / **xl:** Desktop

| Figma | Code |
|-------|------|
| Tablet+ 2열 | `base: flex-col`, `md: grid grid-cols-2 gap-*` |
| 블록 순서 변경 | `base: order-*`, `md: order-*` |

**예**: Arena Home  
- base: Hero → Progress → TeamBoard → MyContribution  
- md+: Hero/Progress 왼쪽, TeamBoard 오른쪽 (`grid-cols-2`)

---

## 7. 상태(State) 매핑 규칙 (Default / Loading / Empty / Error)

각 **데이터 블록**은 아래 4상태 구현:

| 상태 | 구현 |
|------|------|
| Loading | Skeleton 컴포넌트 |
| Empty | EmptyState (문구 + CTA) |
| Error | ErrorState (문구 + Retry) |
| Default | 정상 UI |

- **패턴**: Page에서 data fetch → 상태 판정 → Section에 props로 전달. Section 내부는 UI 렌더링만.

---

## 8. 컴포넌트 API(Props) 표준

**Button**

- `variant`: primary | secondary | ghost  
- `tone`: arena | foundry | center | neutral  
- `size`: sm | md | lg  
- `isLoading`, `disabled`  
- `leftIcon` / `rightIcon` (optional)  
- `aria-label` 필수 (아이콘 버튼)

**Card**

- `tone`, `padding`, `interactive` (boolean), `asChild` (optional)

**ProgressRing**

- `value` (0–100), `label`, `tone`

**Modal / ChatPanel**

- `open`, `onOpenChange`, `title`  
- `role` / `aria-*` (dialog, aria-modal 등)

---

## 9. i18n 매핑 규칙 (Figma copy → 코드 키)

- Figma 문구는 **키**로 남긴다 (Frame description 또는 텍스트 레이어 이름).
- 코드에서는 하드코딩 금지, `t("key")` 사용.

**키 네이밍 예**

- `arena.start_simulation`
- `center.safe_here`
- `foundry.pattern_summary`
- `mentor.insight`

**Figma Text Layer naming (권장)**

- `Text/arena.start_simulation`
- `Text/center.safe_here`

---

## 10. 접근성 매핑 규칙 (Figma → React)

- 모든 interactive: **44×44 이상** hit area
- **focus-visible** 스타일 필수 (ring, outline)
- **대비(WCAG)**: 텍스트 4.5:1, 큰 텍스트 3:1, 컨트롤 3:1
- **스크린리더**: 버튼/아이콘 `aria-label`, 모달 `role="dialog"` `aria-modal="true"`, 입력은 label 연결 또는 `aria-labelledby`

---

## 11. 모션/전환 매핑 규칙 (Figma Prototype → 코드)

| 구분 | Duration (권장) |
|------|----------------|
| Page transition | 200–300ms |
| Modal | 150ms |
| Micro | 80–120ms |
| Progress fill | 400ms |

- **prefers-reduced-motion**: reduce일 때 transition/animation 최소화(0–50ms) 또는 제거. 의미 전달은 색/텍스트 변화로 대체.  
- *`BTY_ARENA_STORYBOARD_INTERACTION_FLOW.md` §2·§3과 동일.*

---

## 12. Figma Frame ID → 코드 주석/메타 연결

각 **페이지 컴포넌트 상단**에 다음 주석/메타를 넣는다:

```
/**
 * Screen: ArenaHome
 * Route: /bty-arena
 * FigmaFrameId: XXXXX
 * SpecAnchor: BTY_ARENA_VISUAL_TOC.md#arena-home
 */
```

→ 디자인–코드–문서 3점이 고정된다.

---

## 13. 구현 순서 (실무 최적)

1. Arena Home (Hero / Progress / Board)
2. Simulation + Result (핵심 루프)
3. Foundry Home + Trend / Insights
4. Center Entry + SafeMirror + Recovery
5. Chat Panel (overlay)
6. Error / Empty / A11y / i18n 마무리

---

**문서 위치**: `bty-app/docs/BTY_ARENA_FIGMA_CODE_MAPPING.md`  
**참조**: `BTY_ARENA_FIGMA_NAMING_GUIDE.md`, `BTY_ARENA_TECHNICAL_SPEC.md` §7, `BTY_ARENA_DESIGN_TOKENS.md`, `BTY_ARENA_VISUAL_TOC.md`, `BTY_ARENA_STORYBOARD_INTERACTION_FLOW.md`  
**토큰→Tailwind 상세**: [Design Token → Tailwind 매핑 규칙](BTY_ARENA_DESIGN_TOKEN_TO_TAILWIND_MAPPING_RULES.md)  
**컴포넌트 상세**: [Component Inventory (Storybook)](BTY_ARENA_COMPONENT_INVENTORY_STORYBOOK.md)
