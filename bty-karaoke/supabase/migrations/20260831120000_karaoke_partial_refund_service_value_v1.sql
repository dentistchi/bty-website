-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- ============================================================================
-- BUILD 26U-R4G-R2A-R1 · PARTIAL REFUND + CARRYOVER-SAFE SERVICE VALUE.
-- Sorts after 20260830120000_karaoke_notification_status_aware_retry_v1.sql.
-- ADDITIVE + IDEMPOTENT. No product arm weakened, no row rewritten, nothing deleted.
--
-- TWO DEFECTS, BOTH MEASURED AGAINST PRODUCTION MIGRATIONS BY R4G-R2A-R0:
--
--   1. The refund denied `duration_seconds + carryover_seconds`. Carryover is written ONLY by
--      `switch_timed_access_pass`, out of a DIFFERENT grant's residual -- measured at 86399
--      seconds belonging to a different Apple purchase. Refunding a 1-hour purchase therefore
--      confiscated 89999 seconds, 86399 of which that purchase never sold.
--
--   2. That 89999 exceeded REFUND_CREDIT's 1..86400 bound, so a later REFUND_REVERSED failed
--      closed with `denied_seconds_out_of_range` and issued NOTHING. A customer could be
--      over-revoked and then, on reversal, compensated zero.
--
-- Capping the denial at the purchase's own remaining base closes both at once: denied <= D,
-- and D <= 86400 for every product in the catalog.
--
-- AND APPLE'S CONTRACT IS WIDER THAN THIS BUILD ASSUMED. `revocationType` may be REFUND_FULL,
-- REFUND_PRORATED or FAMILY_REVOKE, and a prorated refund carries `revocationPercentage` in
-- milliunits. Every REFUND was being treated as 100%.
-- ============================================================================

-- ── A. THE GRANT VOCABULARY GAINS ONE NON-PRODUCT TYPE ──
--
-- REFUND_REMAINDER is the service that was NEVER refunded: the future Room Time surviving a
-- financial event. It is not REFUND_CREDIT, which is service RESTORED after a refund was
-- reversed. Those are different truths about different events and must not share a name.
alter table public.timed_access_pass_grants
  drop constraint if exists timed_access_pass_grants_pass_type_check;
alter table public.timed_access_pass_grants
  add constraint timed_access_pass_grants_pass_type_check
  check (pass_type in ('ONE_HOUR','FOUR_HOURS','TWENTY_FOUR_HOURS','REFUND_CREDIT','REFUND_REMAINDER'));

alter table public.timed_access_pass_grants
  drop constraint if exists timed_pass_source_type_chk;
alter table public.timed_access_pass_grants
  add constraint timed_pass_source_type_chk
  check (source_type in ('PAID','WELCOME','REFERRAL','MANUAL_PROMOTIONAL','REFUND_REVERSAL','REFUND_REMAINDER'));

-- ── B. THE DURATION RULE ──
--
-- The three product arms are UNCHANGED and REFUND_CREDIT keeps 1..86400, which the new denial
-- cap makes permanently satisfiable.
--
-- REFUND_REMAINDER IS DELIBERATELY NOT CAPPED AT 86400. Surviving service is
-- (base_remaining - denied) + carry_remaining, and carryover has no upper bound in this schema:
-- production already carries 14405 seconds, above a whole FOUR_HOURS product, and a 1-milliunit
-- refund of a 24-hour grant carrying 86399 leaves 172799. A product-shaped cap would fail closed
-- on service the customer legitimately owns. The remainder is not a product; its duration can
-- only ever equal a window `timed_pass_expiry_math_chk` already permits.
alter table public.timed_access_pass_grants
  drop constraint if exists timed_pass_duration_matches_type;
alter table public.timed_access_pass_grants
  add constraint timed_pass_duration_matches_type check (
    (pass_type = 'ONE_HOUR'          and duration_seconds = 3600)
    or (pass_type = 'FOUR_HOURS'        and duration_seconds = 14400)
    or (pass_type = 'TWENTY_FOUR_HOURS' and duration_seconds = 86400)
    or (pass_type = 'REFUND_CREDIT'     and duration_seconds between 1 and 86400)
    or (pass_type = 'REFUND_REMAINDER'  and duration_seconds >= 1)
  );

-- ── C. PROVENANCE ──
--
-- A direct link to the purchase whose refund produced it. The purchase already identifies the
-- original grant, so nothing is duplicated.
alter table public.timed_access_pass_grants
  add column if not exists remainder_of_purchase_id uuid references public.karaoke_apple_purchases(id);

-- ONE refunded purchase -> AT MOST ONE remainder, decided by the database rather than by a
-- read-before-write in a caller. This is the same shape as timed_pass_reversal_once_idx.
create unique index if not exists timed_pass_remainder_once_idx
  on public.timed_access_pass_grants (remainder_of_purchase_id)
  where remainder_of_purchase_id is not null;

-- ── D. VERIFIED APPLE REFUND EVIDENCE ON THE LEDGER ──
--
-- The RAW Apple fields are stored as Apple sent them -- null when Apple sent nothing, because
-- fabricating a claim Apple did not make would make the audit lie. `refund_kind` is the DERIVED
-- classification, and it is what a replay is compared against: the legacy shape (both null) and
-- an explicit REFUND_FULL/100000 are the same refund, and must not read as a conflict.
alter table public.karaoke_apple_purchases
  add column if not exists refund_revocation_type text,
  add column if not exists refund_revocation_percentage integer,
  add column if not exists refund_kind text;

alter table public.karaoke_apple_purchases
  drop constraint if exists karaoke_apple_purchases_refund_kind_chk;
alter table public.karaoke_apple_purchases
  add constraint karaoke_apple_purchases_refund_kind_chk
  check (refund_kind is null or refund_kind in ('FULL','PRORATED'));

alter table public.karaoke_apple_purchases
  drop constraint if exists karaoke_apple_purchases_refund_pct_chk;
alter table public.karaoke_apple_purchases
  add constraint karaoke_apple_purchases_refund_pct_chk
  check (refund_revocation_percentage is null
         or (refund_revocation_percentage >= 0 and refund_revocation_percentage <= 100000));

-- ── E. THE REFUND, RE-VALUED ──
--
-- The 5-argument definition is DROPPED rather than left beside a wider one: two overloads would
-- make a 5-argument call ambiguous, and an ambiguous financial writer is worse than a missing
-- one. The new arguments DEFAULT to the legacy shape, so a caller that has not been redeployed
-- yet still resolves -- and under R4G-R1 a failure in that window is a 503 that Apple retries,
-- not a lost refund.
drop function if exists public.apply_apple_purchase_refund(text, text, timestamptz, text, text);

create or replace function public.apply_apple_purchase_refund(
  p_environment text,
  p_transaction_id text,
  p_revocation_date timestamptz,
  p_revocation_reason text,
  p_notification_uuid text,
  p_revocation_type text default null,
  p_revocation_percentage integer default null
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
  -- ── E1. CLASSIFY BEFORE ANYTHING ELSE ──
  --
  -- The handler's domain module classifies too. This is a DEFENSIVE re-validation, not a second
  -- opinion: the two agree by construction, and if a future caller ever reaches this function
  -- directly it still cannot express a refund shape nobody has defined.
  --
  -- Malformed evidence is NEVER widened into a full refund. Taking a customer's whole hour
  -- because a field could not be read is the one outcome this build exists to prevent.
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
    -- FAMILY_REVOKE is a Family Sharing removal, not a refund of this purchase, and an unknown
    -- future type is evidence we cannot read. Both are refused rather than guessed.
    return jsonb_build_object('ok', false, 'error', 'unsupported_revocation_type');
  end if;

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

  -- ── E2. REPLAY, AND THE CONFLICT IT MUST NOT HIDE ──
  --
  -- The same refund arriving twice is a no-op that reports the first outcome. But MATERIALLY
  -- DIFFERENT verified evidence for the same purchase is not a replay -- a 40% refund followed
  -- by a 70% one would silently keep the 40% figure and look successful. There is no cumulative
  -- refund contract in this build, so it is refused and left recoverable instead of guessed.
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

  -- ── E3. WHAT IS STILL AHEAD, AND WHAT APPLE'S SHARE IS WORTH ──
  --
  -- BASE-FIRST ACCOUNTING. The ACTIVE window is one undivided interval as far as entitlement is
  -- concerned -- `expires_at = activated_at + (duration + carryover)` -- and nothing in this
  -- schema expresses a consumption order. This order is therefore a REFUND-VALUATION rule and
  -- nothing else: purchased seconds are treated as consumed FIRST, which maximises the foreign
  -- carryover that survives, and is the reading most favourable to the customer.
  if v_p.pass_grant_id is null then
    v_to := null;                                       -- verified but never fulfilled
  elsif v_g.status = 'REVOKED' then
    v_to := 'REVOKED';
  elsif v_g.status = 'EXPIRED' then
    -- The service was fully delivered before the money came back. EXPIRED is the honest
    -- lifecycle terminus and is NOT rewritten for financial labelling.
    v_to := 'EXPIRED';
  elsif v_g.status = 'ACTIVE' then
    v_elapsed := greatest(0, floor(extract(epoch from (v_now - v_g.activated_at)))::bigint);
    v_base_rem  := greatest(0, coalesce(v_g.duration_seconds, 0)::bigint - v_elapsed);
    v_carry_rem := greatest(0, coalesce(v_g.carryover_seconds, 0)::bigint
                               - greatest(0, v_elapsed - coalesce(v_g.duration_seconds, 0)::bigint));
    if v_g.expires_at <= v_now then
      -- Stale ACTIVE. Which cause terminated it first decides the terminal state; either way no
      -- future service is left, so nothing is denied.
      if p_revocation_date is not null and p_revocation_date < v_g.expires_at then
        v_to := 'REVOKED';
      else
        v_to := 'EXPIRED';
      end if;
    else
      -- The security case: a live paid grant loses entitlement at COMMIT.
      v_to := 'REVOKED';
    end if;
  elsif v_g.status = 'AVAILABLE' then
    -- `timed_pass_available_no_carry_chk` guarantees carryover is 0 here.
    v_base_rem := coalesce(v_g.duration_seconds, 0)::bigint;
    v_carry_rem := 0;
    v_to := 'REVOKED';
  else  -- SELECTED
    v_base_rem := coalesce(v_g.duration_seconds, 0)::bigint;
    v_carry_rem := coalesce(v_g.carryover_seconds, 0)::bigint;
    v_to := 'REVOKED';
  end if;

  -- Integer arithmetic throughout. bigint keeps 86400 * 100000 exact, and `/` on bigint is a
  -- floor for non-negative operands -- deliberately floor, never ceil: BTY must not remove more
  -- Room Time than Apple's percentage represents.
  if v_kind = 'FULL' then
    v_nominal := coalesce(v_g.duration_seconds, 0)::bigint;
  else
    v_nominal := (coalesce(v_g.duration_seconds, 0)::bigint * v_pct::bigint) / 100000;
  end if;

  -- THE CAP THAT CLOSES BOTH DEFECTS. Apple's share can be worth more than the purchase has
  -- left; BTY can only remove what is still ahead, and only out of what the purchase sold.
  v_denied := least(v_nominal, v_base_rem)::int;
  v_surv   := (v_base_rem - v_denied) + v_carry_rem;

  -- ── E4. THE GRANT WRITE ──
  if v_to = 'REVOKED' and v_g.id is not null and v_g.status <> 'REVOKED' then
    update public.timed_access_pass_grants
       set status = 'REVOKED',
           revoked_at = v_now,
           revoke_reason = 'apple_refund',              -- NEVER 'switched_pass'
           selected_at = case when status = 'SELECTED' then null else selected_at end,
           -- activated_at, expires_at and duration_seconds are PRESERVED: they are history.
           -- The product grant is never shortened into an arbitrary duration.
           updated_at = now()
     where id = v_g.id;
    insert into public.timed_access_pass_audit
      (pass_grant_id, account_id, actor_type, actor_ref, action, from_status, to_status,
       idempotency_key, reason, metadata)
    values (v_g.id, v_g.account_id, 'SYSTEM', 'apple_server_notification', 'REVOKED',
            v_g.status, 'REVOKED', p_notification_uuid, 'apple_refund',
            jsonb_build_object('deniedSeconds', v_denied, 'revocationDate', p_revocation_date,
                               'appleReason', v_reason, 'purchaseId', v_p.id,
                               'refundKind', v_kind, 'revocationType', v_type,
                               'revocationPercentage', v_pct,
                               'nominalRefundedSeconds', v_nominal,
                               'baseRemainingSeconds', v_base_rem,
                               'carryRemainingSeconds', v_carry_rem,
                               'survivingFutureSeconds', v_surv));
  elsif v_to = 'EXPIRED' and v_g.id is not null and v_g.status = 'ACTIVE' then
    update public.timed_access_pass_grants
       set status = 'EXPIRED', expired_at = v_now, updated_at = now()
     where id = v_g.id and status = 'ACTIVE';
    insert into public.timed_access_pass_audit
      (pass_grant_id, account_id, actor_type, action, from_status, to_status)
    values (v_g.id, v_g.account_id, 'SYSTEM', 'EXPIRED', 'ACTIVE', 'EXPIRED');
  end if;

  -- ── E5. THE SURVIVING SERVICE ──
  --
  -- Exactly one non-product grant carrying exactly the future Room Time that outlived the
  -- financial event. It is NOT a purchase: unpaid, no Apple purchase id, and the catalog cannot
  -- express its type. Nothing selects or activates it -- the customer chooses, exactly as R4D
  -- requires, and the ordinary AVAILABLE -> SELECTED -> ACTIVE -> EXPIRED path applies unchanged.
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
      values (v_rem, v_g.account_id, 'SYSTEM', 'apple_server_notification', 'ISSUED', null,
              'AVAILABLE', p_notification_uuid, 'apple_refund_remainder',
              jsonb_build_object('version', 1, 'source', 'APPLE_SERVER_NOTIFICATION',
                                 'actor_kind', 'SYSTEM', 'actor_id', p_notification_uuid,
                                 'refundKind', v_kind, 'revocationPercentage', v_pct,
                                 'survivingFutureSeconds', v_surv,
                                 'baseSurvivingSeconds', v_base_rem - v_denied,
                                 'carrySurvivingSeconds', v_carry_rem,
                                 'refundedPurchaseId', v_p.id,
                                 'originalGrantId', v_g.id));
    end if;
  end if;

  -- ── E6. THE LEDGER ──
  --
  -- `refund_denied_seconds` keeps its exact meaning: the future Room Time BTY ACTUALLY removed,
  -- never the nominal financial figure. That is what R4E-R4's reversal restores, and why a
  -- reversal gives back 600 rather than 1440 when only 600 seconds were still ahead.
  update public.karaoke_apple_purchases
     set verification_status  = 'REVOKED',
         revoked_at           = coalesce(p_revocation_date, v_now),
         refunded_at          = coalesce(p_revocation_date, v_now),
         revocation_reason    = v_reason,
         refund_notification_uuid = p_notification_uuid,
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

revoke all on function public.apply_apple_purchase_refund(text, text, timestamptz, text, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.apply_apple_purchase_refund(text, text, timestamptz, text, text, text, integer)
  to service_role;

-- ── F. CONTAINMENT ──
--
-- The CATALOG constraint is deliberately NOT touched: REFUND_REMAINDER cannot be expressed as a
-- purchasable product at all, and neither can REFUND_CREDIT. Normal issuance still refuses both,
-- because `issue_timed_access_pass` validates against its own fixed product list -- leaving
-- `apply_apple_purchase_refund` as the only writer of a remainder in production.
--
-- `apply_apple_refund_reversal` is UNCHANGED. It restores `refund_denied_seconds`, which the new
-- cap keeps inside REFUND_CREDIT's 1..86400 for every possible refund.
