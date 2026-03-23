-- Foundry program_catalog: checklist modules + optional Dojo skill for recovery alignment.

alter table public.program_catalog
  add column if not exists modules jsonb not null default '[]'::jsonb;

alter table public.program_catalog
  add column if not exists skill_area text null;

alter table public.program_catalog
  drop constraint if exists program_catalog_skill_area_check;

alter table public.program_catalog
  add constraint program_catalog_skill_area_check
  check (
    skill_area is null
    or skill_area in ('communication', 'decision', 'resilience', 'integrity', 'leadership', 'empathy')
  );

comment on column public.program_catalog.modules is 'JSON array of module title strings for checklist UI.';
comment on column public.program_catalog.skill_area is 'Optional Dojo micro-assessment skill; used with slip recovery dojo_assessment matching.';

update public.program_catalog set modules = '["모듈 1","모듈 2","모듈 3"]'::jsonb where modules = '[]'::jsonb;

update public.program_catalog set skill_area = case program_id
  when 'fp_01' then 'communication'
  when 'fp_02' then 'decision'
  when 'fp_03' then 'resilience'
  when 'fp_04' then 'integrity'
  when 'fp_05' then 'leadership'
  when 'fp_06' then 'empathy'
  when 'fp_07' then 'communication'
  when 'fp_08' then 'decision'
  when 'fp_09' then 'resilience'
  when 'fp_10' then 'integrity'
  when 'fp_11' then 'leadership'
  when 'fp_12' then 'empathy'
  else null
end;
