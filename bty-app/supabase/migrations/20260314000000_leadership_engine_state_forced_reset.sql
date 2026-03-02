-- P3: Stage 4 forced reset — track when reset was triggered; reset cannot be permanently dismissed, max 48h delay.
-- Ref: docs/LEADERSHIP_ENGINE_SPEC.md §5, ENGINE_ARCHITECTURE_DIRECTIVE_PLAN §4 P3.

alter table public.leadership_engine_state
  add column if not exists forced_reset_triggered_at timestamptz null;

comment on column public.leadership_engine_state.forced_reset_triggered_at is 'When Stage 4 was triggered by forced-reset conditions. Reset due = this + 48h. Cleared when Stage 4 completes (→ Stage 1).';
