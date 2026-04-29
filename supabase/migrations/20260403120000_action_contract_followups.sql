-- Follow-up loop after action contract: execution check-in linked 1:1 to bty_action_contracts.

create table if not exists public.bty_action_contract_followups (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.bty_action_contracts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  started_conversation boolean not null,
  first_30_seconds text,
  trust_delta smallint not null default 0,
  courage_delta smallint not null default 0,
  self_narrative_delta smallint not null default 0,
  created_at timestamptz not null default now(),
  constraint bty_action_contract_followups_contract_unique unique (contract_id)
);

create index if not exists bty_action_contract_followups_user_created_idx
  on public.bty_action_contract_followups (user_id, created_at desc);

comment on table public.bty_action_contract_followups is
  'Post–action-contract follow-up: did they start the conversation; optional first-30s note; stored deltas (trust/courage/self_narrative).';

alter table public.bty_action_contract_followups enable row level security;

drop policy if exists "bty_action_contract_followups_select_own" on public.bty_action_contract_followups;
create policy "bty_action_contract_followups_select_own"
  on public.bty_action_contract_followups
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "bty_action_contract_followups_insert_own" on public.bty_action_contract_followups;
create policy "bty_action_contract_followups_insert_own"
  on public.bty_action_contract_followups
  for insert
  to authenticated
  with check (auth.uid() = user_id);
