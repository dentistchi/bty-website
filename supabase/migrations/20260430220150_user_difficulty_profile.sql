-- Per-user Arena catalog difficulty floor (1–3), adjusted from session AIR + flag_type.

create table if not exists public.user_difficulty_profile (
  user_id uuid primary key references auth.users (id) on delete cascade,
  difficulty_floor smallint not null default 1 check (difficulty_floor >= 1 and difficulty_floor <= 3),
  updated_at timestamptz not null default now()
);

comment on table public.user_difficulty_profile is
  'Minimum `public.scenarios.difficulty` tier for next Arena pick (see scenario-difficulty-adjuster.service).';

alter table public.user_difficulty_profile enable row level security;

drop policy if exists "user_difficulty_profile_select_own" on public.user_difficulty_profile;
create policy "user_difficulty_profile_select_own"
  on public.user_difficulty_profile for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "user_difficulty_profile_upsert_own" on public.user_difficulty_profile;
create policy "user_difficulty_profile_upsert_own"
  on public.user_difficulty_profile for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "user_difficulty_profile_update_own" on public.user_difficulty_profile;
create policy "user_difficulty_profile_update_own"
  on public.user_difficulty_profile for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
