# BTY Arena 비주얼 & 행동 설계 — 서류

**전체 설계 읽는 순서·문서 목록:** `BTY_ARENA_SPEC_INDEX.md`

**목적**: Arena / Foundry / Center 세 공간의 화면 구성, 시각 계층, 챗봇 배치, 인터랙션 플로우를 한 문서로 정리.  
**상태**: 초안 서류화. 구체화 후 구현 계획 수립 예정.  
**관련**: `BTY_ARENA_TECHNICAL_SPEC.md`(데이터·API·라우트·트리거·챗봇 조건), `BTY_ARENA_DESIGN_TOKENS.md`(색상·반응형·i18n), `BTY_ARENA_ERROR_ACCESSIBILITY_MAPPING.md`(에러/빈 상태·접근성·기존 경로 매핑), `CENTER_PAGE_IMPROVEMENT_SPEC.md`, `DESIGN_FIRST_IMPRESSION_BRIEF.md`, `HEALING_COACHING_SPEC_V3.md`

---

## 1. 화면 구성 요약 (블록 단위)

### 1.1 공통 — Top Nav Bar (Slim)

| 요소 | 설명 |
|------|------|
| Season Timer | 시즌 타이머 |
| Weekly Progress Ring | 주간 진행 링 |
| Tier Badge | 티어 배지 |

---

### 1.2 Arena

| 블록 | 구성 | 비고 |
|------|------|------|
| **Hero Card — Today's Simulation** | Title(상황 한 줄), Brief description(24–28px), CTA: **"Start Simulation"** (BIG BUTTON) | 시각 중심·단일 선택 행동 |
| **Weekly Progress Visual** | Progress Ring + % + x/target 라벨 | 시각 완료감 유도 |
| **Team Board** | Rank \| Team Name \| XP — Top 3 | Social proof / 경쟁 참여 |
| **My Contribution** | Icon + %, Progress bar(thin) | 개인 기여 명시 → 자기 효능감 |
| **Simulation 종료 시** | Mentor Insight(1~2줄) + CTA **"Ask Mentor"** → 클릭 시 챗봇 패널 오른쪽 슬라이드 | 챗봇 상시 노출 없음(요청형) |

---

### 1.3 Foundry

| 블록 | 구성 | 비고 |
|------|------|------|
| **Header** | "Your Pattern Summary" | |
| **Decision Replay** | Flow visual(좌), Summary text(우) | 선택 행동 → 시각화 + 설명 = 이해 촉진 |
| **Stats Direction** | ↑ Integrity, → Resilience, ↓ Communication | |
| **Trend Graph — 14d** | Labelled history + mini annotations | |
| **Insights Card Stack** | Card 1: "What you did well", Card 2: "Opportunity", Card 3: "Suggestion" | |
| **챗봇** | 기본 활성 | 분석·통찰 지원 |

---

### 1.4 Center

| 블록 | 구성 | 비고 |
|------|------|------|
| **One Liner** | "You are safe here." | |
| **Safe Mirror** | 1–2줄 reflection 텍스트 입력 | 감정 표현 → 인지 부하 최소·자기 인식 |
| **Small Wins Tile** | Selectable chips + add new | |
| **Self-esteem Indicator** | Single slider (0–100) | |
| **Tiny Recovery Curve** | Live feedback | |
| **챗봇** | 기본 OFF. **Safe Mirror 입력 후만** 활성화 | Reflection 지원 |

---

## 1.5 Artboard 설계 (15 screens)

각 화면은 **행동 유도 → 분석 → 회복**의 공간 구조에 맞춰 배치.

| # | 화면 | 목적 | 구성 요약 |
|---|------|------|-----------|
| **1** | **Arena Home** | 플랫폼 진입 시 기본 실행 화면 | Top Nav (Season Timer / Weekly Ring / Tier), Hero Card (Today's Simulation + Start CTA), Weekly Progress, Team Board (Top 3), My Contribution |
| **2** | **Arena Simulation** | 실제 시뮬레이션 진행 | 시뮬레이션 텍스트/상황, 선택지 2–4개, 타이머(옵션), 내 답변 입력 영역 |
| **3** | **Arena Result** | 시뮬레이션 결과 요약 | 결과 헤드라인, Team/Personal XP 변화, Mentor Insight snippet(1–2줄), CTA: Review in Foundry / Continue Arena |
| **4** | **Foundry Home** | Foundry 공간 진입 | Header (Your Pattern Summary), Recent Decision Replay, Hidden Stats Direction, Trend Graph teaser |
| **5** | **Decision Replay Detail** | 선택 흐름 분석 | 2축 선택 시각화, 선택별 설명, 도출된 리더십 관찰 |
| **6** | **Hidden Stats Insight** | Hidden Stat 방향성 분석 | Stat labels (↑Integrity / →Resilience / ↓Communication), Explanation text cards |
| **7** | **Trend Graph Full** | 14일 패턴 흐름 분석 | 그래프 + mini annotations, 날짜 필터(옵션), 해석 텍스트 |
| **8** | **Foundry Insight Cards** | 심층 인사이트 제공 | Card 1: What you did well, Card 2: Opportunity, Card 3: Suggestion, CTA: Back to Arena / Center Suggestion |
| **9** | **Center Entry** | Center 공간 안내 | One-liner(안정 메시지), Safe Mirror 시작 버튼, Small Wins 시작 버튼 |
| **10** | **Safe Mirror** | 감정 반영 입력 | Reflection input(1–2 sentences), Submit, Optional: "Want verbal reflection?" |
| **11** | **Small Wins Capture** | 작은 성취 기록 | Chip list, Add new win, Encourage message |
| **12** | **Self-esteem Check** | Self-esteem 측정 | Slider(0–100), Mood label text, CTA: Submit & Back to Center |
| **13** | **Center Mini Recovery** | 회복 진행 시각화 | Mini recovery curve, Safe Mirror summary, Suggestion: Return to Arena |
| **14** | **Mentor Chat Panel** | 챗봇(멘토) 대화 공간 | Header: Mentor, Conversation area, Quick suggestion buttons, Input + send |
| **15** | **Settings / Profile** | 사용자 정보/설정 | Profile display (Code Name / Avatar), Season details, UI language switch, Privacy / logout |

---

## 1.6 Flow 연결 예시 (Sequence)

1. **Arena Home**
2. **Simulation** → **Result**
3. **Review in Foundry** → **Foundry Home**
4. **Insight details** → (옵션) **Center Trigger**
5. **Center Entry** → **Safe Mirror** / **Small Wins**
6. **Center Mini Recovery** → **Back to Arena**

---

## 1.7 컴포넌트·폴더 구조

```
/Shared
├ TopNav
├ ProgressRing
├ TeamBoardItem
├ ContributionBar
├ GraphLine
├ Slider
├ ChipTag
├ ButtonPrimary
├ ButtonSecondary
├ ModalSmall

/Arena
├ ArenaHome
│   ├ HeroCard
│   ├ WeeklyProgress
│   ├ TeamBoard
│   └ MyContribution
├ ArenaSimulation
└ ArenaResult

/Foundry
├ FoundryHome
│   ├ DecisionReplay
│   ├ HiddenStats
│   └ TrendGraph
├ DecisionReplayDetail
├ HiddenStatsInsight
├ TrendGraphFull
└ InsightCards

/Center
├ CenterEntry
├ SafeMirror
├ SmallWins
├ SelfEsteemCheck
└ MiniRecovery

/Mentor
├ ChatPanel
├ MessageBubble
├ QuickButtons
└ InputBox

/Settings
├ ProfileCard
├ SeasonInfo
├ LanguageSwitch
└ Logout
```

---

## 1.8 디자인 & 행동 원칙 적용 체크리스트

| 원칙 | 적용 위치 |
|------|-----------|
| **단일 주요 행동** | Arena Hero CTA |
| **진행 시각화** | Weekly Progress / Trend Graph |
| **심리 안정 강조** | Center pages |
| **분석 강화** | Foundry cards & graphs |
| **챗봇 맥락적 개입** | Mentor Chat |
| **사회적 신호** | Team Board |

---

## 2. 설계 원칙

### 2.1 최소 인터랙션

- 감정 상태를 표현하는 요소를 **2–3가지로 제한** → Cognitive Load 최소화.

### 2.2 색감과 호흡

- 부드러운 톤 + **여백 중심** → 시각적 안정성.

### 2.3 챗봇 배치 (공간별)

| 공간 | 챗봇 행동 | 심리 |
|------|-----------|------|
| **Arena** | 종료 후 **요청형** (Ask Mentor 등) | 행동 집중 공간에는 상시 노출 안 함 |
| **Foundry** | **기본 활성** | 분석·통찰 |
| **Center** | **입력 컨텍스트 활성** (Safe Mirror 입력 후) | 인지 부하 저감, 맥락적 유용성 |

---

## 3. 공간별 톤 & 색채 전략

| 공간 | 톤 | 목적 | 색채 |
|------|-----|------|------|
| **Arena** | Energetic, High Contrast | 행동 집중 | Primary: High contrast. Progress: Bright accent. |
| **Foundry** | Neutral, Structured | 분석/통찰 | Primary: Neutral/balanced. Accent: Calm hues. |
| **Center** | Calm, Warm | 정서 안정 | Primary: Warm pastels. Accent: Soft neutrals. |

- **독립 컬러 팔레트**로 각 공간 구분 → 심리적 준비/전환 효과.
- 미적-사용성 효과(Aesthetic–usability): 시각 매력이 직관적 사용성 인식 향상.

---

## 4. 타이포그래피 & 계층

| 용도 | 크기 | 역할 |
|------|------|------|
| H1 | 28–32px | 명확한 핵심 전달 |
| CTA 버튼 | 24–28px | 즉각 행동 촉진 |
| 본문 | 16–18px | 피로도 최소 |
| 미세 라벨/설명 | 12–14px | 보조 정보 |

- H2: 24px (Subheads), Small: 12px (Labels).

---

## 5. 인터랙션 & 애니메이션

- **Progress animation**: 자연스러운 easing.
- **마이크로 인터랙션**: 버튼 클릭/결과 트리거 → 작은 보상 인식이 행동 강화에 기여.
- 버튼 Press → slight scale up.
- ProgressRing → easing fill animation.
- Graph line → fade-in trend points.

---

## 6. UI 구성 & 배치 원칙

- **Scale** (큰 요소 먼저), **Contrast** (색 대비), **Alignment & Whitespace**.
- 이 3가지가 지켜지지 않으면 혼란 가능.

---

## 7. 인터랙션 플로우 (페이지 간)

| 시퀀스 | 흐름 |
|--------|------|
| **Arena → Foundry** | Simulation Start → 종료 → Mentor Insight + "Review in Foundry" → Foundry에서 replay·insights |
| **Foundry → Center** | 위험 점수 높거나 감정 신호 시 → Center 모달("safe" 메시지) 제시 |
| **Center → Arena** | Recover(Small Win / Self-esteem) 후 → CTA "Return to Arena" |

---

## 8. 행동 유지(Retention) 트리거

- **Progressive disclosure**: 단계별 정보 제공. 초반엔 핵심만, 상세는 요청 시 노출.
- Completion feedback loop, Social signals, Micro interaction feedback.

---

## 9. MVP 단계 실험 대상

| # | 요소 | 목적 |
|---|------|------|
| 1 | Arena CTA 컬러 & 위치 | 행동 유도 극대화 |
| 2 | Foundry 인사이트 카드 레이아웃 | 해석 이해도 |
| 3 | Center Safe Mirror 메시지 스타일 | 감정 회복 만족도 |
| 4 | 챗봇 트리거 타이밍 | 도움 빈도 vs 방해 균형 |

---

## 10. 기대 효과

- **인지 부하 감소** → 더 빠른 결정 유도.
- **행동 강화 루프** → 시작 → 진행 → 피드백 반복.
- **심리적 안정성** → 감정 중심 공간 제공.

---

## 11. 컴포넌트·심리 로직 참조표

| 컴포넌트 | UI 요소 | 심리/인사이트 |
|----------|---------|----------------|
| HeroCard | Title, Description, CTA Button | Primary CTA 시각 중심. Cognitive load 최소(단일 선택). |
| ProgressRing | Background circle, Fill circle, Label | Aesthetic–usability, 시각 완료감. |
| LeaderboardItem | Rank, TeamName, XP | Social proof / competition engagement. |
| ContributionBar | Label, ProgressTrack, ProgressFill | 개인 기여 명시 → 자기 효능감. |
| DecisionReplayCard | FlowGraphic, ExplanationText | 선택 행동 → 시각화+텍스트 = 이해 촉진. |
| SafeMirrorInput | Label, InputField | 감정 표현 최소화·자기 인식. |
| SmallWinsTile | ChipIndicator, Label | |
| SelfEsteemSlider | slider 0–100 | |
| MiniRecoveryCurve | tiny progress curve | |

---

## 12. 이후 구체화 시 보완 포인트 (안)

- **데이터·API·라우트·트리거·챗봇**: **`BTY_ARENA_TECHNICAL_SPEC.md`** 에 정의됨.
- **색상·반응형·i18n**: **`BTY_ARENA_DESIGN_TOKENS.md`** 에 정의됨 (CSS 변수 Light/Dark, 15화면 반응형 요약, UI 문자열 ko/en).
- **에러/빈 상태·접근성·기존 경로 매핑**: **`BTY_ARENA_ERROR_ACCESSIBILITY_MAPPING.md`** 에 정의됨.
- **챗봇 패널**: 오른쪽 슬라이드 너비·애니메이션 상세.

---

**문서 위치**: `bty-app/docs/BTY_ARENA_VISUAL_BEHAVIOR_SPEC.md`  
**다음 단계**: 구체화 후 구현 계획(단계별 태스크·담당) 수립.
