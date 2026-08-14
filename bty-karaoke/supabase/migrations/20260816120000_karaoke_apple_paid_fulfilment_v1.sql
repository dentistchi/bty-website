-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- btyNorebang — BUILD 26S-R1: ATOMIC APPLE PAID FULFILMENT V1 (Track B, Slice 4).
--
-- THE FIRST PAID ENTITLEMENT. BUILD 26P verified and durably RECORDED a genuine Apple
-- transaction and deliberately granted nothing. This migration adds the one operation that
-- turns such a record into entitlement: `fulfil_apple_purchase`. Isolated bty-karaoke Supabase
-- project (ref zycwaqignioawtqynopj). Additive + idempotent + forward-only. It adds NO column,
-- ALTERS NO table, activates NO product, and backfills NOTHING.
--
-- WHY A DATABASE FUNCTION AND NOT SERVER CODE. Fulfilment is an INSERT into
-- timed_access_pass_grants plus an UPDATE of karaoke_apple_purchases plus an INSERT into
-- timed_access_pass_audit. Through supabase-js those are three separate PostgREST requests and
-- therefore three separate transactions, so a crash between them could leave a purchase claiming
-- GRANTED with no grant, or a paid grant no purchase points at. BUILD 26S-R0 measured that gap;
-- this closes it. Every other pass mutation in this system is already an RPC for exactly this
-- reason (see 20260728120000 sections 4-6).
--
-- THE 1:1 INVARIANT (BUILD 18C #1): one verified Apple transaction <-> AT MOST ONE paid grant.
-- Three INDEPENDENT database objects each enforce it, and any one of them alone is sufficient:
--   * timed_pass_apple_purchase_idx        UNIQUE (apple_purchase_id) WHERE NOT NULL
--   * karaoke_apple_purchases_pass_grant_idx UNIQUE (pass_grant_id)   WHERE NOT NULL
--   * timed_pass_issue_idem_idx            UNIQUE (issue_idempotency_key)  -- global
-- The advisory lock below is ergonomics: it turns a race into a clean replay instead of a raw
-- 23505. The indexes are the authority. BUILD 26O-R1's lesson stands — a read cannot serialize
-- two concurrent callers, so nothing here relies on one.
--
-- SETTLEMENT DOES NOT READ is_active (BUILD 26S-R0 §8, Contract B, Founder-ratified).
-- `karaoke_product_catalog.is_active` authorizes ACCEPTANCE OF NEW paid transactions. It is not
-- a settlement gate, and this function never loads the column — the catalog read below names its
-- three needed fields explicitly rather than `select *`, so is_active cannot influence settlement
-- even by accident. The reason is the one already written into the verify route: Apple has
-- ALREADY charged the customer. Refusing to settle a durable VERIFIED purchase because our
-- product is switched off would convert a completed payment into a permanent loss, which is the
-- exact failure BUILD 26P's record-before-the-is_active-decision ordering exists to prevent.
-- Duration cannot be corrupted by this: it comes from the catalog's contract-pinned
-- duration_seconds (karaoke_product_catalog_duration_matches_type), which is independent of
-- is_active. The ACCEPTANCE gate in /api/host/purchases/apple/verify is untouched — BUILD 26L is
-- not weakened, it is finally distinguished from settlement.
--
-- NO CALLER-SUPPLIED ENTITLEMENT FACTS. The signature carries two identifiers and nothing else.
-- account_id, pass_type, duration_seconds, product_code, storekit_product_id, source_type,
-- is_paid, the Apple transaction identity, the idempotency key, the provenance document and
-- grant_status are ALL derived inside this transaction from durable rows. There is no argument a
-- caller could use to inflate a duration, claim another account's payment, or forge attribution.
--
-- WHY p_account_id EXISTS (the one additional argument, BUILD 26S-R1 §5). It is SERVER-DERIVED —
-- the route resolves it from `authorizeHost(token)`, never from a request body — and it is used
-- ONLY to scope the lookup, exactly as select_timed_access_pass(p_account_id, p_pass_grant_id)
-- and switch/revoke already do. Checking ownership in the calling service instead would put a
-- read and a write in different transactions, and that window is where a cross-account claim gets
-- through. A wrong value can only cause `purchase_not_found`: it can never move a payment to
-- another account, so the argument is fail-closed by construction.
--
-- ROLLBACK: drop function public.fulfil_apple_purchase(uuid, uuid);
--   No table, column, constraint, index, trigger or row is created or changed by this file, so
--   dropping the function restores the pre-26S database exactly.

-- ── THE ATOMIC FULFILMENT OPERATION ──────────────────────────────────────────
--
-- SECURITY INVOKER (the default — deliberately NOT declared SECURITY DEFINER), matching every
-- other pass RPC in this system. service_role already bypasses RLS, so DEFINER would buy nothing
-- and would create a privilege-escalating primitive that mints paid entitlement. search_path is
-- pinned regardless, so an attacker-controlled schema cannot shadow a table or operator this body
-- resolves.
create or replace function public.fulfil_apple_purchase(
  p_purchase_id uuid,
  p_account_id  uuid
) returns jsonb
language plpgsql set search_path = public, pg_temp as $$
declare
  v_p        public.karaoke_apple_purchases%rowtype;
  v_g        public.timed_access_pass_grants%rowtype;
  -- Named catalog fields, never `select *`: is_active is not loaded, so settlement provably
  -- cannot depend on it.
  v_pass_type    text;
  v_duration     int;
  v_cat_storekit text;
  v_key      text;
  v_new_id   uuid;
  v_txn_fp   text;
  v_tok_fp   text;
  v_rows     int;
begin
  -- 1. RESOLVE. Scoped by the server-derived account, so a purchase belonging to someone else is
  -- indistinguishable from one that does not exist. This first read is unlocked and used only to
  -- learn which account to serialize on; every decision below is made after the lock.
  select * into v_p
    from public.karaoke_apple_purchases
   where id = p_purchase_id and account_id = p_account_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'purchase_not_found');
  end if;

  -- 2. SERIALIZE on the SAME advisory-lock namespace every other timed-pass mutation uses
  -- (issue/select/switch/revoke/begin_song all take hashtext('timed_pass:' || account)). Inventing
  -- a separate namespace for fulfilment would mean a paid grant could be created while a switch
  -- was mid-flight on the same account, which is precisely what the one-SELECTED / one-ACTIVE
  -- partial unique indexes assume cannot happen. Lock order: account advisory lock FIRST, then the
  -- purchase row — the same direction as the rest of the pass lifecycle, so no inversion exists.
  perform pg_advisory_xact_lock(hashtext('timed_pass:' || v_p.account_id::text));

  -- 3. RE-READ UNDER THE LOCK. The state may have changed between step 1 and acquiring it — that
  -- is the entire concurrency case. Every validation below reads THIS row, never the step-1 copy.
  select * into v_p
    from public.karaoke_apple_purchases
   where id = p_purchase_id and account_id = p_account_id
     for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'purchase_not_found');
  end if;

  -- 4. IMMUTABLE-STATE VALIDATION. A purchase that Apple did not vouch for, or that Apple later
  -- withdrew, is never fulfilled. FAILED and REVOKED are terminal for entitlement purposes.
  if v_p.verification_status <> 'VERIFIED' then
    return jsonb_build_object('ok', false, 'error', 'purchase_not_verified',
                              'verificationStatus', v_p.verification_status);
  end if;
  if v_p.environment not in ('Sandbox', 'Production') then
    return jsonb_build_object('ok', false, 'error', 'ledger_invariant_conflict', 'detail', 'environment');
  end if;
  if v_p.apple_transaction_id is null or btrim(v_p.apple_transaction_id) = '' then
    return jsonb_build_object('ok', false, 'error', 'ledger_invariant_conflict', 'detail', 'transaction_id');
  end if;
  -- product_code is NULLABLE in the ledger (a purchase can be recorded before the catalog knows
  -- the product). Fulfilment cannot proceed without it, and inventing one is not an option.
  if v_p.product_code is null or v_p.storekit_product_id is null then
    return jsonb_build_object('ok', false, 'error', 'purchase_product_unresolved');
  end if;
  -- A grant that was issued and then revoked must never be silently re-issued. Re-granting is a
  -- deliberate operational act, not an automatic consequence of calling this again.
  if v_p.grant_status = 'GRANT_REVOKED' then
    return jsonb_build_object('ok', false, 'error', 'grant_revoked');
  end if;
  if v_p.grant_status not in ('NOT_GRANTED', 'GRANTED') then
    return jsonb_build_object('ok', false, 'error', 'ledger_invariant_conflict', 'detail', 'grant_status');
  end if;

  v_txn_fp := left(encode(sha256(convert_to(lower(v_p.apple_transaction_id), 'UTF8')), 'hex'), 12) || '…';
  v_tok_fp := left(encode(sha256(convert_to(lower(v_p.purchase_owner_ref::text), 'UTF8')), 'hex'), 12) || '…';

  -- 5. REPLAY, DECIDED BEFORE ANYTHING IS WRITTEN. An already-fulfilled purchase returns its
  -- existing grant and writes NOTHING — no second grant, no second audit row, no re-entitlement.
  -- Every linkage fact is re-proven rather than assumed; a ledger that has drifted is surfaced,
  -- never repaired, because quietly rewriting a financial record is how it stops being evidence.
  if v_p.grant_status = 'GRANTED' then
    if v_p.pass_grant_id is null or v_p.granted_seconds is null then
      return jsonb_build_object('ok', false, 'error', 'ledger_invariant_conflict', 'detail', 'granted_linkage');
    end if;
    select * into v_g from public.timed_access_pass_grants where id = v_p.pass_grant_id;
    if not found then
      return jsonb_build_object('ok', false, 'error', 'ledger_invariant_conflict', 'detail', 'grant_missing');
    end if;
    if v_g.account_id <> v_p.account_id then
      return jsonb_build_object('ok', false, 'error', 'ledger_invariant_conflict', 'detail', 'grant_account');
    end if;
    if v_g.apple_purchase_id is distinct from v_p.id then
      return jsonb_build_object('ok', false, 'error', 'ledger_invariant_conflict', 'detail', 'grant_purchase_link');
    end if;
    if v_g.source_type <> 'PAID' or v_g.is_paid is distinct from true then
      return jsonb_build_object('ok', false, 'error', 'ledger_invariant_conflict', 'detail', 'grant_not_paid');
    end if;
    if v_g.duration_seconds <> v_p.granted_seconds then
      return jsonb_build_object('ok', false, 'error', 'ledger_invariant_conflict', 'detail', 'granted_seconds');
    end if;
    -- The grant must still agree with the product the money was for.
    select c.pass_type, c.duration_seconds
      into v_pass_type, v_duration
      from public.karaoke_product_catalog c
     where c.product_code = v_p.product_code;
    if not found or v_g.pass_type <> v_pass_type or v_g.duration_seconds <> v_duration then
      return jsonb_build_object('ok', false, 'error', 'ledger_invariant_conflict', 'detail', 'grant_product');
    end if;

    return jsonb_build_object(
      'ok', true, 'replayed', true,
      'purchaseId', v_p.id, 'grantStatus', v_p.grant_status,
      'passGrantId', v_g.id, 'grantedSeconds', v_p.granted_seconds,
      'environment', v_p.environment, 'storekitProductId', v_p.storekit_product_id,
      'productCode', v_p.product_code, 'passType', v_g.pass_type,
      'sourceType', v_g.source_type, 'isPaid', v_g.is_paid,
      'grantStatusOfGrant', v_g.status,
      'transactionFingerprint', v_txn_fp, 'appAccountTokenFingerprint', v_tok_fp);
  end if;

  -- 6. CATALOG CONTRACT (first fulfilment only). The SERVER's duration authority, resolved from
  -- the purchase's OWN durable product identity. Three named fields; is_active is not among them.
  select c.pass_type, c.duration_seconds, c.storekit_product_id
    into v_pass_type, v_duration, v_cat_storekit
    from public.karaoke_product_catalog c
   where c.product_code = v_p.product_code;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'catalog_product_not_found');
  end if;
  -- The two independent records of what was bought must agree. If the ledger's Apple product id
  -- and the catalog's differ, one of them is wrong and neither may be preferred silently.
  if v_cat_storekit is distinct from v_p.storekit_product_id then
    return jsonb_build_object('ok', false, 'error', 'product_identity_mismatch');
  end if;

  -- 7. DETERMINISTIC IDEMPOTENCY KEY, built here from the durable financial identity — never
  -- accepted from a caller, never random, never time-based. FD-3: the key is ENVIRONMENT-scoped
  -- because Apple guarantees transaction-id uniqueness only within an environment, so a Sandbox id
  -- must not be able to collide with a Production one in the global issue-key index.
  v_key := 'apple:' || v_p.environment || ':' || v_p.apple_transaction_id;

  -- 8. THE GRANT. Born AVAILABLE: a purchase must NEVER start a clock (BUILD 18C invariant #3).
  -- Activation stays where it has always been — inside karaoke_begin_song_v2, on a real
  -- waiting->playing transition — and selection/carryover/expiry are untouched, so a paid pass
  -- travels the identical lifecycle a promotional one does. issued_by_manager is NULL because no
  -- manager issued this; the paid provenance lives in apple_purchase_id and the audit document.
  -- FK ORDER (BUILD 26S-R0 §6.2): the grant is inserted FIRST, pointing at the purchase row that
  -- already exists, and only then does the purchase point back. Neither FK is DEFERRABLE, and this
  -- is the one order in which both are satisfied at every statement boundary.
  begin
    insert into public.timed_access_pass_grants
      (account_id, pass_type, duration_seconds, carryover_seconds, status,
       source_type, is_paid, apple_purchase_id,
       issued_by_manager, issue_reason, issue_idempotency_key)
    values
      (v_p.account_id, v_pass_type, v_duration, 0, 'AVAILABLE',
       'PAID', true, v_p.id,
       null, 'apple_purchase_fulfilment', v_key)
    returning id into v_new_id;
  exception when unique_violation then
    -- We hold the account lock, so reaching here means a duplicate arrived by a path that did not
    -- take it. Deliberately narrow (unique_violation ONLY) and it RETURNS A FAILURE — it never
    -- swallows an error into a success. The subtransaction rolls back, so nothing durable remains.
    return jsonb_build_object('ok', false, 'error', 'fulfilment_conflict');
  end;

  -- 9. THE LEDGER TRANSITION. `and grant_status = 'NOT_GRANTED'` is a compare-and-swap: if
  -- anything changed this row since step 3 the update matches zero rows and we ABORT the whole
  -- transaction, taking the grant inserted above with it. Immutable Apple facts — transaction ids,
  -- environment, owner binding, product identity, purchase date, JWS, digest, verification_status,
  -- verified_at — are not in the SET list and are never rewritten. updated_at is left to the
  -- existing karaoke_apple_purchases_touch_updated_at trigger.
  update public.karaoke_apple_purchases
     set grant_status    = 'GRANTED',
         pass_grant_id   = v_new_id,
         granted_seconds = v_duration,
         processed_at    = now()
   where id = v_p.id and grant_status = 'NOT_GRANTED';
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'BUILD 26S: fulfilment lost the ledger row for purchase % (rows=%)', v_p.id, v_rows
      using errcode = 'serialization_failure';
  end if;

  -- 10. THE AUDIT, in the SAME transaction as the grant it describes. BUILD 26O's finding was that
  -- a grant must never exist without its attribution; an audit row written outside this transaction
  -- would be a claim of success a rollback could falsify.
  --
  -- actor_type = SYSTEM: no person issued this. The server acted on Apple's evidence, and the
  -- purchase ledger row IS the provenance root (actor_id). The manager credential model is NOT
  -- reused or widened — `shared_manager_credential` keeps its exact BUILD 26O meaning, and
  -- `apple_storekit_transaction` is a new, separate actor_kind that claims a TRANSACTION, never a
  -- human. metadata carries the stored JWS DIGEST, never the JWS itself: the payload already lives
  -- in the ledger, and copying it into an append-only audit table would duplicate signed financial
  -- evidence into a second place it can never be corrected.
  insert into public.timed_access_pass_audit
    (pass_grant_id, account_id, actor_type, actor_ref, action, from_status, to_status,
     idempotency_key, reason, metadata)
  values
    (v_new_id, v_p.account_id, 'SYSTEM', v_p.id::text, 'ISSUED', null, 'AVAILABLE',
     v_key, 'apple_purchase_fulfilment',
     jsonb_build_object(
       'version',        1,
       'source',         'apple_purchase_fulfilment',
       'actor_kind',     'apple_storekit_transaction',
       'actor_id',       v_p.id,
       'environment',    v_p.environment,
       'product_code',   v_p.product_code,
       'transaction_fp', v_txn_fp,
       'jws_sha256',     v_p.signed_transaction_sha256));

  return jsonb_build_object(
    'ok', true, 'replayed', false,
    'purchaseId', v_p.id, 'grantStatus', 'GRANTED',
    'passGrantId', v_new_id, 'grantedSeconds', v_duration,
    'environment', v_p.environment, 'storekitProductId', v_p.storekit_product_id,
    'productCode', v_p.product_code, 'passType', v_pass_type,
    'sourceType', 'PAID', 'isPaid', true,
    'grantStatusOfGrant', 'AVAILABLE',
    'transactionFingerprint', v_txn_fp, 'appAccountTokenFingerprint', v_tok_fp);
end;
$$;

-- service_role ONLY. A browser-reachable role that can mint paid entitlement is not a bug class
-- this system is willing to have: anon and authenticated are explicitly stripped, so the only
-- caller is the server runtime holding the service key.
revoke all on function public.fulfil_apple_purchase(uuid, uuid) from public, anon, authenticated;
grant execute on function public.fulfil_apple_purchase(uuid, uuid) to service_role;

comment on function public.fulfil_apple_purchase(uuid, uuid) is
  'BUILD 26S-R1. Atomically settles ONE durably VERIFIED Apple purchase into EXACTLY ONE paid '
  'AVAILABLE timed-pass grant, links both directions, and audits it — in a single transaction. '
  'Deliberately does NOT read karaoke_product_catalog.is_active: that column authorizes NEW '
  'transaction acceptance, not settlement of a payment already taken (BUILD 26S-R0 Contract B). '
  'Never activates a pass, never finishes an Apple transaction, never repairs a drifted ledger.';
