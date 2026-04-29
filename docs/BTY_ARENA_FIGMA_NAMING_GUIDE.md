# BTY Arena – Figma Frame Naming & Component Guideline

이 문서는 BTY Arena의 Figma 설계를 일관되게 유지하기 위한  
**Frame 네이밍 규칙** + **컴포넌트 구조** + **Variant 전략** + **토큰·Auto Layout·프로토타입** 규칙을 정의합니다.

**관련**: `BTY_ARENA_VISUAL_TOC.md` (화면 목록·Frame ID 매핑), `BTY_ARENA_VISUAL_BEHAVIOR_SPEC.md` (§1.7), `BTY_ARENA_DESIGN_TOKENS.md` (색·spacing), `BTY_ARENA_TECHNICAL_SPEC.md` (§7)

---

## 1. FRAME NAMING RULE

**형식**

`[Layer] / [Domain] / [ScreenName] / [State]`

| 요소 | 설명 | 예 |
|------|------|-----|
| **Layer** | App / Flow / Overlay | |
| **Domain** | Arena / Foundry / Center / Global | |
| **ScreenName** | ArenaHome, ArenaSimulation 등 (CamelCase) | TOC 화면 제목과 1:1 대응 (예: Arena Home → ArenaHome) |
| **State** | Default / Loading / Empty / Error | |

**예시**

- `App/Arena/ArenaHome/Default`
- `App/Arena/ArenaHome/Loading`
- `App/Arena/ArenaResult/Error`
- `App/Foundry/TrendGraphFull/Default`
- `App/Center/SafeMirror/Empty`
- `Overlay/Global/MentorChat/Open`
- `Flow/Arena/ArenaHome_to_Simulation`

---

## 2. 15 SCREEN FRAME NAME LIST (STANDARD)

| Domain | Frame Path (기본) |
|--------|-------------------|
| Arena | `App/Arena/ArenaHome` |
| Arena | `App/Arena/ArenaSimulation` |
| Arena | `App/Arena/ArenaResult` |
| Arena | `App/Arena/TeamBoard` |
| Foundry | `App/Foundry/FoundryHome` |
| Foundry | `App/Foundry/DecisionReplayDetail` |
| Foundry | `App/Foundry/HiddenStatsInsight` |
| Foundry | `App/Foundry/TrendGraphFull` |
| Foundry | `App/Foundry/FoundryInsightCards` |
| Center | `App/Center/CenterEntry` |
| Center | `App/Center/SafeMirror` |
| Center | `App/Center/SmallWinsCapture` |
| Center | `App/Center/SelfEsteemCheck` |
| Center | `App/Center/CenterMiniRecovery` |
| Global | `Overlay/Global/MentorChat` |
| Global | `App/Global/SettingsProfile` |

---

## 3. COMPONENT NAMING RULE

**형식**

`[Category] / [ComponentName] / [Variant]`

**Category**

- Layout
- Navigation
- DataDisplay
- Input
- Feedback
- Overlay

**예시**

- `Layout/PageContainer`
- `Navigation/TopNav`
- `Navigation/BottomNav`
- `DataDisplay/ProgressRing`
- `DataDisplay/LeaderboardItem`
- `DataDisplay/InsightCard`
- `Input/TextArea`
- `Input/Slider`
- `Input/ButtonPrimary`
- `Input/ButtonSecondary`
- `Feedback/EmptyState`
- `Feedback/ErrorState`
- `Overlay/Modal`
- `Overlay/ChatPanel`

---

## 4. VARIANT STRATEGY (Figma Component Variant)

Variant는 다음 속성으로 관리합니다.

| 속성 | 값 |
|------|-----|
| **State** | Default / Hover / Pressed / Disabled / Loading |
| **Theme** | Arena / Foundry / Center |
| **Size** | Mobile / Tablet / Desktop |

**예시**

```
Input/ButtonPrimary
  ├─ State=Default, Theme=Arena
  ├─ State=Hover, Theme=Arena
  ├─ State=Default, Theme=Center
  └─ State=Disabled, Theme=Foundry
```

---

## 5. AUTO LAYOUT RULE

- 모든 **Screen Frame**은 **Auto Layout** 적용.
- **Padding**은 Design Token spacing 기준 사용.
- **Gap** 값은 **8pt 시스템** (8 / 16 / 24 / 32).

**Breakpoints**

| 대상 | 기준 폭 |
|------|---------|
| Mobile | 390px |
| Tablet | 768px |
| Desktop | 1440px |

---

## 6. COLOR TOKEN 적용 규칙

- **직접 HEX 사용 금지.** 반드시 변수 또는 Figma Style 사용.

**코드/변수 형식 예시**

- `var(--arena-primary)`
- `var(--foundry-accent)`
- `var(--center-bg)`

**Figma Style 이름 규칙**

- `Color/Arena/Primary`
- `Color/Arena/Accent`
- `Color/Foundry/Primary`
- `Color/Center/Accent`
- `Color/Neutral/TextPrimary`

---

## 7. TYPOGRAPHY STYLE RULE

**Text Style Naming**

- `Text/H1`
- `Text/H2`
- `Text/Body`
- `Text/Caption`
- `Text/Button`

Arena / Foundry / Center는 **색상**으로 구분하고, **폰트 스타일**은 공통 유지.

---

## 8. ICON NAMING RULE

**형식**

- `Icon/[Name]/Outline`
- `Icon/[Name]/Filled`

**예시**

- `Icon/ArrowRight/Outline`
- `Icon/Chat/Filled`
- `Icon/Warning/Outline`

---

## 9. INTERACTION PROTOTYPE NAMING

**Flow Frame Naming**

- `Flow/Arena_StartSimulation`
- `Flow/Foundry_To_Center`
- `Flow/Center_BackToArena`

**Transition Naming Convention**

- `Transition/Fade200`
- `Transition/SlideLeft300`
- `Transition/ModalScale150`

*`BTY_ARENA_STORYBOARD_INTERACTION_FLOW.md` §2 Duration과 맞춰 사용.*

---

## 10. FRAME ID 관리 규칙

각 Screen Frame의 **Description** 필드에 아래 정보를 추가합니다.

```
Screen: ArenaHome
Route: /bty-arena
API: GET /api/weekly-targets
Spec Ref: BTY_ARENA_VISUAL_TOC.md#arena-home
```

→ 문서 ↔ Figma ↔ 개발이 1:1로 연결됩니다.  
→ TOC·Technical Spec §7의 Figma Frame ID와 동일한 노드 ID를 사용하세요.

---

## 11. 금지 사항

- Screen 이름에 **공백 사용 금지** (CamelCase 사용)
- **색상 직접 입력 금지** (Color Token / Style 사용)
- **Variant 없이** 복붙으로 컴포넌트 생성 금지
- **Layout 수동 정렬 금지** (Auto Layout 필수)

---

## 12. 협업 권장 구조 (Pages)

```
00_System_Tokens
01_Components
02_Screens_Arena
03_Screens_Foundry
04_Screens_Center
05_Overlay
06_Flow_Prototype
```

---

**문서 위치**: `bty-app/docs/BTY_ARENA_FIGMA_NAMING_GUIDE.md`  
**참조**: `BTY_ARENA_VISUAL_TOC.md` (Frame ID 채우기·§2 15개 목록), `BTY_ARENA_TECHNICAL_SPEC.md` (§7 API↔화면), `BTY_ARENA_DESIGN_TOKENS.md` (색·spacing·타이포), `BTY_ARENA_STORYBOARD_INTERACTION_FLOW.md` (§2 Motion Spec)  
**코드 매핑**: [Figma → Code 매핑 규칙 (React/Tailwind)](BTY_ARENA_FIGMA_CODE_MAPPING.md)
