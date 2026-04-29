-- Re-exposure closure: server-persisted pattern-shift validation (same-axis; changed | unstable | no_change).

alter table public.arena_pending_outcomes
  add column if not exists validation_payload jsonb;

comment on column public.arena_pending_outcomes.validation_payload is
  'POST /api/arena/re-exposure/validate: before/after axis, pattern families, action_decision_commitment snapshot, validation_result.';
