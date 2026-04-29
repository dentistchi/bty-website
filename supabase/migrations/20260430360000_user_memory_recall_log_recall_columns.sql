-- Optional columns for recall log (live may already have them). Safe IF NOT EXISTS.

alter table public.user_memory_recall_log
  add column if not exists recalled_from_scenario_id text;

alter table public.user_memory_recall_log
  add column if not exists pattern_key text;

alter table public.user_memory_recall_log
  add column if not exists recall_message text;

alter table public.user_memory_recall_log
  add column if not exists recall_type text;

comment on column public.user_memory_recall_log.recalled_from_scenario_id is
  'Scenario where the pattern threshold was crossed (source run).';
comment on column public.user_memory_recall_log.pattern_key is
  'Pattern aggregate key, e.g. flag_consecutive:INTENT.';
comment on column public.user_memory_recall_log.recall_message is
  'Narrative shown with the next scenario.';
comment on column public.user_memory_recall_log.recall_type is
  'Same family as recall_kind / queue trigger_type.';
