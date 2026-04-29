-- When the user dismisses the delayed outcome banner in Arena, UI sets this timestamp (with status consumed).

alter table public.arena_pending_outcomes
  add column if not exists delivered_at timestamptz null;

comment on column public.arena_pending_outcomes.delivered_at is
  'Set when the delayed outcome was dismissed/shown as delivered in Arena (alongside consumed_at).';
