-- Admin / CI: Arena→Foundry→Center loop health check audit rows.

create table if not exists public.loop_health_log (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  check_key text not null,
  status text not null check (status in ('PASS', 'FAIL')),
  detail text,
  created_at timestamptz not null default now()
);

create index if not exists loop_health_log_run_created_idx
  on public.loop_health_log (run_id, created_at desc);

comment on table public.loop_health_log is 'Loop health check results (service role writes; optional admin read).';

alter table public.loop_health_log enable row level security;
