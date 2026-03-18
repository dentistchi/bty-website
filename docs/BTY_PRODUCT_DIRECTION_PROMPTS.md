# BTY 제품 방향성 프롬프트 모음

BTY Arena의 제품 방향성, 네비게이션, 첫 화면, Growth, My Page, 시스템 톤을 정리한 복사용 프롬프트 모음입니다.

사용 대상:
- Cursor
- Gemini
- Genspark

권장 사용 순서:
1. 1번 `PRODUCT ARCHITECTURE PROMPT`
2. 2번 `ARENA FIRST SCREEN UI PROMPT`
3. 3번 `GROWTH STRUCTURE PROMPT`
4. 4번 `MY PAGE SIMPLIFICATION PROMPT`
5. 5번 `SYSTEM MESSAGE / TONE PROMPT`

---

## 1. PRODUCT ARCHITECTURE PROMPT

```text
You are a senior product designer and UX architect.

We are building a leadership training system called "BTY Arena".

Core philosophy:
- Users must start with PLAY (game first, not education)
- Growth happens after action, not before
- System must feel like a game, not a dashboard

Your task:
Redesign the product architecture and navigation structure to be:
- Extremely simple
- User-friendly
- Behavior-driven (not information-driven)
- Professional and structured

Constraints:
- Only 3 top-level menus allowed:
  1. Arena (Play)
  2. Growth (Learn & Recover)
  3. My Page (Personal status)

Definitions:
- Arena = simulation gameplay, decision-making under pressure
- Growth = self-reflection, dojo, recovery, coaching
- My Page = progress, identity, leaderboard, account

Important system rules:
- Weekly XP = competition (leaderboard, resets every 30 days)
- Core XP = long-term growth (never resets)
- AIR = personal execution integrity (NOT publicly shown)
- TII = team public score (team-level only)
- LRI = readiness for leadership (hidden unless needed)
- Certified = leadership qualification status

UX principles:
- No dashboards on entry
- First screen must be PLAY
- Hide complexity by default
- Show only what user needs at that moment
- Convert metrics into system messages (not raw numbers)

Your output:
1. Final navigation structure
2. What goes into each menu
3. What must be hidden vs shown
4. First screen (Arena entry screen design)
5. My Page simplified structure (3 layers max)
6. Growth structure (minimal and clear)
7. Clear reasoning for each decision

Avoid:
- Complex dashboards
- Too many metrics on screen
- Mixing personal growth and competition

Think like Duolingo + leadership OS.

Make it clean, structured, and decisive.
```

---

## 2. ARENA FIRST SCREEN UI PROMPT

```text
Design the FIRST screen of BTY Arena.

This screen appears immediately after login.

Goal:
- User must start playing within 3 seconds
- No confusion
- No heavy information
- No dashboard feeling

Requirements:
- Primary CTA: "Play Game"
- Secondary CTA: "Continue"
- Optional: "Weekly Ranking"

Constraints:
- No AIR, TII, LRI, Certified shown
- No complex stats
- No clutter
- Minimal text

Include:
- Layout structure (top, middle, bottom)
- Exact button labels
- 1–2 system messages (BTY tone: calm, professional)

Tone:
- Calm authority
- No hype
- No emotional language

Example tone:
"System ready."
"Continue your Arena."
"2 simulations available."

Output:
- Wireframe (text-based)
- UI hierarchy
- Microcopy
```

---

## 3. GROWTH STRUCTURE PROMPT

```text
Design the Growth section of BTY Arena.

Purpose:
- Not education
- Not content consumption
- It is for reflection, recovery, and internal alignment

Include only essential features:
- Dojo 50 (self-assessment)
- Integrity Mirror
- Guidance (mentor)
- Reflection / Letter

Requirements:
- Simple entry screen (max 4 options)
- Each option must be clearly defined in 1 sentence
- No overwhelming UI
- No long explanations

Important:
- This section should feel calm and structured
- Not like a course or LMS

Output:
1. Growth main screen layout
2. Each feature description (1 line each)
3. When user should enter Growth (trigger logic)
4. What should NOT be shown here
```

---

## 4. MY PAGE SIMPLIFICATION PROMPT

```text
Design "My Page" for BTY Arena.

Goal:
- Clean
- Minimal
- Professional
- Not overwhelming

Constraints:
- Only 3 sections visible on first screen:
  1. Identity
  2. Progress
  3. Team

Details:

Identity:
- Code Name
- Stage

Progress:
- Core XP (simple bar)
- Weekly XP (simple bar)

Team:
- Team summary
- TII (team-level only)

Important rules:
- Do NOT show:
  - AIR raw score
  - LRI raw score
  - Detailed analytics
  - Complex breakdowns

Advanced data must be hidden behind tabs.

Output:
1. First screen layout
2. Hidden layers (tabs)
3. What is visible vs hidden
4. Microcopy (short labels)
```

---

## 5. SYSTEM MESSAGE / TONE PROMPT

```text
Create system messages for BTY Arena.

Tone:
- Calm
- Professional
- Observational (not emotional)
- No praise, no blame
- No gamification hype

Style:
"System detected..."
"Pattern observed..."
"Stability maintained..."

Avoid:
- "Great job!"
- "You failed"
- "Try harder"

Categories:
1. After simulation
2. Integrity risk
3. Progress update
4. Recovery suggestion

Output:
- 20 system messages
- Categorized
- Short and consistent tone
```

---

## 사용 메모

- 이 문서는 **프로젝트 방향성 합의용**입니다.
- 실제 구현 문서가 필요하면 이 프롬프트들을 기준으로 `docs/SPRINT_PLAN.md`, `docs/ROADMAP_Q3_Q4.md`, `docs/BTY_RELEASE_GATE_CHECK.md`에 세부 규칙을 분리해 반영하면 됩니다.
