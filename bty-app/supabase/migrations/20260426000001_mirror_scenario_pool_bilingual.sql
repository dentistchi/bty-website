-- Bilingual mirror copy + choice anchor for HERO_TRAP / INTEGRITY_SLIP triggers.

alter table public.mirror_scenario_pool
  add column if not exists mirror_title_ko text;

alter table public.mirror_scenario_pool
  add column if not exists mirror_context_ko text;

alter table public.mirror_scenario_pool
  add column if not exists mirror_choices jsonb;

alter table public.mirror_scenario_pool
  add column if not exists origin_choice_id text;

comment on column public.mirror_scenario_pool.mirror_title_ko is 'Korean mirror title (역지사지).';
comment on column public.mirror_scenario_pool.mirror_context_ko is 'Korean mirror body / context.';
comment on column public.mirror_scenario_pool.mirror_choices is 'Snapshot of choice labels (en/ko) for mirror UI.';
comment on column public.mirror_scenario_pool.origin_choice_id is 'CHOICE_CONFIRMED choice that triggered generation (optional).';
