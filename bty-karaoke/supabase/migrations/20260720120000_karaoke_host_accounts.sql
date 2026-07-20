-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- btyNorebang — HOST ACCOUNT + WORKSPACE FOUNDATION V1. Gives the product its
-- first real PRINCIPAL: a durable personal Host identity that owns a workspace,
-- which in turn owns a Room. Isolated bty-karaoke Supabase project (ref
-- zycwaqignioawtqynopj). No BTY core tables — bty-app lives in a DIFFERENT
-- Supabase project (mveycersmqfiuddslnrj), so its accounts/orgs are physically
-- unreachable and are deliberately NOT referenced here. Same access model as
-- everything else: the browser NEVER talks to Postgres; only the server's
-- service_role does. Additive + idempotent; never regresses prior migrations.
--
-- Why this exists: until now every credential (manager passcode, room dj_secret,
-- admin PIN, device token, guest capability) was a SHARED SECRET bound to a room
-- or to the whole deployment — never to a person. Two people holding the manager
-- passcode were indistinguishable by construction. This migration adds the
-- minimum durable ownership model that can later carry multiple Hosts, multiple
-- Rooms, invitations, history and plans, WITHOUT implementing any of those now.
--
-- Adds:
--   1. karaoke_accounts          — one row per verified external identity
--   2. karaoke_workspaces        — the ownership container
--   3. karaoke_workspace_members — account x workspace, with revocation
--   4. karaoke_room_ownership    — workspace owns Room (room_id is the PK, so a
--                                  Room can never belong to two workspaces)
--   5. karaoke_host_sessions     — opaque, hashed, revocable Host session tokens
--   6. karaoke_dj_devices.account_id — binds a device credential to a person
--   7. claim_karaoke_room()      — ATOMIC first-claim / idempotent re-claim
--
-- Deliberately NOT added: passwords (never), any auto-created workspace or Room,
-- any FK from Events/requests to accounts. Signing out or losing membership must
-- never delete an Event or queue history, so nothing here cascades into them.
--
-- Rollback:
--   drop function if exists public.claim_karaoke_room(uuid, uuid, text);
--   alter table public.karaoke_dj_devices drop column if exists account_id;
--   drop table if exists public.karaoke_host_sessions;
--   drop table if exists public.karaoke_room_ownership;
--   drop table if exists public.karaoke_workspace_members;
--   drop table if exists public.karaoke_workspaces;
--   drop table if exists public.karaoke_accounts;

-- 1. ACCOUNTS -----------------------------------------------------------------
-- One canonical row per verified external identity. `provider_subject` is the
-- provider's stable subject (for Apple, the `sub` claim) — NEVER an email, which
-- Apple may relay/hide and which users can change. Email/display name are
-- optional convenience only and are never used for authorization.
create table if not exists public.karaoke_accounts (
  id                uuid primary key default gen_random_uuid(),
  provider          text not null check (provider in ('apple')),
  provider_subject  text not null,
  email             text,
  display_name      text check (display_name is null or char_length(display_name) <= 80),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  last_login_at     timestamptz
);

-- THE identity invariant: one account per (provider, subject). Repeated logins
-- with the same Apple identity resolve to this single row, never a duplicate.
create unique index if not exists karaoke_accounts_provider_subject_idx
  on public.karaoke_accounts (provider, provider_subject);

-- 2. WORKSPACES ---------------------------------------------------------------
-- The ownership container a Room belongs to. Created ONLY by an explicit
-- authenticated claim — never implicitly on login or on opening My Norebang.
create table if not exists public.karaoke_workspaces (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 80),
  -- Who created it. SET NULL (not CASCADE): deleting an account must never
  -- delete a workspace, its Room, or any Event history.
  created_by  uuid references public.karaoke_accounts(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- 3. WORKSPACE MEMBERSHIP -----------------------------------------------------
-- account x workspace, with an explicit revocable status. Authorization is
-- ALWAYS resolved from an `active` row here — never from token possession.
create table if not exists public.karaoke_workspace_members (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.karaoke_workspaces(id) on delete cascade,
  account_id    uuid not null references public.karaoke_accounts(id) on delete cascade,
  role          text not null default 'owner' check (role in ('owner', 'member')),
  status        text not null default 'active' check (status in ('active', 'revoked')),
  created_at    timestamptz not null default now(),
  revoked_at    timestamptz
);

-- One membership row per (workspace, account) — re-claiming is idempotent.
create unique index if not exists karaoke_workspace_members_unique_idx
  on public.karaoke_workspace_members (workspace_id, account_id);
-- THE hot authorization lookup: "which live workspaces does this account belong to".
create index if not exists karaoke_workspace_members_account_idx
  on public.karaoke_workspace_members (account_id, status);

-- 4. ROOM OWNERSHIP -----------------------------------------------------------
-- A workspace owns a Room. `room_id` is the PRIMARY KEY, which is what makes
-- "one Room can never belong to two workspaces" a declarative DB invariant
-- rather than an application check.
create table if not exists public.karaoke_room_ownership (
  room_id             uuid primary key references public.karaoke_rooms(id) on delete cascade,
  workspace_id        uuid not null references public.karaoke_workspaces(id) on delete cascade,
  -- Audit: which Host performed the claim. SET NULL so removing an account never
  -- removes the Room's ownership (and therefore never orphans its Events).
  claimed_by_account  uuid references public.karaoke_accounts(id) on delete set null,
  claimed_at          timestamptz not null default now()
);

-- "Which Rooms does this workspace own" — the My Norebang listing.
create index if not exists karaoke_room_ownership_workspace_idx
  on public.karaoke_room_ownership (workspace_id);

-- 5. HOST SESSIONS ------------------------------------------------------------
-- Opaque bearer sessions for the personal Host identity. Only the SHA-256 hash is
-- stored (identical posture to karaoke_dj_devices.token_hash), so a database read
-- never yields a usable credential. Revocable and expiring — this is what makes
-- Sign Out real rather than a client-side illusion. No JWT signing secret is
-- introduced; the token carries no claims, all truth is resolved server-side.
create table if not exists public.karaoke_host_sessions (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references public.karaoke_accounts(id) on delete cascade,
  token_hash    text not null unique,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz,
  expires_at    timestamptz not null,
  revoked_at    timestamptz,
  status        text not null default 'active' check (status in ('active', 'revoked'))
);

create index if not exists karaoke_host_sessions_account_idx
  on public.karaoke_host_sessions (account_id, status);

-- 6. BIND DEVICE CREDENTIALS TO A PERSON --------------------------------------
-- A durable Room device token becomes SUBORDINATE to an account: once a device is
-- account-bound, revoking that account's workspace membership must revoke the
-- device's practical access too (enforced in the app's authorizeDj/authorizeAdmin,
-- which re-resolve membership on EVERY protected call). Nullable because devices
-- enrolled before this slice have no account; those legacy devices remain valid
-- only on Rooms that have not yet been claimed.
-- Rollback: alter table public.karaoke_dj_devices drop column if exists account_id;
alter table public.karaoke_dj_devices
  add column if not exists account_id uuid references public.karaoke_accounts(id) on delete set null;

create index if not exists karaoke_dj_devices_account_idx
  on public.karaoke_dj_devices (account_id);

-- RLS: default-deny, same as every other table. service_role bypasses; the
-- browser and anon/authenticated roles get nothing.
alter table public.karaoke_accounts          enable row level security;
alter table public.karaoke_workspaces        enable row level security;
alter table public.karaoke_workspace_members enable row level security;
alter table public.karaoke_room_ownership    enable row level security;
alter table public.karaoke_host_sessions     enable row level security;

revoke all on public.karaoke_accounts          from anon, authenticated;
revoke all on public.karaoke_workspaces        from anon, authenticated;
revoke all on public.karaoke_workspace_members from anon, authenticated;
revoke all on public.karaoke_room_ownership    from anon, authenticated;
revoke all on public.karaoke_host_sessions     from anon, authenticated;

-- 7. ATOMIC ROOM CLAIM --------------------------------------------------------
-- claim_karaoke_room(account, room, workspace_name) -> jsonb
--
-- The whole first-claim is ONE transaction so a failure can never leave a partial
-- account/workspace/membership/ownership graph behind (a half-claimed Room would
-- be unrecoverable without manual surgery). Outcomes:
--
--   'claimed'    — the Room was unowned; workspace + membership + ownership created
--   'idempotent' — this account already has active membership in the owning
--                  workspace; nothing changes, the same ownership is returned
--   'conflict'   — the Room is owned by a workspace this account is NOT an active
--                  member of. Never re-assigns a Room between workspaces.
--   'no_room'    — no such Room
--
-- Deliberately does NOT create an Event. Claiming a Room must never start karaoke.
-- The caller is responsible for verifying the Manager passcode BEFORE calling this;
-- this function is the atomicity boundary, not the authentication boundary.
create or replace function public.claim_karaoke_room(
  p_account_id     uuid,
  p_room_id        uuid,
  p_workspace_name text
) returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_existing_ws  uuid;
  v_is_member    boolean;
  v_workspace_id uuid;
begin
  -- Serialize concurrent claims for THIS room; released at txn end. Two devices
  -- claiming simultaneously therefore yield exactly one 'claimed' and one
  -- 'idempotent'/'conflict', never two workspaces.
  perform pg_advisory_xact_lock(hashtext(p_room_id::text));

  if not exists (select 1 from public.karaoke_rooms r where r.id = p_room_id) then
    return jsonb_build_object('outcome', 'no_room');
  end if;

  select o.workspace_id into v_existing_ws
    from public.karaoke_room_ownership o
   where o.room_id = p_room_id;

  if v_existing_ws is not null then
    select exists (
      select 1 from public.karaoke_workspace_members m
       where m.workspace_id = v_existing_ws
         and m.account_id = p_account_id
         and m.status = 'active'
    ) into v_is_member;

    if v_is_member then
      return jsonb_build_object(
        'outcome', 'idempotent',
        'workspaceId', v_existing_ws,
        'roomId', p_room_id
      );
    end if;

    -- Owned by someone else's workspace — never steal, never re-assign.
    return jsonb_build_object('outcome', 'conflict');
  end if;

  -- Unowned Room. Reuse an existing workspace this account already owns so a
  -- second Room claim does not mint a redundant workspace; otherwise create one.
  select m.workspace_id into v_workspace_id
    from public.karaoke_workspace_members m
   where m.account_id = p_account_id and m.status = 'active'
   order by m.created_at asc
   limit 1;

  if v_workspace_id is null then
    insert into public.karaoke_workspaces (name, created_by)
    values (coalesce(nullif(btrim(p_workspace_name), ''), 'My Norebang'), p_account_id)
    returning id into v_workspace_id;

    insert into public.karaoke_workspace_members (workspace_id, account_id, role, status)
    values (v_workspace_id, p_account_id, 'owner', 'active');
  end if;

  insert into public.karaoke_room_ownership (room_id, workspace_id, claimed_by_account)
  values (p_room_id, v_workspace_id, p_account_id);

  return jsonb_build_object(
    'outcome', 'claimed',
    'workspaceId', v_workspace_id,
    'roomId', p_room_id
  );
end;
$$;

-- Lock the RPC to the server's service_role only; the browser must never call it.
revoke all on function public.claim_karaoke_room(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.claim_karaoke_room(uuid, uuid, text)
  to service_role;
