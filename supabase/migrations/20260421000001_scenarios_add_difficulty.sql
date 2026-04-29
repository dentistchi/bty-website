alter table public.scenarios
  add column if not exists difficulty smallint not null default 2
  check (difficulty in (1, 2, 3));

comment on column public.scenarios.difficulty is '1=easy, 2=mid, 3=hard (Zod scenario schema).';

alter table public.scenarios
  alter column flag_type drop not null;

update public.scenarios set flag_type = '' where flag_type is null;
