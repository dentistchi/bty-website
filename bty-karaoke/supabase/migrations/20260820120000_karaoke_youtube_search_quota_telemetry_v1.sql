-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- btyNorebang — YOUTUBE SEARCH QUOTA TELEMETRY V1 (BUILD R2). Isolated bty-karaoke Supabase
-- project (ref zycwaqignioawtqynopj). Additive + idempotent; ALTERS nothing, backfills nothing,
-- and touches no existing table, function, or policy.
--
-- WHAT THIS MEASURES, AND WHAT IT DELIBERATELY CANNOT
--
-- Google's granular quota gives `search.list` its own Search Queries bucket: ONE outbound
-- search.list HTTP request = ONE unit. The approved allocation for project 360772184203 is
-- 1,000 calls/day, resetting at midnight PACIFIC.
--
--   * karaoke_youtube_search_calls holds ONE IMMUTABLE ROW PER ACTUAL OUTBOUND REQUEST, so
--     COUNT(*) IS the units consumed. There is deliberately NO `endpoint` column: the table is
--     structurally dedicated to search.list, so `videos.list` (a DIFFERENT bucket) cannot be
--     logged here even by a future contributor who wants to. `quota_units` is pinned to 1 by a
--     CHECK for the same reason -- it is a guardrail, not arithmetic.
--   * A cache hit, an open circuit breaker, a missing credential, a validation rejection, and a
--     recommendation cache read are all ZERO quota. None of them may produce a row here.
--
-- PRIVACY: no query, no biased query, no URL, no API key, no response payload, no account, room,
-- session, guest name, IP, device id, or fingerprint. The only per-call facts are the outcome,
-- the upstream status/reason token, the latency, and the performance style -- none of which
-- identifies a person or a venue. This adds NO App Privacy data type.
--
-- Rollback:
--   drop function if exists public.karaoke_youtube_search_usage(integer);
--   drop function if exists public.karaoke_record_youtube_search_serve(text);
--   drop function if exists public.karaoke_record_youtube_search_call(text, text, integer, text, integer, text);
--   drop table if exists public.karaoke_youtube_search_serves_hourly;
--   drop table if exists public.karaoke_youtube_search_calls;

-- TABLE 1 -- QUOTA TRUTH -----------------------------------------------------
-- One row = one outbound search.list HTTP request = one Search Queries unit.
create table if not exists public.karaoke_youtube_search_calls (
  id              uuid primary key default gen_random_uuid(),
  -- Minted BEFORE the fetch and unique: it makes the WRITE idempotent, so a retried insert for
  -- the same physical call cannot become a second quota row. It does NOT dedupe calls -- a second
  -- genuine outbound request carries a new call_id and is correctly counted twice.
  call_id         text not null unique,
  outcome         text not null check (outcome in
                    ('OK','QUOTA_EXCEEDED','HTTP_4XX','HTTP_5XX','NETWORK_ERROR')),
  http_status     integer,
  -- Google's own classification token only (e.g. quotaExceeded, rateLimitExceeded). Never a body.
  upstream_reason text check (upstream_reason is null or char_length(upstream_reason) <= 64),
  latency_ms      integer check (latency_ms is null or latency_ms >= 0),
  style           text check (style is null or style in ('mr','karaoke','original')),
  quota_units     smallint not null default 1 check (quota_units = 1),
  requested_at    timestamptz not null default now()
);

create index if not exists karaoke_yt_search_calls_time_idx
  on public.karaoke_youtube_search_calls (requested_at desc);
create index if not exists karaoke_yt_search_calls_outcome_idx
  on public.karaoke_youtube_search_calls (outcome, requested_at desc);

alter table public.karaoke_youtube_search_calls enable row level security;
revoke all on table public.karaoke_youtube_search_calls from public, anon, authenticated;
grant select, insert on table public.karaoke_youtube_search_calls to service_role;

-- Append-only: a quota fact that can be edited or erased is not evidence.
create or replace function public.karaoke_youtube_search_calls_immutable()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  raise exception 'karaoke_youtube_search_calls is append-only; % is not permitted', tg_op
    using errcode = 'restrict_violation';
end;
$$;
revoke all on function public.karaoke_youtube_search_calls_immutable() from public, anon, authenticated;
drop trigger if exists karaoke_youtube_search_calls_no_mutate on public.karaoke_youtube_search_calls;
create trigger karaoke_youtube_search_calls_no_mutate
  before update or delete on public.karaoke_youtube_search_calls
  for each row execute function public.karaoke_youtube_search_calls_immutable();

-- TABLE 2 -- SERVED-SEARCH DISPOSITION COUNTERS ------------------------------
-- The denominator for efficiency. A counter, not per-search rows: the visible-search count is
-- only ever read in aggregate, and per-search rows would store far more than the question needs.
-- UPSTREAM here must reconcile 1:1 with COUNT(*) of table 1 over the same window; any drift is
-- itself the signal that instrumentation is broken.
create table if not exists public.karaoke_youtube_search_serves_hourly (
  hour_utc    timestamptz not null,
  disposition text not null check (disposition in
                ('UPSTREAM','CACHE_HIT','BREAKER_OPEN','GATED')),
  serves      integer not null default 0 check (serves >= 0),
  primary key (hour_utc, disposition)
);

alter table public.karaoke_youtube_search_serves_hourly enable row level security;
revoke all on table public.karaoke_youtube_search_serves_hourly from public, anon, authenticated;
grant select, insert, update on table public.karaoke_youtube_search_serves_hourly to service_role;

-- INCREMENT RPC --------------------------------------------------------------
-- Atomic upsert-increment. The hour bucket is computed SERVER-SIDE from now() so a caller cannot
-- backdate a serve, and it is truncated in UTC explicitly rather than relying on the session
-- TimeZone. Pacific offsets are whole hours, so UTC hour buckets align exactly with a Pacific
-- quota-day boundary -- no partial bucket ever straddles midnight PT.
create or replace function public.karaoke_record_youtube_search_serve(p_disposition text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_hour timestamptz := date_trunc('hour', (now() at time zone 'UTC')) at time zone 'UTC';
begin
  insert into public.karaoke_youtube_search_serves_hourly (hour_utc, disposition, serves)
  values (v_hour, p_disposition, 1)
  on conflict (hour_utc, disposition)
  do update set serves = public.karaoke_youtube_search_serves_hourly.serves + 1;
end;
$$;
revoke all on function public.karaoke_record_youtube_search_serve(text) from public, anon, authenticated;
grant execute on function public.karaoke_record_youtube_search_serve(text) to service_role;

-- OUTBOUND-CALL RPC ----------------------------------------------------------
-- `on conflict (call_id) do nothing` is what makes a duplicated WRITE harmless: the second
-- attempt performs no insert and no update, so it neither doubles the quota count nor trips the
-- append-only trigger.
create or replace function public.karaoke_record_youtube_search_call(
  p_call_id         text,
  p_outcome         text,
  p_http_status     integer default null,
  p_upstream_reason text default null,
  p_latency_ms      integer default null,
  p_style           text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.karaoke_youtube_search_calls
    (call_id, outcome, http_status, upstream_reason, latency_ms, style)
  values
    (p_call_id, p_outcome, p_http_status, left(p_upstream_reason, 64), p_latency_ms, p_style)
  on conflict (call_id) do nothing;
end;
$$;
revoke all on function public.karaoke_record_youtube_search_call(text, text, integer, text, integer, text)
  from public, anon, authenticated;
grant execute on function public.karaoke_record_youtube_search_call(text, text, integer, text, integer, text)
  to service_role;

-- AGGREGATION RPC ------------------------------------------------------------
-- One document for the whole future Admin page, so the day-boundary rule exists in exactly ONE
-- place and the page can never disagree with the evidence we submit to Google.
--
-- THE DAY BOUNDARY IS PACIFIC, because that is when Google's counter resets. Bucketing by UTC or
-- by Asia/Seoul would disagree with Google's own number for most of every day. The naive local
-- date is converted with AT TIME ZONE, so a 23- or 25-hour DST day is handled by the calendar
-- rather than by arithmetic.
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
  v_visible   integer;
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
         coalesce(sum(serves) filter (where disposition = 'GATED'), 0)
    into v_upstream, v_hit, v_breaker, v_gated
    from public.karaoke_youtube_search_serves_hourly
   where hour_utc >= v_start and hour_utc < v_end;

  v_visible := v_upstream + v_hit + v_breaker + v_gated;

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
