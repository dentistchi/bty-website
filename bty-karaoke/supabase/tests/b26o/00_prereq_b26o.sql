-- BUILD 26O harness prereq — ADDITIVE ONLY, applied after supabase/tests/20m/00_prereq.sql.
--
-- The 20M prereq builds the METERING stand-in schema. BUILD 26O additionally applies BUILD 26E
-- (account deletion authority) and BUILD 26L (commerce ledger), which reference account-identity
-- columns the metering subset never needed. Kept in a SEPARATE file rather than widened into the
-- shared 20m fixture, for the reason b25 states: one suite's assumptions must not quietly become
-- another's.
alter table public.karaoke_accounts add column if not exists authority_ref uuid not null default gen_random_uuid();
alter table public.karaoke_accounts add column if not exists purchase_owner_ref uuid not null default gen_random_uuid();
alter table public.karaoke_accounts add column if not exists status text not null default 'active';
alter table public.karaoke_accounts add column if not exists deleted_at timestamptz;
create table if not exists public.karaoke_host_plan_assignments (
  account_id uuid not null,
  plan_code  text not null,
  status     text not null default 'active'
);
alter table public.karaoke_rooms add column if not exists status text not null default 'open';
alter table public.karaoke_rooms add column if not exists slug text;

-- `touch_updated_at` is defined by 20260714120000_karaoke_events.sql, which is an Events
-- migration with its own unrelated dependency chain. BUILD 26L attaches it as a trigger to the
-- commerce tables, so the harness needs the FUNCTION, not the Events schema. Copied verbatim
-- from that migration so the fixture cannot drift from the real definition.
create or replace function public.touch_updated_at() returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- BUILD 26M's `karaoke_begin_song_v2` reads `karaoke_free_window_carryover`, which BUILD 26E
-- creates. Copied verbatim from 20260809120000 rather than applying that whole migration, for
-- the reason given in run.sh: 26E's real subject is account deletion, and dragging in its
-- workspace/session/identity chain would make this fixture larger than the thing under test.
create table if not exists public.karaoke_free_window_carryover (
  id                    uuid primary key default gen_random_uuid(),
  account_id            uuid not null references public.karaoke_accounts(id) on delete cascade,
  charged_window_start  timestamptz not null,
  charged_window_end    timestamptz not null,
  carried_used_seconds  int not null default 0 check (carried_used_seconds >= 0),
  grace_consumed        boolean not null default false,
  source_tombstone_id   uuid not null references public.karaoke_accounts(id) on delete restrict,
  fingerprint           text,
  created_at            timestamptz not null default now(),
  constraint karaoke_free_window_carryover_window_chk check (charged_window_end > charged_window_start)
);
create unique index if not exists karaoke_free_window_carryover_acct_window_idx
  on public.karaoke_free_window_carryover (account_id, charged_window_start);
