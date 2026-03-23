-- Weekly AIR digest (Sunday 23:59 UTC cron): trend + scenario stats snapshot per user per ISO week (week_of = Monday UTC).

create table if not exists public.weekly_air_reports (
  user_id uuid not null references auth.users (id) on delete cascade,
  week_of date not null,
  trend text not null check (trend in ('improving', 'stable', 'declining')),
  completion_rate double precision not null default 0,
  streak integer not null default 0,
  flag_type_breakdown jsonb not null default '{}'::jsonb,
  computed_at timestamptz not null default now(),
  primary key (user_id, week_of)
);

comment on table public.weekly_air_reports is
  'Weekly leadership snapshot: AIR trend direction, scenario completion rate, streak, flag_type counts; keyed by user + week (Monday UTC).';

create index if not exists weekly_air_reports_week_of_idx on public.weekly_air_reports (week_of desc);

alter table public.weekly_air_reports enable row level security;
