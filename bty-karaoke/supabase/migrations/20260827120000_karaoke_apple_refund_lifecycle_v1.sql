-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- ============================================================================
-- BUILD 26U-R4E-R1 · APPLE REFUND / REVERSAL LIFECYCLE.
-- ADDITIVE + IDEMPOTENT. No existing function is redefined. R4B/R4C/R4D are untouched.
--
-- WHY. R4E-R0 measured the gap: Apple revocation is captured only when a transaction is FIRST
-- verified, a replay updates nothing, and no code reads a purchase's revocation to touch a grant.
-- `revoke_timed_access_pass` refuses anything that is not AVAILABLE or SELECTED, so an ACTIVE
-- grant whose purchase was refunded kept its entitlement until natural expiry -- up to 24 hours --
-- and no operator could stop it. This file closes that, and only that.
--
-- WHAT IT DELIBERATELY DOES NOT REUSE. `switch_timed_access_pass` also writes REVOKED, with
-- reason 'switched_pass', and it CARRIES THE REMAINING TIME FORWARD. That is right for a Host who
-- voluntarily switches passes and wrong for a refund: money came back, so time must not. The
-- refund path is a separate function with its own reason and an explicit zero carry.
-- ============================================================================

-- ── A. THE NOTIFICATION INBOX ──
--
-- Append-only evidence of what Apple told us. A row exists only after the JWS verified: the
-- server records what it PROVED, never what a payload claimed.
create table if not exists public.karaoke_apple_server_notifications (
  id                    uuid primary key default gen_random_uuid(),
  -- Apple's own idempotency key. UNIQUE is the whole duplicate-suppression mechanism.
  notification_uuid     text not null,
  notification_type     text not null,
  subtype               text,
  environment           text not null check (environment in ('Sandbox', 'Production')),
  apple_transaction_id  text,
  apple_original_transaction_id text,
  signed_date           timestamptz,
  -- sha256 of the outer signedPayload. The payload itself is not stored: it is a bearer-shaped
  -- credential, and the digest is enough to prove which bytes were processed.
  signed_payload_sha256 text not null,
  received_at           timestamptz not null default now(),
  processing_status     text not null default 'RECEIVED'
                          check (processing_status in ('RECEIVED', 'APPLIED', 'IGNORED', 'FAILED')),
  processing_detail     text,
  processed_at          timestamptz
);
create unique index if not exists karaoke_apple_notification_uuid_idx
  on public.karaoke_apple_server_notifications (notification_uuid);
create index if not exists karaoke_apple_notification_txn_idx
  on public.karaoke_apple_server_notifications (environment, apple_transaction_id);
alter table public.karaoke_apple_server_notifications enable row level security;
revoke all on table public.karaoke_apple_server_notifications from public, anon, authenticated;
grant select, insert, update on table public.karaoke_apple_server_notifications to service_role;

-- ── B. PURCHASE-LEDGER REFUND PROVENANCE ──
--
-- `refunded_at` / `revoked_at` / `revocation_reason` already exist (BUILD 26P) but were only ever
-- written at INSERT. These record what a POST-FULFILMENT refund did, including the one number a
-- reversal needs: how much service time BTY actually took away.
alter table public.karaoke_apple_purchases
  add column if not exists refund_notification_uuid   text,
  add column if not exists refund_denied_seconds      int,
  add column if not exists refund_reversed_at         timestamptz,
  add column if not exists reversal_notification_uuid text;

-- ── C. COMPENSATION GRANTS ──
--
-- A reversal must NOT resurrect the original grant: activation-once and terminality are R4B/R4D
-- invariants and reviving a REVOKED row would break both. Instead a NEW grant is issued for
-- exactly the value that was removed. It is not a second fulfilment of the Apple purchase, so it
-- is not PAID and carries no apple_purchase_id -- which also keeps the 1:1 purchase-grant index
-- intact. Its provenance lives in its own columns.
alter table public.timed_access_pass_grants
  add column if not exists reversal_of_purchase_id    uuid references public.karaoke_apple_purchases(id),
  add column if not exists reversal_notification_uuid text;

alter table public.timed_access_pass_grants
  drop constraint if exists timed_pass_source_type_chk;
alter table public.timed_access_pass_grants
  add constraint timed_pass_source_type_chk
  check (source_type in ('PAID', 'WELCOME', 'REFERRAL', 'MANUAL_PROMOTIONAL', 'REFUND_REVERSAL'));

-- ONE compensation grant per reversal, enforced declaratively rather than by application care.
create unique index if not exists timed_pass_reversal_once_idx
  on public.timed_access_pass_grants (reversal_notification_uuid)
  where reversal_notification_uuid is not null;

-- ── D. RECORD A VERIFIED NOTIFICATION ──
--
-- Returns `duplicate` for a notificationUUID already seen, which is what makes Apple's retries
-- harmless. The caller must have verified the JWS before calling this.
create or replace function public.karaoke_record_apple_notification(
  p_notification_uuid text,
  p_notification_type text,
  p_subtype           text,
  p_environment       text,
  p_transaction_id    text,
  p_original_transaction_id text,
  p_signed_date       timestamptz,
  p_payload_sha256    text
) returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  if nullif(btrim(coalesce(p_notification_uuid, '')), '') is null then
    return jsonb_build_object('ok', false, 'error', 'notification_uuid_required');
  end if;
  if nullif(btrim(coalesce(p_payload_sha256, '')), '') is null then
    return jsonb_build_object('ok', false, 'error', 'payload_digest_required');
  end if;

  insert into public.karaoke_apple_server_notifications
    (notification_uuid, notification_type, subtype, environment, apple_transaction_id,
     apple_original_transaction_id, signed_date, signed_payload_sha256)
  values (p_notification_uuid, p_notification_type, p_subtype, p_environment, p_transaction_id,
          p_original_transaction_id, p_signed_date, p_payload_sha256)
  on conflict (notification_uuid) do nothing
  returning id into v_id;

  if v_id is null then
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;
  return jsonb_build_object('ok', true, 'duplicate', false, 'notificationId', v_id);
end; $$;
revoke all on function public.karaoke_record_apple_notification(text,text,text,text,text,text,timestamptz,text)
  from public, anon, authenticated;
grant execute on function public.karaoke_record_apple_notification(text,text,text,text,text,text,timestamptz,text)
  to service_role;

-- ── E. APPLY AN AUTHORITATIVE APPLE REFUND ──
--
-- ONE transaction: the purchase ledger and the grant move together or not at all. There is no
-- committed state in which the ledger says refunded while the grant still authorizes room time.
--
-- LOCK ORDER, fixed and documented, because R4D measured that these are two DIFFERENT domains and
-- assuming they collide is how a race gets missed:
--     1. karaoke_account_lock_key(account)          -- the session/activation domain
--     2. hashtext('timed_pass:' || account)         -- the select/switch domain
--     3. FOR UPDATE on the purchase row, then the grant row
-- Every function in this file takes them in exactly this order, so refund cannot deadlock against
-- itself, and it serialises against BOTH session start and selection.
create or replace function public.apply_apple_purchase_refund(
  p_environment        text,
  p_transaction_id     text,
  p_revocation_date    timestamptz,
  p_revocation_reason  text,
  p_notification_uuid  text
) returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare
  v_p      public.karaoke_apple_purchases%rowtype;
  v_g      public.timed_access_pass_grants%rowtype;
  v_now    timestamptz;
  v_denied int := 0;
  v_to     text;
  v_reason text := coalesce(nullif(btrim(coalesce(p_revocation_reason, '')), ''), 'apple_refund');
begin
  -- Locate by IMMUTABLE Apple evidence only. No caller-supplied account or grant identity is
  -- accepted anywhere in this function: a client claim is never revocation authority.
  select * into v_p from public.karaoke_apple_purchases
   where environment = p_environment and apple_transaction_id = p_transaction_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'purchase_not_found');
  end if;

  perform pg_advisory_xact_lock(public.karaoke_account_lock_key(v_p.account_id));
  perform pg_advisory_xact_lock(hashtext('timed_pass:' || v_p.account_id::text));

  select * into v_p from public.karaoke_apple_purchases where id = v_p.id for update;
  v_now := clock_timestamp();

  -- Already refunded -> a duplicate notification is a no-op that reports the first outcome.
  if v_p.revoked_at is not null then
    return jsonb_build_object('ok', true, 'replayed', true, 'purchaseId', v_p.id,
      'grantId', v_p.pass_grant_id, 'deniedSeconds', v_p.refund_denied_seconds);
  end if;

  if v_p.pass_grant_id is not null then
    select * into v_g from public.timed_access_pass_grants where id = v_p.pass_grant_id for update;
  end if;

  -- ── the grant transition, by lifecycle position (R4E-R1 §G) ──
  if v_p.pass_grant_id is null then
    v_to := null;                                   -- verified but never fulfilled: nothing to revoke
  elsif v_g.status = 'REVOKED' then
    v_to := 'REVOKED'; v_denied := 0;               -- already terminal
  elsif v_g.status = 'EXPIRED' then
    -- §G Case 5. The service was fully delivered before the money came back. EXPIRED is the
    -- honest lifecycle terminus and is NOT rewritten for financial labelling; the purchase row
    -- carries the financial truth instead.
    v_to := 'EXPIRED'; v_denied := 0;
  elsif v_g.status = 'ACTIVE' then
    if v_g.expires_at <= v_now then
      -- §G Case 4. Stale ACTIVE. Which cause terminated it first decides the terminal state.
      if p_revocation_date is not null and p_revocation_date < v_g.expires_at then
        v_to := 'REVOKED';
        v_denied := greatest(0, floor(extract(epoch from (v_g.expires_at - v_now)))::int);
      else
        v_to := 'EXPIRED'; v_denied := 0;           -- natural expiry got there first
      end if;
    else
      -- §G Case 3 / §J. The security case: a live paid grant loses entitlement at COMMIT, not at
      -- app reopen, room restart or natural expiry.
      v_to := 'REVOKED';
      v_denied := greatest(0, floor(extract(epoch from (v_g.expires_at - v_now)))::int);
    end if;
  else
    -- §G Cases 1 and 2: AVAILABLE or SELECTED. Nothing was consumed, so the whole window is what
    -- BTY denies. `carryover_seconds` is READ to size the denial and is never moved anywhere.
    v_to := 'REVOKED';
    v_denied := coalesce(v_g.duration_seconds, 0) + coalesce(v_g.carryover_seconds, 0);
  end if;

  -- ── the grant write ──
  if v_to = 'REVOKED' and v_g.status <> 'REVOKED' then
    update public.timed_access_pass_grants
       set status = 'REVOKED',
           revoked_at = v_now,
           revoke_reason = 'apple_refund',          -- NEVER 'switched_pass'
           selected_at = case when status = 'SELECTED' then null else selected_at end,
           -- activated_at and expires_at are PRESERVED: they are history, not entitlement.
           updated_at = now()
     where id = v_g.id;
    insert into public.timed_access_pass_audit
      (pass_grant_id, account_id, actor_type, actor_ref, action, from_status, to_status,
       idempotency_key, reason, metadata)
    values (v_g.id, v_g.account_id, 'SYSTEM', 'apple_server_notification', 'REVOKED',
            v_g.status, 'REVOKED', p_notification_uuid, 'apple_refund',
            jsonb_build_object('deniedSeconds', v_denied, 'revocationDate', p_revocation_date,
                               'appleReason', v_reason, 'purchaseId', v_p.id));
  elsif v_to = 'EXPIRED' and v_g.status = 'ACTIVE' then
    -- Materialise the lapse that already happened, using R4C's own vocabulary.
    update public.timed_access_pass_grants
       set status = 'EXPIRED', expired_at = v_now, updated_at = now()
     where id = v_g.id and status = 'ACTIVE';
    insert into public.timed_access_pass_audit
      (pass_grant_id, account_id, actor_type, action, from_status, to_status)
    values (v_g.id, v_g.account_id, 'SYSTEM', 'EXPIRED', 'ACTIVE', 'EXPIRED');
  end if;

  -- ── the ledger write, same transaction ──
  update public.karaoke_apple_purchases
     set verification_status  = 'REVOKED',
         revoked_at           = coalesce(p_revocation_date, v_now),
         refunded_at          = coalesce(p_revocation_date, v_now),
         revocation_reason    = v_reason,
         refund_notification_uuid = p_notification_uuid,
         refund_denied_seconds    = v_denied,
         grant_status = case when pass_grant_id is null then grant_status else 'GRANT_REVOKED' end,
         updated_at = now()
   where id = v_p.id;

  return jsonb_build_object('ok', true, 'replayed', false, 'purchaseId', v_p.id,
    'grantId', v_p.pass_grant_id, 'grantStatus', v_to, 'deniedSeconds', v_denied);
end; $$;
revoke all on function public.apply_apple_purchase_refund(text,text,timestamptz,text,text)
  from public, anon, authenticated;
grant execute on function public.apply_apple_purchase_refund(text,text,timestamptz,text,text) to service_role;

-- ── F. APPLY AN AUTHORITATIVE REFUND REVERSAL ──
--
-- Apple can reverse a refund it previously approved. The naive response is to put the original
-- grant back, and it is wrong twice over: R4B's `timed_pass_audit_one_activation_idx` says a grant
-- activates at most once ever, and R4D proved terminality. Resurrecting REVOKED -> AVAILABLE/
-- ACTIVE would break both, and for an ACTIVE grant it would also hand back a window that has since
-- passed in wall-clock terms.
--
-- So nothing is resurrected. A NEW grant is issued for EXACTLY the seconds the refund removed --
-- `refund_denied_seconds`, computed and frozen at refund time, never recomputed later from a
-- clock that has moved on. It starts AVAILABLE, and it goes nowhere until the Host explicitly
-- selects it and explicitly starts a room: R4B's lifecycle applies to it like any other grant.
--
-- If the refund denied ZERO seconds (the service had already been fully delivered), there is
-- nothing to give back and no grant is created. Compensation restores what was taken, never more.
create or replace function public.apply_apple_refund_reversal(
  p_environment       text,
  p_transaction_id    text,
  p_notification_uuid text
) returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare
  v_p       public.karaoke_apple_purchases%rowtype;
  v_now     timestamptz;
  v_new     uuid;
  v_denied  int;
  v_type    text;
begin
  select * into v_p from public.karaoke_apple_purchases
   where environment = p_environment and apple_transaction_id = p_transaction_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'purchase_not_found');
  end if;

  perform pg_advisory_xact_lock(public.karaoke_account_lock_key(v_p.account_id));
  perform pg_advisory_xact_lock(hashtext('timed_pass:' || v_p.account_id::text));
  select * into v_p from public.karaoke_apple_purchases where id = v_p.id for update;
  v_now := clock_timestamp();

  if v_p.revoked_at is null then
    -- Nothing was ever refunded, so there is nothing to reverse. Refuse rather than invent value.
    return jsonb_build_object('ok', false, 'error', 'purchase_not_refunded');
  end if;

  -- Idempotent by the SAME evidence the inbox dedupes on, and backed by
  -- timed_pass_reversal_once_idx so a concurrent duplicate cannot slip past this read.
  select id into v_new from public.timed_access_pass_grants
   where reversal_notification_uuid = p_notification_uuid;
  if v_new is not null then
    return jsonb_build_object('ok', true, 'replayed', true, 'compensationGrantId', v_new);
  end if;
  if v_p.refund_reversed_at is not null then
    return jsonb_build_object('ok', true, 'replayed', true,
      'compensationGrantId', null, 'detail', 'already_reversed');
  end if;

  v_denied := coalesce(v_p.refund_denied_seconds, 0);

  if v_denied > 0 then
    -- The product shape is carried from the original purchase so the compensation is the same
    -- KIND of thing that was taken, sized by what was actually denied.
    select pass_type into v_type from public.timed_access_pass_grants where id = v_p.pass_grant_id;
    insert into public.timed_access_pass_grants
      (account_id, pass_type, duration_seconds, status, source_type, is_paid,
       issue_reason, issue_idempotency_key, reversal_of_purchase_id, reversal_notification_uuid)
    values (v_p.account_id, coalesce(v_type, 'ONE_HOUR'), v_denied, 'AVAILABLE',
            'REFUND_REVERSAL', false, 'apple_refund_reversed',
            'reversal:' || p_notification_uuid, v_p.id, p_notification_uuid)
    returning id into v_new;

    insert into public.timed_access_pass_audit
      (pass_grant_id, account_id, actor_type, actor_ref, action, from_status, to_status,
       idempotency_key, reason, metadata)
    values (v_new, v_p.account_id, 'SYSTEM', 'apple_server_notification', 'ISSUED', null,
            'AVAILABLE', p_notification_uuid, 'apple_refund_reversed',
            -- BUILD 26O's issuance floor applies to THIS grant like any other: an ISSUED audit
            -- row must carry version/source/actor_kind/actor_id. The provenance here is honest --
            -- Apple's own notification issued it, no human did -- and the constraint is what
            -- caught the first draft of this function omitting it.
            jsonb_build_object('version', 1, 'source', 'APPLE_SERVER_NOTIFICATION',
                               'actor_kind', 'SYSTEM', 'actor_id', p_notification_uuid,
                               'restoredSeconds', v_denied, 'reversalOfPurchaseId', v_p.id,
                               'originalGrantId', v_p.pass_grant_id));
  end if;

  update public.karaoke_apple_purchases
     set refund_reversed_at = v_now,
         reversal_notification_uuid = p_notification_uuid,
         updated_at = now()
   where id = v_p.id;

  return jsonb_build_object('ok', true, 'replayed', false, 'compensationGrantId', v_new,
    'restoredSeconds', v_denied, 'originalGrantUntouched', true);
end; $$;
revoke all on function public.apply_apple_refund_reversal(text,text,text) from public, anon, authenticated;
grant execute on function public.apply_apple_refund_reversal(text,text,text) to service_role;

-- ── G. WHAT THIS FILE DOES NOT DO ──
--
-- No existing function is redefined. select_/switch_/issue_/revoke_timed_access_pass,
-- fulfil_apple_purchase, karaoke_start_premium_room_session, both entitlement readers and the
-- audit immutability trigger are all untouched, so R4B, R4C and R4D keep their proofs. Nothing
-- here polls Apple, and nothing here accepts a client claim as authority: both functions locate
-- their subject only by immutable Apple transaction evidence.
