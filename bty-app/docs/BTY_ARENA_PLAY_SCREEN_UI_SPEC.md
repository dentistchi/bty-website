# BTY Arena — Play Screen UI SPEC **(FINAL LOCKED)**

**용도**: BTY Arena **첫 인상·플레이 UI**를 잠그는 Cursor 실행용 명세. “예쁜 화면”이 아니라 **제품 철학·구조가 드러나는** 단일 기준 문서.  
**대상 라우트**: `/[locale]/bty-arena/play`

**관련 원칙**: 시즌≠랭킹, Core XP 영구·Weekly XP 주간만 등은 `.cursor/rules/bty-arena-global.mdc` 및 도메인 문서와 정합.

---

## A. BTY 철학 — 이 화면에 반드시 드러나야 할 5가지

1. **Leadership operating console**  
   게임처럼 **보일 수는 있으나** 가벼운 게임 UI가 아니다. BTY는 단순 게임·교육 앱이 아니라 **leadership operating system**으로 정의되고, Arena는 **1+1 choice**(Primary = 전략적 행동, Reinforcement = 의도 고정)로 리더십 성향을 분석하는 **훈련 공간**이다.

2. **판단이 경쟁보다 먼저**  
   이 화면에서는 **경쟁 정보보다 판단 정보**가 먼저 와야 한다. Weekly XP·leaderboard는 **경쟁 엔진**, Core XP·identity는 **성장 엔진** — 한 화면에서 과하게 섞으면 BTY 구조가 흐려진다.

3. **Hidden stats = 존재감만**  
   Integrity, Communication, Insight, Resilience, Gratitude는 내부적으로 반영되나, UI는 **집계형·아이콘 반응**만 — **숫자 노출 금지**가 원칙이다.

4. **톤은 끝까지 관찰형**  
   메시지는 감정적이지 않고, 평가하지 않으며, **차분한 권위**를 유지한다 (프로젝트 방향성 문서와 일치).

5. **압력 속 판단 훈련**  
   “정답 맞히기”가 아니다. **초록/빨강, 정답/오답, 축하 이펙트**는 넣지 않는다.

---

## B. 초안 대비 추가로 잠글 6가지

| # | 항목 | 명세 |
|---|------|------|
| 1 | **Time Pressure Strip** | TopBar **아래** (또는 Bar 내부 하단) **아주 얇은** 진행 라인. **숫자 카운트다운은 과함** — “decision window” **느낌**만. |
| 2 | **Decision Lock State** | 1차 선택 후 나머지 카드는 **흐려짐** — 패배감이 아니라 **sealed / committed** 톤. |
| 3 | **Intent Reveal Motion** | Reinforcement는 **아래에서 튀어나오지 않음**. **opacity + translate-y ~8px** 정도로 **조용히** 등장. |
| 4 | **System Log Priority** | 시스템 목소리는 **BottomSystemLog 하나만** 강하게. **오른쪽 패널 안에 “System Note” 박스 중복 금지** — 밀도·톤 모두 이유 있음. |
| 5 | **Visual Panel Badge Layering** | 시네마틱 카드 위는 **배지 1 + 장면 라벨(태그) 1** 수준만. 텍스트 과다 시 몰입 붕괴. |
| 6 | **Completion Aftermath** | Reinforcement 직후 **정답 피드백 금지** → 순서: **system log 갱신** → **hidden stat 1~2개 pulse** → **~0.8s 후** 다음 CTA(Continue / Resolve 등)만 노출. |

---

## C. 최종 판단 3줄 (꼭 지킬 것)

1. **상단바 = 정체성·진행**, 경쟁 UI 아님  
   Level·progress·codename은 가능. **Leaderboard·weekly rank·season 경쟁 강조**는 플레이 순간에 넣지 않는다. (Weekly / Core 분리 구조 유지.)

2. **오른쪽 패널 = “판단 콘솔”**  
   가벼운 버튼 탭이 아니라 **한 번 고르면 되돌리기 어려운 command selection**에 가깝게. **Primary vs Reinforcement 위계**가 UI에서 분명해야 함 (1+1 모델).

3. **Hidden stats = 흔적**  
   공개 수치화하면 깊이가 얕아짐. **아이콘 pulse 정도**가 상한.

---

## D. Decision Window Strip (추천 디테일)

- **얇은 청록 진행 스트립** 한 줄이면 충분.
- 숫자 countdown은 과하지만, 아무 압력도 없으면 **폼**처럼 느껴짐.
- 무의식적으로 “**지금 판단 중**” 긴장만 주면 됨.

---

## E. 빼는 것 (명시)

- **BottomSystemLog 외** 오른쪽 패널 등 **중복 시스템 피드백 박스** — 넣지 않는다.
- **역할 분리**: BottomSystemLog = 유일한 시스템 목소리 · HiddenStatRow = 무언의 내부 반응 · 선택 카드 = 사용자 행동.

---

## F. 다음 작업 (자연스러운 순서)

1. 본 명세 + 아래 **Cursor 최종 프롬프트**로 **플레이 화면 첫 프로토타입** 구현.  
2. 이어서 **Result / Resolve** — [`BTY_ARENA_RESOLVE_SCREEN_UI_SPEC.md`](./BTY_ARENA_RESOLVE_SCREEN_UI_SPEC.md).  
3. **Lobby** — [`BTY_ARENA_LOBBY_SCREEN_UI_SPEC.md`](./BTY_ARENA_LOBBY_SCREEN_UI_SPEC.md) (`/bty-arena/lobby`).

---

## G. 기술 명세 (기존 §1–13 요약)

아래는 구현 세부가 필요할 때의 **체크리스트**. 상세 문구는 섹션 A–E가 우선이다.

### 1. Screen purpose

- 리더십 시뮬레이션 콘솔. 게임 화면 아님.

### 2. Layout (tablet-first)

- **TopBar** | **MainContent (2열: Visual | Decision)** | **BottomSystemLog**
- TopBar: BTY ARENA · STAGE · LEVEL·진행바·codename. **Leaderboard 없음.**

### 3. Visual panel

- 몰입 전용. 큰 텍스트 오버레이·버튼 없음. 시네마틱.

### 4. Decision panel

- Header · Description · Primary(2–3 카드) · Reinforcement(2, primary 후) · HiddenStatRow(아이콘만).

### 5. Cards

- 버튼 아님. 호버/선택/락 상태는 명세 B 참조.

### 6. Interaction flow

- 읽기 → Primary 선택(즉시 락) → Reinforcement 등장 → 선택 → 짧은 지연 → 로그·스탯 반응 → CTA (§B-6).

### 7. System feedback

- 형식: `SYSTEM // {statement}`. 관찰형만. 하단 로그 **단일 채널**.

### 8. Hidden stats

- 5개 이름은 내부 의미일 뿐, UI는 아이콘 + 제한적 pulse. 숫자·라벨 과다 노출 금지.

### 9. Progress 표시

- Level·막대·Stage만. **Core/Weekly XP 수치·랭킹은 이 화면에 강조하지 않음.**

### 10–13. Color / Motion / Copy / Non-negotiables

- 딥 네이비·차분한 시안 악센트. 200–400ms, 바운스·콘페티 금지. “Great job / Correct / Wrong” 금지. 정답 시각화·초록빨강 정답 암시 금지.

---

## H. Cursor 최종 프롬프트 (그대로 복사)

```
Create the main BTY Arena scenario play screen as a premium tablet-first React UI using Next.js App Router conventions and Tailwind CSS.

This is not a casual game screen.
This is a leadership simulation console.

Core product intent:
- BTY Arena is a leadership operating system, not a playful game UI.
- This screen trains decision-making under pressure.
- The user should feel calm tension, not excitement.
- The UI must feel premium, cinematic, controlled, and professional.
- No obvious right/wrong feedback.
- No green/red morality cues.
- No leaderboard, rank, or noisy XP emphasis on this screen.

Design language:
- Calm authority
- Structured growth
- Controlled pressure
- Observational system tone
- Premium dark simulation environment

The simulation follows the BTY 1+1 Choice Model:
- Primary Decision = strategic action
- Reinforcement Decision = intent lock-in
This structure must be clearly felt in the UI.

Build the screen with the following component structure:

1) ArenaPlayScreen
- Full-screen container
- Deep navy / slate-black background
- Tablet-first layout
- 3 major zones:
  a. TopBar
  b. MainContent
  c. BottomSystemLog

2) TopBar
- Compact premium bar
- Left: BTY ARENA wordmark
- Center: Stage label
- Right:
  - Level label
  - thin progress bar
  - codename in muted uppercase
- Include an ultra-thin "Decision Window" strip beneath or inside the bar
- Do NOT include leaderboard, ranking, or public competition elements here

3) MainContent
- 2-column tablet-first layout
- Left = VisualPanel
- Right = DecisionPanel
- Spacious gap
- Max width should feel like a simulation console, not a website card layout

4) VisualPanel
- Large cinematic card
- Rounded-3xl
- Subtle border and layered dark glass
- Placeholder scene illustration area
- Include only:
  - small scenario badge
  - optional scene state tag
- No large text overlays
- No buttons
- This panel is for immersion only

5) DecisionPanel
- Rounded dark glass panel
- Contains:
  a. ScenarioHeader
  b. ScenarioDescription
  c. PrimaryDecisionGroup
  d. ReinforcementDecisionGroup
  e. HiddenStatRow
- Internal spacing should feel deliberate and breathable

6) ScenarioHeader
- Small label: SCENARIO ACTIVE
- One-line scenario title
- Small difficulty badge
- Add one subtle case-type tag if useful (e.g. PATIENT TRUST / OPERATIONAL ALIGNMENT)

7) ScenarioDescription
- 2 to 3 short operational sentences
- Fast to scan
- Realistic and professional
- Should sound like a real office leadership issue, not fiction writing

8) PrimaryDecisionGroup
- 3 clickable decision cards
- Not standard buttons
- Each card includes:
  - A/B/C marker
  - main decision line
  - optional small subtext
- Neutral by default
- On hover:
  - subtle lift
  - subtle border emphasis
- On selected:
  - stronger border
  - soft cyan glow
  - locked/committed tone
- Other cards become subdued after selection
- Do not visually imply correct/incorrect

9) ReinforcementDecisionGroup
- Hidden until primary decision is selected
- Reveal with soft opacity + slight upward transition
- Section label: INTENT LOCK-IN
- 2 reinforcement decision cards
- Slightly smaller than primary cards
- Same styling language
- This section should feel like "why you are doing it," not a second quiz

10) HiddenStatRow
- Small icon or monogram row
- Hidden stats:
  - Integrity
  - Communication
  - Insight
  - Resilience
  - Gratitude
- Icons only, no numbers
- No labels unless tooltip/title
- After reinforcement selection, 1 or 2 icons may pulse softly
- Keep it restrained and premium

11) BottomSystemLog
- Anchored bottom bar
- Thin, wide, premium system strip
- One line only
- Format:
  SYSTEM // Awaiting decision input.
- Updated messages must remain observational
- No praise, no blame, no "correct choice" energy
- Use subtle fade transition only

12) Interaction flow
Initial:
- Primary decisions visible
- Reinforcement hidden
- System log says waiting

After primary selection:
- Selected primary card locks
- Other primary cards dim
- Reinforcement group appears
- System log updates to:
  SYSTEM // Primary decision locked.

After reinforcement selection:
- Reinforcement locks
- Hidden stat icons pulse softly
- System log updates to a calm observational message
- No celebratory effects
- Optionally reveal a subtle "Continue" or "Resolve" CTA after a short delay

13) Tailwind style rules
- Deep navy / slate / muted cyan palette
- Rounded-2xl / rounded-3xl
- Soft border, opacity, backdrop-blur
- No flashy gradients
- No cartoon contrast
- Typography:
  - labels: uppercase, tracked
  - title: clean, controlled, modern
  - body: readable neutral tone
- Motion:
  - 200–300ms
  - no bounce
  - no big scaling
  - no confetti / reward energy

14) State model
Use simple mock state with useState:
- selectedPrimary
- selectedReinforcement
- systemMessage
- activeStats
- allow a "decisionCommitted" or "showResolveAction" boolean if needed

15) Implementation output
- One main page component first
- Child components extracted within same file for initial speed
- Use sample content below
- Make it feel polished enough to review immediately
- This is a refined first prototype, not a wireframe

Sample content:
Stage: STAGE 1: FORGE
Level: LEVEL 21
Codename: STILLWATER
Scenario title: Patient Complaint: Revised Estimate
Difficulty: Moderate
Case tag: PATIENT TRUST

Scenario description:
"The patient believes the final estimate is higher than previously explained. Front desk and clinical explanations are not aligned. You need to respond before trust drops further."

Primary decisions:
A. Clarify the updated treatment rationale and rebuild trust first.
B. Re-anchor the conversation in office policy and fee structure.
C. De-escalate the emotion first and schedule a focused follow-up.

Primary subtexts:
A. Restore explanation before policy enforcement.
B. Protect process consistency under pressure.
C. Reduce emotional heat before detailed correction.

Reinforcement decisions:
X. Protect long-term relationship stability.
Y. Protect immediate operational consistency.

Initial system log:
SYSTEM // Awaiting decision input.

Follow-up system messages:
- SYSTEM // Primary decision locked.
- SYSTEM // Relational stability prioritized.
- SYSTEM // Operational consistency preserved under tension.

After generating the first version, refactor the UI into reusable child components without changing the visual hierarchy or tone.
```

---

*문서 버전: FINAL LOCKED (철학 5 + 추가 6 + Cursor 프롬프트 통합).*
