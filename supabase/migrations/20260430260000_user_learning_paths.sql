-- Foundry: active learning path (Integrity / Resilience / Leadership / Empathy) + cursor for checklist UX.

create table if not exists public.user_learning_paths (
  user_id uuid primary key references auth.users (id) on delete cascade,
  path_name text not null
    check (path_name in ('Integrity', 'Resilience', 'Leadership', 'Empathy')),
  current_index smallint not null default 0 check (current_index >= 0),
  updated_at timestamptz not null default now()
);

comment on table public.user_learning_paths is
  'Active Foundry learning path; programs come from engine LEARNING_PATH_MAP; current_index is advanced on path program completion.';

create index if not exists user_learning_paths_updated_idx
  on public.user_learning_paths (updated_at desc);

alter table public.user_learning_paths enable row level security;

drop policy if exists "user_learning_paths_select_own" on public.user_learning_paths;
create policy "user_learning_paths_select_own"
  on public.user_learning_paths for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "user_learning_paths_upsert_own" on public.user_learning_paths;
create policy "user_learning_paths_upsert_own"
  on public.user_learning_paths for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "user_learning_paths_update_own" on public.user_learning_paths;
create policy "user_learning_paths_update_own"
  on public.user_learning_paths for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "user_learning_paths_delete_own" on public.user_learning_paths;
create policy "user_learning_paths_delete_own"
  on public.user_learning_paths for delete to authenticated
  using (auth.uid() = user_id);
