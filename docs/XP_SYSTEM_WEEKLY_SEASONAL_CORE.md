# Weekly XP / Seasonal XP / Core XP — 현재 구조 정리

Phase 2(Dojo/Dear Me XP) 설계 전에 **지금 코드베이스에 있는 XP 관련 개념**을 한 번에 정리한 문서입니다.

---

## 1. 세 가지 개념 (의미)

| 용어 | 의미 | 용도 |
|------|------|------|
| **Weekly XP (테이블)** | `weekly_xp` **테이블**의 `xp_total` | 시즌/리그 구간별로 “이번 구간에서 번 XP”. 리더보드·시즌 순위의 **단일 소스** |
| **Seasonal XP** | 위와 **동일한 값**을 문서/UI에서 부르는 이름 | 시즌 경쟁용. “Season XP = weekly_xp 테이블의 xp_total” (시즌 구간 합산) |
| **Core XP** | `arena_profiles.core_xp_total` | 시즌과 무관한 **영구 누적**. Stage·Code·Sub Name·티어 계산에 사용 |

문서(`SEASON_XP_VS_CORE_XP.md`) 요약: **Season XP = 시즌 경쟁용**, **Core XP = 장기 성장용**.

---

## 2. 저장 위치와 갱신 경로

### 2-1. `weekly_xp` 테이블 (Seasonal XP = 리더보드용)

- **스키마**: `user_id`, `league_id` (nullable), `xp_total`, `updated_at`, `created_at`
- **의미**: “현재 시즌/리그 구간에서 이 유저가 번 XP”
- **갱신하는 곳**:
  - **`POST /api/arena/run/complete`**: 런 완료 시 해당 run의 `arena_events` XP 합산 → 일일 캡(1200) 적용 후 `weekly_xp` 행에 더함 → 같은 양으로 `applySeasonalXpToCore` 호출
  - **`recordActivityXp`** (Dojo/Dear Me): `activity_xp_events` insert 후 `weekly_xp` 행에 더함 → 같은 양으로 `applySeasonalXpToCore` 호출
- **읽는 곳**: `GET /api/arena/leaderboard`, `GET /api/arena/weekly-xp`, `GET /api/arena/core-xp`(seasonalXpTotal 표시) 등

→ **리더보드·시즌 순위는 이 테이블만 사용.**

### 2-2. `arena_profiles.core_xp_total` (Core XP)

- **의미**: 영구 누적 XP. Stage = `floor(core_xp_total / 100) + 1`, Tier = `floor(core_xp_total / 10)` (내부용), Code/Sub Name 연동
- **갱신**: `applySeasonalXpToCore(userId, seasonalXp)` 호출 시
  - 전달된 `seasonalXp`를 비율(45:1 또는 60:1)로 Core로 환산해 `core_xp_total`, `core_xp_buffer` 갱신
  - 45:1 = Core < 200일 때(Beginner), 60:1 = 그 외 (`codes.ts` `seasonalToCoreConversion`)
- **호출하는 곳**: `run/complete`(런 완료 시 방금 `weekly_xp`에 반영한 delta), `recordActivityXp`(방금 `weekly_xp`에 반영한 delta)

→ **Core XP는 “Seasonal XP가 올라갈 때만” 같이 올라감** (run 완료·Dojo/Dear Me 활동).

### 2-3. `arena_profiles.weekly_xp`, `arena_profiles.lifetime_xp` (레거시)

- **의미**: 예전 스펙의 “주간/생애” XP. **리더보드·시즌 로직은 사용하지 않음.**
- **갱신**: RPC `increment_arena_xp(p_user_id, p_run_id, p_xp)` 호출 시
  - `arena_profiles.lifetime_xp`, `arena_profiles.weekly_xp` 증가
- **호출하는 곳**:
  - `POST /api/arena/event` (스텝/선택 시 XP 있을 때)
  - `POST /api/arena/free-response` (자유 입력 제출 시)

→ **리더보드·시즌 XP는 `weekly_xp` 테이블 기준**이므로, event/free-response만 쌓인 런은 **런 완료(`run/complete`)가 호출되기 전까지** 리더보드/시즌 숫자에는 안 들어감.  
반대로, **런 완료 시** `run/complete`가 해당 run의 `arena_events` 합을 한 번에 `weekly_xp` 테이블 + Core에 반영함.

---

## 3. 일일 캡 (1,200)

- **적용 위치**:
  - **런 완료**: `run/complete`에서 당일 `arena_events` XP 합산 후 1,200 캡 적용한 뒤 `weekly_xp` + Core 반영
  - **Dojo/Dear Me**: `recordActivityXp`에서 당일 `arena_events` + `activity_xp_events` 합산 후 1,200 캡 적용
- Arena와 Dojo/Dear Me가 **같은 일일 캡 풀**을 공유한다고 보면 됨.

---

## 4. 정리 (지금 우리가 가진 것)

| 항목 | 저장소 | 리더보드/시즌 | Core XP 반영 |
|------|--------|----------------|--------------|
| **Seasonal XP** | `weekly_xp` 테이블 `xp_total` | ✅ 사용 | run/complete·activityXp 시 `applySeasonalXpToCore`로 반영 |
| **Core XP** | `arena_profiles.core_xp_total` | ❌ 미사용 | 45:1 / 60:1로 누적 |
| **레거시 weekly/lifetime** | `arena_profiles.weekly_xp`, `lifetime_xp` | ❌ 미사용 | event/free-response 시에만 증가 |

Phase 2(2-4, 2-5)에서 “Dojo/Dear Me XP”를 설계·구현할 때는:

- **어디에 쌓이게 할지**: 이미 `recordActivityXp`가 `activity_xp_events` + **`weekly_xp` 테이블(Seasonal)** + **Core**까지 반영하고 있음.
- **정책(얼마나 줄지, 무엇을 기록할지)** 만 스펙으로 정리하면 됨 (2-4).  
이미 구현된 경로와 맞는지 확인한 뒤, 필요하면 2-5에서 이벤트 종류·XP량만 확장하면 됨.

---

*참고: `SEASON_XP_VS_CORE_XP.md`, `DOJO_DEAR_ME_XP_SPEC.md`, `src/lib/bty/arena/applyCoreXp.ts`, `src/lib/bty/arena/activityXp.ts`, `src/lib/bty/arena/codes.ts`*
