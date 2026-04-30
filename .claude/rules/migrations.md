---
description: Supabase/Postgres migrations — idempotent, separated XP storage, copy-friendly SQL
paths:
  - bty-app/supabase/migrations/**
  - "**/*.sql"
---

# Migrations Rule

이 문서는 다음 3개 룰을 통합합니다:
- 30-sql-migration (idempotent SQL)
- bty-arena-data (XP separation, ledger pattern)
- sql-copy-friendly (응답 포맷)

---

## One-line rule

Core XP and Weekly XP storage MUST remain clearly separated (tables/columns/names). Never mix or reuse Weekly XP for league/season logic.

---

## Must

- **Separate Core XP and Weekly XP** in schema: distinct tables or columns, unambiguous names (e.g. `core_xp`, `weekly_xp`; tables like `arena_core_xp_ledger` vs `arena_weekly_xp_ledger`).
- **Prefer append-only ledgers** for XP changes when possible (insert-only events; aggregates/snapshots derived elsewhere).
- **Migrations idempotent and safe to re-run**: `IF NOT EXISTS` for objects, safe `ALTER` patterns (e.g. add column with `IF NOT EXISTS` or backfill before NOT NULL).
- **Indexes for hot paths:**
  - Leaderboard weekly window (e.g. `(league_id, week_id)` or `(week_id, league_id)`)
  - Lookups by `user_id`, `league_id`, `week_id` as used by APIs
- **Integrity constraints** (FK, UNIQUE, CHECK) with a short rationale in comments.
- **Migrations ordered**: timestamp-prefixed filenames; migrations later in time may not modify earlier behavior assumptions.
- **Preserve production behavior**: existing rows must continue to work after migration.

---

## Forbidden

- **No UI code, no domain computations** in migrations or SQL (no `levelFromXp`, no ranking/sort logic in DB).
- **Avoid triggers for business rules** unless explicitly requested (prefer app/engine writes and idempotent migrations).
- **Unrelated schema changes** in a single migration (one concern per migration).

---

## Required Output for Migrations

For any migration touching Arena XP/league/week data, provide:

1. **Migration path + full SQL**
   - Sequential, idempotent steps
2. **One-line rule statement**
   - Preserve: "Core XP vs Weekly XP separation" (and any new invariant)
3. **Test plan**
   - **EXPLAIN plan:** Run `EXPLAIN (ANALYZE)` for hot queries
   - **Sample queries:** weekly leaderboard by `league_id`/`week_id`, user core XP lookup
   - **Rollback note:** Reversible steps (`DROP INDEX IF EXISTS`, `ALTER ... DROP COLUMN`) or backup/restore

---

## SQL File Format (Copy-friendly)

- **순수 텍스트만** (LF 줄바꿈, BOM 없음)
- **줄 끝 공백(trailing space) 금지**
- **파일 끝은 줄바꿈 1개**로 끝낸다
- **마이그레이션 파일** 첫 줄에 다음 주석 포함:
  ```
  -- Copy-friendly (LF, no trailing spaces). Select all to copy.
  ```

## SQL 응답 시 (필수)

SQL 파일을 만들었거나 사용자에게 보여줄 때:
- **응답 메시지 안에 SQL 파일 전체를 ` ```sql ... ``` ` 코드 블록으로 포함**
- "파일을 열어라" 또는 "Admin SQL 페이지에 가라"만 안내하지 **말 것**
- 사용자가 채팅/에디터 화면에서 바로 선택 후 복사할 수 있게 한다

---

## Examples

### ✅ GOOD — clear separation, append-only ledger

```sql
-- Copy-friendly (LF, no trailing spaces). Select all to copy.
CREATE TABLE IF NOT EXISTS arena_core_xp_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  delta int NOT NULL CHECK (delta <> 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS arena_weekly_xp_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  week_id text NOT NULL,
  delta int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Hot path indexes
CREATE INDEX IF NOT EXISTS idx_core_xp_ledger_user_id
  ON arena_core_xp_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_xp_ledger_week_user
  ON arena_weekly_xp_ledger(week_id, user_id);
```

### ❌ BAD — mixing weekly and core in one column

```sql
-- ambiguous: which xp does this represent?
CREATE TABLE xp_ledger ( user_id uuid, xp int, week_id text );
```

### ✅ GOOD — idempotent alter

```sql
ALTER TABLE arena_memberships
  ADD COLUMN IF NOT EXISTS core_xp_total int NOT NULL DEFAULT 0;
```

---

## Checklist

- [ ] First line: `-- Copy-friendly (LF, no trailing spaces). Select all to copy.`
- [ ] All `CREATE TABLE` / `CREATE INDEX` use `IF NOT EXISTS`
- [ ] All `ALTER TABLE` use `IF NOT EXISTS` or check column existence
- [ ] Core XP and Weekly XP storage clearly separated
- [ ] Hot-path indexes for `(league_id, week_id)` and `(user_id, ...)`
- [ ] Rollback note included in PR/commit message
- [ ] Response includes full SQL in `` ```sql `` block
