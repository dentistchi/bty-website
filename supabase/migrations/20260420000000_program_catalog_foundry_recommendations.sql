-- Foundry program catalog (12) + per-user top-3 recommendations.

create table if not exists public.program_catalog (
  program_id text primary key,
  title text not null,
  scenario_tags text[] not null default '{}'::text[],
  phase_tags text[] not null default '{}'::text[],
  flag_tags text[] not null default '{}'::text[]
);

comment on table public.program_catalog is 'Foundry tracks; tags matched against Arena scenario, healing phase, integrity slip reason.';
comment on column public.program_catalog.scenario_tags is 'Slugs e.g. patient, hygienist, team (from last Arena scenario_id).';
comment on column public.program_catalog.phase_tags is 'Healing phases: ACKNOWLEDGEMENT, REFLECTION, REINTEGRATION, RENEWAL.';
comment on column public.program_catalog.flag_tags is 'Derived from integrity_slip_log.reason e.g. lockout, air_delta_slip.';

insert into public.program_catalog (program_id, title, scenario_tags, phase_tags, flag_tags) values
  ('fp_01', 'Patient dialogue & boundaries', array['patient','general']::text[], array['REFLECTION','ACKNOWLEDGEMENT','REINTEGRATION']::text[], array['lockout','air_delta_slip']::text[]),
  ('fp_02', 'Hygienist alignment', array['hygienist','clinical']::text[], array['REFLECTION','REINTEGRATION']::text[], array['air_delta_slip']::text[]),
  ('fp_03', 'Front desk & schedule integrity', array['front_desk','office']::text[], array['REINTEGRATION','RENEWAL']::text[], array['lockout']::text[]),
  ('fp_04', 'Manager–clinician negotiation', array['manager','team']::text[], array['REFLECTION','RENEWAL']::text[], array['lockout','air_delta_slip']::text[]),
  ('fp_05', 'Assistant coaching & safety', array['assistant','team']::text[], array['ACKNOWLEDGEMENT','REFLECTION']::text[], array['air_delta_slip']::text[]),
  ('fp_06', 'Peer clinician candor', array['peer','clinical']::text[], array['REINTEGRATION']::text[], array['lockout']::text[]),
  ('fp_07', 'Negative review response', array['patient','reputation']::text[], array['REFLECTION','RENEWAL']::text[], array['air_delta_slip']::text[]),
  ('fp_08', 'Team conflict mediation', array['team','conflict']::text[], array['ACKNOWLEDGEMENT','REFLECTION','REINTEGRATION']::text[], array['lockout','air_delta_slip']::text[]),
  ('fp_09', 'Billing & insurance clarity', array['office','billing']::text[], array['REINTEGRATION']::text[], array['air_delta_slip']::text[]),
  ('fp_10', 'Renewal & habits (maintenance)', array['general']::text[], array['RENEWAL']::text[], array['lockout']::text[]),
  ('fp_11', 'Micro-win streak reinforcement', array['general','clinical']::text[], array['ACKNOWLEDGEMENT','REFLECTION']::text[], array['air_delta_slip']::text[]),
  ('fp_12', 'Post-lockout re-entry playbook', array['general']::text[], array['ACKNOWLEDGEMENT','REINTEGRATION']::text[], array['lockout']::text[])
on conflict (program_id) do nothing;

create table if not exists public.foundry_recommendations (
  user_id uuid not null references auth.users(id) on delete cascade,
  rank smallint not null check (rank >= 1 and rank <= 3),
  program_id text not null references public.program_catalog(program_id) on delete cascade,
  match_score int not null default 0,
  created_at timestamptz not null default now(),
  primary key (user_id, rank)
);

create index if not exists foundry_recommendations_user_created_idx
  on public.foundry_recommendations (user_id, created_at desc);

comment on table public.foundry_recommendations is 'Top-3 Foundry programs by tag match after foundry_program_assign.';

alter table public.program_catalog enable row level security;
alter table public.foundry_recommendations enable row level security;

drop policy if exists "program_catalog_select_all" on public.program_catalog;
create policy "program_catalog_select_all"
on public.program_catalog for select
to authenticated
using (true);

drop policy if exists "foundry_recommendations_select_own" on public.foundry_recommendations;
create policy "foundry_recommendations_select_own"
on public.foundry_recommendations for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "foundry_recommendations_insert_own" on public.foundry_recommendations;
create policy "foundry_recommendations_insert_own"
on public.foundry_recommendations for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "foundry_recommendations_update_own" on public.foundry_recommendations;
create policy "foundry_recommendations_update_own"
on public.foundry_recommendations for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "foundry_recommendations_delete_own" on public.foundry_recommendations;
create policy "foundry_recommendations_delete_own"
on public.foundry_recommendations for delete
to authenticated
using (auth.uid() = user_id);
