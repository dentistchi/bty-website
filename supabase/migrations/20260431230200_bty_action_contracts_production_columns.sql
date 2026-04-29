-- Production parity: NOT NULL columns required by ensureActionContract INSERT.

alter table public.bty_action_contracts
  add column if not exists action_id text,
  add column if not exists action_type text,
  add column if not exists le_activation_type text,
  add column if not exists verification_type text,
  add column if not exists weight double precision,
  add column if not exists mode text,
  add column if not exists chosen_at timestamptz;

update public.bty_action_contracts
set
  action_id = 'arena_action_loop:' || session_id,
  action_type = 'arena_run_completion',
  le_activation_type = 'arena',
  verification_type = 'hybrid',
  weight = 1.0,
  mode = 'arena',
  chosen_at = coalesce(chosen_at, created_at)
where
  action_id is null
  or trim(action_id) = ''
  or action_type is null
  or le_activation_type is null
  or verification_type is null
  or weight is null
  or mode is null
  or chosen_at is null;

alter table public.bty_action_contracts
  alter column action_id set not null,
  alter column action_type set not null,
  alter column le_activation_type set not null,
  alter column verification_type set not null,
  alter column weight set not null,
  alter column mode set not null,
  alter column chosen_at set not null;
