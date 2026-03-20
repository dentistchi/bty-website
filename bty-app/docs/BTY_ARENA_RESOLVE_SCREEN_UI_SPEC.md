# BTY Arena — Result / Resolve Screen UI SPEC **(FINAL LOCKED)**

**용도**: Arena **플레이 직후** 나타나는 Result/Resolve 화면을 잠그는 Cursor 실행용 명세.  
**구현 라우트 (프로토타입)**: `/[locale]/bty-arena/play/resolve` — 컴포넌트 `src/components/bty-arena/ArenaResolveScreen.tsx`.  
**(기존 밝은 톤 스텁)** `/[locale]/bty-arena/result` 는 별도(ScreenShell) 유지.

**선행 문서**: [`BTY_ARENA_PLAY_SCREEN_UI_SPEC.md`](./BTY_ARENA_PLAY_SCREEN_UI_SPEC.md) — **동일 시뮬레이션 톤·TopBar·BottomSystemLog** 연속성 필수.

**관련 원칙**: 1+1 Choice Model, hidden stats 비수치·암시만, 관찰형 톤, Core/Weekly XP 역할 분리 (`.cursor/rules/bty-arena-global.mdc`).

---

## A. 이 화면의 역할 (4가지만)

1. **무슨 선택이 기록됐는지** 보여준다.  
2. **정답/오답이 아니라** 시스템 해석을 남긴다.  
3. **숨은 스탯 변화**는 **숫자 없이 흔적만** 보여준다.  
4. **다음 행동**(다음 시나리오 / Arena 복귀 / Reflection 진입)을 **고르게** 한다.

**정의**: 축하 화면 아님 · 분석 리포트 아님 · **차분한 post-decision chamber**.

---

## B. 플레이 vs Resolve 톤

| | Play | Resolve |
|---|------|---------|
| 에너지 | 긴장 · 선택 · 미세 hover · 노출 전환 | 정지 · 기록 · 약한 pulse · 차분한 해석 |
| 느낌 | 결정 **전** | 결정 **후** 정리 |

같은 다크 프리미엄 톤 유지, Resolve는 **조금 더 정적**.

---

## C. React 컴포넌트 구조 (권장)

```
ArenaResolveScreen
├─ TopBar
├─ ResolveContent
│  ├─ OutcomeVisualPanel
│  └─ ResolvePanel
│     ├─ ResolveHeader
│     ├─ DecisionRecord
│     │  ├─ SealedDecisionCard (Primary)
│     │  └─ SealedDecisionCard (Reinforcement)
│     ├─ SystemInterpretation
│     ├─ HiddenStatAftermath
│     └─ ResolveActions
└─ BottomSystemLog
```

**이유**: Play 화면과 **1:1 대응**, 시스템 연속성, 이후 `TopBar` / `BottomSystemLog` 공유 추출 용이.

---

## D. 상태 설계 (프로토타입)

```ts
const [systemMessage, setSystemMessage] = useState("SYSTEM // Decision cycle complete.");
const [activeStats, setActiveStats] = useState<string[]>([]);
const [showResolveActions, setShowResolveActions] = useState(false);
```

- 초기 로드 후 예: **300ms** 뒤 `activeStats` 점등, **500ms** 뒤 `showResolveActions = true`.  
- 극적 애니메이션·축하 팝 없음.

---

## E. 추천 props 타입

**SealedDecisionCard**

```ts
type SealedDecisionCardProps = {
  label: string;
  title: string;
  subtitle?: string;
  variant: "primary" | "reinforcement";
};
```

**HiddenStatAftermath**

```ts
type HiddenStatAftermathProps = {
  activeStats: string[];
};
```

**ResolveActions**

```ts
type ResolveActionsProps = {
  onContinue?: () => void;
  onReview?: () => void;
  onReturn?: () => void;
};
```

---

## F. 꼭 넣을 디테일

1. **Primary / Reinforcement**는 수정 가능한 버튼처럼 보이지 않게 — **sealed record** 톤.  
2. **Hidden stat**는 “획득”이 아니라 **반응**(softly lit). `+3`, XP, 숫자 금지.  
3. **Reflection**은 **보조** 행동 — Arena 짧은 반복 흐름을 깨지 않게.  
4. **XP 대형 노출 금지** — 이 화면 목적은 경쟁 보상이 아니라 **판단 기록·해석**. Weekly/Core는 My Page·별도 progression 층에서 (`해석`이 보상보다 먼저).

---

## G. Tailwind 방향 (참고 — 구현 시 조정 가능)

- **ResolvePanel**: `rounded-[2rem] border border-white/10 bg-white/[0.05] backdrop-blur-xl shadow-2xl`  
- **SealedDecisionCard**: `rounded-2xl border border-cyan-300/20 bg-cyan-400/8 px-4 py-4`  
- **SystemInterpretation**: `rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-4`  
- **Actions**: primary `bg-[#1E2A38] text-white hover:bg-[#243446]` · secondary `border border-[#D7CFBF] bg-transparent text-[#405A74] hover:bg-[#F6F4EE]/5`

Play 명세와 동일: 딥 네이비·슬레이트·뮤트 시안, **200–300ms**, opacity/translate만, 바운스·대형 스케일 금지.

---

## H. Cursor 최종 프롬프트 (그대로 복사)

```
Create the BTY Arena result / resolve screen that appears immediately after a completed 1+1 decision cycle.

Use Next.js App Router conventions, React, and Tailwind CSS.

Important design intent:
- This is not a reward screen.
- This is not a grading screen.
- This is not a bright success screen.
- This is a calm post-decision chamber.

BTY product context:
- Arena trains decision-making under pressure.
- The 1+1 Choice Model consists of:
  - Primary Decision
  - Reinforcement Decision
- Hidden stats exist internally:
  - Integrity
  - Communication
  - Insight
  - Resilience
  - Gratitude
- Hidden stats should not be shown as numbers here.
- Tone must remain observational, calm, and professional.
- No right/wrong language.
- No green/red moral cues.
- No leaderboard or public competition UI here.

Build the screen with the following structure:

1) ArenaResolveScreen
- Full screen container
- Same dark premium BTY simulation tone as ArenaPlayScreen
- 3 main zones:
  a. TopBar
  b. ResolveContent
  c. BottomSystemLog

2) TopBar
- Reuse same visual language as play screen
- Left: BTY ARENA
- Center: stage label
- Right: level, thin progress bar, codename
- Must feel continuous with play screen, not like a separate app

3) ResolveContent
- Tablet-first centered layout
- Use 2-column structure:
  - Left: OutcomeVisualPanel
  - Right: ResolvePanel

4) OutcomeVisualPanel
- Cinematic static panel
- Dark illustration / scene placeholder
- Small top-left badge: DECISION RECORDED
- Include a subtle "scene stabilized" or "case transition" feel
- No interaction here
- No text-heavy overlays

5) ResolvePanel
- Premium rounded dark glass panel
- Contains:
  a. ResolveHeader
  b. DecisionRecord
  c. SystemInterpretation
  d. HiddenStatAftermath
  e. ResolveActions

6) ResolveHeader
- Small uppercase label: DECISION RECORDED
- Main title:
  "Patient Complaint: Revised Estimate"
- Small case status badge:
  "Post-Decision State"

7) DecisionRecord
- Show the selected Primary Decision
- Show the selected Reinforcement Decision
- They should appear like sealed decisions, not editable controls
- Use premium neutral cards, subtly highlighted
- Suggested labels:
  - PRIMARY DECISION
  - INTENT LOCK-IN

8) SystemInterpretation
- 2 to 3 short lines max
- Tone must be observational and calm
- Example style:
  - "System detected relational stabilization under pressure."
  - "Policy clarity was preserved without direct escalation."
- Do not say correct / incorrect
- Do not score the user explicitly

9) HiddenStatAftermath
- Show only icon row or compact stat capsules
- No numbers
- 1 or 2 stats may appear softly activated
- Add a small subtle section label:
  SIGNAL TRACE
- This must feel like an internal engine response, not a reward system

10) ResolveActions
- 3 calm action buttons / panels:
  a. Continue Arena
  b. Review Reflection
  c. Return to Arena
- "Continue Arena" should be primary
- "Review Reflection" should feel thoughtful, not mandatory
- "Return to Arena" should be secondary / minimal
- No "Claim Reward" or "Victory" language

11) BottomSystemLog
- Single line
- Format:
  SYSTEM // Decision cycle complete.
- Updated calmly
- Fade transition only

12) Interaction behavior
- This screen is mostly stable and calm
- On load:
  - selected decisions already populated
  - hidden stats softly illuminate after a small delay
  - system log updates once
- No dramatic animation
- No celebratory pop

13) Tailwind style rules
- Same palette as ArenaPlayScreen:
  - deep navy
  - slate-black
  - muted cyan accents
- rounded-2xl / rounded-3xl
- soft borders
- backdrop blur
- subtle shadows only
- typography:
  - uppercase tracked micro-labels
  - clean large title
  - readable neutral body
- motion:
  - 200–300ms
  - opacity / translate only
  - no bounce
  - no large scale transitions

14) Provide implementation as:
- one main page component
- child components extracted in same file first
- use mock state / static values
- polished first prototype, not a wireframe

Use sample content:

Stage: STAGE 1: FORGE
Level: LEVEL 21
Codename: STILLWATER
Progress: 63

Scenario title:
Patient Complaint: Revised Estimate

Selected primary decision:
Clarify the updated treatment rationale and rebuild trust first.

Selected reinforcement decision:
Protect long-term relationship stability.

System interpretation:
- System detected relational stabilization under pressure.
- Explanation clarity was prioritized before policy defense.
- Trust recovery path remains open.

Activated hidden stats:
- Communication
- Integrity

Initial bottom log:
SYSTEM // Decision cycle complete.

Action labels:
- Continue Arena
- Review Reflection
- Return to Arena

After generating the first version, keep the visual hierarchy aligned with ArenaPlayScreen so both screens feel like one continuous simulation system.
```

---

## I. 다음 단계 (권장 순서)

1. **Lobby → Play → Resolve** — [`BTY_ARENA_LOBBY_SCREEN_UI_SPEC.md`](./BTY_ARENA_LOBBY_SCREEN_UI_SPEC.md) (`/bty-arena/lobby`).  
2. 공통 TopBar·배경 패턴 shared component 추출.

---

*문서 버전: FINAL LOCKED (Result/Resolve + Play 연속성).*
