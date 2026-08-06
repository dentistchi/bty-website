-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- btyNorebang — BUILD 26E: CANONICAL ACCOUNT OWNERSHIP & ACCOUNT DELETION AUTHORITY V1.
--
-- Establishes in-app account deletion that removes access and personal data WITHOUT
-- destroying the pass, audit, metering, and (future) financial authority that must
-- survive it. Isolated bty-karaoke Supabase project (ref zycwaqignioawtqynopj).
-- Additive + idempotent + forward-only; no prior migration is rewritten.
--
-- WHY THIS EXISTS (catalog-proven, BUILD 26E Part 1):
--   * 19 foreign keys reference karaoke_accounts. A hard DELETE behaves INCONSISTENTLY:
--     it ABORTS for an account with playback history (karaoke_event_usage_segments
--     .account_id is ON DELETE NO ACTION) or with any append-only audit row (those
--     tables carry BEFORE DELETE OR UPDATE triggers that raise restrict_violation) —
--     but SUCCEEDS for an account without them, cascading away identities, sessions,
--     memberships, plans, saved songs AND timed_access_pass_grants. That protection is
--     incidental, not a retention rule.
--   * Cascading karaoke_workspace_members leaves the workspace, room_ownership and room
--     rows behind with ZERO active owners. karaoke_room_owner_account() then returns
--     null and every start fails 'ownership_state_invalid' — the room is BRICKED, not
--     deleted: unreachable, unplayable, and indistinguishable from a broken graph.
--   * karaoke_dj_devices.account_id is ON DELETE SET NULL while status stays 'active'
--     and token_hash is untouched. Device auth is ROOM-scoped, so a deleted Host's
--     enrolled devices keep working against an ownerless room.
--   * Nothing reaches Supabase Storage: room logos live in the private `room-logos`
--     bucket addressed by object key, with no FK, cascade or trigger.
--
-- FOUNDER DECISIONS IMPLEMENTED (BUILD 26E authorization):
--   F-1 rooms  → FREEZE, RETIRE, ANONYMIZE (never cascade-delete, never transfer,
--                never leave operational). Slug retained and never reusable.
--   F-2 logos  → DELETE, via a durable retryable outbox (DB and Storage are not one
--                transaction, so best-effort with no retry state is not acceptable).
--   F-3 creds  → REVOKE ALL, with an explicit terminal state on every credential.
--                Setting account_id to null is NOT revocation.
--   F-4 history→ RETAIN ROWS, ANONYMIZE personal display data. Resolution codes,
--                ordering, lease seconds and timestamps are NEVER rewritten.
--   F-5 FREE   → RETAIN usage + grace against the tombstone; a same-provider recreate
--                inside the SAME window does not reset it (one-way fingerprint).
--   F-6 sessions→ revoke now, retain minimal evidence 90 days, purge; the deletion
--                audit itself is permanent and non-personal.
--
-- APPLE REVOCATION AUTHORITY (BUILD 26E revision): programmatic Sign in with Apple
-- revocation is the REQUIRED NORMAL PATH. Missing Worker secrets are a DEPLOYMENT
-- BLOCKER, never a per-user audit outcome -- an Apple-linked deletion refuses to start
-- (503) rather than completing while recording that revocation was unavailable. Because
-- Apple's token/revoke endpoints cannot join this transaction, the outcome lives in a
-- DURABLE JOB (section 15) and later transitions are recorded as APPEND-ONLY EVENTS
-- (section 16). The immutable deletion audit therefore snapshots the status AT DELETION
-- TIME without ever becoming a row whose 'pending' can never be reconciled.
--   F-7 attrib → retain a pseudonymous actor snapshot before any FK can become null.
--
-- THE CENTRAL INVARIANT: karaoke_accounts rows are NEVER hard-deleted. The row becomes
-- an anonymized tombstone, so all 19 foreign keys keep a valid target and no cascade or
-- SET NULL ever fires. Attribution, audit and metering therefore survive by construction
-- rather than by remembering to protect each table individually.
--
-- ROLLBACK: this migration is additive. To revert behaviour without dropping data,
-- re-run the karaoke_free_minutes_entitlement_at_v2 and karaoke_begin_song_v2 bodies
-- from 20260807120000; the new tables/columns are inert when unused.

-- ── 1. ACCOUNT TOMBSTONE ─────────────────────────────────────────────────────
--
-- purchase_owner_ref and authority_ref are INDEPENDENT random UUIDs, deliberately not
-- derived from account_id and deliberately not the same value as each other: one is the
-- commerce owner handle, the other the audit-attribution handle, and a leak of either
-- must not correlate to the other or back to the account UUID.
alter table public.karaoke_accounts
  add column if not exists deleted_at         timestamptz,
  add column if not exists anonymized_at      timestamptz,
  add column if not exists deletion_version   text,
  add column if not exists account_status     text not null default 'active',
  add column if not exists purchase_owner_ref uuid not null default gen_random_uuid(),
  add column if not exists authority_ref      uuid not null default gen_random_uuid();

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'karaoke_accounts_status_chk') then
    alter table public.karaoke_accounts
      add constraint karaoke_accounts_status_chk
      check (account_status in ('active', 'deleted'));
  end if;
  -- deleted_at and account_status are one fact expressed twice; keep them consistent.
  if not exists (select 1 from pg_constraint where conname = 'karaoke_accounts_deleted_coherent_chk') then
    alter table public.karaoke_accounts
      add constraint karaoke_accounts_deleted_coherent_chk
      check ((account_status = 'deleted') = (deleted_at is not null));
  end if;
end $$;

create unique index if not exists karaoke_accounts_purchase_owner_ref_idx
  on public.karaoke_accounts (purchase_owner_ref);
create unique index if not exists karaoke_accounts_authority_ref_idx
  on public.karaoke_accounts (authority_ref);
create index if not exists karaoke_accounts_deleted_idx
  on public.karaoke_accounts (deleted_at) where deleted_at is not null;

-- ── 2. PROVIDER FINGERPRINT TOMBSTONE (F-5) ──────────────────────────────────
--
-- The raw provider subject is DELETED on account deletion. To keep the current FREE
-- window from resetting through delete-and-recreate — and, later, to refuse transaction
-- replay onto a fresh account — we retain only a ONE-WAY fingerprint:
--     HMAC-SHA256(KARAOKE_IDENTITY_FINGERPRINT_SECRET, provider || '\0' || subject)
-- computed in the SERVICE LAYER and passed in as hex. The secret never enters the
-- database, so a database compromise alone cannot reverse or re-derive a subject.
-- This table is never returned to a client.
create table if not exists public.karaoke_identity_fingerprints (
  fingerprint          text primary key,
  provider             text not null check (provider in ('apple', 'google')),
  -- RESTRICT, not CASCADE: the tombstone must outlive any attempt to remove it.
  account_tombstone_id uuid not null references public.karaoke_accounts(id) on delete restrict,
  first_deleted_at     timestamptz not null default now(),
  last_deleted_at      timestamptz not null default now()
);
create index if not exists karaoke_identity_fingerprints_tombstone_idx
  on public.karaoke_identity_fingerprints (account_tombstone_id);
alter table public.karaoke_identity_fingerprints enable row level security;
revoke all on public.karaoke_identity_fingerprints from anon, authenticated;

-- ── 3. FREE WINDOW CARRYOVER (F-5) ───────────────────────────────────────────
--
-- Written when a NEW account is created from a fingerprint whose tombstone still has
-- consumed seconds (or a burnt grace) inside the CURRENT window. It carries forward
-- ONLY the applicable current-window state — never rooms, branding, saved songs or
-- entitlements. Empty for every existing account, so both function changes below are
-- provably zero-effect until a deletion+recreate actually happens.
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
alter table public.karaoke_free_window_carryover enable row level security;
revoke all on public.karaoke_free_window_carryover from anon, authenticated;

-- ── 4. STORAGE CLEANUP OUTBOX (F-2) ──────────────────────────────────────────
--
-- A database transaction cannot delete a Storage object. The deletion transaction
-- therefore clears the DB pointer (making the logo immediately unreachable) and ENQUEUES
-- the object here; the service layer drains it, retries transient failures, and records
-- status. deadline_at carries the Founder's hard maximum so an overdue object is
-- detectable rather than silently abandoned.
create table if not exists public.karaoke_storage_cleanup_outbox (
  id                   uuid primary key default gen_random_uuid(),
  bucket               text not null,
  object_key           text not null,
  reason               text not null check (reason in ('account_deletion')),
  account_tombstone_id uuid references public.karaoke_accounts(id) on delete restrict,
  status               text not null default 'PENDING' check (status in ('PENDING', 'DONE', 'FAILED')),
  attempts             int not null default 0 check (attempts >= 0),
  enqueued_at          timestamptz not null default now(),
  deadline_at          timestamptz not null,
  last_attempt_at      timestamptz,
  last_error           text,
  completed_at         timestamptz
);
-- One row per object: a re-enqueue of the same key is idempotent, never a duplicate job.
create unique index if not exists karaoke_storage_cleanup_outbox_object_idx
  on public.karaoke_storage_cleanup_outbox (bucket, object_key);
create index if not exists karaoke_storage_cleanup_outbox_pending_idx
  on public.karaoke_storage_cleanup_outbox (status, enqueued_at) where status = 'PENDING';
alter table public.karaoke_storage_cleanup_outbox enable row level security;
revoke all on public.karaoke_storage_cleanup_outbox from anon, authenticated;

-- ── 5. PERMANENT DELETION AUDIT (F-6) ────────────────────────────────────────
--
-- NOT subject to the 90-day session purge. Carries no email, display name, provider
-- subject or token material — only the pseudonymous authority reference and outcome
-- status, including a TRUTHFUL per-provider revocation result (see §9).
create table if not exists public.karaoke_account_deletion_audit (
  id                          uuid primary key default gen_random_uuid(),
  account_id                  uuid not null references public.karaoke_accounts(id) on delete restrict,
  authority_ref               uuid not null,
  deleted_at                  timestamptz not null,
  deletion_version            text not null,
  deletion_source             text not null check (deletion_source in ('host_native', 'host_web')),
  completion_status           text not null check (completion_status in ('COMPLETED', 'COMPLETED_WITH_PENDING_CLEANUP')),
  credential_revocation_status jsonb not null,
  storage_cleanup_status      text not null check (storage_cleanup_status in ('NONE_REQUIRED', 'ENQUEUED')),
  provider_revocation         jsonb not null,
  actor_ref                   uuid,
  created_at                  timestamptz not null default now()
);
create index if not exists karaoke_account_deletion_audit_account_idx
  on public.karaoke_account_deletion_audit (account_id, created_at desc);
alter table public.karaoke_account_deletion_audit enable row level security;
revoke all on public.karaoke_account_deletion_audit from anon, authenticated;

create or replace function public.karaoke_account_deletion_audit_immutable()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  raise exception 'karaoke_account_deletion_audit is append-only; % is not permitted', tg_op
    using errcode = 'restrict_violation';
end;
$$;
drop trigger if exists karaoke_account_deletion_audit_no_mutate on public.karaoke_account_deletion_audit;
create trigger karaoke_account_deletion_audit_no_mutate
  before update or delete on public.karaoke_account_deletion_audit
  for each row execute function public.karaoke_account_deletion_audit_immutable();

-- ── 6. ROOM / WORKSPACE RETIREMENT (F-1) ─────────────────────────────────────
--
-- 'retired' is a THIRD room status, additive to ('open','closed'): every existing row
-- stays valid. It is terminal — a retired room is never reopened, because the account
-- that owned it can never be reactivated.
do $$ begin
  if exists (select 1 from pg_constraint where conname = 'karaoke_rooms_status_check') then
    alter table public.karaoke_rooms drop constraint karaoke_rooms_status_check;
  end if;
  alter table public.karaoke_rooms
    add constraint karaoke_rooms_status_check
    check (status in ('open', 'closed', 'retired'));
end $$;

alter table public.karaoke_rooms
  add column if not exists retired_at timestamptz;

alter table public.karaoke_workspaces
  add column if not exists status     text not null default 'active',
  add column if not exists retired_at timestamptz;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'karaoke_workspaces_status_chk') then
    alter table public.karaoke_workspaces
      add constraint karaoke_workspaces_status_chk
      check (status in ('active', 'retired'));
  end if;
end $$;

-- ── 7. ATTRIBUTION SNAPSHOTS (F-7) ───────────────────────────────────────────
--
-- Four relationships are ON DELETE SET NULL and would erase WHO acted. Because §1 makes
-- hard deletion impossible, none of them can now fire — but F-7 requires the snapshot to
-- exist BEFORE an FK could ever become null, so the columns are added and backfilled now
-- rather than relied upon never to be needed.
--
-- karaoke_host_plan_assignment_audit.changed_by is deliberately NOT given a snapshot
-- column: that table carries a BEFORE UPDATE trigger, so it can neither be backfilled nor
-- SET NULL — its attribution is already immutable, and adding a column we could never
-- populate would be a false guarantee.
alter table public.karaoke_workspaces
  add column if not exists created_by_ref uuid;
alter table public.karaoke_room_ownership
  add column if not exists claimed_by_ref uuid;
alter table public.karaoke_host_plan_assignments
  add column if not exists assigned_by_ref uuid;

update public.karaoke_workspaces w set created_by_ref = a.authority_ref
  from public.karaoke_accounts a
 where a.id = w.created_by and w.created_by is not null and w.created_by_ref is null;
update public.karaoke_room_ownership o set claimed_by_ref = a.authority_ref
  from public.karaoke_accounts a
 where a.id = o.claimed_by_account and o.claimed_by_account is not null and o.claimed_by_ref is null;
update public.karaoke_host_plan_assignments p set assigned_by_ref = a.authority_ref
  from public.karaoke_accounts a
 where a.id = p.assigned_by_account and p.assigned_by_account is not null and p.assigned_by_ref is null;

-- ── 8. REFUND-AFTER-USE REPRESENTABILITY (BUILD 18C G5) ──────────────────────
--
-- The deployed timed_pass_status_time_chk permits REVOKED ONLY from a never-activated
-- state, so "revoke every active timed pass" is currently UNREPRESENTABLE. Relaxed
-- non-destructively: the original never-activated shape is preserved as the first
-- branch (every existing REVOKED row satisfies it), and a revoked-after-use shape is
-- added. This is also the constraint Apple refund-after-use will require.
do $$ begin
  if exists (select 1 from pg_constraint where conname = 'timed_pass_status_time_chk') then
    alter table public.timed_access_pass_grants drop constraint timed_pass_status_time_chk;
  end if;
  alter table public.timed_access_pass_grants
    add constraint timed_pass_status_time_chk check (
      case status
        when 'AVAILABLE' then activated_at is null and expires_at is null and expired_at is null
                          and revoked_at is null and selected_at is null
        when 'SELECTED'  then selected_at is not null and activated_at is null and expires_at is null
                          and expired_at is null and revoked_at is null
        when 'ACTIVE'    then activated_at is not null and expires_at is not null
                          and expired_at is null and revoked_at is null
        when 'EXPIRED'   then activated_at is not null and expires_at is not null
                          and expired_at is not null and revoked_at is null
        when 'REVOKED'   then revoked_at is not null and (
                               -- revoked before activation (the original, unchanged rule)
                               (activated_at is null and expires_at is null and expired_at is null)
                               -- revoked after use: activation facts are RETAINED, never rewritten
                               or (activated_at is not null and expires_at is not null))
        else false
      end);
end $$;

-- ── 9. INDEX CORRECTIONS ─────────────────────────────────────────────────────
-- Referencing columns with no supporting index (BUILD 26E Part 1, risk R6).
create index if not exists karaoke_workspaces_created_by_idx
  on public.karaoke_workspaces (created_by) where created_by is not null;
create index if not exists karaoke_room_ownership_claimed_by_idx
  on public.karaoke_room_ownership (claimed_by_account) where claimed_by_account is not null;
create index if not exists karaoke_host_plan_assigned_by_idx
  on public.karaoke_host_plan_assignments (assigned_by_account) where assigned_by_account is not null;
create index if not exists karaoke_pro_pilot_audit_account_idx
  on public.karaoke_pro_pilot_request_audit (account_id);
create index if not exists karaoke_lease_rollout_account_idx
  on public.karaoke_lease_rollout (account_id);

-- ── 10. THE DELETION RPC ─────────────────────────────────────────────────────
--
-- ONE transaction. The account is supplied by the service layer AFTER it derived it from
-- the authenticated session — this function is the atomicity boundary, not the
-- authentication boundary (the same division as claim_karaoke_room and the pass RPCs).
--
-- p_fingerprints is [{"provider":"apple","fingerprint":"<hex>"}, ...] computed in the
-- service layer. The function REFUSES to proceed unless every identity it is about to
-- delete has a supplied fingerprint: deleting a provider subject without retaining its
-- one-way fingerprint would silently reopen the FREE-window reset hole, so a partial
-- input fails closed rather than deleting more than it can account for.
--
-- p_provider_revocation is the TRUTHFUL, already-attempted per-provider outcome, passed in
-- rather than written later: the audit table is append-only, so a row that said 'pending'
-- could never be corrected. See §9 of the BUILD 26E report for the Apple gap this records.
create or replace function public.karaoke_delete_account_v1(
  p_account_id          uuid,
  p_deletion_source     text,
  p_fingerprints        jsonb,
  p_provider_revocation jsonb
) returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare
  v_now         timestamptz;
  v_acct        record;
  v_room_ids    uuid[];
  v_ws_ids      uuid[];
  v_logo_keys   text[];
  v_missing     int;
  v_sessions    int := 0;
  v_devices     int := 0;
  v_pairing     int := 0;
  v_setup       int := 0;
  v_handoffs    int := 0;
  v_passes      int := 0;
  v_plans       int := 0;
  v_requests    int := 0;
  v_events      int := 0;
  v_storage     text := 'NONE_REQUIRED';
  v_version     constant text := 'BUILD26E_V1';
  v_deleted_lbl constant text := '(삭제된 방)';
  v_guest_lbl   constant text := '(삭제됨)';
  v_event_lbl   constant text := '(삭제된 이벤트)';
begin
  if p_deletion_source not in ('host_native', 'host_web') then
    return jsonb_build_object('outcome', 'invalid_source');
  end if;

  -- Same canonical account lock every other account-scoped mutation takes, so a
  -- deletion cannot interleave with a song start, a pass selection, or a room create.
  perform pg_advisory_xact_lock(public.karaoke_account_lock_key(p_account_id));
  v_now := clock_timestamp();

  select * into v_acct from public.karaoke_accounts where id = p_account_id for update;
  if not found then
    return jsonb_build_object('outcome', 'account_not_found');
  end if;

  -- IDEMPOTENT REPLAY: a second delete of the same account is a success, not an error,
  -- and performs no further mutation.
  if v_acct.deleted_at is not null then
    return jsonb_build_object('outcome', 'already_deleted',
      'deletedAt', v_acct.deleted_at, 'purchaseOwnerRef', v_acct.purchase_owner_ref,
      'authorityRef', v_acct.authority_ref, 'storageKeys', '[]'::jsonb);
  end if;

  -- FAIL CLOSED on incomplete fingerprint input (see header). UNIQUE(account_id, provider)
  -- makes provider a complete key for this account's identities.
  select count(*) into v_missing
    from public.karaoke_account_identities i
   where i.account_id = p_account_id
     and not exists (
       select 1 from jsonb_array_elements(coalesce(p_fingerprints, '[]'::jsonb)) f
        where f->>'provider' = i.provider
          and coalesce(length(f->>'fingerprint'), 0) >= 32);
  if v_missing > 0 then
    return jsonb_build_object('outcome', 'fingerprint_incomplete');
  end if;

  -- ── Resolve the owned estate BEFORE mutating anything ──
  select coalesce(array_agg(distinct m.workspace_id), '{}') into v_ws_ids
    from public.karaoke_workspace_members m
   where m.account_id = p_account_id and m.status = 'active' and m.role = 'owner';

  select coalesce(array_agg(distinct o.room_id), '{}') into v_room_ids
    from public.karaoke_room_ownership o
   where o.workspace_id = any(v_ws_ids);

  -- ── F-3 REVOKE ALL CREDENTIALS (explicit terminal state, never a null account_id) ──
  with s as (
    update public.karaoke_host_sessions
       set status = 'revoked', revoked_at = v_now
     where account_id = p_account_id and status = 'active' returning 1)
  select count(*) into v_sessions from s;

  with d as (
    update public.karaoke_dj_devices
       set status = 'revoked', revoked_at = v_now
     where status = 'active'
       and (account_id = p_account_id or room_id = any(v_room_ids)) returning 1)
  select count(*) into v_devices from d;

  with p as (
    update public.karaoke_pairing_tokens
       set expires_at = v_now
     where room_id = any(v_room_ids) and redeemed_at is null and expires_at > v_now returning 1)
  select count(*) into v_pairing from p;

  with t as (
    update public.karaoke_admin_setup_tokens
       set expires_at = v_now
     where room_id = any(v_room_ids) and redeemed_at is null and expires_at > v_now returning 1)
  select count(*) into v_setup from t;

  -- handoff_revoked_time CHECK: status='REVOKED' iff revoked_at is not null.
  with h as (
    update public.karaoke_guest_app_handoffs
       set status = 'REVOKED', revoked_at = v_now
     where room_id = any(v_room_ids) and status = 'ACTIVE' returning 1)
  select count(*) into v_handoffs from h;

  update public.karaoke_sessions
     set status = 'ended', ended_at = coalesce(ended_at, v_now)
   where room_id = any(v_room_ids) and status = 'active';

  -- ── F-1 FREEZE + RETIRE + ANONYMIZE ROOMS ──
  -- The slug is deliberately RETAINED: karaoke_rooms_slug_key keeps it globally unique,
  -- so an old QR code or invitation can never resolve to some future room. Retired rooms
  -- answer ROOM_RETIRED (service layer), never ownership_state_invalid.
  select coalesce(array_agg(r.logo_object_key), '{}') into v_logo_keys
    from public.karaoke_rooms r
   where r.id = any(v_room_ids) and r.logo_object_key is not null;

  update public.karaoke_rooms
     set status = 'retired',
         retired_at = coalesce(retired_at, v_now),
         closed_at = coalesce(closed_at, v_now),
         display_name = v_deleted_lbl,
         guest_welcome_message = null,
         logo_object_key = null,        -- F-2: pointer cleared IN this transaction, so the
         logo_version = null,           --      image is unreachable the instant we commit
         admin_pin_hash = null
   where id = any(v_room_ids);

  update public.karaoke_workspaces
     set status = 'retired', retired_at = coalesce(retired_at, v_now)
   where id = any(v_ws_ids);

  -- End any live event so no lease, queue or stage stays open on a retired room.
  with e as (
    update public.karaoke_events
       set status = 'ended', ended_at = coalesce(ended_at, v_now), updated_at = v_now
     where room_id = any(v_room_ids) and status in ('draft', 'active') returning 1)
  select count(*) into v_events from e;

  -- ── F-4 RETAIN ROWS, ANONYMIZE PERSONAL DISPLAY DATA ──
  -- Deliberately NOT touched: status, resolution_code, resolved_at, position, started_at,
  -- completed_at, created_at, youtube_video_id. The BUILD 25 resolution contract must
  -- remain historically truthful, so completed never becomes skipped and ordering never
  -- shifts. guest_name is NOT NULL with a 1..40 CHECK, so it is replaced, not nulled.
  with rq as (
    update public.karaoke_requests
       set guest_name = v_guest_lbl,
           search_query = null
     where room_id = any(v_room_ids) and guest_name <> v_guest_lbl returning 1)
  select count(*) into v_requests from rq;

  update public.karaoke_events
     set name = v_event_lbl, host_name = null, created_by = null
   where room_id = any(v_room_ids);

  -- ── §10 REVOKE ACCESS, RETAIN AUTHORITY RECORDS ──
  -- Unused authority is forfeited on confirmed permanent deletion; grants and audit rows
  -- are retained against the tombstone. Requires the §8 CHECK relaxation for ACTIVE.
  with g as (
    update public.timed_access_pass_grants
       set status = 'REVOKED', revoked_at = v_now,
           revoke_reason = 'account_deleted', updated_at = now()
     where account_id = p_account_id
       and status in ('AVAILABLE', 'SELECTED', 'ACTIVE') returning id, status)
  , aud as (
    insert into public.timed_access_pass_audit
      (pass_grant_id, account_id, actor_type, actor_ref, action, from_status, to_status, reason)
    select g.id, p_account_id, 'SYSTEM', 'account_deletion', 'REVOKED', null, 'REVOKED', 'account_deleted'
      from g returning 1)
  select count(*) into v_passes from aud;

  with pl as (
    update public.karaoke_host_plan_assignments
       set status = 'ended', ended_at = coalesce(ended_at, v_now)
     where account_id = p_account_id and status = 'active' returning 1)
  select count(*) into v_plans from pl;

  -- ── F-5 ONE-WAY PROVIDER FINGERPRINTS, THEN DELETE THE IDENTITIES ──
  insert into public.karaoke_identity_fingerprints
    (fingerprint, provider, account_tombstone_id, first_deleted_at, last_deleted_at)
  select f->>'fingerprint', f->>'provider', p_account_id, v_now, v_now
    from jsonb_array_elements(coalesce(p_fingerprints, '[]'::jsonb)) f
   where exists (select 1 from public.karaoke_account_identities i
                  where i.account_id = p_account_id and i.provider = f->>'provider')
  on conflict (fingerprint) do update set last_deleted_at = excluded.last_deleted_at;

  delete from public.karaoke_account_identities where account_id = p_account_id;

  -- ── DELETE NON-RETAINED PERSONAL / USER CONTENT ──
  delete from public.karaoke_user_saved_songs where account_id = p_account_id;
  delete from public.karaoke_room_creation_idempotency where account_id = p_account_id;
  delete from public.karaoke_lease_rollout where account_id = p_account_id;

  -- ── ANONYMIZE THE ACCOUNT ROW INTO A TOMBSTONE ──
  -- The deprecated provider/provider_subject columns are nulled too: they are a SECOND
  -- copy of provider identity that a naive "delete the identity rows" would miss.
  update public.karaoke_accounts
     set email = null,
         display_name = null,
         provider = null,
         provider_subject = null,
         timezone = 'America/Los_Angeles',
         timezone_source = 'default',
         timezone_captured_at = null,
         last_login_at = null,
         deleted_at = v_now,
         anonymized_at = v_now,
         deletion_version = v_version,
         account_status = 'deleted',
         updated_at = now()
   where id = p_account_id;

  -- ── F-2 ENQUEUE STORAGE CLEANUP (durable, retryable) ──
  if array_length(v_logo_keys, 1) is not null then
    insert into public.karaoke_storage_cleanup_outbox
      (bucket, object_key, reason, account_tombstone_id, deadline_at)
    select 'room-logos', k, 'account_deletion', p_account_id, v_now + interval '30 days'
      from unnest(v_logo_keys) k
    on conflict (bucket, object_key) do nothing;
    v_storage := 'ENQUEUED';
  end if;

  -- ── F-6 PERMANENT, NON-PERSONAL DELETION AUDIT ──
  -- provider_revocation carries what the service layer ACTUALLY achieved per provider.
  -- It is never optimistic: an unavailable Apple revocation is recorded as unavailable.
  insert into public.karaoke_account_deletion_audit
    (account_id, authority_ref, deleted_at, deletion_version, deletion_source,
     completion_status, credential_revocation_status, storage_cleanup_status,
     provider_revocation, actor_ref)
  values (p_account_id, v_acct.authority_ref, v_now, v_version, p_deletion_source,
          case when v_storage = 'ENQUEUED' then 'COMPLETED_WITH_PENDING_CLEANUP' else 'COMPLETED' end,
          jsonb_build_object('hostSessions', v_sessions, 'djDevices', v_devices,
                             'pairingTokens', v_pairing, 'adminSetupTokens', v_setup,
                             'guestHandoffs', v_handoffs, 'roomsRetired', coalesce(array_length(v_room_ids, 1), 0),
                             'eventsEnded', v_events, 'passesRevoked', v_passes, 'plansEnded', v_plans,
                             'requestsAnonymized', v_requests),
          v_storage,
          coalesce(p_provider_revocation, jsonb_build_object('status', 'not_reported')),
          v_acct.authority_ref);

  return jsonb_build_object(
    'outcome', 'deleted',
    'deletedAt', v_now,
    'purchaseOwnerRef', v_acct.purchase_owner_ref,
    'authorityRef', v_acct.authority_ref,
    'roomsRetired', coalesce(array_length(v_room_ids, 1), 0),
    'storageCleanup', v_storage,
    'storageKeys', to_jsonb(v_logo_keys));
end; $$;
revoke all on function public.karaoke_delete_account_v1(uuid, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.karaoke_delete_account_v1(uuid, text, jsonb, jsonb) to service_role;

-- ── 11. FREE WINDOW CARRYOVER ON RECREATION (F-5) ────────────────────────────
--
-- Called at sign-in when a brand-new account is created for a provider identity whose
-- fingerprint matches a tombstone. Carries forward ONLY the current window's consumed
-- seconds and grace state. Restores NOTHING else — not rooms, branding, saved songs or
-- entitlements — and never relinks or reactivates the tombstone.
create or replace function public.karaoke_apply_free_window_carryover_v1(
  p_new_account_id uuid,
  p_fingerprint    text
) returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare
  v_now timestamptz; v_tomb uuid; p record; v_tz text;
  v_local timestamp; v_anchor date; v_ws timestamptz; v_we timestamptz;
  v_used numeric := 0; v_grace boolean := false;
begin
  if p_fingerprint is null or length(p_fingerprint) < 32 then
    return jsonb_build_object('outcome', 'no_fingerprint');
  end if;
  perform pg_advisory_xact_lock(public.karaoke_account_lock_key(p_new_account_id));
  v_now := clock_timestamp();

  select account_tombstone_id into v_tomb
    from public.karaoke_identity_fingerprints where fingerprint = p_fingerprint;
  if v_tomb is null then
    return jsonb_build_object('outcome', 'no_tombstone');
  end if;
  -- Never carry into the account it came from, and never resurrect a live account.
  if v_tomb = p_new_account_id then
    return jsonb_build_object('outcome', 'no_tombstone');
  end if;

  -- The window is computed on the NEW account's timezone using the same canonical
  -- [reset_hour_local, +1 day) anchor as karaoke_free_minutes_entitlement_at_v2.
  select * into p from public.karaoke_usage_policy where policy_key = 'default';
  select coalesce(nullif(btrim(timezone), ''), 'America/Los_Angeles') into v_tz
    from public.karaoke_accounts where id = p_new_account_id;
  v_local  := v_now at time zone v_tz;
  v_anchor := date(v_local - make_interval(hours => p.reset_hour_local));
  v_ws := ((v_anchor::timestamp     + make_interval(hours => p.reset_hour_local))) at time zone v_tz;
  v_we := (((v_anchor + 1)::timestamp + make_interval(hours => p.reset_hour_local))) at time zone v_tz;

  -- The tombstone's metered seconds inside the CURRENT window only. Historic windows are
  -- irrelevant: after this window expires the new account gets a normal fresh window.
  select coalesce(sum(lease_seconds), 0) into v_used
    from public.karaoke_event_usage_segments
   where account_id = v_tomb and metered and lease_seconds is not null
     and started_at >= v_ws and started_at < v_we;

  select exists (select 1 from public.karaoke_free_final_song_grace g
                  where g.account_id = v_tomb and g.charged_window_start = v_ws)
    into v_grace;
  -- Carryover chains: a second deletion inside one window must not drop the first's state.
  select v_grace or exists (select 1 from public.karaoke_free_window_carryover c
                             where c.account_id = v_tomb and c.charged_window_start = v_ws
                               and c.grace_consumed)
    into v_grace;
  select v_used + coalesce((select sum(c.carried_used_seconds) from public.karaoke_free_window_carryover c
                             where c.account_id = v_tomb and c.charged_window_start = v_ws), 0)
    into v_used;

  if v_used <= 0 and not v_grace then
    return jsonb_build_object('outcome', 'nothing_to_carry');
  end if;

  insert into public.karaoke_free_window_carryover
    (account_id, charged_window_start, charged_window_end, carried_used_seconds,
     grace_consumed, source_tombstone_id, fingerprint)
  values (p_new_account_id, v_ws, v_we, floor(v_used)::int, v_grace, v_tomb, p_fingerprint)
  on conflict (account_id, charged_window_start) do nothing;

  return jsonb_build_object('outcome', 'carried',
    'carriedUsedSeconds', floor(v_used)::int, 'graceConsumed', v_grace,
    'windowStart', v_ws, 'windowEnd', v_we);
end; $$;
revoke all on function public.karaoke_apply_free_window_carryover_v1(uuid, text) from public, anon, authenticated;
grant execute on function public.karaoke_apply_free_window_carryover_v1(uuid, text) to service_role;

-- ── 12. 90-DAY SESSION EVIDENCE PURGE (F-6) ──────────────────────────────────
--
-- Revoked-session evidence for a DELETED account is retained 90 days, then purged. The
-- deletion audit row is NOT touched — it is permanent. Idempotent; safe to run on any
-- schedule (or never: retaining longer is a policy failure, not a correctness one, so
-- this is deliberately a callable rather than a trigger).
create or replace function public.karaoke_purge_expired_deleted_sessions_v1()
returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare v_n int;
begin
  with p as (
    delete from public.karaoke_host_sessions s
     using public.karaoke_accounts a
     where a.id = s.account_id
       and a.deleted_at is not null
       and a.deleted_at < now() - interval '90 days' returning 1)
  select count(*) into v_n from p;
  return jsonb_build_object('purgedSessions', v_n);
end; $$;
revoke all on function public.karaoke_purge_expired_deleted_sessions_v1() from public, anon, authenticated;
grant execute on function public.karaoke_purge_expired_deleted_sessions_v1() to service_role;

-- ── 13. ENTITLEMENT v2 — CARRYOVER-AWARE (F-5) ───────────────────────────────
--
-- Byte-identical to 20260807120000 except for v_carry: the carryover table adds to the
-- window's used seconds so a delete-and-recreate inside one window cannot reset the
-- 900-second balance. karaoke_free_window_carryover is empty for every existing account,
-- so this is provably a no-op until a deletion+recreate occurs.
create or replace function public.karaoke_free_minutes_entitlement_at_v2(p_account_id uuid, p_as_of timestamptz)
returns jsonb language plpgsql stable set search_path = public, pg_temp as $$
declare
  p record; v_tz text; v_ws timestamptz; v_we timestamptz; v_local timestamp; v_anchor date;
  v_new numeric := 0; v_legacy numeric := 0; v_carry numeric := 0; v_used numeric; v_limit int; v_remaining int;
  v_plan text; v_plan_n int; v_active int := 0; v_warn text := 'none';
begin
  select * into p from public.karaoke_usage_policy where policy_key='default';
  select count(*), max(plan_code) into v_plan_n, v_plan
    from public.karaoke_host_plan_assignments where account_id=p_account_id and status='active';
  if not (v_plan_n=1 and v_plan in ('FREE','PRO')) then v_plan:='FREE'; end if;

  select coalesce(nullif(btrim(timezone),''),'America/Los_Angeles') into v_tz
    from public.karaoke_accounts where id=p_account_id;

  v_local  := p_as_of at time zone v_tz;
  v_anchor := date(v_local - make_interval(hours => p.reset_hour_local));
  v_ws := ((v_anchor::timestamp     + make_interval(hours => p.reset_hour_local))) at time zone v_tz;
  v_we := (((v_anchor+1)::timestamp + make_interval(hours => p.reset_hour_local))) at time zone v_tz;

  select count(*) into v_active from public.karaoke_event_usage_segments s
    join public.karaoke_requests r on r.id=s.request_id
    join public.karaoke_events   e on e.id=s.event_id
   where s.account_id=p_account_id and s.ended_at is null and r.status='playing'
     and e.status not in ('ended','archived');

  if v_plan='PRO' then
    return jsonb_build_object('plan','PRO','unlimited',true,'enforcementEnabled',p.enforcement_enabled,
      'limitSeconds',null,'usedSeconds',0,'remainingSeconds',null,'activePlaybackCount',v_active,
      'asOf',p_as_of,'windowStart',v_ws,'windowEnd',v_we,'nextResetAt',v_we,'timezone',v_tz,
      'warnLevel','none','model','lease_v2');
  end if;

  select coalesce(sum(lease_seconds), 0) into v_new
    from public.karaoke_event_usage_segments
   where account_id=p_account_id and metered and lease_seconds is not null
     and started_at >= v_ws and started_at < v_we;

  select coalesce(sum(greatest(0, extract(epoch from (
             least(coalesce(s.ended_at, p_as_of),
                   case when r.status<>'playing' then coalesce(r.completed_at, p_as_of) else p_as_of end,
                   v_we) - greatest(s.started_at, v_ws))))), 0)
    into v_legacy
    from public.karaoke_event_usage_segments s
    join public.karaoke_requests r on r.id=s.request_id
   where s.account_id=p_account_id and s.metered and s.lease_seconds is null
     and s.started_at < v_we and coalesce(s.ended_at, p_as_of) > v_ws;

  -- BUILD 26E / F-5: seconds carried forward from a deleted account's tombstone for THIS
  -- window. Keyed on the window start, so it lapses automatically at the next reset.
  select coalesce(sum(carried_used_seconds), 0) into v_carry
    from public.karaoke_free_window_carryover
   where account_id=p_account_id and charged_window_start = v_ws;

  v_used := v_new + v_legacy + v_carry;
  v_limit := p.free_limit_seconds; v_remaining := greatest(0, v_limit - floor(v_used)::int);

  if p.enforcement_enabled then
    v_warn := case when v_remaining<=0 then 'zero'
                   when v_remaining<=p.warning_second_seconds then 'two_min'
                   when v_remaining<=p.warning_first_seconds then 'five_min' else 'none' end;
  end if;

  return jsonb_build_object('plan','FREE','unlimited',false,'enforcementEnabled',p.enforcement_enabled,
    'limitSeconds',v_limit,'usedSeconds',floor(v_used)::int,'remainingSeconds',v_remaining,
    'activePlaybackCount',v_active,'asOf',p_as_of,'windowStart',v_ws,'windowEnd',v_we,
    'nextResetAt',v_we,'timezone',v_tz,'warnLevel',v_warn,'model','lease_v2');
end; $$;
revoke all on function public.karaoke_free_minutes_entitlement_at_v2(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.karaoke_free_minutes_entitlement_at_v2(uuid, timestamptz) to service_role;

-- ── 14. BEGIN v2 — RETIRED-ROOM GUARD + CARRYOVER-AWARE GRACE ────────────────
--
-- Byte-identical to 20260807120000 except for exactly two additions, both required by
-- deletion integrity (the only grounds on which this function may be touched):
--
--   (a) F-1 requires an EXPLICIT retired answer. Without this guard a retired room's
--       start returns 'ownership_state_invalid' — indistinguishable from a corrupt
--       ownership graph — so the guard is placed FIRST, before owner resolution.
--   (b) F-5 requires the once-per-window final-song grace not to reset through
--       delete-and-recreate. The NOT EXISTS therefore also consults the carryover row.
--
-- Every admission decision, lock order, gate, charge and returned field is unchanged.
create or replace function public.karaoke_begin_song_v2(p_room_id uuid, p_request_id uuid, p_mode text)
returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare v_account uuid; v_now timestamptz; v_status text; v_event uuid; v_ready timestamptz; v_req_room uuid;
  v_ev_room uuid; v_ev_status text; v_first uuid; v_plan text; v_plan_n int; v_enf boolean; v_tz text; v_upd int; v_ent jsonb;
  v_video text; v_dur int; v_cur_end timestamptz; v_active timestamptz; v_song_end timestamptz; v_new_end timestamptz; v_charge int; v_remaining int;
  v_ws timestamptz; v_we timestamptz; v_reset_hour int; v_local timestamp; v_anchor date;
  v_active_pass uuid; v_active_expires timestamptz; v_sel_pass uuid; v_sel_dur int; v_pass_grant uuid;
  v_pass_covered boolean := false; v_activate boolean := false; v_upd2 int; v_pass_expires timestamptz;
  v_grace boolean := false; v_grace_secs int; v_charged int; v_shortfall int; v_seg_id uuid;
  v_room_status text;
begin
  if p_mode not in ('guest','promote') then return jsonb_build_object('outcome','invalid_mode'); end if;

  -- (a) BUILD 26E / F-1: a retired room answers explicitly and terminally.
  select status into v_room_status from public.karaoke_rooms where id = p_room_id;
  if v_room_status = 'retired' then return jsonb_build_object('outcome','room_retired'); end if;

  v_account := public.karaoke_room_owner_account(p_room_id);
  if v_account is null then return jsonb_build_object('outcome','ownership_state_invalid'); end if;
  perform pg_advisory_xact_lock(public.karaoke_account_lock_key(v_account));
  perform pg_advisory_xact_lock(hashtext(p_room_id::text));
  v_now := clock_timestamp();
  select r.status, r.event_id, r.ready_at, r.room_id, r.youtube_video_id
    into v_status, v_event, v_ready, v_req_room, v_video
    from public.karaoke_requests r where r.id=p_request_id and r.room_id=p_room_id for update;
  if v_status is null then return jsonb_build_object('outcome','not_found'); end if;
  if v_status <> 'waiting' then return jsonb_build_object('outcome','not_waiting'); end if;
  select e.room_id, e.status into v_ev_room, v_ev_status from public.karaoke_events e where e.id=v_event;
  if v_event is null or v_ev_room is distinct from p_room_id or v_req_room is distinct from p_room_id
     or v_ev_status is distinct from 'active' then
    return jsonb_build_object('outcome','event_state_invalid'); end if;
  if exists (select 1 from public.karaoke_requests where room_id=p_room_id and status='playing') then
    return jsonb_build_object('outcome','already_playing'); end if;
  if p_mode='guest' then
    select id into v_first from public.karaoke_requests
      where room_id=p_room_id and event_id=v_event and status='waiting' order by position,created_at,id limit 1;
    if v_first is distinct from p_request_id then return jsonb_build_object('outcome','not_next'); end if;
  else
    if v_ready is null then return jsonb_build_object('outcome','not_ready'); end if;
    select id into v_first from public.karaoke_requests
      where room_id=p_room_id and event_id=v_event and status='waiting' and ready_at is not null
      order by position,created_at,id limit 1;
    if v_first is distinct from p_request_id then return jsonb_build_object('outcome','not_next'); end if;
  end if;

  select duration_seconds into v_dur from public.karaoke_video_durations where video_id = v_video;
  if v_dur is null or v_dur < 1 or v_dur > 900 then
    return jsonb_build_object('outcome','duration_unavailable'); end if;

  select count(*), max(plan_code) into v_plan_n, v_plan
    from public.karaoke_host_plan_assignments where account_id=v_account and status='active';
  if not (v_plan_n=1 and v_plan in ('FREE','PRO')) then v_plan:='FREE'; end if;
  select coalesce((select enforcement_enabled from public.karaoke_usage_policy where policy_key='default'), false) into v_enf;
  select coalesce((select reset_hour_local from public.karaoke_usage_policy where policy_key='default'), 4) into v_reset_hour;
  select coalesce(nullif(btrim(timezone),''),'America/Los_Angeles') into v_tz from public.karaoke_accounts where id=v_account;
  v_local  := v_now at time zone v_tz;
  v_anchor := date(v_local - make_interval(hours => v_reset_hour));
  v_ws := ((v_anchor::timestamp     + make_interval(hours => v_reset_hour))) at time zone v_tz;
  v_we := (((v_anchor+1)::timestamp + make_interval(hours => v_reset_hour))) at time zone v_tz;

  select max(lease_ends_at) into v_cur_end from public.karaoke_event_usage_segments
    where account_id=v_account and lease_ends_at is not null and lease_ends_at > v_now;
  v_active   := greatest(coalesce(v_cur_end, v_now), v_now);
  v_song_end := v_now + make_interval(secs => v_dur);
  v_new_end  := greatest(v_active, v_song_end);
  v_charge   := ceil(extract(epoch from (v_new_end - v_active)))::int;

  if v_plan <> 'PRO' then
    with exp as (
      update public.timed_access_pass_grants set status='EXPIRED', expired_at=v_now, updated_at=now()
       where account_id=v_account and status='ACTIVE' and expires_at <= v_now returning id)
    insert into public.timed_access_pass_audit (pass_grant_id, account_id, actor_type, action, from_status, to_status)
    select id, v_account, 'SYSTEM', 'EXPIRED', 'ACTIVE', 'EXPIRED' from exp;

    select id, expires_at into v_active_pass, v_active_expires from public.timed_access_pass_grants
      where account_id=v_account and status='ACTIVE' and expires_at > v_now for update limit 1;
    if v_active_pass is not null then
      v_pass_covered := true; v_pass_grant := v_active_pass; v_pass_expires := v_active_expires;
    else
      select id, duration_seconds into v_sel_pass, v_sel_dur from public.timed_access_pass_grants
        where account_id=v_account and status='SELECTED' for update limit 1;
      if v_sel_pass is not null then
        v_pass_covered := true; v_activate := true; v_pass_grant := v_sel_pass;
        v_pass_expires := v_now + make_interval(secs => v_sel_dur);
      end if;
    end if;
  end if;

  if v_pass_covered then
    if v_song_end > v_pass_expires then
      return jsonb_build_object('outcome','pass_insufficient','passExpiresAt',v_pass_expires,
        'durationSeconds',v_dur,
        'remainingSeconds', greatest(0, floor(extract(epoch from (v_pass_expires - v_now)))::int)); end if;
  elsif v_enf and v_plan='FREE' then
    v_ent := public.karaoke_free_minutes_entitlement_at_v2(v_account, v_now);
    v_remaining := (v_ent->>'remainingSeconds')::int;
    if v_charge > v_remaining then
      v_shortfall := v_charge - v_remaining;
      -- (b) BUILD 26E / F-5: grace is once per window per PERSON, not per account row.
      -- The carryover clause makes delete-and-recreate unable to re-arm it.
      if v_remaining > 0 and v_shortfall <= 90 and not exists (
           select 1 from public.karaoke_free_final_song_grace g
            where g.account_id = v_account and g.charged_window_start = v_ws)
        and not exists (
           select 1 from public.karaoke_free_window_carryover c
            where c.account_id = v_account and c.charged_window_start = v_ws and c.grace_consumed)
      then
        v_grace := true;
        v_grace_secs := v_shortfall;
        v_charged := v_remaining;
      else
        return jsonb_build_object('outcome','upgrade_required','entitlement',v_ent,
          'durationSeconds',v_dur,
          'requiredChargeSeconds',v_charge,
          'remainingSeconds',v_remaining); end if;
    end if;
  end if;

  update public.karaoke_requests set status='playing', started_at=v_now
    where id=p_request_id and room_id=p_room_id and status='waiting';
  get diagnostics v_upd = row_count;
  if v_upd <> 1 then return jsonb_build_object('outcome','request_state_changed'); end if;

  if v_activate then
    update public.timed_access_pass_grants
       set status='ACTIVE', activated_at=v_now, expires_at=v_pass_expires, updated_at=now()
     where id=v_sel_pass and status='SELECTED';
    get diagnostics v_upd2 = row_count;
    if v_upd2 <> 1 then return jsonb_build_object('outcome','request_state_changed'); end if;
    insert into public.timed_access_pass_audit
      (pass_grant_id, account_id, actor_type, actor_ref, action, from_status, to_status, metadata)
    values (v_sel_pass, v_account, 'SYSTEM', 'dj_start', 'ACTIVATED', 'SELECTED', 'ACTIVE',
            jsonb_build_object('requestId', p_request_id, 'roomId', p_room_id, 'eventId', v_event));
  end if;

  insert into public.karaoke_event_usage_segments
    (account_id,event_id,room_id,request_id,plan_snapshot,metered,started_at,timezone_snapshot,
     pass_grant_id,metering_paused_by_pass, duration_seconds, lease_ends_at, lease_seconds,
     charged_window_start, charged_window_end)
  values (v_account, v_event, p_room_id, p_request_id, v_plan,
          (v_plan='FREE' and not v_pass_covered), v_now, v_tz,
          v_pass_grant, v_pass_covered,
          v_dur, v_new_end, (case when v_pass_covered then 0 when v_grace then v_charged else v_charge end),
          v_ws, v_we)
  returning id into v_seg_id;

  if v_grace then
    insert into public.karaoke_free_final_song_grace
      (account_id, charged_window_start, charged_window_end, request_id, segment_id,
       remaining_before_seconds, duration_seconds, charged_seconds, grace_seconds)
    values (v_account, v_ws, v_we, p_request_id, v_seg_id,
            v_remaining, v_dur, v_charged, v_grace_secs);
  end if;

  return jsonb_build_object('outcome','ok','leaseEndsAt',v_new_end,
    'chargeSeconds',(case when v_pass_covered then 0 when v_grace then v_charged else v_charge end),
    'finalSongGraceApplied', v_grace,
    'finalSongGraceSeconds', (case when v_grace then v_grace_secs else null end),
    'finalSongChargedSeconds', (case when v_grace then v_charged else null end),
    'remainingBeforeSeconds', (case when v_grace then v_remaining else null end),
    'durationSeconds',v_dur,'chargedWindowStart',v_ws,'passActivated',v_activate,'passCovered',v_pass_covered,
    'passGrantId',v_pass_grant,'passExpiresAt',v_pass_expires,
    'entitlement', public.karaoke_free_minutes_entitlement_at_v2(v_account, v_now));
end; $$;
revoke all on function public.karaoke_begin_song_v2(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.karaoke_begin_song_v2(uuid, uuid, text) to service_role;

-- ── 15. DURABLE PROVIDER-REVOCATION JOB (Apple revocation authority) ─────────
--
-- Apple's /auth/token and /auth/revoke are outbound HTTP calls; they cannot be part of the
-- deletion transaction. Without a durable record, a revocation that fails after the
-- deletion commits is simply lost -- the account is gone and the Apple grant silently
-- survives forever. This table is that record.
--
-- LIFECYCLE:
--   prepared          token exchanged, job written, deletion transaction NOT yet committed.
--                     If the deletion transaction fails the service layer DELETES this row
--                     and erases the token, so a prepared job can never be left usable.
--   pending           deletion committed; revocation owed and retryable.
--   succeeded         Apple accepted the revocation; token material erased.
--   retryable_failure transient Apple/network failure; token retained for the next attempt.
--   manual_required   Apple returned a documented PERMANENT refusal; token erased and the
--                     user is given Apple-Settings instructions. Reachable ONLY from a real
--                     Apple response -- never from missing configuration (see the header).
--
-- TOKEN HANDLING: the refresh token is retained ONLY while it is still needed, and only as
-- AES-256-GCM ciphertext under KARAOKE_APPLE_TOKEN_ENCRYPTION_KEY. WebCrypto appends the
-- 16-byte GCM authentication tag to the ciphertext, so the tag lives inside
-- `encrypted_refresh_token` rather than in a separate column; `token_nonce` is the IV and
-- `encryption_key_version` allows rotation. Plaintext is never stored, logged, or returned.
create table if not exists public.karaoke_provider_revocation_jobs (
  id                      uuid primary key default gen_random_uuid(),
  -- RESTRICT: the job must outlive any attempt to remove the tombstone it points at.
  account_id              uuid not null references public.karaoke_accounts(id) on delete restrict,
  authority_ref           uuid not null,
  provider                text not null check (provider in ('apple', 'google')),
  status                  text not null default 'prepared'
                            check (status in ('prepared', 'pending', 'succeeded',
                                              'retryable_failure', 'manual_required')),
  encrypted_refresh_token text,
  token_nonce             text,
  encryption_key_version  text,
  attempt_count           int not null default 0 check (attempt_count >= 0),
  next_attempt_at         timestamptz,
  last_error_code         text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  completed_at            timestamptz,
  manual_required_at      timestamptz,
  -- Token material must be GONE in every terminal state. This is the constraint that makes
  -- "erase after success / permanent failure" a schema guarantee rather than a code habit.
  constraint provider_revocation_terminal_has_no_token check (
    status not in ('succeeded', 'manual_required')
    or (encrypted_refresh_token is null and token_nonce is null)),
  -- Ciphertext and IV are one fact: neither is usable alone.
  constraint provider_revocation_token_pair check (
    (encrypted_refresh_token is null) = (token_nonce is null)),
  constraint provider_revocation_manual_time check (
    (status = 'manual_required') = (manual_required_at is not null)),
  constraint provider_revocation_completed_time check (
    (status = 'succeeded') = (completed_at is not null))
);
-- At most ONE job per account per provider: a retry must never fan out into duplicates.
create unique index if not exists karaoke_provider_revocation_jobs_acct_provider_idx
  on public.karaoke_provider_revocation_jobs (account_id, provider);
create index if not exists karaoke_provider_revocation_jobs_due_idx
  on public.karaoke_provider_revocation_jobs (status, next_attempt_at)
  where status in ('pending', 'retryable_failure');
alter table public.karaoke_provider_revocation_jobs enable row level security;
revoke all on public.karaoke_provider_revocation_jobs from anon, authenticated;

create or replace function public.karaoke_touch_provider_revocation_job()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists karaoke_provider_revocation_jobs_touch on public.karaoke_provider_revocation_jobs;
create trigger karaoke_provider_revocation_jobs_touch
  before update on public.karaoke_provider_revocation_jobs
  for each row execute function public.karaoke_touch_provider_revocation_job();

-- ── 16. APPEND-ONLY POST-DELETION EVENTS ─────────────────────────────────────
--
-- karaoke_account_deletion_audit is immutable and written INSIDE the deletion transaction,
-- so it can only ever state what was true at that instant. An Apple revocation that
-- succeeds four hours later must still be recordable -- otherwise the permanent audit would
-- assert 'pending' forever and could never be reconciled with reality. That is what this
-- table is for: an append-only event log keyed to the same tombstone, carrying outcome
-- codes and NO personal data.
create table if not exists public.karaoke_account_deletion_events (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references public.karaoke_accounts(id) on delete restrict,
  authority_ref uuid not null,
  event_type    text not null check (event_type in (
                  'APPLE_REVOCATION_SUCCEEDED',
                  'APPLE_REVOCATION_RETRYABLE_FAILURE',
                  'APPLE_REVOCATION_MANUAL_REQUIRED',
                  'APPLE_REVOCATION_PREPARED',
                  'GOOGLE_REVOCATION_REPORTED')),
  -- A short machine code only. NEVER an Apple error body, token, subject, or email.
  detail_code   text check (detail_code is null or char_length(detail_code) <= 64),
  attempt_count int,
  created_at    timestamptz not null default now()
);
create index if not exists karaoke_account_deletion_events_account_idx
  on public.karaoke_account_deletion_events (account_id, created_at desc);
alter table public.karaoke_account_deletion_events enable row level security;
revoke all on public.karaoke_account_deletion_events from anon, authenticated;

create or replace function public.karaoke_account_deletion_events_immutable()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  raise exception 'karaoke_account_deletion_events is append-only; % is not permitted', tg_op
    using errcode = 'restrict_violation';
end;
$$;
drop trigger if exists karaoke_account_deletion_events_no_mutate on public.karaoke_account_deletion_events;
create trigger karaoke_account_deletion_events_no_mutate
  before update or delete on public.karaoke_account_deletion_events
  for each row execute function public.karaoke_account_deletion_events_immutable();
