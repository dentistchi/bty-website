# BTY Arena — Error States · Accessibility · Existing Code Mapping

**목적**: 에러/빈 상태 UX 문구·CTA, 접근성 가이드라인, 기존 앱 경로와 15화면 매핑을 정의.  
**관련**: `BTY_ARENA_VISUAL_BEHAVIOR_SPEC.md`, `BTY_ARENA_TECHNICAL_SPEC.md`, `BTY_ARENA_DESIGN_TOKENS.md`

---

## A) Error / Empty States — UX Text + CTA

| # | 화면 | 상황 | Message (en) | Message (ko) | CTA Primary | CTA Secondary |
|---|------|------|--------------|--------------|--------------|----------------|
| 1 | Arena Home | Weekly Targets 데이터 없음 | No weekly target found. | 주간 목표가 없습니다. | Refresh / 새로고침 | Go to Settings / 설정으로 이동 |
| 2 | Arena Simulation | API Failure | Unable to load simulation. | 시뮬레이션을 불러올 수 없습니다. | Retry / 다시 시도 | — |
| 3 | Arena Result | No Result | No result available. | 결과가 없습니다. | Back to Arena / 아레나로 돌아가기 | — |
| 4 | Foundry Home | Trend/Insight Empty | Nothing to analyze yet. | 분석할 내용이 아직 없습니다. | Go to Arena / 아레나로 이동 | — |
| 5 | Decision Replay Detail | API Error | Could not load replay. | 리플레이를 불러올 수 없습니다. | Retry / 다시 시도 | — |
| 6 | Hidden Stats Insight | Data Missing | Stats unavailable. | 통계 정보를 불러올 수 없습니다. | Back / 뒤로 | — |
| 7 | Trend Graph Full | No Graph Data | Not enough data to show trend. | 추세 데이터를 표시할 수 없습니다. | Back to Foundry / 파운드리로 돌아가기 | — |
| 8 | Foundry Insight Cards | Empty | No insights available. | 인사이트가 없습니다. | Go to Arena / 아레나로 이동 | — |
| 9 | Center Entry | API Failure | Unable to enter safe mode. | 보호 모드로 진입할 수 없습니다. | Retry / 다시 시도 | — |
| 10 | Safe Mirror | Submission Error | Could not save reflection. | 반영을 저장할 수 없습니다. | Try Again / 다시 시도 | — |
| 11 | Small Wins Capture | Empty Chips | No wins added yet. | 작은 성취가 없습니다. | Add Win / 성취 추가 | — |
| 12 | Self-esteem Check | Error | Unable to update mood. | 기분을 업데이트할 수 없습니다. | Retry / 다시 시도 | — |
| 13 | Center Mini Recovery | No Data | No recovery data found. | 회복 데이터를 찾을 수 없습니다. | Go to Arena / 아레나로 이동 | — |
| 14 | Mentor Chat Panel | Chat Load Fail | Unable to load chat. | 채팅을 불러올 수 없습니다. | Retry / 다시 시도 | — |
| 15 | Settings / Profile | Permission Denied | You don't have access. | 접근 권한이 없습니다. | Back / 뒤로 | — |

### i18n 키 제안 (구현 시)

- `error.no_weekly_target`, `error.unable_load_simulation`, `error.no_result`, `error.nothing_to_analyze`, `error.could_not_load_replay`, `error.stats_unavailable`, `error.not_enough_trend_data`, `error.no_insights`, `error.unable_enter_safe_mode`, `error.could_not_save_reflection`, `empty.no_wins_yet`, `error.unable_update_mood`, `error.no_recovery_data`, `error.unable_load_chat`, `error.no_access`
- CTA: `cta.refresh`, `cta.go_to_settings`, `cta.retry`, `cta.back_to_arena`, `cta.go_to_arena`, `cta.back`, `cta.back_to_foundry`, `cta.try_again`, `cta.add_win`

---

## B) Accessibility Guidelines

### 1) WCAG Contrast Minimums

- **Text vs Background**: 4.5 : 1
- **Large Text**: 3 : 1
- **UI Controls (Interactive)**: 3 : 1

### 2) Focus Order / Keyboard

- 모든 화면 **논리적 DOM 순서**:
  1. Skip links
  2. Navigation
  3. Primary CTA
  4. Secondary actions
  5. Informational text
  6. Footer
- **Tab 순서**: 예측 가능 (위→아래, 좌→우)
- **포커스 가능 요소**: `:focus` 스타일 필수

### 3) Screen Reader Labels

- 모든 버튼·입력: `aria-label` 또는 `aria-labelledby`
- **Mentor Chat**: `role="dialog"` `aria-modal="true"`
- 의미 있는 이미지: `alt` 텍스트
- 장식용 비주얼: `aria-hidden="true"`

### 4) Interactive Elements

- **버튼**: 최소 44px × 44px 터치 타겟
- **폼 필드**: `<label>` 연동
- **슬라이더**: `aria-valuemin`, `aria-valuemax`, `aria-valuenow`

---

## C) Existing App Code Mapping

새 15화면과 **기존 앱 경로** 매핑. (실제 앱은 locale prefix 적용 시 `/[locale]/bty-arena` 등 사용.)

### Arena

| 경로 | 화면 |
|------|------|
| `/bty-arena` | Arena Home |
| `/bty-arena/sim` | Arena Simulation |
| `/bty-arena/result` | Arena Result |
| `/bty-arena/board` | Team Board |

### Foundry

| 경로 | 화면 |
|------|------|
| `/bty-arena/foundry` | Foundry Home |
| `/bty-arena/foundry/decision` | Decision Replay Detail |
| `/bty-arena/foundry/stats` | Hidden Stats |
| `/bty-arena/foundry/trend` | Trend Graph |
| `/bty-arena/foundry/insights` | Insight Cards |

### Center

| 경로 | 화면 |
|------|------|
| `/bty-arena/center` | Center Entry |
| `/bty-arena/center/safe-mirror` | Safe Mirror Input |
| `/bty-arena/center/small-wins` | Small Wins Capture |
| `/bty-arena/center/self-esteem` | Self-esteem Check |
| `/bty-arena/center/recovery` | Center Mini Recovery |

### Chat · Settings

| 경로 | 화면 |
|------|------|
| `/bty-arena/chat/mentor` | Mentor Chat Panel |
| `/bty-arena/settings/profile` | Settings / Profile |

*기존 코드베이스의 `/bty-arena`·`/bty` 등과 통합 시 위 경로를 기준으로 라우트·링크를 맞추면 됨.*

---

**문서 위치**: `bty-app/docs/BTY_ARENA_ERROR_ACCESSIBILITY_MAPPING.md`
