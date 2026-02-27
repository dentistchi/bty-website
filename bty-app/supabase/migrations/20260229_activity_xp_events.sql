-- Dojo / Dear Me 활동 XP (Phase 2-5)
-- 이벤트 저장 + weekly_xp 연동용 테이블

create table if not exists public.activity_xp_events (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_type text not null,
  xp int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists activity_xp_events_user_created_idx
  on public.activity_xp_events(user_id, created_at desc);

alter table public.activity_xp_events enable row level security;

drop policy if exists "activity_xp_events_select_own" on public.activity_xp_events;
create policy "activity_xp_events_select_own" on public.activity_xp_events
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "activity_xp_events_insert_own" on public.activity_xp_events;
create policy "activity_xp_events_insert_own" on public.activity_xp_events
  for insert to authenticated with check (auth.uid() = user_id);

comment on table public.activity_xp_events is 'Dojo/Dear Me activity XP (mentor message, chat message). Same daily cap as Arena.';
