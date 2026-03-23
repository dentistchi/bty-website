-- Leadership Readiness Index (weighted daily AIR trend, 14d) per user

create table if not exists public.leadership_readiness_index (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lri numeric(5,4) not null check (lri >= 0 and lri <= 1),
  promotion_ready boolean not null default false,
  daily_air jsonb not null,
  calculated_at timestamptz not null default now()
);

create index if not exists leadership_readiness_index_user_calc_idx
  on public.leadership_readiness_index (user_id, calculated_at desc);

comment on table public.leadership_readiness_index is 'Rolling 14d weighted AIR trend (LRI-like); promotion when all daily AIR ≥ 0.8.';

alter table public.leadership_readiness_index enable row level security;

drop policy if exists "leadership_readiness_index_select_own" on public.leadership_readiness_index;
create policy "leadership_readiness_index_select_own"
  on public.leadership_readiness_index for select
  to authenticated
  using (auth.uid() = user_id);
