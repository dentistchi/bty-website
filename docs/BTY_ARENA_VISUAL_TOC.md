# BTY Arena – Visual 설계 Table of Contents

## 딥링크용 앵커 (Anchor)

인덱스·Figma·외부 문서에서 **화면별로 바로 이동**할 때 아래 앵커를 사용하세요.

**형식**: `BTY_ARENA_VISUAL_TOC.md#앵커명` (또는 문서 URL + `#앵커명`)

| 앵커명 | 화면 |
|--------|------|
| `#overview` | OVERVIEW |
| `#arena-home` | 1. Arena Home |
| `#arena-simulation` | 2. Arena Simulation |
| `#arena-result` | 3. Arena Result |
| `#team-board` | 4. Team Board |
| `#foundry-home` | 5. Foundry Home |
| `#decision-replay-detail` | 6. Decision Replay Detail |
| `#hidden-stats-insight` | 7. Hidden Stats Insight |
| `#trend-graph-full` | 8. Trend Graph Full |
| `#foundry-insight-cards` | 9. Foundry Insight Cards |
| `#center-entry` | 10. Center Entry |
| `#safe-mirror` | 11. Safe Mirror |
| `#small-wins-capture` | 12. Small Wins Capture |
| `#self-esteem-check` | 13. Self-esteem Check |
| `#center-mini-recovery` | 14. Center Mini Recovery |
| `#mentor-chat-panel` | 15. Mentor Chat Panel |
| `#settings--profile` | Settings / Profile |
| `#screenflow-diagram` | SCREENFLOW DIAGRAM |

### Figma Frame ID Mapping (선택)

Figma에서 화면 프레임과 문서 앵커를 연결할 때 아래 형식을 사용할 수 있습니다.

**형식**: `#앵커명@frameId`  
- 예: `#arena-home@0:12345` (Figma node ID 또는 팀 약속 ID)  
- 문서 내 링크는 기존대로 `#arena-home`. 외부(Figma, 이슈)에서만 `@frameId` 부가.

#### Figma Frame ID 채우기 절차

BTY Arena의 15개 화면은 Figma에서 각기 하나의 **Frame**으로 구성되어야 합니다.  
이후 아래 절차로 각 화면의 **Figma Frame ID**를 문서에 채워 넣습니다.

**절차**

1. **Figma에서 각 화면을 Frame으로 생성합니다.**  
   - 이름은 TOC의 항목 이름과 일치시키세요.  
   - 예: Arena Home, Arena Simulation, Foundry Home, Center Entry, Settings / Profile 등.

2. **Figma에서 해당 Frame을 선택한 후**  
   → 오른쪽 **Inspect** 패널에서 **Frame ID**를 복사합니다.  
   - (노드 ID는 보통 `0:12345` 형태로 표시됩니다.)

3. **BTY_ARENA_VISUAL_TOC.md**의 **해당 섹션 헤더 오른쪽**에 붙여 넣습니다.  
   - (아래 표의 "Figma Frame ID" 열에도 동일 ID를 입력하면, 한 곳에서 전체 매핑을 볼 수 있습니다.)

**예시**

| 단계 | 내용 |
|------|------|
| Frame 이름 | Arena Home |
| Inspect에서 복사한 ID | `0:1234` |
| 섹션 헤더 반영 | `## … 1. Arena Home · Figma: \`0:1234\`` 로 수정 |

---

#### 2) Figma Frame ID는 무엇을 의미하는가?

- 각 Frame에 대한 **고유 식별자(ID)** 입니다.
- Notion / Docs / Storyboard / 개발 의사소통에서  
  해당 화면을 **프레임 단위로 직접 참조**할 때 쓸 수 있습니다.

---

#### 3) 각 Frame ID 반영 시 주의점

- **동일한 ID가 중복으로 들어가지 않도록** 합니다.  
  (Figma에서는 Frame마다 고유 ID가 부여됩니다.)
- **프레임 이름**과 **TOC의 앵커 제목**은 반드시 일치시킵니다.  
  예: Frame 이름 "Arena Home" ↔ TOC "1. Arena Home"  
  *(Figma에서 Layer/Domain/ScreenName/State 경로를 쓰는 경우:* `BTY_ARENA_FIGMA_NAMING_GUIDE.md` §1·§2 참고. TOC 화면명 "Arena Home" ↔ ScreenName `ArenaHome`, 전체 경로 `App/Arena/ArenaHome` 등.)
- Frame ID는 **UI 설계 / 프로토타입 공유 / 개발 링크**로도 활용됩니다.
- **Frame·컴포넌트 네이밍**: [Figma 네이밍 규칙 & 컴포넌트 네임라인 가이드](BTY_ARENA_FIGMA_NAMING_GUIDE.md) 참고.

#### 4) 예시 샘플 템플릿 (아래 형식으로 15개 모두 채워 넣습니다)

| 앵커명 | 화면 | Figma Frame ID |
|--------|------|----------------|
| `#arena-home` | 1. Arena Home | *(TBD)* |
| `#arena-simulation` | 2. Arena Simulation | *(TBD)* |
| `#arena-result` | 3. Arena Result | *(TBD)* |
| `#team-board` | 4. Team Board | *(TBD)* |
| `#foundry-home` | 5. Foundry Home | *(TBD)* |
| `#decision-replay-detail` | 6. Decision Replay Detail | *(TBD)* |
| `#hidden-stats-insight` | 7. Hidden Stats Insight | *(TBD)* |
| `#trend-graph-full` | 8. Trend Graph Full | *(TBD)* |
| `#foundry-insight-cards` | 9. Foundry Insight Cards | *(TBD)* |
| `#center-entry` | 10. Center Entry | *(TBD)* |
| `#safe-mirror` | 11. Safe Mirror | *(TBD)* |
| `#small-wins-capture` | 12. Small Wins Capture | *(TBD)* |
| `#self-esteem-check` | 13. Self-esteem Check | *(TBD)* |
| `#center-mini-recovery` | 14. Center Mini Recovery | *(TBD)* |
| `#mentor-chat-panel` | 15. Mentor Chat Panel | *(TBD)* |
| `#settings--profile` | Settings / Profile | *(TBD)* |

---

#### 5) 이후 작업 과정

- Figma Frame ID가 모두 채워지면  
  → **각 화면마다 직접 Link로 이동하는 TOC**가 완성됩니다.  
  → **외부 협업자**도 클릭 한 번으로 해당 화면(문서 앵커 + Figma 참조)으로 접근할 수 있습니다.

---

## <a id="overview"></a>OVERVIEW

BTY Arena는 아래 화면 흐름을 기준으로 동작합니다.

1) [Arena Home](#arena-home)  
2) [Arena Simulation](#arena-simulation)  
3) [Arena Result](#arena-result)  
4) [Team Board](#team-board)  
5) [Foundry Home](#foundry-home)  
6) [Decision Replay Detail](#decision-replay-detail)  
7) [Hidden Stats Insight](#hidden-stats-insight)  
8) [Trend Graph Full](#trend-graph-full)  
9) [Foundry Insight Cards](#foundry-insight-cards)  
10) [Center Entry](#center-entry)  
11) [Safe Mirror](#safe-mirror)  
12) [Small Wins Capture](#small-wins-capture)  
13) [Self-esteem Check](#self-esteem-check)  
14) [Center Mini Recovery](#center-mini-recovery)  
15) [Mentor Chat Panel](#mentor-chat-panel)  
(추가: [Settings / Profile](#settings--profile))

---

## <a id="arena-home"></a>1. Arena Home · Figma: `(TBD)`

**경로**: `/bty-arena`  
**목표**: 리더가 플랫폼 기본 상태에서 수행할 행동을 '바로' 선택하게 함  

**주요 컴포넌트**
- Top Nav (Season Timer / Weekly Progress Ring / Tier Badge)
- Hero Card (오늘 시뮬레이션 텍스트 + Start 버튼)
- Weekly Progress
- Team Board Top 3
- My Contribution

**상태**: 로딩 / 정상 / 데이터 없음 / API 실패  

**트리거 / 네비**
- Start Simulation → [Arena Simulation](#arena-simulation)
- Team Board Open → [Team Board](#team-board)

---

## <a id="arena-simulation"></a>2. Arena Simulation · Figma: `(TBD)`

**경로**: `/bty-arena/sim`  
**목표**: 하나의 시뮬레이션 시나리오 선택 수행  

**컴포넌트**
- 시뮬레이션 텍스트
- 선택 목록(버튼)
- 선택 토글 / 선택 결과 애니

**상태**: 로딩 / 시나리오 없음 / API 실패  

**트리거 / 네비**
- 선택 완료 → [Arena Result](#arena-result)

---

## <a id="arena-result"></a>3. Arena Result · Figma: `(TBD)`

**경로**: `/bty-arena/result`  
**목표**: 시뮬레이션 결과 요약 + 행동 피드백  

**컴포넌트**
- 결과 헤드라인
- XP 변화 요약
- Mentor Insight snippet
- Back to Arena / Review in Foundry CTA

**상태**: 로딩 / 결과 없음 / API 실패  

**트리거 / 네비**
- Review in Foundry → [Foundry Home](#foundry-home)
- Back to Arena → [Arena Home](#arena-home)

---

## <a id="team-board"></a>4. Team Board · Figma: `(TBD)`

**경로**: `/bty-arena/board`  
**목표**: 팀 리더보드 확인  

**컴포넌트**
- 순위 리스트
- 팀명 / 기여도 / XP

**상태**: 로딩 / 데이터 없음 / API 실패  

**트리거 / 네비**
- 팀 선택 → 팀 상세 (추후 확장)

---

## <a id="foundry-home"></a>5. Foundry Home · Figma: `(TBD)`

**경로**: `/bty-arena/foundry`  
**목표**: 행동 분석 & 인사이트 Space  

**컴포넌트**
- Header: Your Pattern Summary
- Recent Decision Replay
- Hidden Stats Direction
- Trend Graph teaser

**상태**: 로딩 / 데이터 없음 / API 실패  

**트리거 / 네비**
- Replay Detail → [Decision Replay Detail](#decision-replay-detail)
- Stats Detail → [Hidden Stats Insight](#hidden-stats-insight)
- Trend Detail → [Trend Graph Full](#trend-graph-full)
- Insight Cards → [Foundry Insight Cards](#foundry-insight-cards)
- Option: Suggest Center → [Center Entry](#center-entry)

---

## <a id="decision-replay-detail"></a>6. Decision Replay Detail · Figma: `(TBD)`

**경로**: `/bty-arena/foundry/decision`  
**목표**: 선택 이력 흐름을 시각화  

**컴포넌트**
- 2축 플로우 그래픽
- 선택별 텍스트 설명

**상태**: 로딩 / 데이터 없음 / API 실패  

**트리거 / 네비**
- Back to Foundry → [Foundry Home](#foundry-home)

---

## <a id="hidden-stats-insight"></a>7. Hidden Stats Insight · Figma: `(TBD)`

**경로**: `/bty-arena/foundry/stats`  
**목표**: Hidden Stats 방향성 + 텍스트 인사이트  

**컴포넌트**
- Stats Item(↑Integrity, →Resilience, ↓Communication)
- 설명 카드

**상태**: 로딩 / 데이터 없음 / API 오류  

**트리거 / 네비**
- Back to Foundry → [Foundry Home](#foundry-home)

---

## <a id="trend-graph-full"></a>8. Trend Graph Full · Figma: `(TBD)`

**경로**: `/bty-arena/foundry/trend`  
**목표**: 14일 트렌드 상세 보기  

**컴포넌트**
- Graph (변동/추세라인)
- 날짜 필터(옵션)

**상태**: 로딩 / 부족 데이터 / API 실패  

**트리거 / 네비**
- Back to Foundry → [Foundry Home](#foundry-home)

---

## <a id="foundry-insight-cards"></a>9. Foundry Insight Cards · Figma: `(TBD)`

**경로**: `/bty-arena/foundry/insights`  
**목표**: 인사이트 카드 스택  

**컴포넌트**
- Card 1: 긍정/성공 관찰
- Card 2: 개선 기회
- Card 3: 제안/다음 액션
- CTA: Arena / Center

**상태**: 로딩 / 인사이트 없음 / 오류  

**트리거 / 네비**
- Back to Foundry → [Foundry Home](#foundry-home)
- Go to Arena → [Arena Home](#arena-home)
- Suggest Center → [Center Entry](#center-entry)

---

## <a id="center-entry"></a>10. Center Entry · Figma: `(TBD)`

**경로**: `/bty-arena/center`  
**목표**: 안전/회복 모드 시작  

**컴포넌트**
- One Liner (e.g., "You are safe here.")
- Buttons: Safe Mirror / Small Wins

**상태**: 로딩 / 에러  

**트리거 / 네비**
- Safe Mirror → [Safe Mirror](#safe-mirror)
- Small Wins → [Small Wins Capture](#small-wins-capture)

---

## <a id="safe-mirror"></a>11. Safe Mirror · Figma: `(TBD)`

**경로**: `/bty-arena/center/safe-mirror`  
**목표**: 자기 감정 반영 입력  

**컴포넌트**
- Multi-line Input
- Submit

**상태**: 입력 제한 / API 실패  

**트리거 / 네비**
- Submit → [Center Mini Recovery](#center-mini-recovery) / Mentor Chat Option

---

## <a id="small-wins-capture"></a>12. Small Wins Capture · Figma: `(TBD)`

**경로**: `/bty-arena/center/small-wins`  
**목표**: 작은 성취 기록  

**컴포넌트**
- Chip List
- Add Chip

**상태**: Chip empty / API error  

**트리거 / 네비**
- Add → [Center Mini Recovery](#center-mini-recovery)

---

## <a id="self-esteem-check"></a>13. Self-esteem Check · Figma: `(TBD)`

**경로**: `/bty-arena/center/self-esteem`  
**목표**: Self-esteem 슬라이더 입력  

**컴포넌트**
- Slider
- Label
- Submit

**상태**: 입력 오류 / API error  

**트리거 / 네비**
- Submit → [Center Mini Recovery](#center-mini-recovery)

---

## <a id="center-mini-recovery"></a>14. Center Mini Recovery · Figma: `(TBD)`

**경로**: `/bty-arena/center/recovery`  
**목표**: 회복/작은 그래프 + CTA  

**컴포넌트**
- Mini Recovery Curve
- Summary Text
- CTA: Back to Arena

**상태**: 그래프 부족 / API error  

**트리거 / 네비**
- Back to Arena → [Arena Home](#arena-home)

---

## <a id="mentor-chat-panel"></a>15. Mentor Chat Panel · Figma: `(TBD)`

**경로**: `/bty-arena/chat/mentor`  
**목표**: 챗봇 기반 멘토 대화  

**컴포넌트**
- Message History
- Message Input
- Quick Buttons

**상태**: Chat load fail  

**트리거 / 네비**
- Close / Retry

---

## <a id="settings--profile"></a>Settings / Profile · Figma: `(TBD)`

**경로**: `/bty-arena/settings/profile`  
**목표**: 사용자 정보/설정  

**컴포넌트**
- Profile Card
- Language/i18n Switch
- Logout

**상태**: Permission Denied / API error  

**트리거 / 네비**
- Back

---

## <a id="screenflow-diagram"></a>SCREENFLOW DIAGRAM (Logical Overview)

```
[Arena Home] ──Start Sim──► [Arena Simulation] ──선택 완료──► [Arena Result]
     │                              │                              │
     │ Team Board                   │                              ├── Review in Foundry ──► [Foundry Home]
     ▼                              │                              └── Back to Arena ──────► [Arena Home]
[Team Board]                        │                                        │
     │                              │                    ┌───────────────────┼───────────────────┐
     │                              │                    ▼                   ▼                   ▼
     │                    [Decision Replay]    [Hidden Stats]      [Trend Graph]    [Insight Cards]
     │                              │                    │                   │                   │
     │                              └────────────────────┴───────────────────┴── Suggest Center ──► [Center Entry]
     │                                                                                   │
     │                                                                     ┌─────────────┴─────────────┐
     │                                                                     ▼                           ▼
     │                                                           [Safe Mirror]              [Small Wins Capture]
     │                                                                     │                           │
     │                                                                     └───────────┬───────────────┘
     │                                                                                 │
     │                                                                     [Self-esteem Check]
     │                                                                                 │
     │                                                                                 ▼
     │                                                                     [Center Mini Recovery] ──Back to Arena──► [Arena Home]
     │
     └──────────────────────────────────────────────────────────────────── [Mentor Chat Panel] (Arena Result / Safe Mirror 등에서 진입)
     │
     └──────────────────────────────────────────────────────────────────── [Settings / Profile]
```

*Figma 등에 붙여 넣을 때는 위 블록명을 프레임/화면명과 1:1로 맞추면 됩니다.*

---

**문서 위치**: `bty-app/docs/BTY_ARENA_VISUAL_TOC.md`  
**상세 설계**: `BTY_ARENA_VISUAL_BEHAVIOR_SPEC.md`  
**확장 문서**: [Figma Frame ID](#딥링크용-앵커-anchor) (본문 표) · [Figma 네이밍·컴포넌트 가이드](BTY_ARENA_FIGMA_NAMING_GUIDE.md) · [Figma → Code 매핑 (React/Tailwind)](BTY_ARENA_FIGMA_CODE_MAPPING.md) · API→화면 매핑: `BTY_ARENA_TECHNICAL_SPEC.md` §7 · [Storyboard & Interaction Flow](BTY_ARENA_STORYBOARD_INTERACTION_FLOW.md)
