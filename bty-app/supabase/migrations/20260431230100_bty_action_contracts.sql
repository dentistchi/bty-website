-- Action Contract rows for Arena run completion → My Page hub + session/next gate + QR token.
-- Columns align with bty-app readers: openActionContractForMyPage, session/next, qr/* routes.

create table if not exists public.bty_action_contracts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id text not null,
  contract_description text not null,
  deadline_at timestamptz not null,
  verification_mode text not null default 'hybrid',
  status text not null default 'pending',
  required boolean not null default false,
  completion_method text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint bty_action_contracts_user_session_unique unique (user_id, session_id),
  constraint bty_action_contracts_status_check check (status in ('pending', 'completed', 'missed')),
  constraint bty_action_contracts_verification_mode_check check (
    verification_mode in ('qr', 'link', 'hybrid')
  )
);

create index if not exists bty_action_contracts_user_status_deadline_idx
  on public.bty_action_contracts (user_id, status, deadline_at desc);

comment on table public.bty_action_contracts is 'Arena Action Loop: one row per completed run (session_id = arena_runs.run_id); My Page + QR mint.';

alter table public.bty_action_contracts enable row level security;

drop policy if exists "bty_action_contracts_select_own" on public.bty_action_contracts;
create policy "bty_action_contracts_select_own"
  on public.bty_action_contracts
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "bty_action_contracts_update_own" on public.bty_action_contracts;
create policy "bty_action_contracts_update_own"
  on public.bty_action_contracts
  for update
  to authenticated
  using (auth.uid() = user_id);
