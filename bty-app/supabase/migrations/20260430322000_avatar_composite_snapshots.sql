-- Cached resolved composite layers for fast avatar UI (see avatar-composite-snapshot.service.ts).

create table if not exists public.avatar_composite_snapshots (
  user_id uuid primary key references auth.users (id) on delete cascade,
  tier smallint not null check (tier >= 0 and tier <= 4),
  layers_json jsonb not null default '[]'::jsonb,
  snapped_at timestamptz not null default now()
);

comment on table public.avatar_composite_snapshots is
  'Precomputed ResolvedLayer[] from resolveCompositeAssets; JSON mirrors engine types.';

create index if not exists avatar_composite_snapshots_snapped_at_idx
  on public.avatar_composite_snapshots (snapped_at desc);

alter table public.avatar_composite_snapshots enable row level security;

drop policy if exists "avatar_composite_snapshots_select_own" on public.avatar_composite_snapshots;
create policy "avatar_composite_snapshots_select_own"
  on public.avatar_composite_snapshots for select to authenticated
  using (auth.uid() = user_id);
