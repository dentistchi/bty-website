-- Distinguish base loop checks (v1) from extended E2E integration checks (v2).

alter table public.loop_health_log
  add column if not exists check_version integer not null default 1;

comment on column public.loop_health_log.check_version is
  '1 = full-loop-validator; 2 = e2e-loop-validator extended integration checks.';
