-- Arena scenario catalog (coverage / locale) + per-user play history for selection.

create table if not exists public.scenarios (
  scenario_id text primary key,
  flag_type text not null,
  locale text not null default 'both' check (locale in ('en', 'ko', 'both'))
);

comment on table public.scenarios is
  'Arena scenario metadata for weighted selection. Full copy lives in app constants; flag_type drives coverage balancing.';

create table if not exists public.user_scenario_history (
  user_id uuid primary key references auth.users (id) on delete cascade,
  played_scenario_ids text[] not null default '{}'
);

comment on table public.user_scenario_history is
  'Scenario ids the user has already played (Arena session).';

comment on column public.user_scenario_history.played_scenario_ids is
  'Ordered or unordered list of scenario_id strings; selector excludes these until replay is allowed.';

alter table public.scenarios enable row level security;
alter table public.user_scenario_history enable row level security;
