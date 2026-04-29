-- Resilience tracker: computed score snapshots (0–100) for Center weekly card + mentor context.

create table if not exists public.user_resilience_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  score numeric not null check (score >= 0 and score <= 100),
  computed_at timestamptz not null default now()
);

comment on table public.user_resilience_scores is
  'Append-only resilience_score snapshots from engine/resilience-tracker.service.';

create index if not exists user_resilience_scores_user_computed_idx
  on public.user_resilience_scores (user_id, computed_at desc);

alter table public.user_resilience_scores enable row level security;

drop policy if exists "user_resilience_scores_select_own" on public.user_resilience_scores;
create policy "user_resilience_scores_select_own"
  on public.user_resilience_scores for select to authenticated
  using (auth.uid() = user_id);
