-- Dear Me prompt recommendations (Healing phase + letter cadence).

create table if not exists public.dear_me_recommendations (
  user_id uuid primary key references auth.users (id) on delete cascade,
  prompt_type text not null
    check (prompt_type in ('first_letter', 'reflection_check', 'awakening_letter', 'none')),
  healing_phase text,
  letter_count integer not null default 0,
  last_letter_at timestamptz,
  recommended_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.dear_me_recommendations is
  'Latest Dear Me CTA prompt derived from healing phase and dear_me_letters activity.';

create index if not exists dear_me_recommendations_updated_idx
  on public.dear_me_recommendations (updated_at desc);

alter table public.dear_me_recommendations enable row level security;

drop policy if exists "dear_me_recommendations_select_own" on public.dear_me_recommendations;
create policy "dear_me_recommendations_select_own"
  on public.dear_me_recommendations for select to authenticated
  using (auth.uid() = user_id);
