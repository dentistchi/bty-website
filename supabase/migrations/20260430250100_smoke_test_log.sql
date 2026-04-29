-- Admin on-demand full-system smoke test runs (service role insert).

create table if not exists public.smoke_test_log (
  id uuid primary key default gen_random_uuid(),
  run_at timestamptz not null default now(),
  arena_ok boolean not null,
  foundry_ok boolean not null,
  center_ok boolean not null,
  dashboard_ok boolean not null,
  health_ok boolean not null,
  details jsonb not null default '{}'::jsonb
);

comment on table public.smoke_test_log is
  'Full-system smoke test (Arena/Foundry/Center + integrity dashboard + system health); see full-system-smoke-test.';

create index if not exists smoke_test_log_run_at_idx on public.smoke_test_log (run_at desc);

alter table public.smoke_test_log enable row level security;
