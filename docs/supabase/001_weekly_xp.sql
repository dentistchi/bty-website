-- BTY Arena Spec 9-1: weekly_xp table (league_id nullable MVP)
-- Run in Supabase SQL Editor.

create table if not exists public.weekly_xp (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  league_id uuid null, -- MVP: NULL = current competition window
  xp_total integer not null default 0,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- MVP: one row per user for league_id IS NULL
create unique index if not exists weekly_xp_user_null_league_uq
on public.weekly_xp(user_id)
where league_id is null;

-- Future: one row per user per league when league_id is not null
create unique index if not exists weekly_xp_user_league_uq
on public.weekly_xp(user_id, league_id)
where league_id is not null;

alter table public.weekly_xp enable row level security;

-- Users can read their own weekly_xp
drop policy if exists "weekly_xp_select_own" on public.weekly_xp;
create policy "weekly_xp_select_own"
on public.weekly_xp
for select
to authenticated
using (user_id = auth.uid());

-- Users can insert their own weekly_xp (server will do it; still safe)
drop policy if exists "weekly_xp_insert_own" on public.weekly_xp;
create policy "weekly_xp_insert_own"
on public.weekly_xp
for insert
to authenticated
with check (user_id = auth.uid());

-- Users can update their own weekly_xp
drop policy if exists "weekly_xp_update_own" on public.weekly_xp;
create policy "weekly_xp_update_own"
on public.weekly_xp
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Optional trigger to keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_weekly_xp_updated_at on public.weekly_xp;
create trigger trg_weekly_xp_updated_at
before update on public.weekly_xp
for each row execute function public.set_updated_at();
