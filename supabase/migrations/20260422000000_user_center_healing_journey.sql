-- Center Healing 4-phase journey (인정→성찰→재통합→갱신). Advance is explicit POST after diagnostics pass.

create table if not exists public.user_center_healing_journey (
  user_id uuid primary key references auth.users (id) on delete cascade,
  active_phase smallint not null default 1
    check (active_phase >= 1 and active_phase <= 4),
  updated_at timestamptz not null default now()
);

comment on table public.user_center_healing_journey is 'Center healing stepper: user-facing active phase 1–4; advance via API when phase diagnostics pass.';

create index if not exists user_center_healing_journey_updated_idx
  on public.user_center_healing_journey (updated_at desc);

alter table public.user_center_healing_journey enable row level security;

drop policy if exists "user_center_healing_journey_select_own" on public.user_center_healing_journey;
create policy "user_center_healing_journey_select_own"
  on public.user_center_healing_journey for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "user_center_healing_journey_insert_own" on public.user_center_healing_journey;
create policy "user_center_healing_journey_insert_own"
  on public.user_center_healing_journey for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "user_center_healing_journey_update_own" on public.user_center_healing_journey;
create policy "user_center_healing_journey_update_own"
  on public.user_center_healing_journey for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
