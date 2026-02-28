# Supabase 마이그레이션 적용 방법

## 방법 1: SQL Editor에서 한 번에 적용 (권장 — 링크 불필요)

1. [Supabase Dashboard](https://supabase.com/dashboard) → 프로젝트 선택 → **SQL Editor**
2. **New query** 클릭
3. `supabase/APPLY_PHASE3_MIGRATIONS.sql` 파일 내용 **전체 복사** 후 붙여넣기
4. **Run** 실행 (몇십 초 소요될 수 있음)
5. 에러 없이 완료되면 Phase 3 마이그레이션(20260301~20260307) 적용 완료

이미 일부가 적용된 DB에도 대부분 안전하게 재실행 가능(IF NOT EXISTS / DROP IF EXISTS 사용).

---

## 방법 2: Supabase CLI (`db push`)

프로젝트를 한 번만 링크한 뒤에는 터미널에서 빠르게 적용 가능.

### 최초 1회: 프로젝트 링크

```bash
cd bty-app
npx supabase link --project-ref <프로젝트 ref>
# 비밀번호 입력 (Database password)
```

프로젝트 ref는 Dashboard → Settings → General → Reference ID.

### 마이그레이션 적용 (오래 걸릴 수 있음)

```bash
cd bty-app
npm run db:push
# 또는
npx supabase db push
```

`db push`는 아직 적용되지 않은 마이그레이션만 순서대로 적용합니다.

---

## 적용되는 마이그레이션 목록 (Phase 3)

| 파일 | 내용 |
|------|------|
| 20260301 | arena_seasons, arena_leagues.season_id/status, weekly_xp 인덱스/코멘트 |
| 20260302 | core_xp_ledger, weekly_xp_ledger, league_memberships, weekly_leaderboard_snapshots, arena_season_state, RLS |
| 20260303 | arena_profiles.avatar_url |
| 20260304 | storage 버킷 `avatars` + RLS 정책 |
| 20260305 | arena_membership_requests 테이블 + RLS |
| 20260306 | arena_profiles.avatar_character_id |
| 20260307 | arena_profiles.avatar_outfit_theme |
