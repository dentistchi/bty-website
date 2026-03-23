-- Rotation metadata when old plays are dropped from `played_scenario_ids` (see scenario-archive.service).

alter table public.user_scenario_history
  add column if not exists scenario_archived_at jsonb not null default '{}'::jsonb;

comment on column public.user_scenario_history.scenario_archived_at is
  'Map scenario_id → ISO timestamp when rotation removed it from played_scenario_ids (90d rule).';
