-- Aggregated pre-release gate: smoke + extended health + final wiring + i18n audit (service role insert).

create table if not exists public.release_readiness_log (
  id uuid primary key default gen_random_uuid(),
  run_at timestamptz not null default now(),
  smoke_ok boolean not null,
  health_ok boolean not null,
  wiring_ok boolean not null,
  i18n_ok boolean not null,
  all_clear boolean not null,
  detail jsonb not null default '{}'::jsonb
);

comment on table public.release_readiness_log is
  'Pre-release bundle: runSmokeTest + runExtendedHealthCheck + runFinalWiringCheck + runI18nAudit; see release-readiness-check.ts.';

create index if not exists release_readiness_log_run_at_idx on public.release_readiness_log (run_at desc);

alter table public.release_readiness_log enable row level security;
