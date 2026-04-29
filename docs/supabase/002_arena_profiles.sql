-- BTY Arena Spec 9-2: arena_profiles table (Core XP Growth Engine)
-- Run in Supabase SQL Editor.
-- If arena_profiles already exists with different columns, add new columns with:
--   ALTER TABLE public.arena_profiles ADD COLUMN IF NOT EXISTS core_xp_total integer not null default 0;
--   ALTER TABLE public.arena_profiles ADD COLUMN IF NOT EXISTS stage integer not null default 1;
--   ALTER TABLE public.arena_profiles ADD COLUMN IF NOT EXISTS code_name text null;
--   ALTER TABLE public.arena_profiles ADD COLUMN IF NOT EXISTS code_hidden boolean not null default false;

create table if not exists public.arena_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  core_xp_total integer not null default 0,
  stage integer not null default 1,
  code_name text null,
  code_hidden boolean not null default false,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.arena_profiles enable row level security;

-- Users can read their own profile
drop policy if exists "arena_profiles_select_own" on public.arena_profiles;
create policy "arena_profiles_select_own"
on public.arena_profiles
for select
to authenticated
using (user_id = auth.uid());

-- Users can insert their own profile (server will do it; still safe)
drop policy if exists "arena_profiles_insert_own" on public.arena_profiles;
create policy "arena_profiles_insert_own"
on public.arena_profiles
for insert
to authenticated
with check (user_id = auth.uid());

-- Users can update their own profile
drop policy if exists "arena_profiles_update_own" on public.arena_profiles;
create policy "arena_profiles_update_own"
on public.arena_profiles
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Keep updated_at fresh (reuse function if exists)
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_arena_profiles_updated_at on public.arena_profiles;
create trigger trg_arena_profiles_updated_at
before update on public.arena_profiles
for each row execute function public.set_updated_at();
