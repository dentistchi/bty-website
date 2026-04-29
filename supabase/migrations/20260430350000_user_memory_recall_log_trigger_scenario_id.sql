-- Align `user_memory_recall_log` with live NOT NULL `trigger_scenario_id` (next-scenario id when recall is shown).
-- Code path: `consumePendingPatternThresholdRecall` sets this from session router `scenarioId`.

alter table public.user_memory_recall_log
  add column if not exists trigger_scenario_id text;

comment on column public.user_memory_recall_log.trigger_scenario_id is
  'Scenario id for which recall was surfaced (same as session next scenario).';

update public.user_memory_recall_log
set trigger_scenario_id = coalesce(nullif(trim(context->>'scenario_id'), ''), 'unknown')
where trigger_scenario_id is null
  and context ? 'scenario_id';
