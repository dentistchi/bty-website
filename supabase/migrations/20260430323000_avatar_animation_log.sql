-- Avatar CSS animation triggers for activity feed + integrity behavioral signal (see avatar-animation-log.service.ts).

create table if not exists public.avatar_animation_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  preset text not null
    check (preset in ('TIER_UP', 'OUTFIT_UNLOCK', 'INTEGRITY_SLIP', 'CLEAN_STREAK')),
  triggered_by_event text not null,
  triggered_at timestamptz not null default now()
);

comment on table public.avatar_animation_log is
  'Client-reported avatar animation plays; preset + trigger source for feed and integrity resilience adjustment.';

create index if not exists avatar_animation_log_user_triggered_at_idx
  on public.avatar_animation_log (user_id, triggered_at desc);

alter table public.avatar_animation_log enable row level security;

drop policy if exists "avatar_animation_log_select_own" on public.avatar_animation_log;
create policy "avatar_animation_log_select_own"
  on public.avatar_animation_log for select to authenticated
  using (auth.uid() = user_id);
