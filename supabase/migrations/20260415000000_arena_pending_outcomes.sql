-- Delayed outcome queue: inject narrative into user's next Arena session (engine scheduler).
-- RLS: own rows only.

create table if not exists public.arena_pending_outcomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_event_id uuid references public.arena_events(event_id) on delete set null,
  choice_type text not null,
  outcome_title text not null,
  outcome_body text not null,
  status text not null default 'pending' check (status in ('pending', 'consumed', 'cancelled')),
  created_at timestamptz not null default now(),
  consumed_at timestamptz null
);

comment on table public.arena_pending_outcomes is 'Delayed outcome injection queue for next Arena session; populated from arena_events older than scheduler lookback.';
comment on column public.arena_pending_outcomes.source_event_id is 'Originating arena_events row (CHOICE_CONFIRMED).';
comment on column public.arena_pending_outcomes.choice_type is 'Matched template key (e.g. direct_fix_or_takeover).';

create unique index if not exists arena_pending_outcomes_user_source_unique
  on public.arena_pending_outcomes(user_id, source_event_id)
  where source_event_id is not null;

create index if not exists arena_pending_outcomes_user_pending_idx
  on public.arena_pending_outcomes(user_id, created_at desc)
  where status = 'pending';

alter table public.arena_pending_outcomes enable row level security;

drop policy if exists "arena_pending_outcomes_select_own" on public.arena_pending_outcomes;
create policy "arena_pending_outcomes_select_own"
on public.arena_pending_outcomes for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "arena_pending_outcomes_insert_own" on public.arena_pending_outcomes;
create policy "arena_pending_outcomes_insert_own"
on public.arena_pending_outcomes for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "arena_pending_outcomes_update_own" on public.arena_pending_outcomes;
create policy "arena_pending_outcomes_update_own"
on public.arena_pending_outcomes for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
