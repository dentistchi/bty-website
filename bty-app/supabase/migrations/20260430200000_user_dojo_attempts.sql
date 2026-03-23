-- Foundry skill micro-assessments (6 areas) — assigned on program completion / slip recovery; scored on submit.

create table if not exists public.user_dojo_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  assessment_id text not null,
  skill_area text not null
    check (skill_area in ('communication', 'decision', 'resilience', 'integrity', 'leadership', 'empathy')),
  assigned_at timestamptz not null default now(),
  answers_json jsonb,
  score numeric,
  passed boolean,
  submitted_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.user_dojo_attempts is
  'Foundry dojo skill assessments: assign rows, fill on submit (answers 1–5 per question id).';

create index if not exists user_dojo_attempts_user_assigned_idx
  on public.user_dojo_attempts (user_id, assigned_at desc);

create index if not exists user_dojo_attempts_user_open_idx
  on public.user_dojo_attempts (user_id, assessment_id)
  where submitted_at is null;

alter table public.user_dojo_attempts enable row level security;

drop policy if exists "user_dojo_attempts_select_own" on public.user_dojo_attempts;
create policy "user_dojo_attempts_select_own"
  on public.user_dojo_attempts for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "user_dojo_attempts_insert_own" on public.user_dojo_attempts;
create policy "user_dojo_attempts_insert_own"
  on public.user_dojo_attempts for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "user_dojo_attempts_update_own" on public.user_dojo_attempts;
create policy "user_dojo_attempts_update_own"
  on public.user_dojo_attempts for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
