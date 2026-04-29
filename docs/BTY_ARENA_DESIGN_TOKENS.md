# BTY Arena — Design Tokens · Responsive · i18n

**목적**: 색상 토큰(Light/Dark), 15화면 반응형 요약, UI 문자열 ko/en 목록을 정의. 디자이너/프론트/백엔드 간 의사소통 표준.  
**관련**: `BTY_ARENA_VISUAL_BEHAVIOR_SPEC.md`, `BTY_ARENA_TECHNICAL_SPEC.md`, `BTY_ARENA_ERROR_ACCESSIBILITY_MAPPING.md`(에러/빈 상태 문구·접근성)

---

## 1. Color Tokens (CSS variables)

### Light mode

```css
:root {
  /* Arena (행동/긴장/경쟁) */
  --arena-primary: #0C2D48;
  --arena-accent: #1E90FF;
  --arena-bg: #F7FAFC;
  --arena-text-primary: #1A202C;
  --arena-text-secondary: #4A5568;

  /* Foundry (분석/통찰/중립) */
  --foundry-primary: #2D3748;
  --foundry-accent: #4C51BF;
  --foundry-bg: #FFFFFF;
  --foundry-text-primary: #2A2E37;
  --foundry-text-secondary: #718096;

  /* Center (보호/회복/친밀) */
  --center-primary: #4A5568;
  --center-accent: #F6AD55;
  --center-bg: #FFF8F0;
  --center-text-primary: #2D3748;
  --center-text-secondary: #718096;

  /* Neutral / Base */
  --text-base: #2D3748;
  --text-light: #718096;
  --bg-base: #FFFFFF;
  --border-base: #E2E8F0;
}
```

### Dark mode

```css
@media (prefers-color-scheme: dark) {
  :root {
    --arena-primary: #A3CEF1;
    --arena-accent: #5AB9EA;
    --arena-bg: #0F172A;
    --arena-text-primary: #E2E8F0;
    --arena-text-secondary: #A0AEC0;

    --foundry-primary: #CBD5E0;
    --foundry-accent: #A3A0FB;
    --foundry-bg: #1A202C;
    --foundry-text-primary: #E2E8F0;
    --foundry-text-secondary: #A0AEC0;

    --center-primary: #CBD5E0;
    --center-accent: #F6AD55;
    --center-bg: #2D3748;
    --center-text-primary: #EDF2F7;
    --center-text-secondary: #A0AEC0;

    --text-base: #EDF2F7;
    --text-light: #A0AEC0;
    --bg-base: #1A202C;
    --border-base: #4A5568;
  }
}
```

---

## 2. Responsive Summary (15 screens)

*All 15 screens: mobile-first, scaling up to tablet/desktop.*

| # | 화면 | Mobile | Tablet+ |
|---|------|--------|---------|
| 1 | **Arena Home** | Hero 상단 → Progress → Team Board → My Contribution | 2열: Hero/Progress 좌, Leaderboard 우 |
| 2 | **Arena Simulation** | 시나리오 텍스트 > 선택지 세로 스택 | 시나리오 좌, 선택 버튼 우 |
| 3 | **Arena Result** | 결과 헤더, 효과 요약, Mentor snippet 접기 가능 | Mentor snippet을 결과와 나란히 |
| 4 | **Foundry Home** | Pattern summary → replay → stats → graph | Stats & graph 2열 그리드 |
| 5 | **Decision Replay Detail** | Flow graphic 전체 폭, 설명 하단 | Flow 좌, 텍스트 우 |
| 6 | **Hidden Stats Insight** | Stats 세로 배치 | 아이콘과 함께 가로 행 |
| 7 | **Trend Graph Full** | 그래프 전체 폭 + 스와이프 | 그래프 + 날짜 슬라이더 좌측 |
| 8 | **Foundry Insight Cards** | 카드 세로 스택 | 카드 그리드 2×2 + 설명 패널 |
| 9 | **Center Entry** | One liner > 버튼 세로 스택 | 버튼 가로 나란히 |
| 10 | **Safe Mirror** | 입력 전체 폭, Submit 하단 고정 | 입력 + 프롬프트 사이드 패널 |
| 11 | **Small Wins Capture** | Chips 세로, "add chip" 하단 | Chips 그리드 3열 |
| 12 | **Self-esteem Check** | Slider 전체 폭 | Slider + 설명 라벨 그리드 |
| 13 | **Center Mini Recovery** | Curve 최소, 텍스트 위 | Curve 좌, 텍스트 우 |
| 14 | **Mentor Chat Panel** | 모달 하단 슬라이드, 입력 하단 고정 | 우측 고정 패널 |
| 15 | **Settings / Profile** | Profile 세로 스택 | 2열 Settings / Profile |

---

## 3. i18n — UI String List (ko / en)

| Key | en | ko |
|-----|----|----|
| `start_simulation` | Start Simulation | 시뮬레이션 시작 |
| `today_scenario` | Today's Scenario | 오늘의 상황 |
| `weekly_progress` | Weekly Progress | 주간 진행 |
| `team_leaderboard` | Team Leaderboard | 팀 리더보드 |
| `my_contribution` | My Contribution | 내 기여도 |
| `mentor_insight` | Mentor Insight | 멘토 코멘트 |
| `retry_simulation` | Retry Simulation | 다시 시뮬레이션 |
| `center_safe_here` | You are safe here. | 이곳은 안전한 공간입니다. |
| `safe_mirror_prompt` | Reflect on how you're feeling. | 지금 느끼는 감정을 적어보세요. |
| `small_wins_title` | Small Wins | 작은 성취 |
| `self_esteem_label` | How do you feel today? | 오늘 기분은 어떠신가요? |
| `submit` | Submit | 제출 |
| `cancel` | Cancel | 취소 |
| `back_to_arena` | Back to Arena | 아레나로 돌아가기 |
| `review_foundry` | Review in Foundry | 파운드리에서 검토하기 |
| `view_trend` | View Trend | 추세 보기 |
| `chat_with_mentor` | Chat with Mentor | 멘토와 대화하기 |

### JSON 형식 (구현 참고)

```json
{
  "start_simulation": { "en": "Start Simulation", "ko": "시뮬레이션 시작" },
  "today_scenario": { "en": "Today's Scenario", "ko": "오늘의 상황" },
  "weekly_progress": { "en": "Weekly Progress", "ko": "주간 진행" },
  "team_leaderboard": { "en": "Team Leaderboard", "ko": "팀 리더보드" },
  "my_contribution": { "en": "My Contribution", "ko": "내 기여도" },
  "mentor_insight": { "en": "Mentor Insight", "ko": "멘토 코멘트" },
  "retry_simulation": { "en": "Retry Simulation", "ko": "다시 시뮬레이션" },
  "center_safe_here": { "en": "You are safe here.", "ko": "이곳은 안전한 공간입니다." },
  "safe_mirror_prompt": { "en": "Reflect on how you're feeling.", "ko": "지금 느끼는 감정을 적어보세요." },
  "small_wins_title": { "en": "Small Wins", "ko": "작은 성취" },
  "self_esteem_label": { "en": "How do you feel today?", "ko": "오늘 기분은 어떠신가요?" },
  "submit": { "en": "Submit", "ko": "제출" },
  "cancel": { "en": "Cancel", "ko": "취소" },
  "back_to_arena": { "en": "Back to Arena", "ko": "아레나로 돌아가기" },
  "review_foundry": { "en": "Review in Foundry", "ko": "파운드리에서 검토하기" },
  "view_trend": { "en": "View Trend", "ko": "추세 보기" },
  "chat_with_mentor": { "en": "Chat with Mentor", "ko": "멘토와 대화하기" }
}
```

---

## 4. Design Judgment Summary

- **화면 구성, 플로우, 원칙, 컴포넌트 구조**가 정의되어 있어 전체적인 디자인/기획 품질은 “좋게 나올 수 있는 상태”.
- **Data / Routes / Trigger / Chatbot 조건**은 `BTY_ARENA_TECHNICAL_SPEC.md`에 정리되어 개발 시 해석 차이를 줄임.
- **Color Tokens + Responsive + i18n**이 이 문서에 추가되어 “어디서 무엇을 보여줄지”, “언제 어떤 UI 반응을 줄지”가 더 명확해짐.
- 이 문서는 **디자이너 / 프론트 / 백엔드 간 의사소통 표준**으로 사용.

---

**문서 위치**: `bty-app/docs/BTY_ARENA_DESIGN_TOKENS.md`  
**Tailwind 매핑**: [Design Token → Tailwind 매핑 규칙](BTY_ARENA_DESIGN_TOKEN_TO_TAILWIND_MAPPING_RULES.md)
