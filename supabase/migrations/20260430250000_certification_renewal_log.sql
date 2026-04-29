-- Certified Leader expiry → auto-renewal attempts (LRI + 7d integrity slip gate); widget history.

create table if not exists public.certification_renewal_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  attempted_at timestamptz not null default now(),
  renewed boolean not null,
  lri_at_attempt numeric,
  expired_grant_id uuid,
  new_grant_id uuid,
  block_reason text
);

comment on table public.certification_renewal_log is
  'Renewal attempts after certified_leader_grants expiry; service role writes; user reads own.';

create index if not exists certification_renewal_log_user_attempted_idx
  on public.certification_renewal_log (user_id, attempted_at desc);

alter table public.certification_renewal_log enable row level security;

drop policy if exists "certification_renewal_log_select_own" on public.certification_renewal_log;
create policy "certification_renewal_log_select_own"
  on public.certification_renewal_log for select to authenticated
  using (user_id = auth.uid());

alter publication supabase_realtime add table only public.certification_renewal_log;
