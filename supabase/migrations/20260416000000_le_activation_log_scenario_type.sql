-- Pattern history / Arena narrative: optional scenario bucket per AIR activation row.

alter table public.le_activation_log
  add column if not exists scenario_type text null;

comment on column public.le_activation_log.scenario_type is
  'Optional Arena/LM scenario bucket for pattern narrative (e.g. scenario_id slug).';

create index if not exists le_activation_log_user_created_idx
  on public.le_activation_log (user_id, created_at desc);
