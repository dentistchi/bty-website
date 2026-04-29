-- UX_FLOW_LOCK_V1 Step 5 — set only on explicit Continue (ENGINE §5 rule 9 / INV-M09).
alter table public.arena_runs
  add column if not exists acknowledgment_timestamp timestamptz;

comment on column public.arena_runs.acknowledgment_timestamp is
  'Pattern Mirror (Step 5): set when user activates Continue; not on dwell, viewport, or impression.';
