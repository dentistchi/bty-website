-- Beginner 7-step reflection flow: run type + maturity score on arena_runs

alter table public.arena_runs
  add column if not exists run_type text not null default 'scenario',
  add column if not exists beginner_maturity_score int null;

comment on column public.arena_runs.run_type is 'scenario | beginner';
comment on column public.arena_runs.beginner_maturity_score is '0-20 maturity score when run_type=beginner, set on completion.';

-- Beginner step responses stored as arena_events: event_type BEGINNER_EMOTION | BEGINNER_RISK | BEGINNER_INTEGRITY | BEGINNER_DECISION | BEGINNER_REFLECTION, meta = { choice index or reflection_text }.
