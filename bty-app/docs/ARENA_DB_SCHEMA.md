# BTY Arena — Database Schema Design

Design focus: **league system**, **weekly (seasonal) XP tracking**, **season resets**, and **constraints to prevent duplicate league entries**. No frontend code.

---

## 1. Design decisions

| Decision | Rationale |
|----------|------------|
| **Seasons table** | Single source of truth for season lifecycle (start/end). Leagues reference a season; carryover runs at season end. |
| **One row per (user, league) in weekly_xp** | Prevents duplicate league entries. Unique constraint enforces at most one seasonal XP row per user per league. |
| **league_id nullable in weekly_xp** | NULL = “global” or current open pool before leagues exist; one row per user when NULL (unique on user_id where league_id IS NULL). |
| **Weekly XP = seasonal XP** | `weekly_xp.xp_total` is the competition XP for that league/season window. Resets (or carryover) at season end; leaderboard reads from this table only. |
| **Core XP on arena_profiles only** | Permanent; never reset. Not stored in weekly_xp. |
| **League status** | `active` / `closed` so only one active league per season is queryable; avoids double-counting. |
| **Indexes for leaderboard** | `(league_id, xp_total DESC)` and `(user_id, league_id)` for fast “top N by league” and “my XP in this league”. |

---

## 2. Tables (summary)

| Table | Purpose |
|-------|---------|
| **arena_seasons** | Season lifecycle: start_at, end_at, status. Run carryover when a season ends. |
| **arena_leagues** | League definition; belongs to a season; has time window (start_at, end_at) and status. |
| **arena_profiles** | One per user; Core XP, tier, code_name; optional league_id for “current league” display (not for ranking). |
| **weekly_xp** | One row per (user_id, league_id). Seasonal XP total for that league. Prevents duplicate league entries via unique. |
| **arena_runs** | Run/session data; XP written to weekly_xp on completion. |
| **arena_events** | Event-sourced log per run. |
| **arena_weekly_quest_claims** | Per-user, per-week, per-quest-type claims (e.g. reflection bonus). |
| **activity_xp_events** | Dojo/Dear Me XP events; feed into weekly_xp + Core. |

---

## 3. Constraints to prevent duplicate league entries

- **weekly_xp**
  - When `league_id IS NULL`: at most one row per user → `UNIQUE (user_id) WHERE league_id IS NULL`.
  - When `league_id IS NOT NULL`: at most one row per (user_id, league_id) → `UNIQUE (user_id, league_id) WHERE league_id IS NOT NULL`.
- No separate “league membership” table; the presence of a `weekly_xp` row for (user_id, league_id) is the membership. Inserts must use `ON CONFLICT` or check existence so duplicates are impossible.
- **Update (20260302):** Explicit **league_memberships** table added for joins and `joined_at`; app creates row when first weekly_xp row for (user, league) is created. **core_xp_ledger** and **weekly_xp_ledger** added as immutable event tables; Core XP history is separate from Weekly XP history. Optional **weekly_leaderboard_snapshots** and **arena_season_state** for reset-boundary history and per-user season state.

---

## 4. Season resets

- **run_season_carryover()** (existing): Sets `weekly_xp.xp_total = floor(xp_total * 0.1)` for rows where `league_id IS NULL` (global pool). Call before creating the next season/league.
- **New:** When using `arena_seasons`, carryover can be run when `arena_seasons.status` moves to `ended`, and the new season/league is created with `status = active`.

---

## 5. Indexes (summary)

| Table | Index | Use |
|-------|--------|-----|
| arena_seasons | (status) WHERE status = 'active' | Current season |
| arena_leagues | (season_id), (start_at, end_at) | League by season, active window |
| arena_leagues | (status) WHERE status = 'active' | Active league(s) |
| weekly_xp | (league_id, xp_total DESC) | Leaderboard by league |
| weekly_xp | (user_id, league_id) | User’s XP in a league (unique enforced) |
| weekly_xp | (user_id) WHERE league_id IS NULL | Global pool per user |

---

## 6. Edge cases to test

- Insert second `weekly_xp` row for same (user_id, league_id) → must fail (unique).
- Insert second `weekly_xp` row for same user with `league_id NULL` → must fail (unique).
- Leaderboard query: filter by `league_id = :active_league_id` and order by `xp_total DESC`.
- Season end: run carryover, then create new season and new league; new league’s `weekly_xp` rows created on first XP grant.
- Only one league per season marked `active` at a time (enforce in app or trigger).

---

## 7. File reference

- Migration (league/season): `supabase/migrations/20260301000000_arena_league_season_schema.sql`
- Migration (ledgers, memberships, snapshots): `supabase/migrations/20260302000000_arena_ledgers_memberships_snapshots.sql`
- Existing: `20260222_000001_arena_core.sql`, `20260224_arena_leagues_30d.sql`, `20260227_season_carryover.sql`, `docs/supabase/001_weekly_xp.sql`
