-- Avatar progression (Core XP thresholds) — separate from internal code/tier math on arena_profiles.

create table if not exists public.user_avatar_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_tier int not null default 0 check (current_tier >= 0 and current_tier <= 4),
  unlocked_assets text[] not null default '{}'::text[],
  updated_at timestamptz not null default now()
);

comment on table public.user_avatar_state is 'Display avatar progression tier (0–4) by Core XP bands; unlocked_assets cumulative ids.';
comment on column public.user_avatar_state.current_tier is 'AvatarTier 0..4; thresholds 0/500/1500/3500/7000 Core XP.';

create index if not exists user_avatar_state_tier_idx on public.user_avatar_state (current_tier);

alter table public.user_avatar_state enable row level security;

drop policy if exists "user_avatar_state_select_own" on public.user_avatar_state;
create policy "user_avatar_state_select_own"
on public.user_avatar_state for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "user_avatar_state_insert_own" on public.user_avatar_state;
create policy "user_avatar_state_insert_own"
on public.user_avatar_state for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "user_avatar_state_update_own" on public.user_avatar_state;
create policy "user_avatar_state_update_own"
on public.user_avatar_state for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
