-- User-facing in-app notifications + Realtime for badge refresh.

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null,
  title_ko text not null,
  title_en text not null,
  read_at timestamptz null,
  created_at timestamptz not null default now()
);

comment on table public.user_notifications is
  'System events surfaced as notifications; see notification-router.service.';

create index if not exists user_notifications_user_created_idx
  on public.user_notifications (user_id, created_at desc);

create index if not exists user_notifications_user_unread_idx
  on public.user_notifications (user_id, created_at desc)
  where read_at is null;

alter table public.user_notifications enable row level security;

drop policy if exists "user_notifications_select_own" on public.user_notifications;
create policy "user_notifications_select_own"
  on public.user_notifications for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "user_notifications_update_own" on public.user_notifications;
create policy "user_notifications_update_own"
  on public.user_notifications for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Inserts from service role (API/engine); no authenticated insert policy.

alter publication supabase_realtime add table only public.user_notifications;
