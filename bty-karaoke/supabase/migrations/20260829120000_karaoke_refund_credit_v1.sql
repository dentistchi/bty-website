-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- ============================================================================
-- BUILD 26U-R4E-R4-R1 · EXACT PARTIAL REFUND-REVERSAL CREDIT.
--
-- THE DEFECT THIS CLOSES, measured in R4E-R3-R1. `timed_pass_duration_matches_type` pins
-- duration to product type: ONE_HOUR is exactly 3600. Reversal compensation restores
-- `refund_denied_seconds`, which for an ACTIVE refund is the REMAINING window -- 3599 in the
-- harness -- so the insert was refused. R4E-R1's reversal gate had passed only because it
-- refunded an AVAILABLE grant, where the denied value happens to be a whole product duration.
-- Compensation therefore worked for a full refund and was IMPOSSIBLE for a partial one, which is
-- the common case.
--
-- WHY A NEW TYPE RATHER THAN A LOOSER ONE. Rounding up restores more than was removed; rounding
-- down keeps money that was returned; relabelling 3599 seconds as ONE_HOUR makes storage lie
-- about what a product is. A refund credit is genuinely not a product -- it is an exact quantity
-- of restored service time -- so it gets its own type and its own duration rule, and the three
-- product types keep their exact invariants untouched.
--
-- THE BOUNDARY IS STRUCTURAL. REFUND_CREDIT is added to the GRANT vocabulary only. The catalog's
-- own CHECK is deliberately NOT touched, so a credit cannot be expressed as a purchasable
-- product: not sellable, not in ASC, not reachable by product.purchase. That is enforced by the
-- schema rather than promised by a comment.
-- ============================================================================

-- ── A. THE GRANT VOCABULARY GAINS ONE VALUE ──
alter table public.timed_access_pass_grants
  drop constraint if exists timed_access_pass_grants_pass_type_check;
alter table public.timed_access_pass_grants
  add constraint timed_access_pass_grants_pass_type_check
  check (pass_type in ('ONE_HOUR', 'FOUR_HOURS', 'TWENTY_FOUR_HOURS', 'REFUND_CREDIT'));

-- ── B. DURATION: product arms unchanged, one new arm for exact restoration ──
--
-- The upper bound is 86400 because that is the largest legitimate SOURCE duration in the live
-- catalog (PASS_24H) -- measured, not invented. Nothing can be refunded for more time than the
-- largest pass could ever have held, so a value above it is malformed and must fail closed
-- rather than be clamped.
alter table public.timed_access_pass_grants
  drop constraint if exists timed_pass_duration_matches_type;
alter table public.timed_access_pass_grants
  add constraint timed_pass_duration_matches_type check (
    (pass_type = 'ONE_HOUR'          and duration_seconds = 3600)
    or (pass_type = 'FOUR_HOURS'        and duration_seconds = 14400)
    or (pass_type = 'TWENTY_FOUR_HOURS' and duration_seconds = 86400)
    or (pass_type = 'REFUND_CREDIT'     and duration_seconds between 1 and 86400)
  );

-- ── C. THE REVERSAL WRITER ──
--
-- Two changes only: the compensation grant is typed REFUND_CREDIT instead of inheriting the
-- refunded product's type, and a denied value outside 1..86400 refuses instead of attempting an
-- insert the constraint would reject anyway. Everything else -- lock order, idempotency, the
-- frozen denied value, provenance, the 26O issuance floor -- is unchanged from R4E-R1.
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
    return jsonb_build_object('ok', false, 'error', 'purchase_not_refunded');
  end if;

  select id into v_new from public.timed_access_pass_grants
   where reversal_notification_uuid = p_notification_uuid;
  if v_new is not null then
    return jsonb_build_object('ok', true, 'replayed', true, 'compensationGrantId', v_new);
  end if;
  if v_p.refund_reversed_at is not null then
    return jsonb_build_object('ok', true, 'replayed', true,
      'compensationGrantId', null, 'detail', 'already_reversed');
  end if;

  -- THE FROZEN VALUE, never recomputed from a clock that has moved on since the refund.
  v_denied := coalesce(v_p.refund_denied_seconds, 0);

  -- Malformed input fails closed. It is NOT clamped: a denied value outside the representable
  -- range means the refund record is wrong, and quietly capping it would restore an amount
  -- nobody can justify from the evidence.
  if v_denied < 0 or v_denied > 86400 then
    return jsonb_build_object('ok', false, 'error', 'denied_seconds_out_of_range',
                              'deniedSeconds', v_denied);
  end if;

  if v_denied > 0 then
    -- REFUND_CREDIT even when the amount happens to equal a product duration: the type records
    -- PROVENANCE, and a coincidence of seconds does not make restored time a purchased product.
    insert into public.timed_access_pass_grants
      (account_id, pass_type, duration_seconds, status, source_type, is_paid,
       issue_reason, issue_idempotency_key, reversal_of_purchase_id, reversal_notification_uuid)
    values (v_p.account_id, 'REFUND_CREDIT', v_denied, 'AVAILABLE',
            'REFUND_REVERSAL', false, 'apple_refund_reversed',
            'reversal:' || p_notification_uuid, v_p.id, p_notification_uuid)
    returning id into v_new;

    insert into public.timed_access_pass_audit
      (pass_grant_id, account_id, actor_type, actor_ref, action, from_status, to_status,
       idempotency_key, reason, metadata)
    values (v_new, v_p.account_id, 'SYSTEM', 'apple_server_notification', 'ISSUED', null,
            'AVAILABLE', p_notification_uuid, 'apple_refund_reversed',
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
    'restoredSeconds', v_denied, 'passType', 'REFUND_CREDIT', 'originalGrantUntouched', true);
end; $$;
revoke all on function public.apply_apple_refund_reversal(text,text,text) from public, anon, authenticated;
grant execute on function public.apply_apple_refund_reversal(text,text,text) to service_role;

-- ── D. WHAT IS DELIBERATELY NOT TOUCHED ──
--
-- karaoke_product_catalog.pass_type keeps its three-value CHECK, so REFUND_CREDIT can never be a
-- purchasable product. issue_timed_access_pass keeps rejecting anything outside the three product
-- types, so the ordinary issuance path cannot mint one. apply_apple_refund_reversal is therefore
-- the single production writer. Entitlement, activation, expiry, selection and the audit
-- immutability trigger are all unchanged: a credit is an ordinary grant once issued.
