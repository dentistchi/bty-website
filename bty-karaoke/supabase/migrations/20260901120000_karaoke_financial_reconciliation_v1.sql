-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- ============================================================================
-- BUILD 26U-R4G-R2-R1 · RETENTION-SAFE FINANCIAL RECONCILIATION.
-- Sorts after 20260831120000_karaoke_partial_refund_service_value_v1.sql.
-- ADDITIVE + IDEMPOTENT. No product arm, no entitlement predicate, no catalog, no notification
-- identity, and no REFUND_CREDIT / REFUND_REMAINDER arithmetic is touched.
--
-- THE BLOCKER THIS CLOSES. Apple keeps Notification History for 30 days (Sandbox) / 180 days
-- (Production). Past that a refund BTY missed is unrecoverable from the notification path, while
-- Apple still exposes the financial truth through Get Refund History and Get Transaction Info.
-- R4G-R2-R0 measured that there was no safe way to act on it.
--
-- THREE EVIDENCE SYSTEMS, DELIBERATELY NOT MERGED:
--
--   karaoke_apple_server_notifications   "Apple PRODUCED this V2 notification"  (notification_uuid)
--   THIS TABLE                           "BTY RETRIEVED Apple-signed truth"     (its own id)
--   purchases / grants / audit            canonical business state
--
-- A reconciliation is NOT a notification. Nothing here invents a notificationUUID, writes an
-- inbox row, or lets an evidence id be stored in a column whose name says notification.
-- ============================================================================

-- ── A. THE EVIDENCE STORE ──
--
-- Append-only in the way that matters: the VERIFIED APPLE CLAIMS are written once and never
-- rewritten. Only the processing columns move, because a transient failure must be retryable --
-- the same lesson R4G-R1 paid for on the notification inbox.
--
-- The raw JWS is deliberately NOT retained. The inbox already keeps only a digest, the decoded
-- claims below are what any decision is made from, and a signed transaction is bearer-ish
-- evidence about a real customer's purchase. A digest proves which bytes were verified without
-- keeping them.
create table if not exists public.karaoke_apple_financial_reconciliation_evidence (
  id uuid primary key default gen_random_uuid(),

  environment text not null,
  apple_transaction_id text not null,
  apple_original_transaction_id text,

  -- WHICH Apple endpoint this came from. Not a notification type, and never one.
  evidence_source text not null,

  -- The exact bytes that were verified. Also the natural identity of a snapshot of Apple state:
  -- a later, genuinely different state produces a different digest and therefore a new row,
  -- which is what makes refund -> reversal observable at all.
  signed_transaction_sha256 text not null,
  apple_signed_date timestamptz,

  -- The verified refund claims, as Apple sent them. NULL means Apple sent nothing; it is never
  -- filled in with a guess, because the whole point of §J is that absence is ambiguous.
  revocation_date timestamptz,
  revocation_reason text,
  revocation_type text,
  revocation_percentage integer,
  product_id text,

  observed_at timestamptz not null default now(),
  processing_status text not null default 'OBSERVED',
  processing_detail text,
  processed_at timestamptz,

  constraint karaoke_recon_env_chk check (environment in ('Sandbox','Production')),
  constraint karaoke_recon_source_chk check (evidence_source in ('REFUND_HISTORY','TRANSACTION_INFO')),
  constraint karaoke_recon_status_chk
    check (processing_status in ('OBSERVED','APPLIED','NO_ACTION','FAILED')),
  constraint karaoke_recon_pct_chk
    check (revocation_percentage is null
           or (revocation_percentage >= 0 and revocation_percentage <= 100000))
);

-- SAME SIGNED EVIDENCE -> ONE ROW. The identity is Apple's own bytes, never the wall clock a
-- scan happened to run at: a full rescan must be free, and a changed Apple state must be
-- visible. Both fall out of digest identity.
create unique index if not exists karaoke_recon_evidence_identity_idx
  on public.karaoke_apple_financial_reconciliation_evidence
  (environment, apple_transaction_id, evidence_source, signed_transaction_sha256);

create index if not exists karaoke_recon_evidence_txn_idx
  on public.karaoke_apple_financial_reconciliation_evidence (environment, apple_transaction_id);
create index if not exists karaoke_recon_evidence_unfinished_idx
  on public.karaoke_apple_financial_reconciliation_evidence (observed_at)
  where processing_status in ('OBSERVED','FAILED');

alter table public.karaoke_apple_financial_reconciliation_evidence enable row level security;
revoke all on table public.karaoke_apple_financial_reconciliation_evidence
  from public, anon, authenticated;
grant select, insert, update on table public.karaoke_apple_financial_reconciliation_evidence
  to service_role;

-- ── B. RECORD ONE OBSERVATION ──
--
-- Insert-or-return, exactly like the notification recorder, and for the same reason: two workers
-- observing the same Apple bytes must converge on one row rather than race.
create or replace function public.karaoke_record_reconciliation_evidence(
  p_environment text,
  p_transaction_id text,
  p_original_transaction_id text,
  p_evidence_source text,
  p_signed_sha256 text,
  p_apple_signed_date timestamptz,
  p_revocation_date timestamptz,
  p_revocation_reason text,
  p_revocation_type text,
  p_revocation_percentage integer,
  p_product_id text
) returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare v_id uuid; v_status text; v_inserted boolean := false;
begin
  if nullif(btrim(coalesce(p_transaction_id, '')), '') is null then
    return jsonb_build_object('ok', false, 'error', 'transaction_id_required');
  end if;
  if nullif(btrim(coalesce(p_signed_sha256, '')), '') is null then
    return jsonb_build_object('ok', false, 'error', 'digest_required');
  end if;
  if p_evidence_source not in ('REFUND_HISTORY','TRANSACTION_INFO') then
    return jsonb_build_object('ok', false, 'error', 'invalid_evidence_source');
  end if;
  if p_environment not in ('Sandbox','Production') then
    return jsonb_build_object('ok', false, 'error', 'invalid_environment');
  end if;

  insert into public.karaoke_apple_financial_reconciliation_evidence
    (environment, apple_transaction_id, apple_original_transaction_id, evidence_source,
     signed_transaction_sha256, apple_signed_date, revocation_date, revocation_reason,
     revocation_type, revocation_percentage, product_id)
  values (p_environment, p_transaction_id, p_original_transaction_id, p_evidence_source,
          p_signed_sha256, p_apple_signed_date, p_revocation_date, p_revocation_reason,
          p_revocation_type, p_revocation_percentage, p_product_id)
  on conflict (environment, apple_transaction_id, evidence_source, signed_transaction_sha256)
    do nothing
  returning id into v_id;

  if v_id is not null then
    v_inserted := true; v_status := 'OBSERVED';
  else
    select id, processing_status into v_id, v_status
      from public.karaoke_apple_financial_reconciliation_evidence
     where environment = p_environment and apple_transaction_id = p_transaction_id
       and evidence_source = p_evidence_source and signed_transaction_sha256 = p_signed_sha256;
    if v_id is null then
      return jsonb_build_object('ok', false, 'error', 'evidence_unreadable');
    end if;
  end if;

  -- Same shape as the notification recorder: APPLIED and NO_ACTION are finished; OBSERVED and
  -- FAILED are unfinished and must be picked back up.
  return jsonb_build_object('ok', true, 'evidenceId', v_id, 'inserted', v_inserted,
    'processingStatus', v_status,
    'shouldProcess', v_status not in ('APPLIED','NO_ACTION'));
end;
$$;
revoke all on function public.karaoke_record_reconciliation_evidence(
  text,text,text,text,text,timestamptz,timestamptz,text,text,integer,text) from public, anon, authenticated;
grant execute on function public.karaoke_record_reconciliation_evidence(
  text,text,text,text,text,timestamptz,timestamptz,text,text,integer,text) to service_role;

create or replace function public.karaoke_mark_reconciliation_evidence(
  p_evidence_id uuid, p_status text, p_detail text
) returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if p_status not in ('OBSERVED','APPLIED','NO_ACTION','FAILED') then
    return jsonb_build_object('ok', false, 'error', 'invalid_status');
  end if;
  update public.karaoke_apple_financial_reconciliation_evidence
     set processing_status = p_status, processing_detail = p_detail, processed_at = now()
   where id = p_evidence_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'evidence_not_found'); end if;
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.karaoke_mark_reconciliation_evidence(uuid,text,text) from public, anon, authenticated;
grant execute on function public.karaoke_mark_reconciliation_evidence(uuid,text,text) to service_role;

-- ── C. TRUTHFUL PROVENANCE ON THE LEDGER AND THE GRANT ──
--
-- `refund_notification_uuid` and `reversal_notification_uuid` keep meaning REAL NOTIFICATIONS.
-- An evidence id lives in its own column, so no field name has to lie about where a mutation
-- came from.
alter table public.karaoke_apple_purchases
  add column if not exists refund_reconciliation_evidence_id uuid
    references public.karaoke_apple_financial_reconciliation_evidence(id),
  add column if not exists reversal_reconciliation_evidence_id uuid
    references public.karaoke_apple_financial_reconciliation_evidence(id);

alter table public.timed_access_pass_grants
  add column if not exists reversal_reconciliation_evidence_id uuid
    references public.karaoke_apple_financial_reconciliation_evidence(id);

-- An APPLIED financial event must be able to say where it came from -- one source, never none.
alter table public.karaoke_apple_purchases
  drop constraint if exists karaoke_apple_purchases_refund_provenance_chk;
alter table public.karaoke_apple_purchases
  add constraint karaoke_apple_purchases_refund_provenance_chk
  check (revoked_at is null
         or refund_notification_uuid is not null
         or refund_reconciliation_evidence_id is not null);

-- ── D. ONE COMPENSATION PER PURCHASE, WHATEVER DISCOVERED IT ──
--
-- `timed_pass_reversal_once_idx` is UNIQUE on reversal_notification_uuid WHERE NOT NULL, so it
-- protects nothing for a reconciliation-sourced reversal, whose notification uuid is NULL. It is
-- NOT weakened; a purchase-level index is added beside it, which is the stronger statement and is
-- independent of how the reversal was discovered.
create unique index if not exists timed_pass_reversal_purchase_once_idx
  on public.timed_access_pass_grants (reversal_of_purchase_id)
  where reversal_of_purchase_id is not null;

-- ── E. THE CANONICAL RPCs GAIN A SECOND PROVENANCE SOURCE ──
--
-- The VALUATION IS UNTOUCHED. Every R4G-R2A invariant -- base-only denial, integer floor, foreign
-- carryover survival, denied <= D, one REFUND_REMAINDER, exact reversal -- comes along unchanged,
-- because this is the same function with one more way to say who asked.
--
-- HARD XOR: a new mutation carries exactly one provenance source. Both would be a lie about
-- origin; neither would be an unattributable financial write.
drop function if exists public.apply_apple_purchase_refund(text, text, timestamptz, text, text, text, integer);

create or replace function public.apply_apple_purchase_refund(
  p_environment text,
  p_transaction_id text,
  p_revocation_date timestamptz,
  p_revocation_reason text,
  p_notification_uuid text default null,
  p_revocation_type text default null,
  p_revocation_percentage integer default null,
  p_reconciliation_evidence_id uuid default null
) returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_p        public.karaoke_apple_purchases%rowtype;
  v_g        public.timed_access_pass_grants%rowtype;
  v_now      timestamptz;
  v_reason   text := coalesce(nullif(btrim(coalesce(p_revocation_reason, '')), ''), 'apple_refund');
  v_type     text := nullif(btrim(coalesce(p_revocation_type, '')), '');
  v_pct      integer := p_revocation_percentage;
  v_nuid     text := nullif(btrim(coalesce(p_notification_uuid, '')), '');
  v_key      text;
  v_kind     text;
  v_elapsed  bigint := 0;
  v_nominal  bigint := 0;
  v_base_rem bigint := 0;
  v_carry_rem bigint := 0;
  v_denied   int := 0;
  v_surv     bigint := 0;
  v_to       text;
  v_rem      uuid;
begin
  -- E0. PROVENANCE XOR.
  if (v_nuid is not null) = (p_reconciliation_evidence_id is not null) then
    return jsonb_build_object('ok', false, 'error', 'provenance_required',
      'detail', 'exactly one of notification_uuid or reconciliation_evidence_id');
  end if;
  v_key := coalesce(v_nuid, 'evidence:' || p_reconciliation_evidence_id::text);

  -- E1. CLASSIFY BEFORE ANYTHING ELSE. Malformed evidence is NEVER widened into a full refund.
  if v_type is null then
    if v_pct is null then
      v_kind := 'FULL';                                  -- the legacy shape, unchanged
    else
      return jsonb_build_object('ok', false, 'error', 'unsupported_revocation_type');
    end if;
  elsif v_type = 'REFUND_FULL' then
    if v_pct is null or v_pct = 100000 then
      v_kind := 'FULL';
    else
      return jsonb_build_object('ok', false, 'error', 'full_percentage_mismatch');
    end if;
  elsif v_type = 'REFUND_PRORATED' then
    if v_pct is null then
      return jsonb_build_object('ok', false, 'error', 'prorated_percentage_missing');
    elsif v_pct <= 0 or v_pct >= 100000 then
      return jsonb_build_object('ok', false, 'error', 'prorated_percentage_out_of_range');
    end if;
    v_kind := 'PRORATED';
  else
    return jsonb_build_object('ok', false, 'error', 'unsupported_revocation_type');
  end if;

  select * into v_p from public.karaoke_apple_purchases
   where environment = p_environment and apple_transaction_id = p_transaction_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'purchase_not_found');
  end if;

  perform pg_advisory_xact_lock(public.karaoke_account_lock_key(v_p.account_id));
  perform pg_advisory_xact_lock(hashtext('timed_pass:' || v_p.account_id::text));

  select * into v_p from public.karaoke_apple_purchases where id = v_p.id for update;
  v_now := clock_timestamp();

  -- E2. REPLAY, AND THE CONFLICT IT MUST NOT HIDE. A refund rediscovered by reconciliation after
  -- a notification already applied it is a REPLAY, not a second refund -- which is exactly why
  -- the comparison is on the EVIDENCE, never on which door it came through.
  if v_p.revoked_at is not null then
    if coalesce(v_p.refund_kind, 'FULL') is distinct from v_kind
       or (v_kind = 'PRORATED'
           and coalesce(v_p.refund_revocation_percentage, -1) is distinct from coalesce(v_pct, -1)) then
      return jsonb_build_object('ok', false, 'error', 'refund_evidence_conflict',
        'storedKind', coalesce(v_p.refund_kind, 'FULL'),
        'storedPercentage', v_p.refund_revocation_percentage,
        'incomingKind', v_kind, 'incomingPercentage', v_pct);
    end if;
    return jsonb_build_object('ok', true, 'replayed', true, 'purchaseId', v_p.id,
      'grantId', v_p.pass_grant_id, 'deniedSeconds', v_p.refund_denied_seconds,
      'refundKind', coalesce(v_p.refund_kind, 'FULL'),
      'remainderGrantId', (select id from public.timed_access_pass_grants
                            where remainder_of_purchase_id = v_p.id));
  end if;

  if v_p.pass_grant_id is not null then
    select * into v_g from public.timed_access_pass_grants where id = v_p.pass_grant_id for update;
  end if;

  -- E3. BASE-FIRST ACCOUNTING, unchanged from R4G-R2A-R1.
  if v_p.pass_grant_id is null then
    v_to := null;
  elsif v_g.status = 'REVOKED' then
    v_to := 'REVOKED';
  elsif v_g.status = 'EXPIRED' then
    v_to := 'EXPIRED';
  elsif v_g.status = 'ACTIVE' then
    v_elapsed := greatest(0, floor(extract(epoch from (v_now - v_g.activated_at)))::bigint);
    v_base_rem  := greatest(0, coalesce(v_g.duration_seconds, 0)::bigint - v_elapsed);
    v_carry_rem := greatest(0, coalesce(v_g.carryover_seconds, 0)::bigint
                               - greatest(0, v_elapsed - coalesce(v_g.duration_seconds, 0)::bigint));
    if v_g.expires_at <= v_now then
      if p_revocation_date is not null and p_revocation_date < v_g.expires_at then
        v_to := 'REVOKED';
      else
        v_to := 'EXPIRED';
      end if;
    else
      v_to := 'REVOKED';
    end if;
  elsif v_g.status = 'AVAILABLE' then
    v_base_rem := coalesce(v_g.duration_seconds, 0)::bigint;
    v_carry_rem := 0;
    v_to := 'REVOKED';
  else
    v_base_rem := coalesce(v_g.duration_seconds, 0)::bigint;
    v_carry_rem := coalesce(v_g.carryover_seconds, 0)::bigint;
    v_to := 'REVOKED';
  end if;

  if v_kind = 'FULL' then
    v_nominal := coalesce(v_g.duration_seconds, 0)::bigint;
  else
    v_nominal := (coalesce(v_g.duration_seconds, 0)::bigint * v_pct::bigint) / 100000;
  end if;

  v_denied := least(v_nominal, v_base_rem)::int;
  v_surv   := (v_base_rem - v_denied) + v_carry_rem;

  if v_to = 'REVOKED' and v_g.id is not null and v_g.status <> 'REVOKED' then
    update public.timed_access_pass_grants
       set status = 'REVOKED', revoked_at = v_now, revoke_reason = 'apple_refund',
           selected_at = case when status = 'SELECTED' then null else selected_at end,
           updated_at = now()
     where id = v_g.id;
    insert into public.timed_access_pass_audit
      (pass_grant_id, account_id, actor_type, actor_ref, action, from_status, to_status,
       idempotency_key, reason, metadata)
    values (v_g.id, v_g.account_id, 'SYSTEM',
            case when v_nuid is not null then 'apple_server_notification'
                 else 'apple_financial_reconciliation' end,
            'REVOKED', v_g.status, 'REVOKED', v_key, 'apple_refund',
            jsonb_build_object('deniedSeconds', v_denied, 'revocationDate', p_revocation_date,
                               'appleReason', v_reason, 'purchaseId', v_p.id,
                               'refundKind', v_kind, 'revocationType', v_type,
                               'revocationPercentage', v_pct,
                               'nominalRefundedSeconds', v_nominal,
                               'baseRemainingSeconds', v_base_rem,
                               'carryRemainingSeconds', v_carry_rem,
                               'survivingFutureSeconds', v_surv,
                               'provenanceSource',
                                 case when v_nuid is not null then 'SERVER_NOTIFICATION'
                                      else 'FINANCIAL_RECONCILIATION' end,
                               'reconciliationEvidenceId', p_reconciliation_evidence_id));
  elsif v_to = 'EXPIRED' and v_g.id is not null and v_g.status = 'ACTIVE' then
    update public.timed_access_pass_grants
       set status = 'EXPIRED', expired_at = v_now, updated_at = now()
     where id = v_g.id and status = 'ACTIVE';
    insert into public.timed_access_pass_audit
      (pass_grant_id, account_id, actor_type, action, from_status, to_status)
    values (v_g.id, v_g.account_id, 'SYSTEM', 'EXPIRED', 'ACTIVE', 'EXPIRED');
  end if;

  if v_surv > 0 and v_g.id is not null then
    insert into public.timed_access_pass_grants
      (account_id, pass_type, duration_seconds, carryover_seconds, status, source_type, is_paid,
       issue_reason, issue_idempotency_key, remainder_of_purchase_id)
    values (v_g.account_id, 'REFUND_REMAINDER', v_surv::int, 0, 'AVAILABLE',
            'REFUND_REMAINDER', false, 'apple_refund_remainder',
            'remainder:' || v_p.id::text, v_p.id)
    on conflict (remainder_of_purchase_id) where remainder_of_purchase_id is not null
      do nothing
    returning id into v_rem;

    if v_rem is not null then
      insert into public.timed_access_pass_audit
        (pass_grant_id, account_id, actor_type, actor_ref, action, from_status, to_status,
         idempotency_key, reason, metadata)
      values (v_rem, v_g.account_id, 'SYSTEM',
              case when v_nuid is not null then 'apple_server_notification'
                   else 'apple_financial_reconciliation' end,
              'ISSUED', null, 'AVAILABLE', v_key, 'apple_refund_remainder',
              jsonb_build_object('version', 1,
                                 'source', case when v_nuid is not null
                                                then 'APPLE_SERVER_NOTIFICATION'
                                                else 'APPLE_FINANCIAL_RECONCILIATION' end,
                                 'actor_kind', 'SYSTEM', 'actor_id', v_key,
                                 'refundKind', v_kind, 'revocationPercentage', v_pct,
                                 'survivingFutureSeconds', v_surv,
                                 'baseSurvivingSeconds', v_base_rem - v_denied,
                                 'carrySurvivingSeconds', v_carry_rem,
                                 'refundedPurchaseId', v_p.id,
                                 'originalGrantId', v_g.id));
    end if;
  end if;

  update public.karaoke_apple_purchases
     set verification_status  = 'REVOKED',
         revoked_at           = coalesce(p_revocation_date, v_now),
         refunded_at          = coalesce(p_revocation_date, v_now),
         revocation_reason    = v_reason,
         refund_notification_uuid = v_nuid,
         refund_reconciliation_evidence_id = p_reconciliation_evidence_id,
         refund_denied_seconds    = v_denied,
         refund_revocation_type       = v_type,
         refund_revocation_percentage = v_pct,
         refund_kind                  = v_kind,
         grant_status = case when pass_grant_id is null then grant_status else 'GRANT_REVOKED' end,
         updated_at = now()
   where id = v_p.id;

  return jsonb_build_object('ok', true, 'replayed', false, 'purchaseId', v_p.id,
    'grantId', v_p.pass_grant_id, 'grantStatus', v_to, 'deniedSeconds', v_denied,
    'refundKind', v_kind, 'revocationPercentage', v_pct,
    'nominalRefundedSeconds', v_nominal, 'baseRemainingSeconds', v_base_rem,
    'carryRemainingSeconds', v_carry_rem, 'survivingFutureSeconds', v_surv,
    'remainderGrantId', v_rem);
end;
$$;
revoke all on function public.apply_apple_purchase_refund(text,text,timestamptz,text,text,text,integer,uuid)
  from public, anon, authenticated;
grant execute on function public.apply_apple_purchase_refund(text,text,timestamptz,text,text,text,integer,uuid)
  to service_role;

-- ── F. THE REVERSAL GAINS THE SAME SECOND SOURCE ──
--
-- The compensation arithmetic is UNTOUCHED: it still restores exactly `refund_denied_seconds`,
-- the frozen figure, as one REFUND_CREDIT.
drop function if exists public.apply_apple_refund_reversal(text, text, text);

create or replace function public.apply_apple_refund_reversal(
  p_environment text,
  p_transaction_id text,
  p_notification_uuid text default null,
  p_reconciliation_evidence_id uuid default null
) returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_p       public.karaoke_apple_purchases%rowtype;
  v_now     timestamptz;
  v_new     uuid;
  v_denied  int;
  v_nuid    text := nullif(btrim(coalesce(p_notification_uuid, '')), '');
  v_key     text;
begin
  if (v_nuid is not null) = (p_reconciliation_evidence_id is not null) then
    return jsonb_build_object('ok', false, 'error', 'provenance_required',
      'detail', 'exactly one of notification_uuid or reconciliation_evidence_id');
  end if;
  v_key := coalesce(v_nuid, 'evidence:' || p_reconciliation_evidence_id::text);

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
    return jsonb_build_object('ok', false, 'error', 'purchase_not_refunded');
  end if;

  -- PURCHASE-LEVEL replay first, so a reversal already applied through the OTHER door is a
  -- no-op rather than a second compensation.
  if v_p.refund_reversed_at is not null then
    return jsonb_build_object('ok', true, 'replayed', true,
      'compensationGrantId', (select id from public.timed_access_pass_grants
                               where reversal_of_purchase_id = v_p.id),
      'detail', 'already_reversed');
  end if;
  select id into v_new from public.timed_access_pass_grants
   where reversal_of_purchase_id = v_p.id;
  if v_new is not null then
    return jsonb_build_object('ok', true, 'replayed', true, 'compensationGrantId', v_new);
  end if;

  v_denied := coalesce(v_p.refund_denied_seconds, 0);
  if v_denied < 0 or v_denied > 86400 then
    return jsonb_build_object('ok', false, 'error', 'denied_seconds_out_of_range',
                              'deniedSeconds', v_denied);
  end if;

  if v_denied > 0 then
    insert into public.timed_access_pass_grants
      (account_id, pass_type, duration_seconds, status, source_type, is_paid,
       issue_reason, issue_idempotency_key, reversal_of_purchase_id,
       reversal_notification_uuid, reversal_reconciliation_evidence_id)
    values (v_p.account_id, 'REFUND_CREDIT', v_denied, 'AVAILABLE',
            'REFUND_REVERSAL', false, 'apple_refund_reversed',
            'reversal:' || v_key, v_p.id, v_nuid, p_reconciliation_evidence_id)
    returning id into v_new;

    insert into public.timed_access_pass_audit
      (pass_grant_id, account_id, actor_type, actor_ref, action, from_status, to_status,
       idempotency_key, reason, metadata)
    values (v_new, v_p.account_id, 'SYSTEM',
            case when v_nuid is not null then 'apple_server_notification'
                 else 'apple_financial_reconciliation' end,
            'ISSUED', null, 'AVAILABLE', v_key, 'apple_refund_reversed',
            jsonb_build_object('version', 1,
                               'source', case when v_nuid is not null
                                              then 'APPLE_SERVER_NOTIFICATION'
                                              else 'APPLE_FINANCIAL_RECONCILIATION' end,
                               'actor_kind', 'SYSTEM', 'actor_id', v_key,
                               'restoredSeconds', v_denied, 'reversalOfPurchaseId', v_p.id,
                               'originalGrantId', v_p.pass_grant_id,
                               'reconciliationEvidenceId', p_reconciliation_evidence_id));
  end if;

  update public.karaoke_apple_purchases
     set refund_reversed_at = v_now,
         reversal_notification_uuid = v_nuid,
         reversal_reconciliation_evidence_id = p_reconciliation_evidence_id,
         updated_at = now()
   where id = v_p.id;

  return jsonb_build_object('ok', true, 'replayed', false, 'compensationGrantId', v_new,
    'restoredSeconds', v_denied, 'passType', 'REFUND_CREDIT', 'originalGrantUntouched', true);
end;
$$;
revoke all on function public.apply_apple_refund_reversal(text,text,text,uuid) from public, anon, authenticated;
grant execute on function public.apply_apple_refund_reversal(text,text,text,uuid) to service_role;
