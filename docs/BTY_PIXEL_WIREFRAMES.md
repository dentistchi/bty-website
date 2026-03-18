# BTY Pixel Wireframes

BTY Arena의 실제 제품 화면을 Figma로 옮기기 위한 텍스트 와이어프레임 스펙입니다.

목표:
- 행동을 먼저 유도한다
- 정보는 최소로 둔다
- 게임 같은 진입감을 유지한다
- 상태는 카드 3개 이내로 단순화한다

권장 Figma 기준:
- Frame: `390 x 844` mobile
- Layout: `Auto layout / vertical`
- Padding: `16~20`
- Spacing: `12~16`
- Component: Button, Card, Progress bar, System message block
- Typography: Title `18~20`, Body `14~16`, Caption `12`

---

## 1. ARENA FIRST SCREEN

### Wireframe

```text
[ TOP NAV ]
-----------------------------------
BTY Arena                     [≡]

-----------------------------------
[ HERO AREA ]

System ready.

[ Continue ]
Resume last simulation

─────────────── or ───────────────

[ Play Game ]
Start new scenario

-----------------------------------
[ SECONDARY INFO ]

Weekly Rank: #128
Season ends in 12 days

-----------------------------------
[ BOTTOM ]

[ Weekly Ranking ]   [ Growth ]   [ My Page ]
```

### UI hierarchy

1. First visual focus: `Play Game`
2. Second visual focus: `Continue`
3. Third visual focus: `Weekly Rank` and `Season ends in 12 days`
4. Persistent bottom entry: `Weekly Ranking / Growth / My Page`

### Microcopy

- `System ready.`
- `Resume last simulation`
- `Start new scenario`
- `Weekly Rank: #128`
- `Season ends in 12 days`

### Rules

- Do not show AIR, TII, LRI, or Certified.
- Do not show complex stats.
- Do not show dashboard-like summaries.
- Keep the first screen click-first, not read-first.

---

## 2. GROWTH MAIN SCREEN

### Wireframe

```text
[ TOP NAV ]
-----------------------------------
Growth                        [≡]

-----------------------------------
[ SECTION TITLE ]

Rebuild your internal state.

-----------------------------------
[ OPTIONS ]

[ Dojo 50 ]
Measure your current state

[ Integrity Mirror ]
See the situation from the other side

[ Guidance ]
Review your decision patterns

[ Reflection ]
Stabilize your internal voice

-----------------------------------
[ FOOTER ]

Return to Arena →
```

### UI hierarchy

1. Section title
2. Four action cards
3. Return link

### Microcopy

- `Rebuild your internal state.`
- `Measure your current state`
- `See the situation from the other side`
- `Review your decision patterns`
- `Stabilize your internal voice`

### Rules

- Max 4 options only.
- Each option gets one sentence only.
- Remove learning/LMS 느낌.
- Treat this as recovery and alignment, not education.

---

## 3. MY PAGE FIRST SCREEN

### Wireframe

```text
[ TOP NAV ]
-----------------------------------
My Page                      [≡]

-----------------------------------
[ IDENTITY CARD ]

Code Name: Builder-07
Stage 3

-----------------------------------
[ PROGRESS CARD ]

Core Progress
[██████░░░░] 60%

Weekly Progress
[████░░░░░░] 40%

-----------------------------------
[ TEAM CARD ]

Team Status: Stable
TII: 0.72

-----------------------------------
[ NAV TABS ]

[ Overview ] [ Progress ] [ Team ] [ Leader ] [ Account ]
```

### UI hierarchy

1. Identity card
2. Progress card
3. Team card
4. Navigation tabs

### Visible vs hidden

Visible:
- Code Name
- Stage
- Core Progress
- Weekly Progress
- Team Status
- TII

Hidden behind tabs:
- AIR raw score
- LRI raw score
- Detailed analytics
- Complex breakdowns

### Rules

- Show only 3 cards on first screen.
- Keep numbers minimal.
- Keep TII visible, but only at team level.

---

## 4. MY PAGE - PROGRESS TAB

### Wireframe

```text
[ HEADER ]
-----------------------------------
Progress

-----------------------------------
[ CORE XP ]

Core XP: 320
Stage 3 → Stage 4

-----------------------------------
[ WEEKLY XP ]

Weekly XP: 140
Current Rank: #128

-----------------------------------
[ STREAK ]

Consistency: 5 days

-----------------------------------
[ SYSTEM MESSAGE ]

System detected stable execution pattern.
```

### Rules

- Keep the tab numeric, but minimal.
- Show progression, not analysis.
- Use one calm system message only.

---

## 5. MY PAGE - TEAM TAB

### Wireframe

```text
[ HEADER ]
-----------------------------------
Team

-----------------------------------
[ TEAM SCORE ]

Team Integrity Score (TII)
0.72

-----------------------------------
[ TEAM STATUS ]

Status: Stable
Trend: Improving

-----------------------------------
[ TEAM RANK ]

Team Rank: #8

-----------------------------------
[ NOTE ]

Team score reflects collective execution quality.
```

### Rules

- Show team-level data only.
- Keep explanation short and professional.
- Avoid personal scores in this tab.

---

## 6. MY PAGE - LEADER TRACK TAB

### Wireframe

```text
[ HEADER ]
-----------------------------------
Leader Track

-----------------------------------
[ STATUS ]

Status: Building

-----------------------------------
[ READINESS ]

Leader Readiness: Near Threshold

-----------------------------------
[ CERTIFIED ]

Certification: Not Yet Qualified

-----------------------------------
[ SYSTEM MESSAGE ]

System detected improving responsibility pattern.
```

### Rules

- Focus on status, not raw numbers.
- Keep the tone observational.
- Do not over-explain certification logic.

---

## 7. ARENA RESULT SCREEN

### Wireframe

```text
[ HEADER ]
-----------------------------------
Simulation Complete

-----------------------------------
[ RESULT ]

+25 Core XP
+15 Weekly XP

-----------------------------------
[ SYSTEM MESSAGE ]

System detected improved decision consistency.

-----------------------------------
[ ACTIONS ]

[ Continue ]
[ Return to Arena ]
```

### Rules

- Keep the result simple.
- Use one system message only.
- Avoid analytics and deep breakdowns.
- Keep the next action obvious.

---

## 8. PRODUCT FLOW SUMMARY

```text
Arena → 행동
Growth → 해석
My Page → 상태
```

### Interpretation

- Arena is for action and simulation.
- Growth is for reflection and recovery.
- My Page is for identity, progress, and team status.

---

## 9. Figma Implementation Notes

- Use vertical auto layout for each screen frame.
- Keep sections visually separated with consistent spacing.
- Prefer cards with simple shadows and strong whitespace.
- Preserve the button order as written.
- Never introduce extra metrics unless the screen specifically asks for them.

---

## 10. Design Principles

- First screen = play first
- Growth = calm and structured
- My Page = clean and professional
- Result = short and action-oriented
- Metrics = system messages whenever possible

---

## 11. React Wireframe Reference

`BTYArenaWireframes`는 위 와이어프레임을 React + Tailwind로 옮긴 **시각 참고용 단일 파일 프로토타입**입니다.

### Component map

- `Screen` — 상단 헤더와 본문을 가진 공통 화면 컨테이너
- `Card` — identity / progress / team / message용 카드
- `PrimaryButton` — 주요 행동 버튼
- `SecondaryButton` — 보조 행동 버튼
- `ProgressBar` — Core XP / Weekly Progress 시각화
- `Tab` — My Page 하단 탭 상태 표시
- `BottomNav` — Arena 하단 내비게이션

### Covered screens

- Arena / First Screen
- Arena / Result Screen
- Growth / Main Screen
- My Page / Overview
- My Page / Progress Tab
- My Page / Team Tab
- My Page / Leader Track Tab

### What this prototype proves

- 첫 화면은 Play가 가장 먼저 보이도록 배치
- Growth는 4개 옵션만 두고 학습 느낌을 줄임
- My Page는 카드 3개 중심으로 단순화
- Progress / Team / Leader Track은 탭으로 분리
- 결과 화면은 숫자보다 시스템 메시지와 다음 행동에 집중

### Implementation note

- 이 컴포넌트는 **Figma 이전 단계의 구조 검증용**이다.
- 실제 제품 화면에서는 locale, data, role, hidden state를 props 또는 API로 분리하면 된다.

