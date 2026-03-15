# Arena / Lab XP·구조 — 정리 및 기준 스펙

**상태:** **새 공식이 정식 기준이다.** 구현은 `docs/spec/ARENA_LAB_XP_SPEC.md`를 따른다.  
**목적:** (과거) 새 서류 vs 현재 시스템 비교. (현재) 새 공식 기준으로 서류 반영 후 구현 시 참고용 정리.

---

## 1. 철학·구조 — 일치

| 항목 | 새 서류 | 현재 (BTY_ARENA_DOMAIN_SPEC 등) | 판정 |
|------|--------|----------------------------------|------|
| 본질 = Training, 형태 = Game | Leadership Training + Competitive Game Mechanics | — | ✅ 새 서류가 명시한 정의로 두면 됨 |
| Core XP 영구 | Core XP never reset | Core XP permanent, never reset | ✅ 일치 |
| Weekly XP = 경쟁/리더보드 | Weekly XP 리셋, 리더보드만 | Weekly XP resets, leaderboard ranking only | ✅ 일치 |
| 시즌 진행 ≠ 랭킹 | — | Season progression must not affect leaderboard | ✅ 일치 |
| Arena vs Practice(Lab) 역할 분리 | Arena=실전/랭크, Lab=훈련/성장 | 현재 코드에는 **Lab 모드 없음** | ⚠️ Lab은 신규 도입 |

---

## 2. XP 계산 — 차이

### 2.1 Arena/Lab 구현 (현재)

- **Arena run/complete:** `src/app/api/arena/run/complete/route.ts`  
  - XP 계산: `arenaLabXp.computeArenaCoreXp` / `computeArenaWeeklyXp` (난이도·streak·time 보너스 반영).  
  - Core: `applyDirectCoreXp`. Weekly: 기존 capping 후 `weekly_xp` 반영.  
  - 난이도: run에 저장된 `difficulty` 우선, 없으면 이벤트 합산으로 `inferDifficultyFromEventSum`.  
  - 타이머: run `meta.time_limit` + 완료 요청 body `time_remaining`으로 `timeFactorFromRemaining` 계산.
- **Run 생성:** `POST /api/arena/run` — body에 `difficulty`, `meta: { time_limit }` 선택. 클라이언트 `useArenaSession.createRun`에서 시나리오 choices 기준 `difficultyFromScenarioChoices`, `ARENA_TIME_LIMIT_SECONDS`(300)로 meta 전달.
- **Lab:** `POST /api/arena/lab/complete` — Core XP만, 하루 3회 제한. `GET /api/arena/lab/usage`로 남은 횟수 조회.
- **레거시:** `applySeasonalXpToCore`는 리플렉션 퀘스트 보너스 등 일부 경로에서만 사용. Arena run 완료 XP는 위 새 공식만 사용.

### 2.2 새 서류

- **Arena:**  
  - Core XP = base(difficulty) + reinforcement + streak + time_bonus  
  - Weekly XP = base + performance_bonus  
  - difficulty_base: easy=10, mid=20, hard=35, extreme=50  
- **Lab:**  
  - Core XP만: `round(base(difficulty) * 0.6)`  
  - Weekly XP = 0  
- **Primary/Reinforce 선택지:** A/B + X/Y 두 단계로 나누고, 각각 보너스가 있음.

### 2.3 정리

| 항목 | 현재 | 새 서류 | 조치 |
|------|------|--------|------|
| XP 공식 | xpBase × difficulty (단일), 45:1/60:1로 Core 전환 | base + reinforcement + time + streak (Arena), Lab 0.6×base | 새 서류 도입 시 **도메인/API에서 공식 교체** 필요 |
| Primary/Reinforce | 없음 (choice 1개) | A/B + X/Y | 시나리오 데이터·엔진·submit payload 확장 필요 |
| Lab 전용 공식 | 없음 (Lab 모드 자체 없음) | Lab = Core only, 0.6×base | Lab 모드 추가 시 함께 반영 |

**결론:** **새 공식이 정식이다.** 구현 시 기존 `computeResult`·`awardXp`·`applySeasonalXpToCore`를 `ARENA_LAB_XP_SPEC.md`의 Arena/Lab 수식·모드에 맞게 교체하거나 새 레이어로 이전한다.

---

## 3. Arena vs Lab 모드

| 항목 | 현재 | 새 서류 |
|------|------|--------|
| Lab(Practice) 모드 | **없음** | 있음. 하루 3회, 제출 성공 시 1회 차감, Core XP만. |
| Arena 전용 제한 | 일일 캡 1200 (activityXp 등) | 횟수 제한 없음, XP 공식으로 조절. |
| DB | arena_runs, arena_events, weekly_xp (league_id null) | decision_logs, mode='arena'|'lab', daily_lab_usage. |

**결론:** Lab은 **신규**이다. `arena_mode`(또는 equivalent), `daily_lab_usage` 테이블, Lab 전용 submit 경로/로직이 필요하다.

---

## 4. DB·RPC

| 항목 | 현재 | 새 서류 |
|------|------|--------|
| weekly_xp | user_id + **league_id (null)** 1행/유저 (글로벌 풀) | user_id + **league_id** (30일 league 참조), 리그별 행 |
| 리그 | active league 개념 있음(activeLeague 등) | leagues 테이블, start_date/end_date, status |
| 제출 처리 | arena_runs + arena_events → run/complete에서 합산 후 weekly_xp 업데이트 + applySeasonalXpToCore | **submit_decision(mode, …)** RPC 1회로 decision_logs insert + profile/weekly_xp 갱신 |
| Lab 제한 | 없음 | daily_lab_usage (user_id, usage_date, attempts_used), RPC 내에서 < 3 검사 |

**결론:** 새 서류의 DDL·RPC는 “목표 스키마”로 두고, **현재는 league_id null 단일 풀**이라면, 리그 단위로 갈 때는 마이그레이션·호환 계획이 필요하다. `submit_decision` RPC는 “한 번에 원자 처리”라는 점에서 현재 run/complete + apply 흐름을 대체·보완하는 설계로 보면 된다.

---

## 5. 네이밍·UX

- **Practice → Leadership Lab:** 새 서류 권장명. 현재 코드에 "Practice"가 있으면 Lab으로 통일 시 UI/문서만 바꿔도 됨.
- **CONTINUE ARENA:** 새 서류에서 핵심 CTA. 현재 대시/arena 진입 버튼과 동일한 역할로 두고 문구만 맞추면 됨.

---

## 6. 오류·충돌 여부

- **논리 오류:** 없음. Core 영구·Weekly 리셋·리더보드=Weekly만·Arena vs Lab 분리 모두 기존 스펙과 방향 일치.
- **충돌:**  
  - **XP 공식:** 현재 “단일 earned + 비율 Core” vs 새 “Arena dual (Core+Weekly) + Lab Core only” → **공식이 다름**. 둘 다 동시에 쓰면 안 되고, 하나로 통일하거나 단계적으로 새 공식으로 이전해야 함.  
  - **모드:** 현재는 Arena만 있으므로 Lab 추가는 “기능 추가”이지 기존 로직을 깨는 변경은 아님.  
  - **DB:** league_id null vs league_id FK, decision_logs vs arena_runs/arena_events → **스키마/테이블이 다름**. 새 서류대로 가려면 마이그레이션 또는 병행 기간 설계 필요.

---

## 7. 기준 스펙 및 구현 순서

- **정식 기준:** `docs/spec/ARENA_LAB_XP_SPEC.md`. 모든 XP 계산·Lab 제한·모드 규칙은 여기为准.

### 7.1 구현 완료 항목

| # | 항목 | 구현 위치·요약 |
|---|------|----------------|
| 1 | Arena/Lab XP 도메인 | `bty-app/src/lib/bty/arena/arenaLabXp.ts` — getDifficultyBase, computeLabCoreXp, computeArenaCoreXp, computeArenaWeeklyXp, streakFactorFromDays, inferDifficultyFromEventSum, parseStoredDifficulty, timeFactorFromRemaining, difficultyFromScenarioChoices, LAB_DAILY_ATTEMPT_LIMIT |
| 2 | daily_lab_usage + Lab 제한 | 마이그레이션 `20260411000000_daily_lab_usage.sql`, RPC `consume_lab_attempt`, `labUsage.ts` (getLabAttemptsUsed, consumeLabAttempt) |
| 3 | Lab 전용 Core XP | `applyCoreXp.ts` — applyDirectCoreXp |
| 4 | Lab 제출 API | `POST /api/arena/lab/complete` — body: difficulty?, 하루 3회 RPC 차감, Core XP만 지급 |
| 5 | Arena run/complete 새 공식 | `POST /api/arena/run/complete` — computeArenaCoreXp/WeeklyXp, applyDirectCoreXp, streak·timeFactor 반영. 난이도: run.difficulty 우선, 없으면 inferDifficultyFromEventSum |
| 6 | Lab 사용량 GET | `GET /api/arena/lab/usage` — limit, attemptsUsed, attemptsRemaining |
| 7 | Lab UI | `/[locale]/bty-arena/lab` 페이지(GET usage 표시), Arena 페이지 `LabUsageStrip`, 대시보드 Leadership Lab 카드·링크 |
| 8 | Run 생성 시 difficulty·meta | `POST /api/arena/run` — body: difficulty?, meta? (예: { time_limit }). `arena_runs` 컬럼 difficulty, meta 추가 마이그레이션 `20260412000000_arena_runs_difficulty_meta.sql` |
| 9 | Run 완료 시 time_remaining | run/complete body: time_remaining? (초). run.meta.time_limit와 함께 timeFactor 계산. 클라이언트 `useArenaSession`: createRun 시 scenario·timeLimitSeconds 전달, complete 시 runMetaRef로 time_remaining 계산해 전달 |
| 10 | 시나리오 기준 난이도 | useArenaSession.createRun에서 difficultyFromScenarioChoices(scenario.choices)로 difficulty 전달 |

### 7.2 미완·선택

- 필요 시 `submit_decision` RPC 또는 run/complete에 mode(arena/lab) 분기.
- 테스트: Arena Core+Weekly 지급, Lab Core만·4회째 429, 저장 difficulty·time_remaining 반영 검증.

---

**한 줄 요약:** **새 공식이 서류·구현의 기준이다.** `ARENA_LAB_XP_SPEC.md`를 따르고, 위 구현 완료 항목이 현재 코드와 일치한다.
