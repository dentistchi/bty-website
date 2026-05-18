-- SCENARIO_AUDIT_STANDARDS_V1.md §3 — pool health rollups (C3 instrumentation).
-- Snapshots are append-only; cron inserts rows. No PII in payload dimensions.

create table if not exists public.scenario_pool_health_snapshots (
  id uuid primary key default gen_random_uuid(),
  computed_at timestamptz not null default now(),
  window_days int not null check (window_days in (7, 30)),
  metric_id text not null check (metric_id in ('PH-CHOICE-CONC', 'PH-ZERO-EXIT', 'PH-DET-UUID')),
  scenario_id text not null,
  step int,
  value_primary double precision,
  value_secondary double precision,
  sample_size bigint,
  details jsonb not null default '{}'::jsonb
);

comment on table public.scenario_pool_health_snapshots is
  'C3 pool health metrics per SCENARIO_AUDIT_STANDARDS_V1 §3; service-role writes only.';

create index if not exists scenario_pool_health_snapshots_computed_metric_idx
  on public.scenario_pool_health_snapshots (computed_at desc, metric_id);

create index if not exists scenario_pool_health_snapshots_scenario_idx
  on public.scenario_pool_health_snapshots (scenario_id, metric_id, computed_at desc);

alter table public.scenario_pool_health_snapshots enable row level security;

-- ---------------------------------------------------------------------------
-- PH-CHOICE-CONC: max choice share + HHI per scenario × step (steps 2–4).
-- ---------------------------------------------------------------------------
create or replace function public.ph_choice_conc_rollup(p_days integer)
returns table (
  scenario_id text,
  step int,
  max_share double precision,
  hhi double precision,
  total_commits bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with ev as (
    select
      e.scenario_id,
      e.step,
      e.choice_id,
      count(*)::bigint as c
    from public.arena_events e
    where
      e.event_type = 'CHOICE_CONFIRMED'
      and e.step between 2 and 4
      and e.choice_id is not null
      and trim(e.choice_id) <> ''
      and e.created_at >= now() - make_interval(days => greatest(p_days, 1))
    group by 1, 2, 3
  ),
  tot as (
    select ev.scenario_id, ev.step, sum(ev.c) as total
    from ev
    group by 1, 2
    having sum(ev.c) >= 10
  ),
  shares as (
    select
      ev.scenario_id,
      ev.step,
      ev.c::double precision / tot.total::double precision as p,
      tot.total
    from ev
    inner join tot on tot.scenario_id = ev.scenario_id and tot.step = ev.step
  )
  select
    s.scenario_id,
    s.step,
    max(s.p) as max_share,
    sum(s.p * s.p) as hhi,
    max(s.total) as total_commits
  from shares s
  group by s.scenario_id, s.step;
$$;

comment on function public.ph_choice_conc_rollup(integer) is
  'PH-CHOICE-CONC: empirical choice concentration (max share + HHI) for Steps 2–4.';

-- ---------------------------------------------------------------------------
-- PH-ZERO-EXIT: among runs with step 2–4 pattern_signals, fraction with no exit in 2–4.
-- ---------------------------------------------------------------------------
create or replace function public.ph_zero_exit_rollup(p_days integer)
returns table (
  scenario_id text,
  runs_with_signals bigint,
  runs_with_no_exit bigint,
  zero_exit_rate double precision
)
language sql
stable
security definer
set search_path = public
as $$
  with run_ctx as (
    select distinct e.run_id, e.scenario_id
    from public.arena_events e
    where
      e.event_type = 'CHOICE_CONFIRMED'
      and e.step between 2 and 4
      and e.created_at >= now() - make_interval(days => greatest(p_days, 1))
  ),
  signed_runs as (
    select distinct r.run_id, r.scenario_id
    from run_ctx r
    where exists (
      select 1
      from public.pattern_signals ps
      where
        ps.run_id = r.run_id
        and ps.step between 2 and 4
        and ps.recorded_at >= now() - make_interval(days => greatest(p_days, 1))
    )
  ),
  flags as (
    select
      s.run_id,
      s.scenario_id,
      exists (
        select 1
        from public.pattern_signals ps2
        where
          ps2.run_id = s.run_id
          and ps2.step between 2 and 4
          and ps2.direction = 'exit'
      ) as has_exit
    from signed_runs s
  )
  select
    f.scenario_id,
    count(*)::bigint as runs_with_signals,
    count(*) filter (where not f.has_exit)::bigint as runs_with_no_exit,
    case
      when count(*) > 0 then (count(*) filter (where not f.has_exit))::double precision / count(*)::double precision
      else 0::double precision
    end as zero_exit_rate
  from flags f
  group by f.scenario_id
  having count(*) >= 5;
$$;

comment on function public.ph_zero_exit_rollup(integer) is
  'PH-ZERO-EXIT: rate of runs (with pattern_signals on steps 2–4) that never record exit on those steps.';

revoke all on function public.ph_choice_conc_rollup(integer) from public;
revoke all on function public.ph_zero_exit_rollup(integer) from public;
grant execute on function public.ph_choice_conc_rollup(integer) to service_role;
grant execute on function public.ph_zero_exit_rollup(integer) to service_role;
