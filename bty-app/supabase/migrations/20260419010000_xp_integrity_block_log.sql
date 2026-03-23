-- Audit log when Weekly XP (or all XP) is blocked due to integrity slip / lockout.

create table if not exists public.xp_integrity_block_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  xp_type text not null,
  amount numeric not null,
  reason text not null,
  created_at timestamptz not null default now()
);

comment on table public.xp_integrity_block_log is 'Blocked XP awards: integrity_slip weekly block or lockout full block.';

create index if not exists xp_integrity_block_log_user_created_idx
  on public.xp_integrity_block_log (user_id, created_at desc);

alter table public.xp_integrity_block_log enable row level security;

drop policy if exists "xp_integrity_block_log_select_own" on public.xp_integrity_block_log;
create policy "xp_integrity_block_log_select_own"
on public.xp_integrity_block_log for select
to authenticated
using (auth.uid() = user_id);
