-- Per-phase Center diagnostic completions (gates for healing stepper / reports).

create table if not exists public.center_diagnostics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  phase text not null
    check (phase in ('ACKNOWLEDGEMENT', 'REFLECTION', 'REINTEGRATION', 'RENEWAL')),
  diagnostic_type text not null,
  completed_at timestamptz not null default now(),
  unique (user_id, phase, diagnostic_type)
);

comment on table public.center_diagnostics is
  'Rows record which diagnostic_type is satisfied for a healing phase (see engine healing-content PHASE_GATE_MAP).';

create index if not exists center_diagnostics_user_phase_idx
  on public.center_diagnostics (user_id, phase);

alter table public.center_diagnostics enable row level security;

drop policy if exists "center_diagnostics_select_own" on public.center_diagnostics;
create policy "center_diagnostics_select_own"
on public.center_diagnostics for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "center_diagnostics_insert_own" on public.center_diagnostics;
create policy "center_diagnostics_insert_own"
on public.center_diagnostics for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "center_diagnostics_delete_own" on public.center_diagnostics;
create policy "center_diagnostics_delete_own"
on public.center_diagnostics for delete
to authenticated
using (auth.uid() = user_id);
