# 다음 과정 — 다른 커서용 복사 프롬프트

**커맨더(당신)**: 누가 뭘 보고 누구에게 명령 내릴지 한눈에 보려면 **`docs/COMMANDER_CURSORS_REF.md`** 만 열어두면 됩니다. **현재 상태·Cursor 4 해야 할 내용·다음 지시**는 **§6 현재 상태 · 다음 지시 (마무리)** 에 정리되어 있습니다.

다른 Cursor에게 **단계별로 명령을 내릴 때** 이 문서를 보고, 아래 **먼저 볼 파일**을 열어 준 뒤, **단계별 프롬프트**를 복사해 붙여 넣으면 됩니다.

- **자율 진행**: 할 수 있는 것은 사용자에게 묻지 말고 알아서 진행한다. 결정이 꼭 필요한 경우만 질문한다.

---

## 1. 먼저 열어볼 파일 (다른 커서들이 참고할 문서)

지시하기 전에 아래 파일들을 **열어 두거나** @ 로 첨부해서 컨텍스트로 주세요.

| 순서 | 파일 경로 | 용도 |
|------|-----------|------|
| 1 | `bty-app/docs/AGENTS_SHARED_README.md` | 공통 규칙·도메인/API/UI 경로 |
| 2 | `bty-app/docs/AGENTS_ROLES.md` | 진행 vs 검증 vs 서커 역할 |
| 3 | `bty-app/docs/PLAN_WORKFLOW.md` | 진행/검증 구분 방식 |
| 4 | `bty-app/docs/CURRENT_TASK.md` | 현재 할 일·한 줄 지시 |
| 5 | `bty-app/docs/AGENTS_TURN_BY_TURN.md` | 단계별 진행↔검증 프롬프트 |
| 6 | `bty-app/docs/NEXT_TASKS_2.md` | 2차 작업·상세 프롬프트 블록 |
| 7 | `bty-app/docs/PROJECT_BACKLOG.md` | 백로그·미완료 항목 |
| 8 | `bty-app/.cursor/rules/bty-release-gate.mdc` | 배포/XP/리더보드 규칙 (변경 시) |
| 9 | `bty-app/.cursor/rules/bty-arena-global.mdc` | Arena 비즈니스 규칙 |
| 10 | `bty-app/.cursor/rules/bty-ui-render-only.mdc` | UI는 렌더만 |

**한 줄 안내 (복사용)**  
→ 「`bty-app/docs/AGENTS_SHARED_README.md`, `bty-app/docs/AGENTS_ROLES.md`, `bty-app/docs/CURRENT_TASK.md` 읽고 진행해줘.」

---

## 2. 단계별 복사용 프롬프트

아래를 **순서대로** 다른 Cursor에게 붙여 넣어서 지시하면 됩니다.  
(진행용 Cursor 1, 검증용 Cursor 2 두 개를 쓰면 진행 → 검증 순으로 번갈아 가며 실행.)

---

### 단계 0 — 공통: 컨텍스트 읽기

**대상**: 진행/검증 모두 (먼저 한 번만)

```
bty-app에서 작업할 거야. 먼저 이 문서들 읽고 규칙 지켜줘.

- docs/AGENTS_SHARED_README.md — 도메인/API/UI 경로, 규칙 요약
- docs/AGENTS_ROLES.md — 너는 진행 에이전트(구현) 또는 검증 에이전트(점검) 역할
- .cursor/rules/bty-arena-global.mdc, bty-ui-render-only.mdc — UI는 XP/랭킹 계산 금지, API 값만 표시

이제 아래 단계 N 지시를 따르면 돼.
```

---

### 단계 1 — 진행 (Cursor 1)

```
docs/CURRENT_TASK.md의 "이번에 구현할 기능" 또는 docs/AGENTS_TURN_BY_TURN.md 단계 1 진행을 해줘.

- CURRENT_TASK.md에 구체 지시가 있으면 그걸 구현해.
- 없으면 AGENTS_TURN_BY_TURN.md 1-1 "진행 (Cursor 1)" 블록 안의 프롬프트대로 대시보드·Arena 히어로+여백 적용해줘.
- 도메인 → API → UI 순서 지키고, UI에서는 XP/랭킹/시즌 계산하지 말고 API에서 받은 값만 렌더해.
- 끝나면 "단계 1 진행 완료"라고만 짧게 말해줘.
```

---

### 단계 1 — 검증 (Cursor 2)

```
방금 진행 에이전트가 한 "단계 1" 작업을 검증해줘.

- docs/AGENTS_TURN_BY_TURN.md 1-2 "검증 (Cursor 2)" 블록 내용대로 확인해.
- 대시보드(/en/bty/dashboard, /ko/bty/dashboard)·Arena(/en/bty-arena) 상단 히어로·여백이 있는지, UI가 XP/랭킹 계산 없이 API 값만 쓰는지 점검해.
- 결과를 PASS 또는 FAIL + 발견 이슈 목록(있으면)으로 보고해줘.
```

---

### 단계 2 — 진행 (Cursor 1)

```
docs/AGENTS_TURN_BY_TURN.md 단계 2-1 "진행 (Cursor 1)" 해줘.

- DESIGN_FIRST_IMPRESSION_BRIEF §4 프롬프트 B: 제목·로고 웹폰트, 악센트 색 --arena-accent, 본문 line-height 1.6.
- 끝나면 "단계 2 진행 완료"라고만 말해줘.
```

---

### 단계 2 — 검증 (Cursor 2)

```
단계 2 적용분 검증해줘.

- AGENTS_TURN_BY_TURN.md 2-2 검증 블록: 제목·로고 웹폰트, 악센트 색 사용처, bty-*.mdc 규칙 위반 여부.
- 결과: PASS/FAIL + 이슈 목록.
```

---

### 단계 3 — 진행 (Cursor 1)

```
docs/AGENTS_TURN_BY_TURN.md 단계 3 호버·카드 인터랙션 진행해줘.

- ProgressCard·클릭 가능 카드: hover 시 translateY(-2px), box-shadow 강화, transition 0.2s.
- 버튼: hover 시 brightness(1.05) 또는 scale(1.02). focus-visible 시 box-shadow 링.
- 끝나면 "단계 3 진행 완료"라고만 말해줘.
```

---

### 단계 3 — 검증 (Cursor 2)

```
단계 3(호버·카드) 검증해줘.

- 카드·버튼 hover 시각 변화, 포커스 링 확인.
- 결과: PASS/FAIL + 이슈 목록.
```

---

### 단계 4 — 통합 검증 (Cursor 2만)

```
docs/AGENTS_TURN_BY_TURN.md 단계 4-1 통합 검증 해줘.

- 첫인상 디자인(히어로·폰트·악센트·호버) 전체가 DESIGN_FIRST_IMPRESSION_BRIEF 목표에 맞는지, bty 규칙 위반 없는지 확인해.
- 결과: PASS/FAIL + 개선 제안 1~2개(있으면).
```

---

### 백로그에서 하나 고를 때 (진행 Cursor)

```
docs/PROJECT_BACKLOG.md 또는 docs/NEXT_TASKS_2.md에서 [ ] 미완료 항목 하나 골라서 구현해줘.

- 해당 항목의 요구·수정 위치·완료 기준을 읽고 도메인 → API → UI 순으로 구현해.
- docs/AGENTS_SHARED_README.md, .cursor/rules/bty-*.mdc 규칙 지켜줘.
- 끝나면 어떤 항목을 했는지 한 줄로 말하고, 해당 문서에 [x] 체크 반영해줘.
```

---

### 배포 전 체크 (검증 Cursor)

```
bty-app 배포 전 체크 해줘.

- .cursor/rules/bty-release-gate.mdc 에 있는 체크리스트대로: Auth/Cookies, Weekly Reset, Leaderboard, Migration, API Contract, Verification Steps 확인해.
- 변경한 파일이 XP/시즌/리더보드/인증/쿠키를 건드렸으면 해당 절 결과 정리해.
- OUTPUT FORMAT에 맞춰 요약해줘.
```

---

## 3. 완료 시 알람 (모든 Cursor)

작업이 끝났을 때 소리·알림으로 알아차리려면 아래를 **순서대로** 확인하세요.

### 3-1. 에이전트 응답 완료 시 소리 (가장 먼저 할 것)

- **Cursor UI 설정**: **Cmd+,** (설정) → 검색창에 **"sound"** 입력 → **"Play sound when reply is complete"** 를 **ON**으로 두고, **볼륨**을 올린 뒤 **"Test Sound"** 로 동작 확인.
- 이렇게 하면 **에이전트(채팅) 응답이 끝날 때** 소리가 납니다. (Cursor 0.48+)
- 소리가 안 나면: Cursor 재시작 후 다시 ON, 시스템 볼륨·무음 해제 확인.

### 3-2. 터미널 명령 완료 시 소리 (선택)

- **settings.json**에 아래가 있으면, **터미널에서 실행한 명령**이 끝날 때 소리가 납니다.
- **macOS** 설정 파일: `~/Library/Application Support/Cursor/User/settings.json`

```json
"audioCues.terminalCommandSucceeded": "on",
"audioCues.terminalCommandFailed": "on"
```

- 그러면 **해당 Cursor의 터미널에서 실행한 명령**이 끝날 때(성공/실패) 소리가 납니다.
- Cursor에는 “에이전트 응답이 끝났을 때” 자동 소리 기능이 없어서, **에이전트가 끝났을 때**는 아래 3-3를 보조로 쓰면 됩니다.

### 3-3. 수동 알람 (스크립트 — 확실히 울리게)

- 진행/검증 에이전트가 **“단계 N 완료”**라고 한 뒤, **그 Cursor의 터미널**에서 아래 중 하나를 실행하면 알람(소리)이 납니다.

**프로젝트 스크립트 (권장):** `./scripts/notify-done.sh` 또는 `bash scripts/notify-done.sh` (권한 오류 시 `chmod +x scripts/notify-done.sh`.)

**macOS 한 줄:** `afplay /System/Library/Sounds/Glass.aiff; osascript -e 'display notification "작업 완료" with title "Cursor" sound name "Glass"'`

- 3-1이 안 울릴 때 이 방법을 쓰면 항상 소리를 낼 수 있습니다.

---

## 4. 사용 방법 요약

1. **다른 Cursor 2개** 준비 (진행용 1, 검증용 1).
2. **§1 표**에 있는 파일들 중 최소 `AGENTS_SHARED_README.md`, `AGENTS_ROLES.md`, `CURRENT_TASK.md` 를 열거나 @ 로 첨부.
3. **단계 0** 프롬프트를 두 Cursor 모두에 보내서 컨텍스트 읽기.
4. **단계 1 진행** → Cursor 1에 붙여 넣기 → 완료 후 **단계 1 검증** → Cursor 2에 붙여 넣기. (완료 시 §3-3 `./scripts/notify-done.sh` 실행.)
5. **단계 2 진행** → Cursor 1 … **단계 2 검증** → Cursor 2 … 반복. (각 완료 시 §3-3 알람.)
6. 필요하면 **백로그에서 하나 고를 때** / **배포 전 체크** 프롬프트 사용.

---

## 5. 파일 경로만 빠르게 복사

- **워크스페이스가 `bty-app`** 이면 아래에서 `bty-app/` 을 빼고 **`docs/...`** 만 씁니다. (Cmd+P에서 `docs/CURRENT_TASK` 처럼 검색.)

```
docs/AGENTS_SHARED_README.md
docs/AGENTS_ROLES.md
docs/PLAN_WORKFLOW.md
docs/CURRENT_TASK.md
docs/AGENTS_TURN_BY_TURN.md
docs/NEXT_TASKS_2.md
docs/PROJECT_BACKLOG.md
```

위 목록을 그대로 복사해 다른 Cursor에 「이 파일들 참고해서 ~ 해줘」라고 붙여도 됩니다.

---

## 6. 현재 상태 · 다음 지시 (마무리)

**커맨더**: **`docs/COMMANDER_CURSORS_REF.md`** 와 이 §6만 보면 누가 뭘 하고, 다음에 뭘 시키면 되는지 파악할 수 있습니다.

### 6-1. 커서별 역할 · 할 일 요약

| 커서 | 역할 | 할 일 / 상태 |
|------|------|----------------|
| **Cursor 1** | 진행(구현) | CURRENT_TASK·BACKLOG 지시에 따라 구현. Dojo 2차, 감정 스탯 v3 확장 등. |
| **Cursor 2** | 검증/병렬 | 배포 전 체크, 옵션 A 검증, 빈 상태 보강, 아바타·코드네임 검증(선택) 등. |
| **Cursor 4** | Arena 코드네임·아바타 | **§6-2** 참고. 구현 3종 반영 완료 → **배포 전 마이그레이션 3개 적용** → (선택) Cursor 2 검증. |

### 6-2. Cursor 4 — 해야 할 내용 (Arena 코드네임·아바타)

**계획 문서**: **`docs/ARENA_CODENAME_AVATAR_PLAN.md`**

**구현 완료 범위 (현재 반영됨)**

| 항목 | 상태 |
|------|------|
| 리더보드 아바타 역전 | sub-name/profile 인증을 `requireUser(req)`로 통일, 리더보드 행별 `profileMap.get(r.user_id)` 주석·로직 유지 |
| 코드네임 코드별 1회 | 마이그레이션 `sub_name_renamed_at_code_index`, sub-name POST·core-xp `subNameRenameAvailable` 반영 |
| 캐릭터+옷 1단계 | `avatar_selected_outfit_id` 마이그레이션, profile PATCH, core-xp `currentOutfit`·`avatarSelectedOutfitId`, 대시보드 “선택한 옷” 드롭다운 |

**배포 전 필요 (Cursor 4 관련)**

1. **마이그레이션 3개 적용**: `20260309000000`, `20260310000000`, `20260311000000`
2. **(선택)** Cursor 2에 **「아바타·코드네임 계획 검증해줘」** 로 검증 요청

**Cursor 4에게 지시할 때**: `docs/ARENA_CODENAME_AVATAR_PLAN.md` 열어 주고, §4 체크리스트·§6 구현 현황 참고. 배포 전에는 위 마이그레이션 적용 후 (선택) 검증까지 진행하면 됨. 같은 영역은 다른 커서에 지시하지 말 것.

### 6-3. 다음에 시킬 수 있는 작업 (복사용)

| 누구에게 | 할 일 | 복사용 프롬프트 |
|----------|--------|------------------|
| **Cursor 1** | BACKLOG §7 Dojo 2차 | `PROJECT_BACKLOG §7: Dojo 50문항 목차 또는 연습 플로우 1종 스펙 정리·진입/1단계 구현해줘. docs/DOJO_DEAR_ME_NEXT_CONTENT.md 참고.` |
| **Cursor 1** | 감정 스탯 v3 확장 (선택) | `docs/HEALING_COACHING_SPEC_V3.md`, docs/specs/healing-coaching-spec-v3.json 읽고, 이벤트 15종·stat_distribution·30일 가속 등 v3 스펙 반영해줘. (Phase A1–F1은 완료됨.)` |
| **Cursor 2** | BACKLOG §8 빈 상태 보강 | `PROJECT_BACKLOG §8: BRIEF §2에 따라 리더보드·대시보드 등 빈 상태에 일러·아이콘 + 한 줄 문구 넣어줘.` |
| **Cursor 2** | 배포 전 체크 | `docs/NEXT_TASKS_2.md §1-2: .cursor/rules/bty-release-gate 규칙에 맞게 배포 전 체크 실행해줘. Auth/Cookies, Weekly Reset, Leaderboard, Migration, API Contract, Verification Steps 확인하고 결과 요약해줘.` |
| **Cursor 2** | 아바타·코드네임 검증 (선택) | `docs/ARENA_CODENAME_AVATAR_PLAN.md 읽고, Cursor 4가 반영한 리더보드 아바타·코드네임 코드별 1회·캐릭터+옷 1단계가 스펙과 규칙을 만족하는지 검증해줘. 결과를 PASS/FAIL + 이슈 목록으로 보고해줘.` |
| **Cursor 4** | 마이그레이션 3개 적용 완료 | ✅ 적용됨 (`scripts/apply-arena-avatar-migrations.sql`). (선택) Cursor 2에 「아바타·코드네임 계획 검증해줘」 지시. |

**역할·다음 과정** 상세 표: `docs/ARENA_CODENAME_AVATAR_PLAN.md` §0 하단.

- **옵션 A (Dojo·Dear Me 2차)**: 진입·Dear Me 1차 플로우 구현 완료, 검증·재검증 **PASS**. 2차 전체 검증(항목 1~10)은 **`docs/DOJO_DEAR_ME_2ND_VERIFICATION.md`** 사용. (1차·재검증 기록은 `docs/DOJO_DEAR_ME_VERIFICATION_CHECKLIST.md` 참고.)
- **챗봇 훈련 (BACKLOG §9)**: 구현 완료, Lint·Vitest 10/10 **PASS**. next/headers·supabaseServer 목 추가.
- **감정 스탯 (Phase A1–F1)**: 도메인 → DB → API → UI 반영 완료. v3 확장은 `docs/HEALING_COACHING_SPEC_V3.md` 기준.
- **BRIEF §2 (빈 상태·로딩, BACKLOG §8)**: ✅ **적용 완료** — LoadingFallback·PageLoadingFallback. **로딩 전역 통일**: Suspense fallback 14곳 + 인라인 7곳(PageClient, TrainShell, AuthGate, JourneyBoard 등) → 아이콘 + "잠시만 기다려 주세요." + 카드형 스켈레톤. 빈 상태: 리더보드·ArenaLevelsCard·감정 스탯 EmptyState, i18n arenaLevels.noLevelsYet·emptyCta.
- **Cursor 4 아바타·코드네임**: ✅ 마이그레이션 3개 적용 완료 (`scripts/apply-arena-avatar-migrations.sql`). Cursor 2 재검증 **PASS** (2026-02-28, §7-1 점검 항목 1~8).
- **배포 전 체크 (bty-release-gate)**: **PASS** (재실행 완료). NEXT_TASKS_2 §1-2·`.cursor/rules/bty-release-gate.mdc` 기준. Auth/Cookies·Weekly Reset·Leaderboard·Migration·API 계약 위반 없음. **배포 후**: 아래 F) Verification Steps 1~4만 실행. (상세: §6-5.)

### 6-5. 배포 전 체크 결과 (bty-release-gate)

- **근거**: `docs/NEXT_TASKS_2.md` §1-2, `.cursor/rules/bty-release-gate.mdc`
- **재실행**: 최근 1회 PASS 후 재실행 완료 → **PASS**. 배포 후에는 Verification Steps만 실행하면 됨.
- **Assumptions**: 재실행 범위에서 Auth/쿠키·Weekly Reset·Leaderboard·XP·시즌 직접 수정 없음. 리더보드 = 주간 창(league_id IS NULL), Weekly XP = weekly_xp, Core XP = 별도 저장·리셋 없음, UI = API 값만 표시.
- **Release Gate Results**: **PASS**. A~E 항목 기준 규칙 위반 없음.
- **Findings 요약**  
  - **A) Auth/Cookies**: Path=/, SameSite=lax, Secure=true, HttpOnly=true. 로그아웃 시 Clear-Site-Data + expireAuthCookiesHard. `/api/auth/callback` runtime = nodejs.  
  - **B) Weekly Reset**: 주간 경계(앱/크론). Core XP 비수정. Idempotency·동시성 기존 설계 유지.  
  - **C) Leaderboard**: weekly_xp만 정렬(xp_total DESC), 시즌은 표시용만. (선택) tie-breaker 명시 시 재검증.  
  - **D) Migration**: 이번 배포에서 추가/변경 마이그레이션 없음. Core/Weekly 분리 유지. **Leadership Engine(LE) 마이그레이션·롤백 절차**: `docs/ENGINE_ARCHITECTURE_DIRECTIVE_PLAN.md` §7 "Leadership Engine 테이블·마이그레이션·롤백" 참고.  
  - **E) API**: 이번 배포에서 변경한 API 없음. 리더보드 Cache-Control no-store, UI는 응답만 사용.  
  - **F) Verification Steps (배포 후 실행)**: 1) 로컬: 로그인 → Arena 시나리오 1회 완료 → 대시보드·프로필·리더보드 XP·순위·아바타 확인. 2) 로컬(가능 시): 주간 경계/리셋 시뮬레이션 후 Core XP 유지·Weekly XP만 리셋 확인. 3) Preview: 로그인 후 새로고침·다른 bty 경로 이동 시 세션 유지 확인. 4) Production: HTTPS 쿠키(Secure/SameSite), 리더보드 로드, 401 루프 없음 확인.
- **Required patches**: 없음. (선택) 리더보드 동점 시 order(updated_at/user_id) 추가 시 스펙·테스트 재확인.
- **Next steps checklist**: [x] 배포 전 체크 재실행 — PASS. [ ] 배포 후 Verification Steps 1~4 실행. [ ] (선택) 리더보드 tie-breaker 명시 시 코드·스펙 반영 후 재점검.

## 7. 다음 진행 (BACKLOG §6 완료 후) — 복사용 프롬프트 모음

PROJECT_BACKLOG §6(언어 선택 시나리오·안내·대답 통일)은 NEXT_TASKS_2 §1-5로 이미 구현·검증되어 [x] 반영된 상태입니다. **그 다음**에 할 일을 지시할 때 아래를 사용하세요.

### 열어둘 파일

- **워크스페이스 루트가 `bty-app`이면** Cmd+P에서 **`docs/CURRENT_TASK`** 또는 **`CURRENT_TASK`** 만 입력해 열면 됩니다. (`bty-app/` 접두어 없이.)
- **워크스페이스 루트가 `btytrainingcenter`이면** `bty-app/docs/CURRENT_TASK.md` 로 검색.

| 순서 | 파일 (bty-app 기준) | 용도 |
|------|---------------------|------|
| 1 | `docs/CURRENT_TASK.md` | 이번에 구현할 기능(비어 있으면 여기에 새로 적기) |
| 2 | `docs/PROJECT_PROGRESS_ORDER.md` | 다음 권장 작업(§3: Dojo·Dear Me 콘텐츠 또는 2차 항목) |
| 3 | `docs/ROADMAP_NEXT_STEPS.md` | Phase·로드맵 상세 |
| 4 | `docs/DOJO_DEAR_ME_NEXT_CONTENT.md` | Dojo·Dear Me 2차 구현 스펙 |
| 5 | `docs/PROJECT_BACKLOG.md` | 완료된 §1~§6 참고, 새 항목 추가 시 |

### 복사용 프롬프트 (다음 할 일 지시)

**옵션 A — Dojo·Dear Me 2차 콘텐츠**

```
docs/PROJECT_PROGRESS_ORDER.md §3과 docs/ROADMAP_NEXT_STEPS.md를 보면, 다음 권장은 "Dojo·Dear Me 콘텐츠 2차"야.

docs/DOJO_DEAR_ME_NEXT_CONTENT.md를 읽고, 아직 구현 안 된 2차 항목(예: 50문항 분석 목차·연습 플로우 1종 스펙, Dear Me 1차 플로우 진입 화면) 중 하나 골라서 구현해줘. 도메인 → API → UI 순서 지키고, docs/AGENTS_SHARED_README.md·bty-*.mdc 규칙 따르면 돼. 끝나면 CURRENT_TASK나 해당 문서에 완료 반영해줘.
```

**옵션 B — 다음 할 일 정해서 한 줄 적기**

```
docs/CURRENT_TASK.md, docs/PROJECT_PROGRESS_ORDER.md, docs/PROJECT_BACKLOG.md를 읽어줘.

다음에 할 작업을 한 줄로 정해서 docs/CURRENT_TASK.md "이번에 구현할 기능" 칸에 적어줘. BACKLOG §1~§6은 완료된 상태니까, PROJECT_PROGRESS_ORDER §3(Dojo·Dear Me 2차 또는 2차 항목)이나 새로 넣을 백로그 항목 중에서 골라서 적으면 돼.
```

**옵션 C — 배포 전 체크**

```
docs/NEXT_TASKS_2.md §1-2: .cursor/rules/bty-release-gate 규칙에 맞게 배포 전 체크 실행해줘. Auth/Cookies, Weekly Reset, Leaderboard, Migration, API Contract, Verification Steps 확인하고 결과 요약해줘.
```

**챗봇 훈련 (BACKLOG §9)**

```
PROJECT_BACKLOG §9 챗봇 훈련 해줘.

docs/ROADMAP_NEXT_STEPS.md § 챗봇 훈련 시기, docs/CHATBOT_TRAINING_CHECKLIST.md 를 읽고, (1) 시스템 프롬프트 보강(역할·말투·금지 표현) (2) 구역별(bty / today-me) 예시 대화 몇 턴 (3) 메타 질문("챗봇이야?" 등) 답변 가이드 (4) 선택: BTY·Dear Me 소개 RAG. src/app/api/chat/route.ts, src/components/Chatbot.tsx 수정. CHATBOT_TRAINING_CHECKLIST §2·§3 항목 점검하고 §3 [ ] 항목 정리·반영해줘.
```

**시스템 업그레이드 — Core Stats / Events / Advanced Stats**

- **계획 문서**: **`docs/SYSTEM_UPGRADE_PLAN_EMOTIONAL_STATS.md`** — Core Stats(EA, RS, BS, TI, RC, RD), Events(quality_weight), Advanced Stats(해금), Q/Δ 공식, UI(숫자 미노출·문구만), 악용 방지.
- **진행 순서**: Phase A(도메인·상수) → B(악용 방지) → C(DB 마이그레이션) → D(API record/display) → E(챗/멘토 이벤트 연동) → F(UI 문구 표시).
- **복사용 프롬프트 (Phase A1 예시)**:

```
docs/SYSTEM_UPGRADE_PLAN_EMOTIONAL_STATS.md 읽어줘. Phase A1: src/lib/bty/emotional-stats/coreStats.ts 에 core_stats, events, advanced_stats JSON을 TS 상수로 정의하고, source_events 매핑해줘. 도메인만, API/DB 건드리지 마.
```

- **다음 단계**: A2 formula.ts → A3 unlock.ts → B1 antiExploit → C1 마이그레이션 → D1/D2 API → E1/F1 연동·UI. 각 단계는 CURRENT_TASK 또는 RUNBOOK에서 "SYSTEM_UPGRADE_PLAN_EMOTIONAL_STATS Phase X" 로 지시하면 됨.

### 시스템 업그레이드(감정 스탯) Phase A1–F1 구현 완료

- **반영 일시**: Phase A1~F1을 **도메인 → DB → API → UI** 순서로 반영 완료.
- **구현 범위**: A1 coreStats.ts, A2 formula.ts, A3 unlock.ts, B1 antiExploit.ts, C1 마이그레이션(4개 테이블+RLS), D1 POST record-event, D2 GET display(문구만), E1 챗/멘토 이벤트 판별·record 호출, F1 UI phrases 표시.
- **상세 체크리스트**: **`docs/SYSTEM_UPGRADE_PLAN_EMOTIONAL_STATS.md`** §6. 이후 v3 스펙(이벤트 15종·stat_distribution·30일 가속 등) 반영은 **`docs/HEALING_COACHING_SPEC_V3.md`**·`docs/specs/healing-coaching-spec-v3.json` 기준으로 진행 가능.

### 챗봇 구현 테스트 결과 (Cursor 2 검증)

- **검증 일시**: 챗봇 훈련(BACKLOG §9) 구현 후 Cursor 2에서 Lint + Vitest 실행.
- **실행한 작업**  
  | 항목 | 내용 |  
  |------|------|  
  | Lint | `npm run lint` → 통과 (경고만 있음) |  
  | 단위 테스트 | `npm test` (Vitest 10개) → 초기 5실패 → 원인 수정 후 **10/10 통과** (chat 5, mentor 5) |
- **테스트 실패 원인과 수정**  
  - **원인 1**: Next.js `cookies()`가 Vitest에서 호출되면 "request scope 밖" 에러.  
    → **조치**: `next/headers`를 목으로 두어 `cookies()`가 빈 쿠키를 반환하도록 처리.  
  - **원인 2**: `getSupabaseServerClient()`가 테스트 환경에서 Supabase URL/Key 없어 에러.  
    → **조치**: `@/lib/bty/arena/supabaseServer`를 목으로 두어 `getUser()`가 `{ user: null }`을 반환하는 가짜 클라이언트 사용.
- **수정한 파일**: `src/app/api/chat/route.test.ts`, `src/app/api/mentor/route.test.ts` — next/headers·supabaseServer 목 추가.
- **결과**: **PASS** — Lint 통과, 테스트 10/10 통과. 챗봇이 “테스트 실패 원인 파악 → 목 추가로 수정 → 전체 테스트 통과”까지 구현·검증된 상태.

### 다른 커서는? (옵션 A 진행 중일 때)

- **Cursor 1**: 옵션 A(Dojo·Dear Me 2차 구현) 진행 중.
- **Cursor 2**는 아래 둘 중 하나를 쓰면 됨.

**역할 1 — 검증 (진행이 끝난 뒤)**  
Cursor 1이 "구현 완료"라고 하면, Cursor 2에 아래를 붙여 넣기.

```
방금 다른 커서가 Dojo·Dear Me 2차 콘텐츠(옵션 A) 구현을 끝냈다고 해. 검증해줘.

- docs/DOJO_DEAR_ME_2ND_VERIFICATION.md 체크리스트(항목 1~10) 순서대로 확인해. DOJO_DEAR_ME_NEXT_CONTENT.md §4·§5·§6·§2-2·§1-4·§6 스펙 기준이야.
- docs/AGENTS_SHARED_README.md·.cursor/rules/bty-*.mdc 위반 없는지 점검해.
- 결과를 PASS/FAIL + 불충족 항목(있으면)으로 보고하고, DOJO_DEAR_ME_2ND_VERIFICATION.md 하단 검증 결과 템플릿에 검증 일시·결과·비고 적어줘.
```

**역할 2 — 지금 바로 (병렬 작업)**  
기다리지 않고 Cursor 2에서 지금 할 수 있는 작업. 아래 중 하나 복사.

```
docs/NEXT_TASKS_2.md §1-2: .cursor/rules/bty-release-gate 규칙에 맞게 배포 전 체크 실행해줘. Auth/Cookies, Weekly Reset, Leaderboard, Migration, API Contract, Verification Steps 확인하고 결과 요약해줘.
```

```
docs/DOJO_DEAR_ME_NEXT_CONTENT.md를 읽고, 2차 구현 시 검증할 체크리스트(5~10개 항목)를 docs/ 폴더에 짧게 정리해줘. 나중에 다른 커서가 구현 끝냈을 때 검증용으로 쓸 거야.
```

### 옵션 A 검증 결과 (Dear Me 1차 플로우 진입)

- **검증 일시**: 옵션 A 구현 후 Cursor 2 검증 수행.
- **가정**: 옵션 A = DOJO_DEAR_ME_NEXT_CONTENT §4 "Dear Me 1차 플로우 진입(단계 1)"만 해당. 50문항 목차·연습 플로우는 1차에서 스펙/목차만 확정된 항목으로 이번 구현 범위 미포함.
- **규칙 점검**: AGENTS_SHARED_README·bty-.mdc — 도메인/API/UI 분리, XP·시즌·리더보드 계산 금지(UI), 비즈니스 로직 중복 없음. PageClient·dear-me 페이지·i18n만 사용, 새 API/도메인 로직 없음. ✅
- **결과**: **PASS**
- **발견 이슈**: 없음.

**상세·재검증 시**: **`docs/DOJO_DEAR_ME_VERIFICATION_CHECKLIST.md`** 하단에 위 결과가 반영되어 있음. 동일 체크리스트로 재검증 시 해당 문서 사용.

### 옵션 A 재검증 결과 (Dojo·Dear Me 2차 전체)

- **검증 일시**: Dojo·Dear Me 2차(옵션 A) 구현 후 Cursor 2 재검증.
- **규칙 점검 (AGENTS_SHARED_README · bty-.mdc)**

| 규칙 | 확인 |
|------|------|
| 도메인/API/UI 분리 | Dojo/Dear Me 진입·멘토 페이지는 src/domain/, src/lib/bty/arena/ 미사용. 새 API/엔진 미추가. |
| XP/리더보드/시즌 계산 금지(UI) | page.client.tsx(bty), PageClient.tsx(dear-me), mentor/page.client.tsx에 tierFromCoreXp, levelToTier, .sort(, weeklyXp, coreXp 등 없음. |
| bty-ui-render-only | Arena/리더보드 컴포넌트 변경 없음. XP·랭킹·시즌 계산 로직 없음. |
| bty-arena-global | 시즌/리더보드/XP 관련 비즈니스 로직 추가 없음. |

- **발견 이슈**: 없음.
- **검증 체크리스트 (DOJO_DEAR_ME_VERIFICATION_CHECKLIST §체크리스트)**: 1~8항목 모두 ✅ (진입 문구·시작하기·i18n ko/en·레이아웃·Dear Me hasStartedDearMe 분기·locale 전달·기존 경로 회귀 없음).
- **결과**: **PASS** — 스펙(진입·1단계·Dear Me 진입) 만족, 규칙 위반 없음. **`docs/DOJO_DEAR_ME_VERIFICATION_CHECKLIST.md`** 하단에 이번 재검증 결과가 추가되어 있음.

### Leadership Engine P8 최종 검증 완료

- **검증 일시**: P8 최종 검증(Cursor 4) 수행.
- **내용**: `docs/ENGINE_ARCHITECTURE_DIRECTIVE_PLAN.md` §8 — Stage·AIR·Reset·TII·Certified·LRI가 `docs/LEADERSHIP_ENGINE_SPEC.md`와 일치하는지, bty-arena-global·bty-release-gate·bty-ui-render-only 위반 여부 확인.
- **결과**: **PASS** — SPEC §2–§7 대로 구현 일치, 세 규칙 위반 없음. 상세는 **`docs/ENGINE_ARCHITECTURE_DIRECTIVE_PLAN.md` §8 검증 기록** 참고.

---

### 다음 과정 (옵션 A 완료 후)

- **옵션 A**: Dojo·Dear Me 2차 — Dear Me 1차 플로우 진입 완료·검증 PASS. **NEXT_STEPS_RUNBOOK** 기준 해당 단계 완료.
- **현재 커서 배치 (참고)**  
  - **Cursor 4**: **Arena 코드네임·아바타** — **`docs/ARENA_CODENAME_AVATAR_PLAN.md`** 기준으로 진행. 리더보드 아바타 역전(Inferno/Spark) 확인·수정 → 코드네임 “코드별 1회” 규칙 → 캐릭터 고정+옷 선택 단계. 같은 영역은 다른 커서에 지시하지 말 것.

**다음에 시킬 수 있는 작업**

| 누구에게 | 할 일 | 복사용 프롬프트 (RUNBOOK 또는 아래) |
|----------|--------|--------------------------------------|
| **Cursor 1** | BACKLOG §7 Dojo 2차 | `PROJECT_BACKLOG §7: Dojo 50문항 목차 또는 연습 플로우 1종 스펙 정리·진입/1단계 구현해줘. docs/DOJO_DEAR_ME_NEXT_CONTENT.md 참고.` |
| **Cursor 1** | 시스템 업그레이드 v3 확장 (선택) | `docs/HEALING_COACHING_SPEC_V3.md`, docs/specs/healing-coaching-spec-v3.json 읽고, 이벤트 15종·stat_distribution·30일 가속 등 v3 스펙 반영해줘. (Phase A1–F1은 완료됨.)` |
| **Cursor 2** | BACKLOG §8 빈 상태 보강 | `PROJECT_BACKLOG §8: BRIEF §2에 따라 리더보드·대시보드 등 빈 상태에 일러·아이콘 + 한 줄 문구 넣어줘.` |
| **Cursor 2** | 배포 전 체크 | §6 "역할 2 — 배포 전 체크" 블록 복사. |
| **Cursor 4** | (현재 진행 중) | **`docs/ARENA_CODENAME_AVATAR_PLAN.md`** — 리더보드 아바타 역전 수렴, 코드네임 코드별 1회, 캐릭터+옷 시스템. 완료 시 검증은 Cursor 2에 "아바타·코드네임 계획 검증해줘" 등으로 지시. |

**당신이 할 일**: 위 표에서 비어 있는 Cursor(1, 2)에게 다음 할 일 하나씩 복사용 프롬프트로 지시. Cursor 4는 아바타·코드네임 계획 작업 끝날 때까지 같은 영역 다른 지시 금지.

### Cursor 4 — Arena 코드네임·아바타 (계획 문서 기준)

- **계획 문서**: **`docs/ARENA_CODENAME_AVATAR_PLAN.md`**
- **요약**: (1) 리더보드 아바타 “반대로 적용” — Inferno/Spark 계정·DB·저장 시점 확인 후 수렴 (2) 코드네임 “코드가 바뀌고 25 tier → 그 코드에서 1회” 규칙 — `sub_name_renamed_at_code_index` 등 코드별 1회 (3) 캐릭터 고정+옷만 선택 — 레이어(캐릭터/옷/악세사리), 표시 방식 A/B/C 검토, 단계 1→2→3→4→5 순.
- **Cursor 4에게 지시할 때**: `docs/ARENA_CODENAME_AVATAR_PLAN.md` 열어 주고, §4 체크리스트부터 진행하거나, “계획서 §1·§2·§3 단계별로 진행해줘” 등으로 지시하면 됨.

**Cursor 4 구현 범위 (현재 반영됨)**

| 항목 | 상태 |
|------|------|
| 리더보드 아바타 역전 | sub-name/profile 인증을 `requireUser(req)`로 통일, 리더보드 행별 `profileMap.get(r.user_id)` 주석·로직 유지 |
| 코드네임 코드별 1회 | 마이그레이션 `sub_name_renamed_at_code_index`, sub-name POST·core-xp `subNameRenameAvailable` 반영 |
| 캐릭터+옷 1단계 | `avatar_selected_outfit_id` 마이그레이션, profile PATCH, core-xp `currentOutfit`·`avatarSelectedOutfitId`, 대시보드 “선택한 옷” 드롭다운 |

**배포 전 필요**

- **마이그레이션 3개 적용**: `20260309000000`, `20260310000000`, `20260311000000`
- **(선택)** Cursor 2에 “아바타·코드네임 계획 검증해줘” 로 검증 요청

→ 위 흐름대로 진행하면 됨.

### 빈 상태(empty state) 보강

- **BRIEF §2 반영**: ✅ **적용 완료**
- **로딩 (전역 통일)**  
  - **공통**: `PageLoadingFallback` (`src/components/bty-arena/PageLoadingFallback.tsx`) — Suspense/페이지 로딩용, LoadingFallback(⏳ + "잠시만 기다려 주세요." + 카드형 스켈레톤) 사용.  
  - **Suspense fallback 14곳**: `Loading...`/스피너 → `<PageLoadingFallback />` (app/[locale]/loading.tsx, 랜딩, Dojo 진입, mentor, elite, integrity, forbidden, auth/callback, auth/reset-password, dear-me, journal, app/page, assessment, assessment/result 등).  
  - **인라인 로딩**: app/page.client.tsx, journal page.client·PageClient, TrainShell, TrainLayoutContext, AuthGate, JourneyBoard, auth/reset-password page.client — "loading..."/스피너 → `<PageLoadingFallback />` 또는 `<LoadingFallback />`.  
  - **유지**: 리더보드 t.loading(리스트는 LeaderboardListSkeleton), 버튼 로딩 문구, 관리자 페이지(admin)는 미적용.
- **빈 상태**: 리더보드 빈 목록·"내 순위 없음" — 기존 EmptyState(🏆/📊 + 문구 + CTA/hint). ArenaLevelsCard — emptyCta 추가, 해금 레벨 없을 때 EmptyState(📂 + 문구 + CTA). 감정 스탯 카드 — 기존 EmptyState(🌱). i18n: arenaLevels.noLevelsYet, arenaLevels.emptyCta (ko/en).
- **일관성**: 사용자 경로에서 로딩 시 스피너/"Loading…"만 나오는 구간 없이, 아이콘 + 한 줄 문구 + (필요 시) 카드형 스켈레톤으로 통일.

### 리더보드 악센트 변수 통일

- **적용 완료**: `leaderboard/page.tsx` 1등(챔피언) 강조 색을 `var(--dojo-purple)` → `var(--arena-accent)` 로 통일해 두었음. 시각적 차이 없음, 악센트 한 변수로 맞춤.

### 빈 상태·로딩 (브리프 §2)

- **적용 완료**: DESIGN_FIRST_IMPRESSION_BRIEF §2에 맞춰 **"Loading…"/스피너를 카드형 스켈레톤 + 아이콘·한 줄 문구로 전역 통일**. PageLoadingFallback 공통 사용, Suspense fallback 14곳 + 인라인 로딩(PageClient·TrainShell·AuthGate·JourneyBoard 등) 7곳 변경. 리더보드 리스트(LeaderboardListSkeleton)·버튼 로딩·관리자 페이지는 의도적으로 유지. (상세: 위 "빈 상태(empty state) 보강" 참고.)

### 히어로와 제목 블록 순서

- **현재**: 대시보드에서 히어로가 최상단, 그 아래 "Dashboard" 제목 블록. "첫 화면 = 히어로 한 문장" 요구사항 충족.
- **선택 개선**: 강조를 더 하고 싶을 때만 제목 블록 비중·순서(예: 히어로와의 시각적 간격) 조정 검토하면 됨.

---

**마무리**: **§6 현재 상태 · 다음 지시 (마무리)** 에 커서별 역할·Cursor 4 해야 할 내용(구현 범위·배포 전 마이그레이션 3개·선택 검증)·다음에 시킬 수 있는 작업 표가 정리되어 있습니다. 거의 마무리된 RUNBOOK은 §6 + COMMANDER_CURSORS_REF만 보면 흐름을 따를 수 있습니다.
