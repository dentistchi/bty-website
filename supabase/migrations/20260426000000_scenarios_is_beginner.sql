-- Beginner 7-step flow vs full Arena copy: same (locale, id), flagged for consumers.

alter table public.scenarios
  add column if not exists is_beginner boolean not null default false;

comment on column public.scenarios.is_beginner is
  'True when row body/choices follow beginner_7step shape (from BEGINNER_SCENARIOS sync).';
