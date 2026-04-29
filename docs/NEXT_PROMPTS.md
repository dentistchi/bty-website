# 다음에 진행할 내용 — 복사용 프롬프트

아래 프롬프트를 **그대로 복사**해서 진행 에이전트에게 붙여 넣어 지시하면 됩니다.  
상세는 `docs/PROJECT_BACKLOG.md`, `docs/ARENA_UI_REDESIGN_BRIEF.md`, `docs/SCENARIO_UNLOCK_VERIFICATION.md` 참고.  
**작업 반영 시** 해당 항목을 `[x]` 로 체크해 두세요.

---

## 다음 작업 진행 방식 (같은 방식 유지)

1. **`docs/CURRENT_TASK.md`** 또는 **§4 한 줄 지시 표**에서 **아직 [ ] 인 항목** 하나를 고른다.
2. **이 문서(NEXT_PROMPTS.md)** 에서 해당 항목의 **§1~§3 전체 프롬프트 블록**을 복사한다.
3. 진행 에이전트에게 **그 블록을 붙여 넣어** 지시한다.
4. 완료되면 **이 문서 + PROJECT_BACKLOG(해당 §) + CURRENT_TASK 한 줄 지시 표**에서 해당 행을 **[x]** 로 바꾼다.
5. 다음 [ ] 항목으로 1~4를 반복한다.

(한 줄만 쓸 때는 CURRENT_TASK 표의 지시 문장만 복사해 붙여 넣어도 됨.)

---

## 1. 백로그 — 기능

### 1-1. 대시보드 Arena Level MVP 후 숨기기

| 상태 | [x] |

```
PROJECT_BACKLOG §2 적용해줘. 대시보드에 Arena Level(S1~L4) 카드를 MVP에서는 보이게, MVP 이후에는 숨길 수 있게 해줘.

- 환경 변수 또는 플래그(예: NEXT_PUBLIC_SHOW_ARENA_LEVELS=true|false)로 제어.
- 수정: src/app/[locale]/bty/(protected)/dashboard/page.client.tsx — Arena Level 카드 렌더 조건에 플래그 추가.
- 플래그 off면 카드 미노출, on이면 기존처럼 노출.
```

### 1-2. Partner 시나리오 S1~L4 노출 (기초만 나오는 문제 해결)

| 상태 | [x] |

```
PROJECT_BACKLOG §3 적용해줘. Partner(리더 트랙)인데 시나리오가 기초만 나오는 문제를 해결해줘.

- 점검: arena_membership_requests.job_function, leader_started_at, getEffectiveTrack→leader, getUnlockedContentWindow, new joiner 30일.
- 수정: src/app/api/arena/unlocked-scenarios/route.ts, 필요 시 program.ts·unlock.ts.
- 완료 기준: Partner 로그인 시 S1~S3 + L1~L4(또는 tenure/L4 권한에 맞는 범위) 시나리오 노출.
- 검증: docs/SCENARIO_UNLOCK_VERIFICATION.md 체크리스트 순서대로 확인.
```

### 1-3. 엘리트 5% 정책 정리 (주간 vs 시즌, 특혜)

| 상태 | [x] |

```
PROJECT_BACKLOG §4 적용해줘. 주간 5%를 보여주기만 할지 특혜를 줄지, 시즌 5% 정의·주간/시즌 혜택 분리·아이템 교환 가능 여부를 정리해줘.

- 참고: docs/PHASE_4_ELITE_5_PERCENT_SPEC.md §6.
- 산출물: 1페이지 정책 요약 또는 스펙 §6 보강.
```

### 1-4. 엘리트 5% 특혜 아이디어 선정

| 상태 | [x] |

```
PROJECT_BACKLOG §5 적용해줘. 시즌/주간 5% 엘리트 특혜 후보(멘토 대화 신청, 서클 모임, 특별 트레이닝, 배지, 해금 콘텐츠, 멘토 배지 확장) 중 1~2차 구현할 항목을 선정하고 한 줄 스펙으로 정리해줘.

- 참고: docs/PHASE_4_ELITE_5_PERCENT_SPEC.md §7.
```

---

## 2. 시나리오 노출 검증

| 상태 | [x] |

```
docs/SCENARIO_UNLOCK_VERIFICATION.md 체크리스트를 순서대로 확인해줘. 비가입/미승인→levels 빈 배열, 승인 후 track·maxUnlockedLevel·levels 채워지는지, Staff/Leader/L4, UI 대시보드 Arena Level 카드 노출이 맞는지 검증하고, 빠진 항목이나 버그 있으면 수정해줘.
```

---

## 3. Arena UI 리디자인 (트레이닝장·포근한 대화 느낌)

전체 프롬프트는 `docs/ARENA_UI_REDESIGN_BRIEF.md` §4 참고. 적용 순서: **C → B → D 또는 E → (필요 시) A**.

### 3-1. 색·테마만 (C)

| 상태 | [x] |

```
bty-app의 globals.css에 Arena 전용 테마를 추가해줘. 변수: --arena-bg, --arena-card, --arena-accent, --arena-text, --arena-text-soft (크림·연보라·dojo-purple 활용). body[data-theme="arena"] 또는 .bty-arena-area로 배경 그라데이션(크림→연한 보라)과 본문 색 적용. bty/(protected)/layout.tsx에서 이 테마가 적용되도록 data-theme 또는 클래스를 붙여줘.
```

### 3-2. 대시보드만 (B)

| 상태 | [x] |

```
bty-app의 대시보드(dashboard/page.client.tsx)만 다음처럼 바꿔줘. ProgressCard: 배경 #FAFAF8 또는 연한 크림, border-radius 16px, box-shadow 0 2px 12px rgba(0,0,0,0.06). 카드 왼쪽에 4px 세로 강조 바(보라 또는 세이지). 대시보드 상단에 "오늘도 한 걸음, Arena에서." / "One step today, in the Arena." (locale ko/en). 카드 간격·패딩 넉넉히.
```

### 3-3. 문구·톤만 (D)

| 상태 | [x] |

```
bty-app Arena·대시보드에 포근한 문구만 넣어줘. 대시보드 상단: "오늘도 한 걸음, Arena에서." (ko) / "One step today, in the Arena." (en). Arena 레벨 카드 근처: "지금 여기까지 열렸어요." (ko) / "Unlocked up to here." (en). 리더보드 상단: "함께 달리는 동료들." (ko) / "Running together." (en). i18n 또는 locale별 객체에 추가하고 텍스트만 교체해줘.
```

### 3-4. 네비·레이아웃 (E)

| 상태 | [x] |

```
bty-app의 BtyTopNav와 bty/(protected)/layout.tsx를 Arena스럽고 포근하게 바꿔줘. 헤더: 연한 크림/보라 톤, "Arena" 또는 "BTY Arena" 왼쪽, 오른쪽에 메인·Dashboard·Arena·Leaderboard. 활성 링크만 둥근 배경+강조색, hover 부드럽게. 본문 padding 넉넉히 (py-8 또는 24px).
```

### 3-5. 전체 감성 한 번에 (A)

| 상태 | [x] |

```
docs/ARENA_UI_REDESIGN_BRIEF.md §4 프롬프트 A를 적용해줘. Arena스럽게·트레이닝장 같게·포근한 대화 창 느낌으로, globals.css Arena 변수 + layout·대시보드·BtyTopNav 적용. dojo-purple 활용.
```

---

## 4. 한 줄 지시 (요약)

| 상태 | 지시 |
|------|------|
| [x] | **Phase 4 (4-1~4-4)** 완료. 코드별 스킨 스펙·챗봇/멘토 스킨·엘리트 기획·멘토 배지 확장·Elite 전용 페이지. `docs/PHASE_4_CHECKLIST.md` |
| [x] | **대시보드 Arena Level 숨기기**: "PROJECT_BACKLOG §2: Arena Level 카드 플래그로 MVP 후 숨기기 구현해줘." |
| [x] | **Partner 시나리오**: "PROJECT_BACKLOG §3: Partner일 때 S1~L4 시나리오 노출되도록 점검·수정해줘." |
| [x] | **엘리트 정책**: "PROJECT_BACKLOG §4: 주간 vs 시즌 5% 정책·특혜 1페이지 정리해줘." |
| [x] | **엘리트 특혜 선정**: "PROJECT_BACKLOG §5: 엘리트 특혜 후보 중 1~2차 구현 항목 선정·한 줄 스펙해줘." |
| [x] | **시나리오 검증**: "SCENARIO_UNLOCK_VERIFICATION.md 체크리스트 순서대로 검증해줘." |
| [x] | **Arena UI (B)**: "ARENA_UI_REDESIGN_BRIEF C → B 적용해줘." — B(대시보드 카드·상단 문구) 적용 완료. |
| [x] | **Arena UI (D)**: "ARENA_UI_REDESIGN_BRIEF 프롬프트 D 적용해줘." (문구·톤만) |
