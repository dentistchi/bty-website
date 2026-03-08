# 에이전트 — 먼저 열 파일 + 단계 0~N 복사용 프롬프트

다른 Cursor에 지시할 때: **아래 파일을 먼저 열거나 @ 로 첨부**한 뒤, **단계별 프롬프트**를 복사해 붙여 넣으면 됩니다.

---

## 1. 먼저 열어볼 파일

| 순서 | 파일 경로 | 용도 |
|------|-----------|------|
| 1 | `bty-app/docs/AGENTS_SHARED_README.md` | 공통 규칙·도메인/API/UI 경로 |
| 2 | `bty-app/docs/AGENTS_ROLES.md` | 진행 vs 검증 vs 서커 역할 |
| 3 | `bty-app/docs/PLAN_WORKFLOW.md` | 진행/검증 구분 방식 |
| 4 | `docs/CURRENT_TASK.md` | 현재 할 일·한 줄 지시 |
| 5 | `bty-app/docs/AGENTS_TURN_BY_TURN.md` | 단계별 진행↔검증 프롬프트 |
| 6 | `bty-app/docs/NEXT_TASKS_2.md` | 2차 작업·상세 프롬프트 블록 |
| 7 | `bty-app/docs/PROJECT_BACKLOG.md` | 백로그·미완료 항목 |
| 8 | `bty-app/.cursor/rules/bty-release-gate.mdc` | 배포/XP/리더보드 규칙 (변경 시) |
| 9 | `bty-app/.cursor/rules/bty-arena-global.mdc` | Arena 비즈니스 규칙 |
| 10 | `bty-app/.cursor/rules/bty-ui-render-only.mdc` | UI는 렌더만 |

**한 줄 안내 (복사용)**  
→ 「`bty-app/docs/AGENTS_SHARED_README.md`, `bty-app/docs/AGENTS_ROLES.md`, `docs/CURRENT_TASK.md` 읽고 진행해줘.」

**파일 경로만 복사 (워크스페이스가 bty-app이면 `bty-app/` 생략 가능)**

```
docs/AGENTS_SHARED_README.md
docs/AGENTS_ROLES.md
docs/PLAN_WORKFLOW.md
docs/CURRENT_TASK.md
docs/AGENTS_TURN_BY_TURN.md
docs/NEXT_TASKS_2.md
docs/PROJECT_BACKLOG.md
```

---

## 2. 단계 0 — 공통: 컨텍스트 읽기

**대상**: 진행/검증 모두 (먼저 한 번만)

```
bty-app에서 작업할 거야. 먼저 이 문서들 읽고 규칙 지켜줘.

- docs/AGENTS_SHARED_README.md — 도메인/API/UI 경로, 규칙 요약
- docs/AGENTS_ROLES.md — 너는 진행 에이전트(구현) 또는 검증 에이전트(점검) 역할
- .cursor/rules/bty-arena-global.mdc, bty-ui-render-only.mdc — UI는 XP/랭킹 계산 금지, API 값만 표시

이제 아래 단계 N 지시를 따르면 돼.
```

---

## 3. 단계 1 — 진행 (Cursor 1)

```
docs/CURRENT_TASK.md의 "이번에 구현할 기능" 또는 docs/AGENTS_TURN_BY_TURN.md 단계 1 진행을 해줘.

- CURRENT_TASK.md에 구체 지시가 있으면 그걸 구현해.
- 없으면 AGENTS_TURN_BY_TURN.md 1-1 "진행 (Cursor 1)" 블록 안의 프롬프트대로 대시보드·Arena 히어로+여백 적용해줘.
- 도메인 → API → UI 순서 지키고, UI에서는 XP/랭킹/시즌 계산하지 말고 API에서 받은 값만 렌더해.
- 끝나면 "단계 1 진행 완료"라고만 짧게 말해줘.
```

---

## 4. 단계 1 — 검증 (Cursor 2)

```
방금 진행 에이전트가 한 "단계 1" 작업을 검증해줘.

- docs/AGENTS_TURN_BY_TURN.md 1-2 "검증 (Cursor 2)" 블록 내용대로 확인해.
- 대시보드(/en/bty/dashboard, /ko/bty/dashboard)·Arena(/en/bty-arena) 상단 히어로·여백이 있는지, UI가 XP/랭킹 계산 없이 API 값만 쓰는지 점검해.
- 결과를 PASS 또는 FAIL + 발견 이슈 목록(있으면)으로 보고해줘.
```

---

## 5. 단계 2 — 진행 (Cursor 1)

```
docs/AGENTS_TURN_BY_TURN.md 단계 2-1 "진행 (Cursor 1)" 해줘.

- DESIGN_FIRST_IMPRESSION_BRIEF §4 프롬프트 B: 제목·로고 웹폰트, 악센트 색 --arena-accent, 본문 line-height 1.6.
- 끝나면 "단계 2 진행 완료"라고만 말해줘.
```

---

## 6. 단계 2 — 검증 (Cursor 2)

```
단계 2 적용분 검증해줘.

- AGENTS_TURN_BY_TURN.md 2-2 검증 블록: 제목·로고 웹폰트, 악센트 색 사용처, bty-*.mdc 규칙 위반 여부.
- 결과: PASS/FAIL + 이슈 목록.
```

---

## 7. 단계 3 — 진행 (Cursor 1)

```
docs/AGENTS_TURN_BY_TURN.md 단계 3 호버·카드 인터랙션 진행해줘.

- ProgressCard·클릭 가능 카드: hover 시 translateY(-2px), box-shadow 강화, transition 0.2s.
- 버튼: hover 시 brightness(1.05) 또는 scale(1.02). focus-visible 시 box-shadow 링.
- 끝나면 "단계 3 진행 완료"라고만 말해줘.
```

---

## 8. 단계 3 — 검증 (Cursor 2)

```
단계 3(호버·카드) 검증해줘.

- 카드·버튼 hover 시각 변화, 포커스 링 확인.
- 결과: PASS/FAIL + 이슈 목록.
```

---

## 9. 단계 4 — 통합 검증 (Cursor 2만)

```
docs/AGENTS_TURN_BY_TURN.md 단계 4-1 통합 검증 해줘.

- 첫인상 디자인(히어로·폰트·악센트·호버) 전체가 DESIGN_FIRST_IMPRESSION_BRIEF 목표에 맞는지, bty 규칙 위반 없는지 확인해.
- 결과: PASS/FAIL + 개선 제안 1~2개(있으면).
```

---

## 10. 백로그에서 하나 고를 때 (진행 Cursor)

```
docs/PROJECT_BACKLOG.md 또는 docs/NEXT_TASKS_2.md에서 [ ] 미완료 항목 하나 골라서 구현해줘.

- 해당 항목의 요구·수정 위치·완료 기준을 읽고 도메인 → API → UI 순으로 구현해.
- docs/AGENTS_SHARED_README.md, .cursor/rules/bty-*.mdc 규칙 지켜줘.
- 끝나면 어떤 항목을 했는지 한 줄로 말하고, 해당 문서에 [x] 체크 반영해줘.
```

---

## 11. 배포 전 체크 (검증 Cursor)

```
bty-app 배포 전 체크 해줘.

- .cursor/rules/bty-release-gate.mdc 에 있는 체크리스트대로: Auth/Cookies, Weekly Reset, Leaderboard, Migration, API Contract, Verification Steps 확인해.
- 변경한 파일이 XP/시즌/리더보드/인증/쿠키를 건드렸으면 해당 절 결과 정리해.
- OUTPUT FORMAT에 맞춰 요약해줘.
```

---

## 사용 순서 요약

1. **진행 Cursor 1, 검증 Cursor 2** 두 개 준비.
2. §1 표에서 최소 **AGENTS_SHARED_README.md**, **AGENTS_ROLES.md**, **CURRENT_TASK.md** 열거나 @ 첨부.
3. **단계 0** 프롬프트를 두 Cursor 모두에 보내서 컨텍스트 읽기.
4. **단계 1 진행** → Cursor 1에 붙여 넣기 → 완료 후 **단계 1 검증** → Cursor 2에 붙여 넣기.
5. **단계 2 진행** → Cursor 1 … **단계 2 검증** → Cursor 2 … 반복.
6. 필요 시 **단계 3·4** 또는 **백로그 고르기** / **배포 전 체크** 프롬프트 사용.

상세·현재 상태·다음 지시: **`docs/NEXT_STEPS_RUNBOOK.md`** §6, **`docs/COMMANDER_CURSORS_REF.md`** 참고.
