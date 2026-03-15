# Arena / Leadership Lab — XP 및 모드 스펙 (정식)

**상태:** 정식. 구현은 이 문서를 기준으로 한다.  
**관계:** `BTY_ARENA_DOMAIN_SPEC.md`의 Core/Weekly 원칙을 따르며, **XP 계산·모드 규칙**은 이 문서가 단일 기준이다.

---

## 1. 모드 정의

| 모드 | 목적 | Core XP | Weekly XP | 제한 |
|------|------|---------|-----------|------|
| **Arena** | 실전·경쟁·리더보드 | 지급 | 지급 | 횟수 제한 없음 (일일 캡 등은 별도 정책) |
| **Lab** (Leadership Lab) | 훈련·학습·실험 | 지급 | **0** | **하루 3회** (제출 성공 시 1회 차감) |

- Lab = 이전 명칭 "Practice". UI/문서는 **Leadership Lab** 사용 권장.
- **Lab attempts:** 제출 **성공** 시에만 1회 차감. 시나리오 시작 시가 아님.

---

## 2. 난이도 베이스 (공통)

| difficulty | base |
|------------|------|
| easy | 10 |
| mid | 20 |
| hard | 35 |
| extreme | 50 (MVP에서 잠금 가능) |

---

## 3. Arena XP 공식

### 3.1 구성

- **xp_base** = difficulty_base[difficulty]
- **xp_primary** = xp_base (Primary 선택 A/B에 따른 기본)
- **xp_reinforce** = round(xp_base × 0.5) (Reinforce 선택 X/Y에 따른 보너스)
- **xp_time_bonus** = round(xp_base × time_factor), time_factor ∈ [0, 0.25] (Arena만)
- **xp_streak_bonus** = round(xp_base × streak_factor), streak_factor ∈ [0, 0.20] (연속 플레이 일수)

### 3.2 Arena Core XP

```
arena_core_xp = xp_primary + xp_reinforce + xp_time_bonus + xp_streak_bonus
```

(각 항목은 0 이상으로 클램프.)

### 3.3 Arena Weekly XP

```
arena_weekly_xp = xp_base + performance_bonus
```

performance_bonus는 xp_reinforce 등과 동일한 논리로 정의 가능. MVP에서는 단순화하여:

```
arena_weekly_xp = xp_primary + xp_reinforce + xp_time_bonus
```

로 두어도 됨. (순위용이므로 Core와 동일한 “버는 양”을 Weekly에도 반영하는 방식.)

### 3.4 time_factor (Arena만)

- **time_factor** = clamp((time_remaining / time_limit - 0.5) × 0.5, 0, 0.25)
- 남은 시간이 많을수록 보너스. 타이머 없으면 0.

### 3.5 streak_factor (연속 플레이 일)

| 연속 일수 | streak_factor |
|-----------|----------------|
| 1일 | 0 |
| 2일 | 0.05 |
| 3일 | 0.10 |
| 4일+ | 0.15 (상한 0.20) |

- Lab에서 적용 시 **절반**만 적용하거나 0으로 둠 (MVP에서는 Arena만 적용 가능).

---

## 4. Lab XP 공식

- **Lab에서는 Weekly XP를 지급하지 않음.**
- **lab_core_xp** = round(base(difficulty) × 0.6)

| difficulty | base | lab_core_xp |
|------------|------|-------------|
| easy | 10 | 6 |
| mid | 20 | 12 |
| hard | 35 | 21 |

- time_bonus, streak_bonus는 Lab에서 사용하지 않거나 0.
- **Lab 시도 횟수:** 사용자당 **하루 3회**. 제출 **성공** 시 1회 차감.

---

## 5. Primary / Reinforce 선택 (시나리오)

- **Primary choices:** A/B (첫 번째 결정). xp_primary = xp_base.
- **Reinforce choices:** X/Y (두 번째 결정). xp_reinforce = round(xp_base × 0.5).
- 시나리오 데이터에 `primaryChoices`, `reinforceChoices` 및 각 선택별 effects를 정의.
- **MVP 호환:** 아직 Primary/Reinforce가 없으면 xp_reinforce = 0, xp_primary = xp_base로 계산.

---

## 6. 레벨·티어·스테이지 (기존 도메인 스펙 유지)

- **weekly_level** = floor(weekly_xp_total / 100) + 1
- **weekly_tier:** 0–99 Bronze, 100–199 Silver, 200–299 Gold, 300+ Platinum
- **core_stage** = floor(core_xp_total / 100) + 1
- **core_stage_progress** = core_xp_total % 100

`BTY_ARENA_DOMAIN_SPEC.md` §2와 동일.

---

## 7. Lab 일일 제한

- **daily_lab_limit** = 3
- **차감 시점:** 제출(submit) **성공** 시 1회 차감.
- **집계:** (user_id, usage_date) 기준. 다음 날 0시(UTC 또는 서비스 기준)에 리셋.
- **초과 시:** 제출 API가 429 또는 400 + `daily lab limit reached` 등으로 거부.

---

## 8. DB 요구사항

- **daily_lab_usage** 테이블: (user_id, usage_date, attempts_used). PK (user_id, usage_date).
- Lab 제출 시: 현재 날짜 행이 없으면 0으로 생성, attempts_used + 1 후 3 초과 여부 검사. 초과 시 예외.
- **submit_decision** RPC 또는 동등한 원자 처리: decision_logs insert + arena_profiles.core_xp_total 갱신 + weekly_xp 갱신(Arena일 때만) + daily_lab_usage 갱신(Lab일 때만).

---

## 9. 구현 참조

- **도메인 (순수 함수):** `bty-app/src/lib/bty/arena/arenaLabXp.ts`  
  - getDifficultyBase, computeLabCoreXp, computeArenaCoreXp, computeArenaWeeklyXp  
  - streakFactorFromDays, timeFactorFromRemaining, inferDifficultyFromEventSum, parseStoredDifficulty, difficultyFromScenarioChoices
- **Core XP 적용:** `bty-app/src/lib/bty/arena/applyCoreXp.ts` — applyDirectCoreXp (Lab·Arena run 완료 시 Core만 반영), applySeasonalXpToCore (리플렉션 보너스 등)
- **Arena run:**  
  - 생성: `POST /api/arena/run` — body: scenarioId, locale?, difficulty?, meta? (예: { time_limit }). `arena_runs.difficulty`, `arena_runs.meta` 저장  
  - 완료: `POST /api/arena/run/complete` — body: runId, time_remaining? (초). run에 저장된 difficulty 우선 사용, meta.time_limit + body.time_remaining으로 time_factor 계산
- **Lab:**  
  - 제출: `POST /api/arena/lab/complete` — body: difficulty?. 일일 3회 제한(RPC consume_lab_attempt), Core XP만 지급  
  - 사용량: `GET /api/arena/lab/usage` — limit, attemptsUsed, attemptsRemaining
- **DB:** daily_lab_usage (마이그레이션 20260411000000), arena_runs.difficulty·meta (20260412000000). Lab 차감 RPC: consume_lab_attempt.
- **단일 진실:** 이 문서가 Arena/Lab XP 및 Lab 제한의 단일 기준이다. 상세 구현 상태는 `ARENA_LAB_XP_RECONCILIATION.md` §7 참조.
