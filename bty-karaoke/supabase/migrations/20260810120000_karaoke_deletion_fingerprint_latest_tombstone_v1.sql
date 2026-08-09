-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- btyNorebang — BUILD 26I: DELETION FINGERPRINT MUST TRACK THE LATEST TOMBSTONE.
--
-- MEASURED DEFECT (production, 2026-08-09). BUILD 26I §3 checked every deleted account in
-- production against the published retention ledger. Account 98d3496f — deleted through
-- the real Native path on 2026-08-08 — had NO fingerprint row pointing at it, while the
-- Apple fingerprint for the very identity it owned still pointed at the EARLIER tombstone
-- ef4cc5d2, its last_deleted_at correctly advanced to 98d3496f's deletion instant.
--
-- CAUSE. karaoke_delete_account_v1 upserts the one-way fingerprint with
--     on conflict (fingerprint) do update set last_deleted_at = excluded.last_deleted_at
-- so the SECOND and every later deletion of the same provider identity advanced the
-- timestamp but never re-pointed account_tombstone_id. The pointer froze on the first
-- tombstone that identity ever produced.
--
-- WHY IT MATTERS — this reopens F-5, the hole the fingerprint exists to close.
-- karaoke_apply_free_window_carryover_v1 resolves the tombstone through that pointer:
--     select account_tombstone_id into v_tomb from karaoke_identity_fingerprints ...
-- and then sums (a) v_tomb's own metered seconds in the current window and (b) carryover
-- rows whose account_id = v_tomb. With a frozen pointer BOTH terms address the wrong
-- account from the second recreate onward: the intermediate account's consumed seconds are
-- invisible, and so is the carryover it had itself received. Concretely, in production
-- ef4cc5d2 consumed 504 s, 98d3496f inherited exactly those 504 s — but a third signup on
-- that Apple identity inside the same window would have resolved back to ef4cc5d2 and
-- carried 504 s, silently forgiving everything 98d3496f consumed. Every delete-and-recreate
-- cycle after the first therefore returned a fresh FREE allowance, which is precisely the
-- abuse F-5 forbids. The first cycle was always correct, which is why BUILD 26E's gates —
-- which exercised exactly one recreate — could not see it.
--
-- THE FIX is one clause: the upsert now advances account_tombstone_id too, so the pointer
-- always names the MOST RECENT tombstone for that identity. That is the value the chaining
-- logic in karaoke_apply_free_window_carryover_v1 already assumes ("a second deletion
-- inside one window must not drop the first's state") — the write site simply never
-- supplied it.
--
-- SCOPE. Forward-only, additive, idempotent. karaoke_delete_account_v1 is re-issued
-- BYTE-IDENTICALLY except for that one ON CONFLICT clause; no other behaviour, table,
-- constraint, grant or function is touched. The retention policy is unchanged: nothing
-- newly deleted, nothing newly retained.
--
-- ROLLBACK: re-run the karaoke_delete_account_v1 body from 20260809120000. The backfill
-- below is not reversed by that, and does not need to be — it only corrects pointers to
-- the value this migration makes canonical.

-- ── 1. RE-ISSUE THE DELETION RPC WITH THE CORRECTED UPSERT ───────────────────
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
  on conflict (fingerprint) do update set
        last_deleted_at      = excluded.last_deleted_at,
        account_tombstone_id = excluded.account_tombstone_id;

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

-- ── 2. BACKFILL THE FROZEN POINTERS ──────────────────────────────────────────
--
-- The fingerprint is one-way, so the identities that produced it cannot be recomputed —
-- but last_deleted_at records the exact instant of the most recent deletion, and
-- karaoke_accounts.deleted_at is written from the same clock_timestamp() inside the same
-- transaction. Joining on that equality names the correct tombstone without needing to
-- reverse anything.
--
-- Idempotent: the predicate excludes rows already pointing at the right account, so a
-- re-run changes nothing. Deliberately NOT time-boxed — a stale pointer is wrong whenever
-- it occurred.
update public.karaoke_identity_fingerprints f
   set account_tombstone_id = a.id
  from public.karaoke_accounts a
 where a.deleted_at = f.last_deleted_at
   and a.account_status = 'deleted'
   and f.account_tombstone_id <> a.id;
