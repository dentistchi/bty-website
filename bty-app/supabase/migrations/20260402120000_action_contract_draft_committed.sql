-- Draft / committed lifecycle for bty_action_contracts (choice → draft → PATCH → commit → validator submit).

alter table public.bty_action_contracts
  add column if not exists arena_scenario_id text,
  add column if not exists primary_choice_id text,
  add column if not exists committed_at timestamptz;

comment on column public.bty_action_contracts.arena_scenario_id is
  'Scenario id at draft creation (choice confirmed); mirrors arena_runs.scenario_id for this session.';
comment on column public.bty_action_contracts.primary_choice_id is
  'Choice id selected when draft was created.';
comment on column public.bty_action_contracts.committed_at is
  'When user committed Step 6 fields via POST .../commit (before validator submit).';

alter table public.bty_action_contracts
  drop constraint if exists bty_action_contracts_status_check;

alter table public.bty_action_contracts
  add constraint bty_action_contracts_status_check check (
    status in (
      'draft',
      'committed',
      'pending',
      'submitted',
      'approved',
      'rejected',
      'escalated',
      'missed'
    )
  );

drop index if exists bty_action_contracts_user_family_open_unique;

create unique index if not exists bty_action_contracts_user_family_open_unique
  on public.bty_action_contracts (user_id, pattern_family)
  where pattern_family is not null
    and status in ('draft', 'committed', 'pending', 'submitted', 'escalated');
