-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- =============================================================================
-- Event QR — Slice 2b: atomic scan-award RPC
--
-- Binds the participation insert and the permanent Core XP add into ONE
-- transaction: if a scan is recorded, Core XP IS awarded in the same tx; if the
-- Core XP add cannot happen, no participation row is recorded. Idempotency comes
-- from bty_event_participation unique(event_id, user_id) — a duplicate scan
-- inserts nothing, awards nothing, and reports already_scanned (no double XP).
--
-- Scope (Commander-locked, Slice 2b): Core XP only.
--   - NO activity_xp_events linkage (activity_xp_event_id stays NULL).
--   - NO weekly XP / leaderboard / band / seasonal conversion.
--   - NO org / TII.
-- Derived projections (tier, code_index, sub_name, stage, code_hidden, avatar)
-- are NOT computed here: banding + avatar growth are domain/TS concerns and the
-- migrations rule forbids domain computation in SQL. The route reprojects them
-- best-effort AFTER this RPC. core_xp_total is the authoritative permanent value
-- and is the only thing that must be atomic with the participation insert; the
-- projections are self-healing so their staleness is non-fatal.
--
-- bty_events / bty_event_participation schema is NOT modified by this migration
-- (function-only). File-only first: apply is a separate Commander-authorized step.
-- =============================================================================

create or replace function public.bty_event_scan_award(
  p_event_id uuid,
  p_user_id uuid,
  p_xp int
)
returns table (
  fresh_insert boolean,
  already_scanned boolean,
  xp_awarded int,
  new_core_xp bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows int;
  v_new bigint;
begin
  -- Atomic idempotent claim: at most one participation row per (event, user).
  insert into public.bty_event_participation (event_id, user_id, xp_awarded)
  values (p_event_id, p_user_id, p_xp)
  on conflict (event_id, user_id) do nothing;

  get diagnostics v_rows = row_count;

  if v_rows > 0 then
    -- Permanent Core XP add, atomic with the insert above. A single UPDATE
    -- statement takes the row lock, so concurrent awards to the same user
    -- serialize (no lost add).
    update public.arena_profiles
       set core_xp_total = coalesce(core_xp_total, 0) + p_xp
     where user_id = p_user_id
    returning core_xp_total into v_new;

    if not found then
      -- First-ever profile for this user: create it with the awarded XP.
      insert into public.arena_profiles (
        user_id, core_xp_total, core_xp_buffer, tier, code_index,
        sub_name, sub_name_renamed_in_code, stage, code_hidden
      )
      values (p_user_id, p_xp, 0, 0, 0, 'Spark', false, 1, false)
      returning core_xp_total into v_new;
    end if;

    fresh_insert := true;
    already_scanned := false;
    xp_awarded := p_xp;
    new_core_xp := v_new;
  else
    -- Duplicate scan: no insert, no XP. Report current Core XP if a profile exists.
    select core_xp_total into v_new
      from public.arena_profiles
     where user_id = p_user_id;

    fresh_insert := false;
    already_scanned := true;
    xp_awarded := 0;
    new_core_xp := v_new;
  end if;

  return next;
end;
$$;
