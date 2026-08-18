-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- btyNorebang — YOUTUBE SEARCH ABUSE CONTAINMENT V1 (BUILD R2.5). Isolated bty-karaoke Supabase
-- project (ref zycwaqignioawtqynopj). Additive + idempotent. Preserves every BUILD R2 row and the
-- BUILD R2 aggregation contract.
--
-- WHY THIS EXISTS
--
-- `GET /api/youtube/search` is public, anonymous and cookieless. The KV cache is keyed on the
-- biased query, so it defends against REPEATS and offers nothing at all against NOVELTY: ~1,000
-- unique cold queries drain the whole daily Search Queries grant, which costs an attacker one
-- shell loop. The Google 429 circuit breaker only trips AFTER the grant is gone.
--
-- WHY THE COUNTER LIVES HERE AND NOT IN KV
--
-- Cloudflare KV has NO atomic increment (read-modify-write) and is eventually consistent across
-- colos, so a KV-based ceiling could be overshot by an unbounded amount under exactly the
-- distributed burst it is meant to stop. A counter that cannot be trusted at its own threshold is
-- worse than none, because it reads as protection. Postgres gives an EXACT reservation in one
-- statement: `insert ... on conflict do update ... where reserved < ceiling` takes the row lock,
-- so concurrent reservations serialise and the ceiling cannot be exceeded.
--
-- RESERVED >= ACTUAL CALLS, ALWAYS. A slot is taken BEFORE the request is issued; if that request
-- then fails before reaching Google, the slot stays spent. The error is in the safe direction (we
-- under-spend the grant), and R2's call table remains the truth for what was actually consumed.
--
-- PRIVACY: unchanged. This migration stores a date and a count. No identifier of any kind.
--
-- Rollback:
--   drop function if exists public.karaoke_reserve_youtube_search(integer);
--   drop table if exists public.karaoke_youtube_search_budget;
--   -- and restore the previous 4-value disposition CHECK + the BUILD R2 usage function.

-- A. DISPOSITION SET — extended, never narrowed --------------------------------
-- RATE_LIMITED and BUDGET_GUARDED are BLOCKED serves: the request was refused by US, before any
-- outbound call. They are deliberately NOT folded into `visible_searches`, so the BUILD R2
-- efficiency denominator (and every ratio derived from it) stays comparable across this change.
alter table public.karaoke_youtube_search_serves_hourly
  drop constraint if exists karaoke_youtube_search_serves_hourly_disposition_check;
alter table public.karaoke_youtube_search_serves_hourly
  add constraint karaoke_youtube_search_serves_hourly_disposition_check
  check (disposition in
    ('UPSTREAM','CACHE_HIT','BREAKER_OPEN','GATED','RATE_LIMITED','BUDGET_GUARDED'));

-- B. DAILY BUDGET RESERVATION -------------------------------------------------
-- One row per PACIFIC quota day, because that is when Google's counter resets.
create table if not exists public.karaoke_youtube_search_budget (
  pacific_date date primary key,
  reserved     integer not null default 0 check (reserved >= 0),
  updated_at   timestamptz not null default now()
);

alter table public.karaoke_youtube_search_budget enable row level security;
revoke all on table public.karaoke_youtube_search_budget from public, anon, authenticated;
grant select, insert, update on table public.karaoke_youtube_search_budget to service_role;

-- The whole guard, in one atomic statement. `granted:false` means the ceiling is reached: the
-- caller must serve cache hits normally and refuse only COLD searches, and must NOT claim Google
-- reported quotaExceeded — this is our own reserve, not Google's refusal.
create or replace function public.karaoke_reserve_youtube_search(p_ceiling integer default 850)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_date     date := (now() at time zone 'America/Los_Angeles')::date;
  v_reserved integer;
begin
  insert into public.karaoke_youtube_search_budget as b (pacific_date, reserved)
  values (v_date, 1)
  on conflict (pacific_date) do update
     set reserved = b.reserved + 1, updated_at = now()
   where b.reserved < p_ceiling
  returning b.reserved into v_reserved;

  if v_reserved is null then
    select reserved into v_reserved
      from public.karaoke_youtube_search_budget where pacific_date = v_date;
    return jsonb_build_object(
      'granted', false, 'reserved', coalesce(v_reserved, 0), 'ceiling', p_ceiling, 'date', v_date);
  end if;

  return jsonb_build_object(
    'granted', true, 'reserved', v_reserved, 'ceiling', p_ceiling, 'date', v_date);
end;
$$;
revoke all on function public.karaoke_reserve_youtube_search(integer) from public, anon, authenticated;
grant execute on function public.karaoke_reserve_youtube_search(integer) to service_role;

-- C. AGGREGATION — extended, contract preserved -------------------------------
-- Every BUILD R2 field keeps its name, its shape and its meaning. `visible_searches`,
-- `cache_hit_rate` and `calls_per_visible_search` are computed from the SAME four dispositions as
-- before; blocked serves are reported alongside, never inside, them.
create or replace function public.karaoke_youtube_search_usage(p_trend_days integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_zone      text := 'America/Los_Angeles';
  v_limit     integer := 1000;
  v_today     date := (now() at time zone v_zone)::date;
  v_start     timestamptz := (v_today::timestamp) at time zone v_zone;
  v_end       timestamptz := ((v_today + 1)::timestamp) at time zone v_zone;
  v_days      integer := greatest(coalesce(p_trend_days, 30), 1);
  v_calls     integer;
  v_ok        integer;
  v_quota     integer;
  v_4xx       integer;
  v_5xx       integer;
  v_net       integer;
  v_last      timestamptz;
  v_upstream  integer;
  v_hit       integer;
  v_breaker   integer;
  v_gated     integer;
  v_rated     integer;
  v_budgeted  integer;
  v_visible   integer;
  v_reserved  integer;
  v_daily7    jsonb;
  v_daily30   jsonb;
  v_peak      jsonb;
begin
  select count(*),
         count(*) filter (where outcome = 'OK'),
         count(*) filter (where outcome = 'QUOTA_EXCEEDED'),
         count(*) filter (where outcome = 'HTTP_4XX'),
         count(*) filter (where outcome = 'HTTP_5XX'),
         count(*) filter (where outcome = 'NETWORK_ERROR')
    into v_calls, v_ok, v_quota, v_4xx, v_5xx, v_net
    from public.karaoke_youtube_search_calls
   where requested_at >= v_start and requested_at < v_end;

  select max(requested_at) into v_last
    from public.karaoke_youtube_search_calls
   where outcome = 'OK';

  select coalesce(sum(serves) filter (where disposition = 'UPSTREAM'), 0),
         coalesce(sum(serves) filter (where disposition = 'CACHE_HIT'), 0),
         coalesce(sum(serves) filter (where disposition = 'BREAKER_OPEN'), 0),
         coalesce(sum(serves) filter (where disposition = 'GATED'), 0),
         coalesce(sum(serves) filter (where disposition = 'RATE_LIMITED'), 0),
         coalesce(sum(serves) filter (where disposition = 'BUDGET_GUARDED'), 0)
    into v_upstream, v_hit, v_breaker, v_gated, v_rated, v_budgeted
    from public.karaoke_youtube_search_serves_hourly
   where hour_utc >= v_start and hour_utc < v_end;

  -- UNCHANGED from BUILD R2: blocked serves are excluded so the ratio stays comparable.
  v_visible := v_upstream + v_hit + v_breaker + v_gated;

  select coalesce(reserved, 0) into v_reserved
    from public.karaoke_youtube_search_budget where pacific_date = v_today;

  select jsonb_agg(jsonb_build_object('day', day, 'calls', calls) order by day)
    into v_daily7
    from (
      select d::date as day,
             (select count(*) from public.karaoke_youtube_search_calls c
               where c.requested_at >= (d::date::timestamp) at time zone v_zone
                 and c.requested_at <  ((d::date + 1)::timestamp) at time zone v_zone) as calls
        from generate_series((v_today - 6)::timestamp, v_today::timestamp, interval '1 day') d
    ) s;

  select jsonb_agg(jsonb_build_object('day', day, 'calls', calls) order by day)
    into v_daily30
    from (
      select d::date as day,
             (select count(*) from public.karaoke_youtube_search_calls c
               where c.requested_at >= (d::date::timestamp) at time zone v_zone
                 and c.requested_at <  ((d::date + 1)::timestamp) at time zone v_zone) as calls
        from generate_series((v_today - (v_days - 1))::timestamp, v_today::timestamp, interval '1 day') d
    ) s;

  select coalesce(jsonb_build_object('hour_utc', h, 'calls', c), '{}'::jsonb)
    into v_peak
    from (
      select date_trunc('hour', (requested_at at time zone 'UTC')) at time zone 'UTC' as h,
             count(*) as c
        from public.karaoke_youtube_search_calls
       where requested_at >= ((v_today - (v_days - 1))::timestamp) at time zone v_zone
       group by 1
       order by c desc, h desc
       limit 1
    ) p;

  return jsonb_build_object(
    'bucket', 'search_queries',
    'endpoint', 'search.list',
    'timezone', v_zone,
    'generated_at', now(),
    'today', jsonb_build_object(
      'day', v_today,
      'day_start', v_start,
      'day_end', v_end,
      'calls', v_calls,
      'limit', v_limit,
      'remaining', greatest(v_limit - v_calls, 0),
      'usage_pct', round((v_calls::numeric / v_limit) * 100, 2),
      'ok', v_ok,
      'quota_exceeded', v_quota,
      'http_4xx', v_4xx,
      'http_5xx', v_5xx,
      'network_error', v_net,
      'last_successful_at', v_last
    ),
    'efficiency', jsonb_build_object(
      'visible_searches', v_visible,
      'cache_hits', v_hit,
      'upstream', v_upstream,
      'breaker_open', v_breaker,
      'gated', v_gated,
      'cache_hit_rate', case when (v_hit + v_upstream) > 0
                             then round(v_hit::numeric / (v_hit + v_upstream), 4) else null end,
      'calls_per_visible_search', case when v_visible > 0
                             then round(v_calls::numeric / v_visible, 4) else null end
    ),
    'blocked', jsonb_build_object(
      'rate_limited', v_rated,
      'budget_guarded', v_budgeted
    ),
    'budget', jsonb_build_object(
      'reserved', coalesce(v_reserved, 0),
      'soft_ceiling', 850,
      'hard_reserve', v_limit - 850
    ),
    'trend', jsonb_build_object(
      'daily_7', coalesce(v_daily7, '[]'::jsonb),
      'daily_30', coalesce(v_daily30, '[]'::jsonb),
      'peak_hour', coalesce(v_peak, '{}'::jsonb)
    )
  );
end;
$$;
revoke all on function public.karaoke_youtube_search_usage(integer) from public, anon, authenticated;
grant execute on function public.karaoke_youtube_search_usage(integer) to service_role;
