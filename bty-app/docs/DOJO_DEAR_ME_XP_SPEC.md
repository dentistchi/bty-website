# Dojo / Dear Me 활동 XP 스펙 (Phase 2-4, 2-5)

**목표**: 멘토 대화·전역 챗(Dear Me/Dojo) 참여를 Seasonal XP에 반영해, Arena만이 아닌 활동도 리더보드·성장에 기여하게 한다.

---

## 1. 기록 대상 (이벤트 정의)

| 활동 | 트리거 | XP (MVP) |
|------|--------|----------|
| **멘토 메시지** | 사용자가 Dr. Chi 멘토 페이지에서 메시지 1회 전송 성공 | 5 |
| **챗 메시지** | 전역 챗봇에서 사용자가 메시지 1회 전송 성공 (Dear Me/Dojo 모드 구분 없이 동일) | 5 |

- **체류 시간**은 MVP에서 제외 (추후 옵션).
- **일일 캡**: Arena와 동일하게 **1,200** 적용. 당일 arena_events + activity_xp 합산 후 초과분은 잘림.

---

## 2. 저장 구조

- **테이블**: `activity_xp_events`
  - `id` (bigserial PK)
  - `user_id` (uuid, auth.users)
  - `activity_type` (text): `MENTOR_MESSAGE` | `CHAT_MESSAGE`
  - `xp` (int): 실제 반영된 XP (캡 적용 후)
  - `created_at` (timestamptz)

- **weekly_xp**: Arena와 동일하게 `league_id IS NULL` 행에 Seasonal XP 누적.
- **Core 전환**: `applySeasonalXpToCore` 호출 (45:1 / 60:1 동일).

---

## 3. 로직 요약

1. **멘토** (`POST /api/mentor`): 응답 성공 후 `recordActivityXp(supabase, userId, "MENTOR_MESSAGE", 5)` 호출.
2. **챗** (`POST /api/chat`): 응답 성공 후 `recordActivityXp(supabase, userId, "CHAT_MESSAGE", 5)` 호출.
3. **recordActivityXp** (공용):
   - 당일 `arena_events` xp 합 + 당일 `activity_xp_events` xp 합 → `todayTotal`
   - `deltaCapped = min(xp, DAILY_CAP - todayTotal)`, 0 이하면 스킵
   - `activity_xp_events` insert (xp = deltaCapped)
   - `weekly_xp` (league_id null) 행에 deltaCapped 가산
   - `applySeasonalXpToCore(supabase, userId, deltaCapped)`

---

## 4. 마이그레이션

Supabase SQL Editor에서 아래 파일 실행 후 사용:

- `docs/supabase-migrations/activity_xp_events.sql`

## 5. 완료 기준

- [x] `activity_xp_events` 테이블 및 RLS (마이그레이션 파일)
- [x] `recordActivityXp` 공용 함수 (lib/bty/arena/activityXp.ts)
- [x] `/api/mentor` 성공 시 MENTOR_MESSAGE 5 XP 기록
- [x] `/api/chat` 성공 시 CHAT_MESSAGE 5 XP 기록
- [x] 일일 캡 1,200에 Arena + 활동 XP 합산 적용
