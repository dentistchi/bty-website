-- Team Integrity Index snapshots (recomputed on team AIR write + queryable latest TII)

create table if not exists public.team_integrity_index (
  id uuid primary key default gen_random_uuid(),
  team_id text not null,
  tii numeric(5,4) not null check (tii >= 0 and tii <= 1),
  avg_air numeric(5,4) not null,
  avg_mwd numeric(5,4) not null,
  tsp numeric(3,2) not null check (tsp >= 1 and tsp <= 5),
  calculated_at timestamptz not null default now()
);

create index if not exists team_integrity_index_team_calc_idx
  on public.team_integrity_index (team_id, calculated_at desc);

comment on table public.team_integrity_index is 'Append-only TII snapshots per team (rolling 7d recompute on AIR write).';

alter table public.team_integrity_index enable row level security;

drop policy if exists "team_integrity_index_select" on public.team_integrity_index;
create policy "team_integrity_index_select"
  on public.team_integrity_index for select
  to authenticated
  using (true);
