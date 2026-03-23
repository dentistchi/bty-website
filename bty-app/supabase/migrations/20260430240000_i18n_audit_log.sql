-- Admin i18n completeness audit runs (service role insert; optional admin read via API).

create table if not exists public.i18n_audit_log (
  id uuid primary key default gen_random_uuid(),
  run_at timestamptz not null default now(),
  missing_ko_count int not null default 0,
  missing_en_count int not null default 0,
  orphaned_count int not null default 0,
  details jsonb not null default '{}'::jsonb
);

comment on table public.i18n_audit_log is
  'i18n completeness scan: missing/orphaned keys vs src usage (see bty-app i18n-completeness-validator).';

create index if not exists i18n_audit_log_run_at_idx on public.i18n_audit_log (run_at desc);

alter table public.i18n_audit_log enable row level security;
