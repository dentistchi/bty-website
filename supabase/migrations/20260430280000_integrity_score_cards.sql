-- One row per user: latest computed integrity score card (AIR/LRI/resilience weighted grade).

create table if not exists public.integrity_score_cards (
  user_id uuid primary key references auth.users (id) on delete cascade,
  grade text not null check (grade in ('A', 'B', 'C', 'D')),
  computed_at timestamptz not null default now(),
  component_scores jsonb not null default '{}'::jsonb
);

comment on table public.integrity_score_cards is
  'Weighted integrity grade (AIR 40% + LRI 30% + resilience 30%) from engine/integrity-score-card.service.';

create index if not exists integrity_score_cards_computed_at_idx
  on public.integrity_score_cards (computed_at desc);

alter table public.integrity_score_cards enable row level security;

drop policy if exists "integrity_score_cards_select_own" on public.integrity_score_cards;
create policy "integrity_score_cards_select_own"
  on public.integrity_score_cards for select to authenticated
  using (auth.uid() = user_id);
