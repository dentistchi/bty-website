-- File-backed Arena scenario content (locale + id); loaded by engine scenario-loader.service.

create table if not exists public.scenarios (
  locale text not null check (locale in ('en', 'ko')),
  id text not null,
  title text not null,
  body text not null default '',
  choices jsonb not null default '[]'::jsonb,
  flag_type text not null default '',
  scenario_type text not null default '',
  updated_at timestamptz not null default now(),
  primary key (locale, id)
);

comment on table public.scenarios is 'JSON-driven scenario copy; composite key (locale, id).';
create index if not exists scenarios_scenario_type_idx on public.scenarios (scenario_type);

alter table public.scenarios enable row level security;

drop policy if exists "scenarios_select_authenticated" on public.scenarios;
create policy "scenarios_select_authenticated"
on public.scenarios for select
to authenticated
using (true);

drop policy if exists "scenarios_select_anon" on public.scenarios;
create policy "scenarios_select_anon"
on public.scenarios for select
to anon
using (true);
