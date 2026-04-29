-- Add nullable jsonb column for detailed JSON
alter table public.bty_action_contracts
add column if not exists details jsonb;

-- Add nullable text column for source
alter table public.bty_action_contracts
add column if not exists source text;

-- Create optional index on source column
create index if not exists bty_action_contracts_source_idx
on public.bty_action_contracts(source);