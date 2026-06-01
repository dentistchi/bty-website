/* le_pulse_log — P-A personal_responsibility_pulse capture
   (session/action-loop terminal 1..5 self-rating; 14d rolling -> pulse_norm).
   Documenting migration: table pre-applied in prod (empty). Idempotent/replay-safe.
   DESIGN: docs/LRI_CERTIFIED_ADMIN_SURFACE_DESIGN_V1.md sections 2 and 7. */

create table if not exists public.le_pulse_log (
  id          bigserial primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  session_id  uuid null,
  pulse_value smallint not null check (pulse_value between 1 and 5),
  created_at  timestamptz not null default now()
);

create index if not exists le_pulse_log_user_created_idx
  on public.le_pulse_log (user_id, created_at desc);

alter table public.le_pulse_log enable row level security;

drop policy if exists le_pulse_log_select_own on public.le_pulse_log;
create policy le_pulse_log_select_own on public.le_pulse_log
  for select using (auth.uid() = user_id);

drop policy if exists le_pulse_log_insert_own on public.le_pulse_log;
create policy le_pulse_log_insert_own on public.le_pulse_log
  for insert with check (auth.uid() = user_id);
