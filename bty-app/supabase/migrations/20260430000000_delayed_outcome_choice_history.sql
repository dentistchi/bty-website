-- Delayed outcomes from user_scenario_choice_history (7-day follow-up) + scheduling.

alter table public.user_scenario_choice_history
  add column if not exists outcome_triggered boolean not null default false;

alter table public.user_scenario_choice_history
  add column if not exists scenario_type text not null default '';

comment on column public.user_scenario_choice_history.outcome_triggered is
  'True after delayed outcome was delivered/acknowledged (engine delayed-outcome-trigger).';
comment on column public.user_scenario_choice_history.scenario_type is
  'Mirrors scenarios.scenario_type when known; used with flag_type to pick template.';

create index if not exists user_scenario_choice_history_user_outcome_idx
  on public.user_scenario_choice_history (user_id, outcome_triggered, played_at desc);

alter table public.arena_pending_outcomes
  add column if not exists scheduled_for timestamptz;

alter table public.arena_pending_outcomes
  add column if not exists source_choice_history_id uuid references public.user_scenario_choice_history (id) on delete cascade;

comment on column public.arena_pending_outcomes.scheduled_for is
  'When this delayed outcome becomes due (typically played_at + 7 days from source choice).';
comment on column public.arena_pending_outcomes.source_choice_history_id is
  'Originating user_scenario_choice_history row; unique per user when set.';

update public.arena_pending_outcomes
set scheduled_for = coalesce(scheduled_for, created_at)
where scheduled_for is null;

create unique index if not exists arena_pending_outcomes_user_choice_history_unique
  on public.arena_pending_outcomes (user_id, source_choice_history_id)
  where source_choice_history_id is not null;

create index if not exists arena_pending_outcomes_user_scheduled_idx
  on public.arena_pending_outcomes (user_id, scheduled_for)
  where status = 'pending';
