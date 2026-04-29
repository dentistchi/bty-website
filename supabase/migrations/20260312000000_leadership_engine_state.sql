-- Leadership Engine: user Stage state (separate from arena_profiles per ENGINE_ARCHITECTURE_DIRECTIVE_PLAN §2).
-- Stage values: 1–4 per domain (Over-Intervention → Expectation Collapse → Leadership Withdrawal → Integrity Reset).
-- No XP/leaderboard/season; UI displays API value only.

create table if not exists public.leadership_engine_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_stage smallint not null default 1 check (current_stage >= 1 and current_stage <= 4),
  stage_entered_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.leadership_engine_state is 'Current Leadership Engine stage per user. Transition rules applied in API/domain only; UI renders only.';
comment on column public.leadership_engine_state.current_stage is '1=Over-Intervention, 2=Expectation Collapse, 3=Leadership Withdrawal, 4=Integrity Reset.';
comment on column public.leadership_engine_state.stage_entered_at is 'When current_stage was last set (for analytics/repeat detection).';

create index if not exists leadership_engine_state_updated_at_idx on public.leadership_engine_state(updated_at desc);

alter table public.leadership_engine_state enable row level security;

drop policy if exists "leadership_engine_state_select_own" on public.leadership_engine_state;
create policy "leadership_engine_state_select_own"
on public.leadership_engine_state for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "leadership_engine_state_insert_own" on public.leadership_engine_state;
create policy "leadership_engine_state_insert_own"
on public.leadership_engine_state for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "leadership_engine_state_update_own" on public.leadership_engine_state;
create policy "leadership_engine_state_update_own"
on public.leadership_engine_state for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
