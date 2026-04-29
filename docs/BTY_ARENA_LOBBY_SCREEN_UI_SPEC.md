# BTY Arena — Home / Lobby Screen UI SPEC **(FINAL LOCKED)**

**용도**: Arena **미션 로비** — 대시보드가 아니라 **지금 플레이 가능**함을 전달하는 진입 화면.  
**구현 라우트 (프로토타입)**: `/[locale]/bty-arena/lobby` — `src/components/bty-arena/ArenaLobbyScreen.tsx`  
**기존 허브** (`/bty-arena` ScreenShell + 카드)와 별도; 추후 통합·리다이렉트는 제품 결정.

**연속성**: [`BTY_ARENA_PLAY_SCREEN_UI_SPEC.md`](./BTY_ARENA_PLAY_SCREEN_UI_SPEC.md) · [`BTY_ARENA_RESOLVE_SCREEN_UI_SPEC.md`](./BTY_ARENA_RESOLVE_SCREEN_UI_SPEC.md) 와 **동일 다크 프리미엄 시뮬 톤**.

---

## A. 역할 (4블록만)

1. **Top Identity Bar** — 정체성  
2. **Primary Action Hero** — 다음 행동  
3. **Live Simulation Row** — 활성 시나리오 + (조용한) Reflection  
4. **Quiet Status Rail** — 최소 상태만 (경쟁·과분석 금지)

**정의**: Dashboard ❌ · **Mission Lobby** ✅

---

## B. BTY 철학 (Lobby 한정)

- **행동 중심** — “지금 바로 플레이”가 한눈에.  
- **경쟁 정보는 보조** — 리더보드·과시 XP **강조 없음**.  
- **정체성 + 진입점 + 최소 상태**만.  
- Play / Resolve와 **같은 세계관** (deep navy, muted cyan, glass, 관찰형).

### Hero = 명령 데크 (배너 아님)

- 큰 카피 한 줄 + CTA 1~2개면 충분.  
- 추천 톤: *Enter the next decision cycle.* / *Pressure, ambiguity, and responsibility remain active.* — 게임 같지도, 기업 대시보드 같지도 않게.

### Reflection 카드

- Growth·회복은 중요 축이나 **Lobby에서는 주연 아님**.  
- “Open Reflection”은 보여도 되나 **Enter Arena보다 크거나 밝으면 안 됨**.

### QuietStatusRail

- 질적 한 줄만 (예: Stable movement, 12 days remaining). **숫자 과다·그래프·리더보드 표·AIR raw 금지.**

---

## C. 컴포넌트 구조

```
ArenaLobbyScreen
├─ TopIdentityBar
├─ HeroEntryPanel
├─ LiveSimulationPanelRow
│  ├─ ActiveScenarioCard
│  └─ ReflectionPromptCard
└─ QuietStatusRail
   └─ StatusCapsule × 3
```

---

## D. 상태 (프로토타입)

```ts
const [systemState] = useState("ARENA READY");
const [hasResume] = useState(true);
const [hasReflectionPrompt] = useState(true);
```

---

## E. QuietStatusRail 규칙

- **숫자·그래프·리더보드 표·AIR raw** 넣지 않음.  
- 짧은 **질적 문구**만 (예: Stable movement, 12 days remaining).

---

## F. Cursor 최종 프롬프트 (그대로 복사)

```
Create the BTY Arena Home / Lobby screen as a premium tablet-first React UI using Next.js App Router conventions and Tailwind CSS.

Important design intent:
- This is not a dashboard.
- This is not a gamified home screen.
- This is the mission lobby before entering the Arena.
- The user should immediately feel:
  1. identity
  2. readiness
  3. clear next action

The screen must feel like the same world as:
- ArenaPlayScreen
- ArenaResolveScreen

Use the same design language:
- deep navy / slate-black
- muted cyan accents
- calm authority
- premium dark glass panels
- cinematic but restrained
- no playful game energy
- no bright success colors
- no clutter

Build the screen with the following structure:

1) ArenaLobbyScreen
- full-screen container
- same dark BTY background language
- 4 zones:
  a. TopIdentityBar
  b. HeroEntryPanel
  c. LiveSimulationPanelRow
  d. QuietStatusRail

2) TopIdentityBar
- Left:
  - BTY ARENA wordmark
- Center:
  - Stage label
- Right:
  - Level
  - thin progress strip
  - codename
- same visual language as ArenaPlayScreen TopBar

3) HeroEntryPanel
- primary visual focus
- large premium panel
- left side:
  - small label: ARENA READY
  - title: short, calm, strong
  - one-line readiness description
- right side:
  - primary CTA: Enter Arena
  - secondary CTA: Resume Scenario
- no leaderboard
- no reward bursts
- must feel like a command deck entry point

4) LiveSimulationPanelRow
- 2 cards side by side

Card A: Active Scenario
- current scenario title
- difficulty
- state label such as SCENARIO LOADED
- small button or CTA: Continue

Card B: Reflection / Recovery prompt
- quiet optional card
- short message such as:
  "One unresolved pattern remains available for review."
- CTA: Open Reflection
- should feel secondary, not distracting

5) QuietStatusRail
- horizontal low-noise status strip or 3 compact cards
- only minimal information:
  - Core Progress
  - Weekly Window
  - Team Signal
- no raw analytics
- no leaderboard table
- no AIR raw score
- no clutter
- each status item should feel compact and premium

6) Interaction priorities
- Primary action = Enter Arena
- Secondary = Resume Scenario
- Reflection should be visible but quieter
- Status is last in hierarchy

7) Tailwind style rules
- same family as Arena play/resolve
- rounded-3xl for hero
- rounded-2xl for support cards
- dark glass surfaces
- muted cyan edge highlights
- soft border opacity
- subtle shadows
- no bright gradients
- no flashy animation

8) Motion
- only subtle fade / slight translate
- no bounce
- no celebratory scale
- quiet hover states only

9) Use sample content:

Stage: STAGE 1: FORGE
Level: LEVEL 21
Codename: STILLWATER
Progress: 63

Hero:
Label: ARENA READY
Title: Enter the next decision cycle.
Description: Pressure, ambiguity, and responsibility remain active.

Primary CTA: Enter Arena
Secondary CTA: Resume Scenario

Active Scenario card:
Title: Patient Complaint: Revised Estimate
Difficulty: Moderate
State: Scenario Loaded
CTA: Continue

Reflection card:
Text: One unresolved pattern remains available for review.
CTA: Open Reflection

Quiet status:
Core Progress: Stable movement
Weekly Window: 12 days remaining
Team Signal: Stable

10) Implementation output
- one main page component
- child components extracted in same file first
- use mock state / static sample data
- polished first prototype, not wireframe
- keep visual continuity with ArenaPlayScreen and ArenaResolveScreen

After generating the first version, refactor the layout into reusable components without changing the visual hierarchy or tone.
```

---

## G. Arena 3장 (잠금)

1. **Lobby** — `/bty-arena/lobby`  
2. **Play** — `/bty-arena/play` (기존 시뮬)  
3. **Resolve** — `/bty-arena/play/resolve` (프로토타입)

**다음 정리**: 공통 `TopBar` / 배경 / `BottomSystemLog` 패턴을 **shared component**로 추출 (Play·Resolve·Lobby 정렬).

---

## H. 추가 Cursor 한 줄

> After generating this version, align spacing, border opacity, and typography scale with `ArenaResolveScreen` and the future `ArenaPlayScreen` premium prototype so all three feel like one continuous simulation flow.
