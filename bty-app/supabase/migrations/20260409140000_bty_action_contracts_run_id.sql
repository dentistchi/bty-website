-- Link action contracts to arena runs explicitly (session_id already mirrors run_id as text).

alter table public.bty_action_contracts
  add column if not exists run_id uuid references public.arena_runs (run_id) on delete set null;

comment on column public.bty_action_contracts.run_id is
  'Arena run UUID; backfilled from session_id when it matches arena_runs.run_id.';

-- Backfill where session_id is the canonical run id string
update public.bty_action_contracts c
set run_id = ar.run_id
from public.arena_runs ar
where c.run_id is null
  and trim(c.session_id) = ar.run_id::text;

create index if not exists bty_action_contracts_run_id_idx
  on public.bty_action_contracts (run_id)
  where run_id is not null;
