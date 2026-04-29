-- Center healing track: phase + integrity slip log read for severity (RLS).

-- Allow users to read own integrity slip audit rows (needed for healing phase assignment with user session).
drop policy if exists "integrity_slip_log_select_own" on public.integrity_slip_log;
create policy "integrity_slip_log_select_own"
on public.integrity_slip_log for select
to authenticated
using (auth.uid() = user_id);

create table if not exists public.user_healing_phase (
  user_id uuid primary key references auth.users(id) on delete cascade,
  phase text not null
    check (phase in ('ACKNOWLEDGEMENT', 'REFLECTION', 'REINTEGRATION', 'RENEWAL')),
  started_at timestamptz not null default now(),
  completed_at timestamptz null
);

comment on table public.user_healing_phase is 'Current healing phase (Center / integrity recovery); assigned after diagnostics, advanced explicitly.';
comment on column public.user_healing_phase.completed_at is 'Set when journey completes at RENEWAL (terminal); null while active.';

alter table public.user_healing_phase enable row level security;

drop policy if exists "user_healing_phase_select_own" on public.user_healing_phase;
create policy "user_healing_phase_select_own"
on public.user_healing_phase for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "user_healing_phase_insert_own" on public.user_healing_phase;
create policy "user_healing_phase_insert_own"
on public.user_healing_phase for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "user_healing_phase_update_own" on public.user_healing_phase;
create policy "user_healing_phase_update_own"
on public.user_healing_phase for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
