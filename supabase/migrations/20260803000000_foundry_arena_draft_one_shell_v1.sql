-- Slice 3.2I-R5B1A.1 — ONE authoritative Practice shell per (owner, training).
--
-- WHY: "Create practice" must be globally atomic across Cloudflare Worker isolates. A
-- SELECT-then-INSERT check is not atomic (two isolates can both observe "none" and both insert).
-- This partial UNIQUE INDEX is the global authority: the second concurrent INSERT for the same
-- (owner_user_id, source_event_id) new-authority relationship is rejected by the database (SQLSTATE
-- 23505), and createOrOpenArenaDraftShell() then loads the winning row — so every caller converges
-- to one canonical draft id and no duplicate/orphan authoritative shell can remain.
--
-- SCOPE (partial, exact relationship): only NEW-AUTHORITY drafts carry
-- guided_answers.practiceSetupVersion (Slice 3.2I-R5A.2). The index constrains exactly those.
--   * Legacy drafts (no discriminator, pre-R5A.2) are NOT constrained — historical legacy
--     duplicates can never block this index.
--   * A legitimate revision UPDATEs the SAME row in place (never a new row), so it never conflicts.
--   * A new training version is a new source_event_id, so it never conflicts.
--   * This table holds only status='draft' rows; published Practices live in a separate table, so
--     publication never creates a second row here.
-- The predicate uses a stored, immutable jsonb expression (guided_answers ->> '...'), which is a
-- valid partial-index predicate under the actual PostgreSQL contract.
--
-- ADDITIVE + IDEMPOTENT: CREATE UNIQUE INDEX IF NOT EXISTS only. No table/column/constraint/RLS/
-- grant/default/backfill change. No row is deleted or merged. Reversible by DROP INDEX.
--
-- DUPLICATE PREFLIGHT — run this READ-ONLY query BEFORE applying (do NOT auto-delete anything):
--
--     select owner_user_id, source_event_id, count(*)
--     from public.foundry_arena_scenario_drafts
--     where (guided_answers ->> 'practiceSetupVersion') is not null
--     group by owner_user_id, source_event_id
--     having count(*) > 1;
--
-- If any group is returned, STOP: a human must resolve those duplicates before the index can be
-- created (CREATE UNIQUE INDEX will otherwise fail). The create-or-open shell path had never been
-- deployed to any environment before this slice, so on staging/production this set is expected to
-- be EMPTY. This migration performs no cleanup.
--
-- ROLLBACK:
--     drop index if exists public.foundry_arena_scenario_drafts_one_shell_idx;

-- DEFINITION GUARD (fail-closed): `create unique index if not exists` is only NAME-idempotent —
-- it would silently accept a pre-existing index of the SAME NAME but a WRONG definition (e.g. a
-- non-unique index, wrong columns, or a missing/incorrect partial predicate), leaving the atomic
-- one-shell invariant unenforced while appearing "applied". Before creating, verify the catalog:
-- if an index of this name already exists it MUST be the exact required index, else this migration
-- raises and fails closed. Verified via catalog fields (not brittle string matching).
do $$
declare
  v_indexrelid oid;
  v_indrelid   oid;
  v_is_unique  boolean;
  v_relkind    text;
  v_cols       text;
  v_pred       text;
  v_norm       text;
begin
  select c.oid, c.relkind::text, i.indrelid, i.indisunique
    into v_indexrelid, v_relkind, v_indrelid, v_is_unique
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  left join pg_index i on i.indexrelid = c.oid
  where c.relname = 'foundry_arena_scenario_drafts_one_shell_idx'
    and n.nspname = 'public';

  if not found then
    return; -- name is free → the additive create below establishes the correct index
  end if;

  -- 0) the name must be an INDEX. A same-named table/view/matview/sequence would make
  -- `create unique index if not exists` silently SKIP (NOTICE, no error) — leaving the invariant
  -- unenforced while the migration "succeeds". Fail closed instead.
  if v_relkind is distinct from 'i' then
    raise exception 'one_shell_idx guard: name is occupied by a non-index relation (relkind=%)', v_relkind;
  end if;

  -- 1) exact target table
  if v_indrelid is distinct from 'public.foundry_arena_scenario_drafts'::regclass::oid then
    raise exception 'one_shell_idx guard: existing index is on the wrong table (%)', v_indrelid::regclass;
  end if;

  -- 2) must be UNIQUE
  if v_is_unique is distinct from true then
    raise exception 'one_shell_idx guard: existing index is not UNIQUE';
  end if;

  -- 3) indexed columns, in exact order = owner_user_id, source_event_id
  select string_agg(a.attname, ',' order by k.ord)
    into v_cols
  from pg_index i
  cross join lateral unnest(i.indkey) with ordinality as k(attnum, ord)
  join pg_attribute a on a.attrelid = i.indrelid and a.attnum = k.attnum
  where i.indexrelid = v_indexrelid;
  if v_cols is distinct from 'owner_user_id,source_event_id' then
    raise exception 'one_shell_idx guard: wrong key columns (% ; expected owner_user_id,source_event_id)', v_cols;
  end if;

  -- 4) partial predicate must be EXACTLY:  (guided_answers ->> 'practiceSetupVersion') IS NOT NULL
  --    pg_get_expr renders that as:  ((guided_answers ->> 'practiceSetupVersion'::text) IS NOT NULL)
  --    Normalize ONLY insignificant, deterministic variance — whitespace, the PostgreSQL-added
  --    ::text cast, and pg_get_expr's grouping parentheses — while PRESERVING identifier/keyword
  --    case (the JSON key is case-sensitive). Then require EXACT equality. A loose substring test
  --    would accept "<pred> OR true", "<pred> AND owner_user_id IS NOT NULL", "= '1'", a different
  --    JSON key/column, or a broader/narrower lifecycle predicate — all of which change which rows
  --    are constrained and must fail closed.
  select pg_get_expr(i.indpred, i.indrelid) into v_pred
  from pg_index i where i.indexrelid = v_indexrelid;
  if v_pred is null then
    raise exception 'one_shell_idx guard: existing index is not partial (expected (guided_answers ->> ''practiceSetupVersion'') IS NOT NULL)';
  end if;
  v_norm := regexp_replace(v_pred, '\s+', '', 'g'); -- strip whitespace
  v_norm := replace(v_norm, '::text', '');          -- strip PostgreSQL-added text cast
  v_norm := translate(v_norm, '()', '');            -- strip pg_get_expr grouping parentheses
  if v_norm is distinct from 'guided_answers->>''practiceSetupVersion''ISNOTNULL' then
    raise exception 'one_shell_idx guard: predicate is not EXACTLY (guided_answers ->> ''practiceSetupVersion'') IS NOT NULL (got: %)', v_pred;
  end if;
end $$;

create unique index if not exists foundry_arena_scenario_drafts_one_shell_idx
  on public.foundry_arena_scenario_drafts (owner_user_id, source_event_id)
  where (guided_answers ->> 'practiceSetupVersion') is not null;
