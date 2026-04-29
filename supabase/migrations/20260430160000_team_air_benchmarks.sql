-- Weekly team AIR / TII benchmark snapshots (rolling 4w) + integrity risk level.

create table if not exists public.team_air_benchmarks (
  id uuid primary key default gen_random_uuid(),
  team_id text not null,
  week_of date not null,
  avg_air numeric(7,4) not null,
  weekly_tii numeric(7,4),
  rolling_4w_avg_air numeric(7,4),
  risk_level text not null check (risk_level in ('none', 'watch', 'elevated', 'critical')),
  computed_at timestamptz not null default now(),
  unique (team_id, week_of)
);

create index if not exists team_air_benchmarks_team_computed_idx
  on public.team_air_benchmarks (team_id, computed_at desc);

comment on table public.team_air_benchmarks is
  'Team-level weekly AIR/TII from le_activation_log; risk_level from consecutive low-TII rule (see team-air-benchmark.service).';

alter table public.team_air_benchmarks enable row level security;

drop policy if exists "team_air_benchmarks_select_authenticated" on public.team_air_benchmarks;
create policy "team_air_benchmarks_select_authenticated"
  on public.team_air_benchmarks for select to authenticated
  using (true);
