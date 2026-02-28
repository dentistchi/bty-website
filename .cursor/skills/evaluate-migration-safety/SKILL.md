---
name: evaluate-migration-safety
description: Evaluates Supabase/Postgres migration SQL for data loss risk, constraint/index correctness, rollback strategy, and BTY Arena compatibility (weekly reset, core XP permanence, seasons). Use when the user pastes migration SQL to evaluate, when reviewing migrations for safety, or when asked to check a migration before applying.
---

# Evaluate Migration for Safety

When the user provides migration SQL (in place of `{PASTE SQL HERE}` or in a fenced block), evaluate it and return a structured report.

## 1. Run the checks

Apply these checks to the migration SQL:

### Data loss risk

- **DROP TABLE / DROP COLUMN**: Identify any drops. If they drop tables or columns that may contain data, flag as high risk. Prefer `ALTER TABLE ... DROP COLUMN` only after a deprecation period or when the column is confirmed unused.
- **TRUNCATE**: Truncation without a clear backup or idempotent repopulation is high risk.
- **UPDATE/DELETE without WHERE or with broad criteria**: Could wipe or overwrite more rows than intended; require explicit scope (e.g. by `season_id`, `league_id`, or bounded batch).
- **Renaming columns/tables**: Ensure no application code or views reference the old names, or that a transition path exists (e.g. view with old name → new table).

### Constraint and index correctness

- **Unique constraints**: For `weekly_xp`, expect:
  - One row per user when `league_id IS NULL`: `UNIQUE (user_id) WHERE league_id IS NULL`.
  - One row per (user_id, league_id) when `league_id IS NOT NULL`: `UNIQUE (user_id, league_id) WHERE league_id IS NOT NULL`.
- **Ledgers**: `core_xp_ledger` and `weekly_xp_ledger` should have idempotency unique indexes on `(source_type, source_id)` and `(user_id, league_id, source_type, source_id)` respectively (with `WHERE source_id IS NOT NULL` where applicable).
- **Foreign keys**: Verify FKs point to the correct tables and use appropriate `ON DELETE` (e.g. `CASCADE` for user-owned data, `RESTRICT` or `NO ACTION` where parent must not be deleted).
- **Indexes**: Match schema docs — leaderboard needs `(league_id, xp_total DESC)` on `weekly_xp`; user lookups need `(user_id, league_id)`. New tables that are queried by `user_id`, `league_id`, or `created_at` should have supporting indexes.

### Rollback strategy

- **Reversibility**: Can every change be undone with a single rollback script? If not, note which parts are one-way (e.g. data backfill).
- **Rollback SQL**: Produce a script that reverses the migration (in order: drop new objects, restore renamed/dropped columns or tables if applicable). If the migration is destructive (e.g. drops data), state that rollback cannot restore data and recommend backup/restore.

### Compatibility with weekly reset + core XP permanence

- **Core XP is permanent**: No migration may truncate, reset, or repurpose `arena_profiles.core_xp_total` / `core_xp_ledger`. No logic should move Core XP into weekly-only storage or delete Core XP history.
- **Weekly XP is separate**: Tables or columns used for “weekly” or “seasonal” XP (e.g. `weekly_xp`, `weekly_xp_ledger`) must not be used to store or derive Core XP. Resets (e.g. carryover) must not touch `core_xp_ledger` or Core XP on `arena_profiles`.
- **Reset boundary**: If the migration adds or changes snapshot/carryover tables, ensure they align with “week boundary” (e.g. `week_end_at`) and do not conflate with Core XP.

### Forward-compatibility for seasons

- **Season lifecycle**: `arena_seasons` and `arena_leagues` are the source of truth for season/league windows. New tables that reference seasons should use `season_id` or `league_id` FKs; avoid hardcoding “current” season in constraints.
- **Carryover**: Any new logic that runs at “season end” should be additive (e.g. snapshots, state tables) or clearly scoped to weekly/seasonal data only, not Core XP.
- **One active league per season**: If the migration adds or changes league status, preserve the rule that only one league per season is `active` at a time (enforced in app or trigger).

## 2. Output format

Return the report in this order:

```markdown
## 1) Risks
- [List each risk with severity: Critical / High / Medium / Low and one-line mitigation if obvious.]

## 2) Required changes
- [List concrete changes to the migration SQL or to run before/after: add missing index, fix constraint, add backup step, etc.]

## 3) Rollback SQL (if needed)
\`\`\`sql
-- Reverse operations in reverse order of application
...
\`\`\`
[If rollback cannot restore dropped/overwritten data, say so and recommend backup/restore.]

## 4) Test plan
- [ ] Step 1: ...
- [ ] Step 2: ...
[Include: apply on copy of prod or staging; verify constraints (e.g. duplicate weekly_xp insert fails); verify Core XP unchanged after any reset/carryover; verify leaderboard query and indexes; run rollback and confirm schema/data state).]
```

## 3. When the user has not pasted SQL

If the message contains only the template and no migration SQL, ask the user to paste the migration SQL they want evaluated, then run the checks above on it.

## Reference

- Arena schema and constraints: `bty-app/docs/ARENA_DB_SCHEMA.md`
- Global rules (Core XP vs Weekly XP, no business logic in UI): `.cursor/rules/bty-arena-global.mdc`
- Existing migrations: `bty-app/supabase/migrations/` (naming pattern `YYYYMMDD*_*.sql`)
