-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- ============================================================================
-- BUILD 26U-R4A · CONTROLLED PREMIUM ROLLOUT — dual_allowlist (ACCOUNT + ROOM).
-- Sorts after 20260823120000_karaoke_premium_room_rollout_v1.sql.
-- ADDITIVE + IDEMPOTENT. No column dropped, no historical row rewritten.
--
-- WHY THIS EXISTS. BUILD 26U-R4 measured that a GLOBAL `dual` would expose 14 live production
-- Events to the Premium Room guard — 12 NOT-ENTITLED, 2 with no resolvable owner, 0 entitled.
-- The guard's expiry behaviour is correct (WAITING -> removed, PLAYING -> skipped, event ->
-- ended), which is exactly why turning it on for everyone at once would have closed twelve real
-- rooms on their next host action. A validation slice must not do that.
--
-- WHY ACCOUNT + ROOM, AND NOT ACCOUNT ALONE. The Founder account that would run the validation
-- also owns `bty-home`, a live room in daily use. An account-scoped allowlist would have swept
-- it in. The participation key is therefore the PAIR, and the R4A test room was deliberately
-- chosen from that same account so the distinction is provable rather than assumed.
--
-- WHAT A ROW MEANS, AND ONLY THIS:
--     "this account+room pair participates in the controlled Premium rollout"
-- It does not create an entitlement, issue a pass, activate a pass, grant room time, or prove
-- payment. Financial authority is unchanged and is asserted by permanent tests:
--     verified Apple purchase -> fulfilment -> timed grant -> Event activation
--
-- DELIBERATELY NOT COUPLED to any Apple transaction row: a rollout boundary and a payment record
-- must not be able to imply one another.
-- ============================================================================

-- ── A. THE PARTICIPATION TABLE ──
--
-- Shaped after `karaoke_lease_rollout` (BUILD 20M), which drove the lease cutover, with one
-- deliberate difference: the key is the PAIR, so participation can never widen to a whole
-- account by accident.
create table if not exists public.karaoke_premium_room_rollout (
  account_id uuid not null references public.karaoke_accounts(id) on delete cascade,
  room_id    uuid not null references public.karaoke_rooms(id)    on delete cascade,
  added_at   timestamptz not null default now(),
  note       text,
  -- THE authority key. A room appears at most once, for exactly one account.
  primary key (account_id, room_id)
);
-- A room may only ever participate under ONE account, so a room that changes hands cannot end up
-- allowlisted twice with different owners.
create unique index if not exists karaoke_premium_room_rollout_room_idx
  on public.karaoke_premium_room_rollout (room_id);

alter table public.karaoke_premium_room_rollout enable row level security;
revoke all on table public.karaoke_premium_room_rollout from public, anon, authenticated;
-- Read + controlled write for the server only; participation is an operational decision that
-- arrives as a reviewed migration, exactly like the catalog contract.
grant select, insert, delete on table public.karaoke_premium_room_rollout to service_role;

-- ── B. THE ROOM-SCOPED READ — enforcement authority ──
--
-- Resolves the room's CANONICAL OWNER and then requires the exact pair. Two consequences worth
-- stating: a credential cannot influence the answer (the owner is not the caller), and a room
-- whose ownership is ambiguous is NOT in the rollout — the safe direction, because an
-- unresolvable owner is exactly when we least want to change behaviour.
create or replace function public.karaoke_room_in_premium_rollout(p_room_id uuid)
returns boolean language plpgsql stable set search_path = public, pg_temp as $$
declare v_account uuid;
begin
  if p_room_id is null then return false; end if;
  v_account := public.karaoke_room_owner_account(p_room_id);
  if v_account is null then return false; end if;   -- ambiguous ownership -> not in the rollout
  return exists (
    select 1 from public.karaoke_premium_room_rollout
     where account_id = v_account and room_id = p_room_id);
end; $$;
revoke all on function public.karaoke_room_in_premium_rollout(uuid) from public, anon, authenticated;
grant execute on function public.karaoke_room_in_premium_rollout(uuid) to service_role;

-- ── C. THE ACCOUNT-SCOPED READ — catalog VISIBILITY only ──
--
-- Deliberately a DIFFERENT scope from §B, and the difference is the product's, not a shortcut:
-- BTY Room time is bought FOR AN ACCOUNT, so an account taking part in the controlled rollout
-- may be shown the store. WHERE that time may then be spent stays exact-pair scoped by §B.
--
-- This function therefore governs a READ SURFACE and nothing else. It can never authorize a
-- hosted session; `karaoke_start_premium_room_session` does not call it.
create or replace function public.karaoke_account_in_premium_rollout(p_account_id uuid)
returns boolean language sql stable set search_path = public, pg_temp as $$
  select p_account_id is not null and exists (
    select 1 from public.karaoke_premium_room_rollout where account_id = p_account_id);
$$;
revoke all on function public.karaoke_account_in_premium_rollout(uuid) from public, anon, authenticated;
grant execute on function public.karaoke_account_in_premium_rollout(uuid) to service_role;

-- ── D. THE MODE GAINS ONE ARM ──
--
-- 'dual_allowlist' sits BETWEEN legacy_free and dual: premium applies only inside allowlisted
-- pairs, and never to a client that is not premium-capable. The CHECK is dropped and re-added
-- under the same name because a CHECK cannot be altered in place; the previous three values all
-- remain valid, so no existing row changes status.
alter table public.karaoke_usage_policy
  drop constraint if exists karaoke_usage_policy_premium_room_mode_chk;
alter table public.karaoke_usage_policy
  add constraint karaoke_usage_policy_premium_room_mode_chk
  check (premium_room_mode in ('legacy_free', 'dual_allowlist', 'dual', 'premium_all'));

-- The mode read gains the new value. It still falls back to 'legacy_free' for anything
-- unrecognised or missing — never to a gated state.
create or replace function public.karaoke_premium_room_mode()
returns text language sql stable set search_path = public, pg_temp as $$
  select coalesce(
    (select case when premium_room_mode in ('legacy_free','dual_allowlist','dual','premium_all')
                 then premium_room_mode else 'legacy_free' end
       from public.karaoke_usage_policy where policy_key = 'default'),
    'legacy_free');
$$;
revoke all on function public.karaoke_premium_room_mode() from public, anon, authenticated;
grant execute on function public.karaoke_premium_room_mode() to service_role;

-- ── E. WHAT IS DELIBERATELY NOT HERE ──
--
-- 1. NO allowlist row is inserted. Participation arrives as its own reviewed migration so the
--    blast radius can be re-measured between adding the mechanism and using it.
--
-- 2. NO mode change. `premium_room_mode` stays whatever it already is (production: legacy_free),
--    under which this entire file is inert — every client resolves `legacy` regardless of any
--    row in the new table. That inertness is asserted by ALLOW-16.
--
-- 3. NO change to karaoke_start_premium_room_session, karaoke_begin_song_v2, the catalog
--    contract, the purchase ledger, fulfil_apple_purchase, or any grant. This migration cannot
--    move money or entitlement; it can only widen or narrow who is ASKED for entitlement.
