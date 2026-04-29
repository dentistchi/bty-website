-- Admin smoke: top-level engine entry wiring verification (final-wiring-check).

create table if not exists public.final_wiring_log (
  id uuid primary key default gen_random_uuid(),
  service_name text not null,
  status text not null check (status in ('OK', 'ERROR')),
  checked_at timestamptz not null default now(),
  detail jsonb null
);

comment on table public.final_wiring_log is
  'Result shapes from runFinalWiringCheck; service role writes.';

create index if not exists final_wiring_log_checked_at_idx on public.final_wiring_log (checked_at desc);

alter table public.final_wiring_log enable row level security;
