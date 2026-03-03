# BTY Arena – Component Inventory (Storybook 대응)

**목표**

- Figma → React → Storybook → 실제 앱까지 **동일한 컴포넌트 목록·역할·상태**로 유지
- 모든 UI 컴포넌트를 **역할/상태/스토리** 단위로 정의
- 재사용 가능 + 일관성 유지 + A11y 대응

**관련**: `BTY_ARENA_FIGMA_NAMING_GUIDE.md`, `BTY_ARENA_FIGMA_CODE_MAPPING.md` (§8 Props 표준), `BTY_ARENA_VISUAL_BEHAVIOR_SPEC.md` (§1.7 컴포넌트·폴더 구조)

---

## 1. 컴포넌트 분류 체계

| 분류 | 설명 | 예시 |
|------|------|------|
| **A. UI (Atomic / Reusable)** | 여러 화면·도메인에서 재사용 | Button, Card, Chip, ProgressRing, Slider, Modal, ChatPanel, EmptyState, ErrorState, Skeleton |
| **B. Layout** | 레이아웃 전용 | PageContainer, SectionContainer, GridLayout, Stack |
| **C. Domain (Feature-Level)** | 특정 도메인 화면 블록 | ArenaHeroCard, ArenaTeamBoard, FoundryDecisionReplay, FoundryTrendGraph, CenterSafeMirror, CenterRecoverySummary |
| **D. Overlay** | 오버레이·다이얼로그 | MentorChatPanel, ConfirmDialog |

---

## 2. Storybook 폴더 구조 (권장)

```
stories/
├── ui/
│   ├── Button.stories.tsx
│   ├── Card.stories.tsx
│   ├── Chip.stories.tsx
│   ├── ProgressRing.stories.tsx
│   ├── Slider.stories.tsx
│   ├── Modal.stories.tsx
│   ├── EmptyState.stories.tsx
│   ├── ErrorState.stories.tsx
│   └── Skeleton.stories.tsx
├── layout/
│   ├── PageContainer.stories.tsx
│   ├── SectionContainer.stories.tsx
│   ├── GridLayout.stories.tsx
│   └── Stack.stories.tsx
├── arena/
│   ├── ArenaHeroCard.stories.tsx
│   └── ArenaTeamBoard.stories.tsx
├── foundry/
│   ├── FoundryDecisionReplay.stories.tsx
│   └── FoundryTrendGraph.stories.tsx
├── center/
│   ├── CenterSafeMirror.stories.tsx
│   └── CenterRecoverySummary.stories.tsx
└── overlay/
    ├── MentorChatPanel.stories.tsx
    └── ConfirmDialog.stories.tsx
```

---

## 3. UI 컴포넌트 상세 정의

### Button

**Category**: UI/Input  

**Props**

- `variant`: primary | secondary | ghost  
- `tone`: arena | foundry | center | neutral  
- `size`: sm | md | lg  
- `isLoading`: boolean  
- `disabled`: boolean  
- `leftIcon?`: ReactNode  
- `rightIcon?`: ReactNode  
- `onClick`: () => void  

**Stories**

- Primary_Arena, Primary_Foundry, Primary_Center  
- Disabled, Loading, WithIcon  
- Accessibility_FocusVisible  

**A11y**

- 아이콘만 있는 버튼은 `aria-label` 필수  
- focus-visible ring 적용  
- 최소 44×44 hit area  

---

### Card

**Category**: UI/DataDisplay  

**Props**

- `tone`: arena | foundry | center | neutral  
- `interactive?`: boolean  
- `padding?`: sm | md | lg  

**Stories**

- Default, Interactive  
- ArenaTone, CenterTone  

---

### ProgressRing

**Category**: UI/DataDisplay  

**Props**

- `value`: 0–100  
- `label?`: string  
- `tone`: arena | foundry | center | neutral  

**Stories**

- 25%, 50%, 75%, 100%  
- Animated  
- ReducedMotion  

---

### Slider

**Category**: UI/Input  

**Props**

- `value`, `onChange`  
- `min`, `max`  
- `tone`  

**Stories**

- Default, MinMax, CenterTone  

**A11y**

- `aria-valuemin`, `aria-valuemax`, `aria-valuenow`  

---

### EmptyState

**Category**: UI/Feedback  

**Props**

- `title`, `description`  
- `ctaLabel?`, `onCtaClick?`  

**Stories**

- ArenaEmpty, FoundryEmpty, CenterEmpty  

---

### ErrorState

**Category**: UI/Feedback  

**Props**

- `title`, `description`  
- `retryLabel?`, `onRetry?`  

**Stories**

- APIError, PermissionDenied, RetryFlow  

---

### 기타 UI (Skeleton, Modal, ChatPanel, Chip)

- **Skeleton**: 로딩 블록. Stories: Default, CardShape, ListRow.  
- **Modal**: `open`, `onOpenChange`, `title`, `children`. Stories: Default, WithFooter. A11y: role="dialog", aria-modal.  
- **ChatPanel**: `open`, `onOpenChange`, `messages`, `onSend`. Stories: Empty, WithMessages.  
- **Chip**: `label`, `onRemove?`, `selected?`. Stories: Default, Removable, Selected.  

---

## 4. Arena Domain Components

### ArenaHeroCard

**Props**

- `title`, `description`  
- `onStart`: () => void  
- `isLoading`: boolean  

**Stories**

- Default, Loading, NoScenario  

---

### ArenaTeamBoard

**Props**

- `teams`: 배열 (rank, name, xp 등)  
- `loading`: boolean  
- `error`: Error | null  

**Stories**

- Top3, Empty, Error  

---

## 5. Foundry Domain Components

### FoundryDecisionReplay

**Props**

- `decisions`: 배열  
- `loading`, `error`  

**Stories**

- WithData, Empty, Error  

---

### FoundryTrendGraph

**Props**

- `data`: 배열 (날짜·값)  
- `range`: '7d' | '14d'  
- `loading`: boolean  

**Stories**

- 14d, 7d, Empty, Loading  

---

## 6. Center Domain Components

### CenterSafeMirror

**Props**

- `value`, `onChange`, `onSubmit`  
- `placeholder?`, `maxLength?`  
- `loading`: boolean  

**Stories**

- Default, Filled, Loading, ValidationError  

---

### CenterRecoverySummary

**Props**

- `summaryText`  
- `curveData?` (미니 그래프용)  
- `onBackToArena`: () => void  

**Stories**

- Default, WithCurve, Minimal  

---

## 7. Overlay Components

### MentorChatPanel

**Props**

- `open`, `onOpenChange`  
- `messages`, `onSend`  
- `quickButtons?`  

**Stories**

- Empty, WithMessages, WithQuickButtons  

**A11y**: role="dialog", aria-modal="true"  

---

### ConfirmDialog

**Props**

- `open`, `onOpenChange`  
- `title`, `message`  
- `confirmLabel`, `cancelLabel`  
- `onConfirm`, `onCancel`  
- `destructive?`: boolean  

**Stories**

- Default, Destructive  

---

## 8. Storybook 작성 원칙

- **한 컴포넌트 = 한 *.stories.tsx**. Meta에 `title`을 분류 경로로 (예: `ui/Button`, `arena/ArenaHeroCard`).
- **상태·tone별 Story**를 최소 한 개씩 두어, Figma Variant와 대응시킨다.
- **A11y**: focus, reduced-motion, 스크린리더 관련 스토리 포함 권장.
- **Docs**: props 테이블·설명은 CSF3 또는 MDX로 유지.

---

**문서 위치**: `bty-app/docs/BTY_ARENA_COMPONENT_INVENTORY_STORYBOOK.md`  
**참조**: `BTY_ARENA_FIGMA_CODE_MAPPING.md` (§8 컴포넌트 API), `BTY_ARENA_FIGMA_NAMING_GUIDE.md` (§3 Component), `BTY_ARENA_VISUAL_BEHAVIOR_SPEC.md` (§1.7)  
**시각 회귀**: [Chromatic/Visual Regression 전략](BTY_ARENA_CHROMATIC_VISUAL_REGRESSION_STRATEGY.md)
