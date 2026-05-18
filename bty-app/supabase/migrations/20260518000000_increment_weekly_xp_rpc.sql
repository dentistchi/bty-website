-- =============================================================================
-- Pre-demo hotfix: atomic weekly_xp.xp_total increment.
--
-- Replaces read-modify-write (SELECT xp_total → compute → UPDATE) in:
--   - src/lib/bty/arena/activityXp.ts            (recordActivityXp)
--   - src/app/api/arena/beginner-complete/route.ts
--   - src/app/api/arena/run/complete/route.ts    (reflection quest bonus)
--
-- The Supabase JS client cannot express `xp_total = xp_total + :delta`, so the
-- atomic increment is done here as a single UPSERT statement: the row is created
-- when absent, otherwise xp_total is incremented under the row lock held by the
-- INSERT ... ON CONFLICT DO UPDATE. Concurrent callers serialize on that lock,
-- so no read-modify-write window remains and no XP is lost.
--
-- SECURITY DEFINER mirrors existing public.increment_arena_xp (20260222 arena_core).
-- No RLS policy is changed. No held migration is resumed.
-- =============================================================================

create or replace function public.increment_weekly_xp(
  p_user_id   uuid,
  p_league_id uuid,
  p_delta     int
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total int;
begin
  if p_user_id is null then
    raise exception 'increment_weekly_xp: p_user_id is required';
  end if;

  -- No-op deltas: return the current total without writing.
  if p_delta is null or p_delta = 0 then
    select xp_total into v_total
      from public.weekly_xp
     where user_id = p_user_id
       and league_id is not distinct from p_league_id;
    return coalesce(v_total, 0);
  end if;

  -- league_id NULL = global pool; matches partial unique index
  -- weekly_xp_user_null_league_uq (user_id) WHERE league_id IS NULL.
  if p_league_id is null then
    insert into public.weekly_xp (user_id, league_id, xp_total)
    values (p_user_id, null, p_delta)
    on conflict (user_id) where league_id is null
    do update set xp_total   = weekly_xp.xp_total + excluded.xp_total,
                  updated_at = now()
    returning xp_total into v_total;
  else
    -- Non-NULL league; matches weekly_xp_user_league_uq (user_id, league_id)
    -- WHERE league_id IS NOT NULL.
    insert into public.weekly_xp (user_id, league_id, xp_total)
    values (p_user_id, p_league_id, p_delta)
    on conflict (user_id, league_id) where league_id is not null
    do update set xp_total   = weekly_xp.xp_total + excluded.xp_total,
                  updated_at = now()
    returning xp_total into v_total;
  end if;

  return v_total;
end;
$$;

comment on function public.increment_weekly_xp(uuid, uuid, int) is
  'Atomic weekly_xp.xp_total increment (UPSERT). Prevents read-modify-write lost writes. p_league_id NULL = global pool. Returns the new xp_total.';

grant execute on function public.increment_weekly_xp(uuid, uuid, int) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Rollback (run manually if reverting):
--   DROP FUNCTION IF EXISTS public.increment_weekly_xp(uuid, uuid, int);
-- -----------------------------------------------------------------------------
