-- Component columns for resilience snapshots (audit + UI); engine/resilience-tracker.service.ts

alter table public.user_resilience_scores
  add column if not exists consecutive_clean_choices integer,
  add column if not exists recovery_days numeric,
  add column if not exists phase_completions integer;

comment on column public.user_resilience_scores.consecutive_clean_choices is
  'Trailing consecutive CLEAN choices from user_scenario_choice_history.';
comment on column public.user_resilience_scores.recovery_days is
  'Sum of slip→first-CLEAN day spans from integrity_slip_log + choice timestamps.';
comment on column public.user_resilience_scores.phase_completions is
  'Center healing phases completed / progressed (user_healing_phase).';
