# Dojo / Dear Me 활동 XP 스펙 (Phase 2-4, 2-5)

**목표**: 멘토 대화·전역 챗(Dear Me/Dojo) 참여를 Seasonal XP에 반영해, Arena만이 아닌 활동도 리더보드·성장에 기여하게 한다.

**Phase 2-4 설계 결과 (한눈에)**  
- **무엇을 기록할지**: 멘토 메시지 1회, 챗 메시지 1회 (체류 시간은 추후).  
- **얼마나 줄지**: 건당 **5 XP**, 일일 캡 **1,200** (Arena와 합산).  
- **이벤트 타입**: `MENTOR_MESSAGE`, `CHAT_MESSAGE` (코드: `src/lib/bty/arena/activityXp.ts`의 `ActivityType`, `ACTIVITY_XP`).

---

## Phase 2-4 설계 요약: 무엇을 기록할지, 얼마나 줄지

| 기록 대상 | 트리거 | XP (건당) | MVP 반영 |
|-----------|--------|-----------|----------|
| **멘토 메시지** | Dr. Chi 멘토 페이지에서 사용자 메시지 1회 전송 성공 | 5 | ✅ |
| **챗 메시지** | 전역 챗봇에서 사용자 메시지 1회 전송 성공 (Dear Me/Dojo 구분 없음) | 5 | ✅ |
| **멘토 체류 시간** | 멘토 페이지 N분 이상 체류 | (미정) | ❌ 추후 |
| **챗/Dojo 체류 시간** | Dojo/Dear Me 페이지 체류 N분 | (미정) | ❌ 추후 |

- **일일 캡**: Arena와 동일 **1,200**. 당일 `arena_events` XP + `activity_xp_events` XP 합산 후 초과분은 반영하지 않음.
- **체류 시간**은 MVP에서 제외. 추후 이벤트 타입(`DOJO_DWELL`, `DEAR_ME_DWELL`, `MENTOR_DWELL` 등) 및 XP량 별도 스펙.

---

## 1. 이벤트 정의 (스펙)

### 1.1 MVP 이벤트 타입

| `activity_type` | 설명 | 트리거 | XP | 호출 위치 |
|-----------------|------|--------|-----|-----------|
| `MENTOR_MESSAGE` | 멘토 대화 1회 | `POST /api/mentor` 응답 성공 후 (사용자 메시지 1회 대응) | 5 | `/api/mentor` |
| `CHAT_MESSAGE` | 전역 챗 1회 | `POST /api/chat` 응답 성공 후 (사용자 메시지 1회 대응) | 5 | `/api/chat` |

- Dear Me / Dojo 모드 구분 없이 챗 1회 = 5 XP 동일.
- 비로그인 사용자: 이벤트 기록·XP 미적용.

### 1.2 추후 검토 이벤트 (미구현)

| 후보 타입 | 설명 | 비고 |
|-----------|------|------|
| `MENTOR_DWELL` | 멘토 페이지 체류 N분 | N, XP량 미정 |
| `DOJO_DWELL` | Dojo 페이지 체류 N분 | N, XP량 미정 |
| `DEAR_ME_DWELL` | Dear Me 페이지 체류 N분 | N, XP량 미정 |

---

## 2. 기록 대상 (요약)

- **지금 기록하는 것**: 멘토 메시지 1회, 챗 메시지 1회 (각 5 XP, 일일 캡 내에서만).
- **기록하지 않는 것**: 체류 시간, 세션 길이, 토픽/모드별 차등 XP (MVP에서는 모두 동일 5 XP).

---

## 2.1 코드 참조 (이벤트 정의)

구현은 `bty-app/src/lib/bty/arena/activityXp.ts` 에서:

- **타입**: `ActivityType = "MENTOR_MESSAGE" | "CHAT_MESSAGE"`
- **XP량**: `ACTIVITY_XP = { MENTOR_MESSAGE: 5, CHAT_MESSAGE: 5 }`
- **일일 캡**: `DAILY_CAP = 1200` (Arena와 동일 풀)

이벤트 타입·XP량을 바꿀 때는 이 파일과 본 스펙을 함께 수정할 것.

---

## 3. 저장 구조

- **테이블**: `activity_xp_events`
  - `id` (bigserial PK)
  - `user_id` (uuid, auth.users)
  - `activity_type` (text): `MENTOR_MESSAGE` | `CHAT_MESSAGE`
  - `xp` (int): 실제 반영된 XP (캡 적용 후)
  - `created_at` (timestamptz)

- **weekly_xp**: **active league** 기준. `getActiveLeague()`로 현재 시즌 리그를 구한 뒤 해당 `league_id` 행에 Seasonal XP 누적 (리더보드와 동일). 활성 리그가 없으면 `league_id` null 행 사용.
- **Core 전환**: `applySeasonalXpToCore` 호출 (45:1 / 60:1 동일).

---

## 4. 로직 요약

1. **멘토** (`POST /api/mentor`): 응답 성공 후 `recordActivityXp(supabase, userId, "MENTOR_MESSAGE")` 호출.
2. **챗** (`POST /api/chat`): 응답 성공 후 `recordActivityXp(supabase, userId, "CHAT_MESSAGE")` 호출.
3. **recordActivityXp** (공용, `lib/bty/arena/activityXp.ts`):
   - 당일 `arena_events` xp 합 + 당일 `activity_xp_events` xp 합 → `todayTotal`
   - `deltaCapped = min(활동 XP, DAILY_CAP - todayTotal)`, 0 이하면 스킵
   - `activity_xp_events` insert (xp = deltaCapped)
   - **weekly_xp**: `getActiveLeague()`로 구한 `league_id`(없으면 null) 행에 deltaCapped 가산
   - `applySeasonalXpToCore(supabase, userId, deltaCapped)`

---

## 5. 마이그레이션

- **Supabase 마이그레이션**: `bty-app/supabase/migrations/20260229_activity_xp_events.sql`  
- **문서용 복사본**: `bty-app/docs/supabase-migrations/activity_xp_events.sql` (동일 내용 참고용)

---

## 6. 완료 기준 (Phase 2-4 설계 / Phase 2-5 구현)

### Phase 2-4 (설계)

- [x] 무엇을 기록할지 정의: 멘토 메시지, 챗 메시지 (체류 시간은 추후)
- [x] 얼마나 줄지 정의: 건당 5 XP, 일일 캡 1,200 (Arena와 합산)
- [x] 이벤트 타입 정의: `MENTOR_MESSAGE`, `CHAT_MESSAGE` 스펙 및 추후 후보 정리

### Phase 2-5 (구현)

- [x] `activity_xp_events` 테이블 및 RLS (마이그레이션 파일)
- [x] `recordActivityXp` 공용 함수 (lib/bty/arena/activityXp.ts)
- [x] `/api/mentor` 성공 시 MENTOR_MESSAGE 5 XP 기록
- [x] `/api/chat` 성공 시 CHAT_MESSAGE 5 XP 기록
- [x] 일일 캡 1,200에 Arena + 활동 XP 합산 적용
