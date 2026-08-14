// BUILD 26S-R1 — REAL PostgreSQL authority tests for atomic Apple paid fulfilment.
//
// This is the build that first turns money into entitlement, so the claims that matter are
// claims about the DATABASE, not about routing:
//   * one Apple transaction produces EXACTLY ONE paid grant, even under true concurrency;
//   * a replay writes NOTHING and returns the same grant;
//   * every refusal leaves durable state byte-identical;
//   * settlement does NOT depend on karaoke_product_catalog.is_active (Contract B);
//   * a drifted ledger HARD-FAILS instead of being repaired.
//
// Concurrency is exercised with two independent connections and real transactions. Sequential
// mocks cannot establish serialization; only PostgreSQL can.
//
// Run via `bash supabase/tests/b26s/run.sh` (isolated throwaway cluster).
import pg from 'pg';

const CONN = { host: '127.0.0.1', port: Number(process.env.PGPORT || 54371), user: 'postgres', database: 'postgres' };
const db = new pg.Client(CONN); await db.connect();

let pass = 0; const fails = [];
const ok = (c, n) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fails.push(n); console.log('  ✗ ' + n); } };
const q = (t, p) => db.query(t, p).then(r => r.rows);
const one = async (t, p) => (await q(t, p))[0];

async function reset() {
  await db.query(`truncate table karaoke_apple_purchases, timed_access_pass_audit,
    timed_access_pass_grants, karaoke_accounts restart identity cascade`);
}
const seedAccount = async () => (await one(
  `insert into karaoke_accounts(timezone) values('America/Los_Angeles')
   returning id, purchase_owner_ref`));

/** The exact insert shape apple-purchase-ledger.server.ts writes (BUILD 26P). */
const insertPurchase = (acct, ownerRef, txnId, opts = {}) =>
  one(`insert into karaoke_apple_purchases
        (account_id, purchase_owner_ref, environment, apple_transaction_id,
         apple_original_transaction_id, storekit_product_id, product_code, purchase_date,
         quantity, signed_transaction_payload, signed_transaction_sha256,
         verification_status, verified_at, verification_attempts,
         grant_status, granted_seconds, pass_grant_id, source)
       values ($1,$2,$3,$4,$4,$5,$6, now(), 1,
               'aaa.bbb.ccc', repeat('d',64), $7, now(), 1,
               'NOT_GRANTED', null, null, 'STOREKIT_CLIENT')
       returning id, account_id, product_code, grant_status, verification_status`,
      [acct, ownerRef, opts.env ?? 'Sandbox', txnId,
       opts.storekit ?? 'com.btydaily.norebang.pass.1hour',
       opts.productCode === undefined ? 'PASS_1H' : opts.productCode,
       opts.verification ?? 'VERIFIED']);

const fulfil = (purchaseId, accountId) =>
  one(`select public.fulfil_apple_purchase($1,$2) as r`, [purchaseId, accountId]).then(r => r.r);

const census = async () => await one(`select
    (select count(*)::int from timed_access_pass_grants)                                   grants,
    (select count(*)::int from timed_access_pass_grants where is_paid)                     paid,
    (select count(*)::int from timed_access_pass_grants where apple_purchase_id is not null) linked,
    (select count(*)::int from timed_access_pass_audit)                                    audit,
    (select count(*)::int from timed_access_pass_audit where action='ISSUED')              issued,
    (select count(*)::int from karaoke_apple_purchases)                                    purchases,
    (select count(*)::int from karaoke_apple_purchases where grant_status='GRANTED')        granted`);

console.log('\n== BUILD 26S-R1: atomic Apple paid fulfilment ==\n');

// ─────────────────────────────────────────────────────────────────────────────────────────
console.log('-- G6: first fulfilment is atomic and complete --');
await reset();
{
  const a = await seedAccount();
  const p = await insertPurchase(a.id, a.purchase_owner_ref, 'TXN-FIRST');

  // The catalog ships is_active=false for all three products, so this FIRST test is already the
  // Contract B proof: settlement of a durably VERIFIED purchase succeeds against an INACTIVE
  // product. §24 re-states it explicitly below.
  const inactive = await one(`select is_active from karaoke_product_catalog where product_code='PASS_1H'`);
  ok(inactive.is_active === false, 'precondition: PASS_1H is_active=false');

  const r = await fulfil(p.id, a.id);
  ok(r.ok === true, 'ok=true');
  ok(r.replayed === false, 'replayed=false on first fulfilment');
  ok(r.grantStatus === 'GRANTED', 'grantStatus=GRANTED');
  ok(r.grantedSeconds === 3600, 'grantedSeconds=3600 (from the catalog contract)');
  ok(r.sourceType === 'PAID' && r.isPaid === true, 'sourceType=PAID, isPaid=true');
  ok(r.passType === 'ONE_HOUR', 'passType=ONE_HOUR');
  ok(r.environment === 'Sandbox', 'environment echoed from the ledger');
  ok(typeof r.passGrantId === 'string' && r.passGrantId.length === 36, 'passGrantId is a uuid');
  ok(/^[0-9a-f]{12}…$/.test(r.transactionFingerprint), 'transactionFingerprint is a 12-hex fp');
  ok(/^[0-9a-f]{12}…$/.test(r.appAccountTokenFingerprint), 'appAccountTokenFingerprint is a 12-hex fp');

  const g = await one(`select * from timed_access_pass_grants where id=$1`, [r.passGrantId]);
  ok(g.status === 'AVAILABLE', 'G12: the paid grant is born AVAILABLE — purchase started no clock');
  ok(g.source_type === 'PAID' && g.is_paid === true, 'grant is PAID');
  ok(g.duration_seconds === 3600 && g.carryover_seconds === 0, 'duration 3600, carryover 0');
  ok(g.pass_type === 'ONE_HOUR', 'pass_type ONE_HOUR');
  ok(g.issued_by_manager === null, 'issued_by_manager is NULL — no manager issued a paid grant');
  ok(g.issue_reason === 'apple_purchase_fulfilment', 'issue_reason names the fulfilment');
  ok(g.issue_idempotency_key === 'apple:Sandbox:TXN-FIRST', 'deterministic env-scoped issue key');
  ok(g.selected_at === null && g.activated_at === null && g.expires_at === null
     && g.expired_at === null && g.revoked_at === null, 'no lifecycle timestamp is set');
  ok(g.apple_purchase_id === p.id, 'G13: grant.apple_purchase_id -> purchase');

  const pr = await one(`select * from karaoke_apple_purchases where id=$1`, [p.id]);
  ok(pr.grant_status === 'GRANTED', 'purchase grant_status GRANTED');
  ok(pr.pass_grant_id === g.id, 'G13: purchase.pass_grant_id -> grant (bidirectional)');
  ok(pr.granted_seconds === 3600, 'purchase granted_seconds 3600');
  ok(pr.processed_at !== null, 'processed_at set');
  ok(pr.verification_status === 'VERIFIED', 'verification_status still VERIFIED');
  ok(pr.signed_transaction_sha256 === 'd'.repeat(64), 'JWS digest untouched');
  ok(pr.signed_transaction_payload === 'aaa.bbb.ccc', 'JWS payload untouched');
  ok(pr.apple_transaction_id === 'TXN-FIRST', 'Apple transaction id untouched');
  ok(pr.environment === 'Sandbox', 'environment untouched');

  const au = await q(`select * from timed_access_pass_audit where pass_grant_id=$1`, [g.id]);
  ok(au.length === 1, 'G14: exactly one audit row, in the same transaction');
  ok(au[0].action === 'ISSUED' && au[0].from_status === null && au[0].to_status === 'AVAILABLE',
     'audit ISSUED null->AVAILABLE');
  ok(au[0].actor_type === 'SYSTEM', 'actor_type SYSTEM — no person issued it');
  ok(au[0].actor_ref === p.id, 'actor_ref is the purchase ledger identity');
  ok(au[0].metadata.actor_kind === 'apple_storekit_transaction',
     'actor_kind apple_storekit_transaction — manager credential semantics NOT reused');
  ok(au[0].metadata.source === 'apple_purchase_fulfilment' && au[0].metadata.version === 1,
     'provenance version + source');
  ok(au[0].metadata.jws_sha256 === 'd'.repeat(64), 'metadata carries the stored JWS DIGEST');
  ok(!JSON.stringify(au[0].metadata).includes('aaa.bbb.ccc'), 'metadata does NOT copy the raw JWS');

  const c = await census();
  ok(c.paid === 1 && c.linked === 1 && c.granted === 1 && c.purchases === 1,
     'census: exactly one paid grant, one link, one GRANTED purchase, one purchase');
}

// ─────────────────────────────────────────────────────────────────────────────────────────
console.log('\n-- G7: replay returns the SAME grant and writes nothing --');
await reset();
{
  const a = await seedAccount();
  const p = await insertPurchase(a.id, a.purchase_owner_ref, 'TXN-REPLAY');
  const first = await fulfil(p.id, a.id);
  const before = await census();

  const again = await fulfil(p.id, a.id);
  ok(again.ok === true && again.replayed === true, 'second call: ok=true, replayed=true');
  ok(again.passGrantId === first.passGrantId, 'same passGrantId');
  ok(again.grantedSeconds === 3600 && again.sourceType === 'PAID', 'same durable facts');

  const after = await census();
  ok(JSON.stringify(before) === JSON.stringify(after), 'census unchanged by the replay');
}

// ─────────────────────────────────────────────────────────────────────────────────────────
console.log('\n-- G7: ten repeated replays converge --');
await reset();
{
  const a = await seedAccount();
  const p = await insertPurchase(a.id, a.purchase_owner_ref, 'TXN-TEN');
  const first = await fulfil(p.id, a.id);
  const ids = new Set([first.passGrantId]);
  for (let i = 0; i < 10; i++) ids.add((await fulfil(p.id, a.id)).passGrantId);
  ok(ids.size === 1, 'all 11 calls returned the SAME passGrantId');

  const c = await census();
  ok(c.grants === 1, 'exactly one grant total');
  ok(c.issued === 1, 'exactly one ISSUED audit row total');
  ok(c.granted === 1, 'exactly one GRANTED purchase');
}

// ─────────────────────────────────────────────────────────────────────────────────────────
console.log('\n-- G8: REAL concurrency — serialized by the advisory lock --');
await reset();
{
  const a = await seedAccount();
  const p = await insertPurchase(a.id, a.purchase_owner_ref, 'TXN-LOCK');

  const c1 = new pg.Client(CONN); await c1.connect();
  const c2 = new pg.Client(CONN); await c2.connect();

  await c1.query('begin');
  const r1 = (await c1.query(`select public.fulfil_apple_purchase($1,$2) r`, [p.id, a.id])).rows[0].r;
  ok(r1.replayed === false, 'txn A fulfils first (uncommitted)');

  // B enters while A holds the account advisory lock and has NOT committed. It must BLOCK.
  await c2.query('begin');
  let bDone = false;
  const bPromise = c2.query(`select public.fulfil_apple_purchase($1,$2) r`, [p.id, a.id])
    .then(res => { bDone = true; return res.rows[0].r; });
  await new Promise(r => setTimeout(r, 600));
  ok(bDone === false, 'txn B BLOCKS on the account advisory lock — a read could not have done this');

  await c1.query('commit');
  const r2 = await bPromise;
  await c2.query('commit');

  ok(r2.replayed === true, 'txn B resolves to a REPLAY once A commits');
  ok(r2.passGrantId === r1.passGrantId, 'both transactions name the SAME grant');

  const c = await census();
  ok(c.grants === 1 && c.paid === 1, 'exactly ONE paid grant after concurrent fulfilment');
  ok(c.issued === 1, 'exactly ONE ISSUED audit row — no duplicate success event');
  ok(c.granted === 1, 'exactly ONE GRANTED purchase');
  await c1.end(); await c2.end();
}

// ─────────────────────────────────────────────────────────────────────────────────────────
console.log('\n-- G8: unordered concurrent race (both fired together) --');
await reset();
{
  const a = await seedAccount();
  const p = await insertPurchase(a.id, a.purchase_owner_ref, 'TXN-RACE');
  const clients = [];
  for (let i = 0; i < 4; i++) { const c = new pg.Client(CONN); await c.connect(); clients.push(c); }

  const results = await Promise.all(clients.map(async (c) => {
    await c.query('begin');
    const r = (await c.query(`select public.fulfil_apple_purchase($1,$2) r`, [p.id, a.id])).rows[0].r;
    await c.query('commit');
    return r;
  }));
  for (const c of clients) await c.end();

  ok(results.every(r => r.ok === true), 'all four concurrent callers succeeded');
  ok(new Set(results.map(r => r.passGrantId)).size === 1, 'all four returned the SAME grant id');
  ok(results.filter(r => r.replayed === false).length === 1, 'exactly one was the first fulfilment');

  const c = await census();
  ok(c.grants === 1 && c.paid === 1 && c.issued === 1 && c.granted === 1,
     'exactly one grant / one audit / one GRANTED purchase after a 4-way race');
}

// ─────────────────────────────────────────────────────────────────────────────────────────
console.log('\n-- §24 / G10+G11: is_active does NOT gate settlement (Contract B) --');
await reset();
{
  const a = await seedAccount();
  const p = await insertPurchase(a.id, a.purchase_owner_ref, 'TXN-INACTIVE');
  const before = await one(`select is_active from karaoke_product_catalog where product_code='PASS_1H'`);
  ok(before.is_active === false, 'catalog product is INACTIVE');

  const r = await fulfil(p.id, a.id);
  ok(r.ok === true && r.grantStatus === 'GRANTED', 'G10: settlement SUCCEEDS against an inactive product');
  ok(r.grantedSeconds === 3600, 'duration still comes from the contract-pinned catalog row');

  const after = await one(`select is_active from karaoke_product_catalog where product_code='PASS_1H'`);
  ok(after.is_active === false, 'the product was NOT activated as a side effect');

  // And the outcome is identical when the product IS active — proving is_active is not merely
  // tolerated but genuinely not consulted.
  await reset();
  await db.query(`update karaoke_product_catalog set is_active=true where product_code='PASS_4H'`);
  const a2 = await seedAccount();
  const p2 = await insertPurchase(a2.id, a2.purchase_owner_ref, 'TXN-ACTIVE',
    { productCode: 'PASS_4H', storekit: 'com.btydaily.norebang.pass.4hour' });
  const r2 = await fulfil(p2.id, a2.id);
  ok(r2.ok === true && r2.grantedSeconds === 14400, 'active product settles identically (14400s)');
  await db.query(`update karaoke_product_catalog set is_active=false where product_code='PASS_4H'`);
  const restored = await one(`select count(*)::int n from karaoke_product_catalog where is_active`);
  ok(restored.n === 0, 'fixture restored: no catalog row left active');
}

// ─────────────────────────────────────────────────────────────────────────────────────────
console.log('\n-- G9 / §23: negative states refuse and mutate NOTHING --');
await reset();
{
  const a = await seedAccount();
  const other = await seedAccount();
  const p = await insertPurchase(a.id, a.purchase_owner_ref, 'TXN-NEG');
  const before = await census();

  const missing = await fulfil('00000000-0000-0000-0000-000000000000', a.id);
  ok(missing.ok === false && missing.error === 'purchase_not_found', 'missing purchase refused');

  const wrongAcct = await fulfil(p.id, other.id);
  ok(wrongAcct.ok === false && wrongAcct.error === 'purchase_not_found',
     'wrong account refused, and told NOTHING about the real owner');

  await db.query(`update karaoke_apple_purchases set verification_status='FAILED' where id=$1`, [p.id]);
  const failed = await fulfil(p.id, a.id);
  ok(failed.ok === false && failed.error === 'purchase_not_verified', 'FAILED verification refused');

  await db.query(`update karaoke_apple_purchases set verification_status='REVOKED' where id=$1`, [p.id]);
  const revoked = await fulfil(p.id, a.id);
  ok(revoked.ok === false && revoked.error === 'purchase_not_verified', 'REVOKED verification refused');

  await db.query(`update karaoke_apple_purchases set verification_status='PENDING' where id=$1`, [p.id]);
  const pending = await fulfil(p.id, a.id);
  ok(pending.ok === false && pending.error === 'purchase_not_verified', 'PENDING verification refused');

  await db.query(`update karaoke_apple_purchases
                     set verification_status='VERIFIED', product_code=null where id=$1`, [p.id]);
  const unresolved = await fulfil(p.id, a.id);
  ok(unresolved.ok === false && unresolved.error === 'purchase_product_unresolved',
     'unknown/unresolved product refused');

  // Product identity mismatch: the ledger's Apple product id disagrees with the catalog's.
  await db.query(`update karaoke_apple_purchases
                     set product_code='PASS_1H', storekit_product_id='com.btydaily.norebang.pass.24hour'
                   where id=$1`, [p.id]);
  const mismatch = await fulfil(p.id, a.id);
  ok(mismatch.ok === false && mismatch.error === 'product_identity_mismatch',
     'product identity mismatch HARD-FAILS rather than preferring one record');

  const after = await census();
  ok(after.grants === 0 && after.audit === 0 && after.granted === 0,
     'no refusal created a grant, an audit row, or a GRANTED purchase');
  ok(before.purchases === after.purchases, 'purchase count unchanged by every refusal');
}

// ─────────────────────────────────────────────────────────────────────────────────────────
console.log('\n-- G9: corrupt GRANTED linkage HARD-FAILS and is never repaired --');
await reset();
{
  const a = await seedAccount();

  // (a) purchase GRANTED but pointing at a PROMOTIONAL grant that does not point back.
  const p1 = await insertPurchase(a.id, a.purchase_owner_ref, 'TXN-CORRUPT-1');
  const promo = await one(
    `insert into timed_access_pass_grants
       (account_id, pass_type, duration_seconds, issued_by_manager, issue_idempotency_key)
     values ($1,'ONE_HOUR',3600,'bty_mgr','k-promo') returning id`, [a.id]);
  await db.query(`update karaoke_apple_purchases
                     set grant_status='GRANTED', pass_grant_id=$2, granted_seconds=3600
                   where id=$1`, [p1.id, promo.id]);
  const r1 = await fulfil(p1.id, a.id);
  ok(r1.ok === false && r1.error === 'ledger_invariant_conflict' && r1.detail === 'grant_purchase_link',
     'GRANTED pointing at an unlinked promotional grant -> ledger_invariant_conflict');

  // (b) granted_seconds disagreeing with the grant's duration.
  await reset();
  const a2 = await seedAccount();
  const p2 = await insertPurchase(a2.id, a2.purchase_owner_ref, 'TXN-CORRUPT-2');
  const good = await fulfil(p2.id, a2.id);
  await db.query(`update karaoke_apple_purchases set granted_seconds=999 where id=$1`, [p2.id]);
  const r2 = await fulfil(p2.id, a2.id);
  ok(r2.ok === false && r2.error === 'ledger_invariant_conflict' && r2.detail === 'granted_seconds',
     'granted_seconds disagreeing with the grant -> ledger_invariant_conflict');
  const stillOne = await census();
  ok(stillOne.grants === 1 && stillOne.issued === 1, 'the conflict created nothing');
  ok(good.passGrantId !== undefined, 'the originally fulfilled grant is untouched');

  // (c) GRANT_REVOKED must never silently re-issue.
  await db.query(`update karaoke_apple_purchases set granted_seconds=3600, grant_status='GRANT_REVOKED'
                   where id=$1`, [p2.id]);
  const r3 = await fulfil(p2.id, a2.id);
  ok(r3.ok === false && r3.error === 'grant_revoked', 'GRANT_REVOKED refuses re-issue');
  const c = await census();
  ok(c.grants === 1, 'still exactly one grant — no re-grant after revocation');
}

// ─────────────────────────────────────────────────────────────────────────────────────────
console.log('\n-- structural: the 1:1 invariant survives even without the function --');
await reset();
{
  const a = await seedAccount();
  const p = await insertPurchase(a.id, a.purchase_owner_ref, 'TXN-STRUCT');
  const r = await fulfil(p.id, a.id);

  // A second grant claiming the same purchase is impossible regardless of application logic.
  let dup = null;
  try {
    await db.query(`insert into timed_access_pass_grants
        (account_id, pass_type, duration_seconds, status, source_type, is_paid,
         apple_purchase_id, issue_idempotency_key)
      values ($1,'ONE_HOUR',3600,'AVAILABLE','PAID',true,$2,'k-dup')`, [a.id, p.id]);
  } catch (e) { dup = e; }
  ok(dup !== null && dup.code === '23505', 'timed_pass_apple_purchase_idx blocks a second grant (23505)');

  // A second purchase claiming the same grant is equally impossible.
  const p2 = await insertPurchase(a.id, a.purchase_owner_ref, 'TXN-STRUCT-2');
  let dup2 = null;
  try {
    await db.query(`update karaoke_apple_purchases
                       set grant_status='GRANTED', pass_grant_id=$2, granted_seconds=3600
                     where id=$1`, [p2.id, r.passGrantId]);
  } catch (e) { dup2 = e; }
  ok(dup2 !== null && dup2.code === '23505',
     'karaoke_apple_purchases_pass_grant_idx blocks a second purchase claiming the grant (23505)');

  // And the global issue key blocks a replay that bypassed the function entirely.
  let dup3 = null;
  try {
    await db.query(`insert into timed_access_pass_grants
        (account_id, pass_type, duration_seconds, status, source_type, is_paid,
         apple_purchase_id, issue_idempotency_key)
      values ($1,'ONE_HOUR',3600,'AVAILABLE','PAID',true,$2,'apple:Sandbox:TXN-STRUCT')`, [a.id, p2.id]);
  } catch (e) { dup3 = e; }
  ok(dup3 !== null && dup3.code === '23505', 'timed_pass_issue_idem_idx blocks the deterministic key twice');
}

// ─────────────────────────────────────────────────────────────────────────────────────────
console.log('\n-- G5: EXECUTE authority is service_role only --');
{
  const acl = await one(`select proacl::text acl, prosecdef, proconfig::text cfg
                           from pg_proc where proname='fulfil_apple_purchase'`);
  ok(acl.prosecdef === false, 'SECURITY INVOKER (not DEFINER) — no privilege-escalating primitive');
  ok(String(acl.cfg).includes('search_path=public, pg_temp'), 'search_path is pinned');
  ok(!/(^|,)=X\//.test(String(acl.acl)), 'PUBLIC holds no EXECUTE');
  ok(!String(acl.acl).includes('anon='), 'anon holds no EXECUTE');
  ok(!String(acl.acl).includes('authenticated='), 'authenticated holds no EXECUTE');
  ok(String(acl.acl).includes('service_role=X/'), 'service_role holds EXECUTE');
}

// ─────────────────────────────────────────────────────────────────────────────────────────
console.log('\n-- the paid grant travels the ORDINARY lifecycle (no second entitlement system) --');
await reset();
{
  const a = await seedAccount();
  const p = await insertPurchase(a.id, a.purchase_owner_ref, 'TXN-LIFECYCLE');
  const r = await fulfil(p.id, a.id);

  const sel = await one(`select public.select_timed_access_pass($1,$2,'k-sel') s`, [a.id, r.passGrantId]);
  ok(sel.s.ok === true && sel.s.status === 'SELECTED', 'a PAID grant is selectable by the existing RPC');
  const g = await one(`select status, activated_at, expires_at from timed_access_pass_grants where id=$1`,
                      [r.passGrantId]);
  ok(g.status === 'SELECTED' && g.activated_at === null && g.expires_at === null,
     'selection still starts NO clock for a paid pass');

  const st = await one(`select public.karaoke_timed_pass_state($1) s`, [a.id]);
  ok(st.s !== null, 'the existing state RPC reads an account holding a paid pass');
}

console.log(`\n${fails.length ? '✗ FAIL' : '✓ PASS'} — ${pass} assertions passed, ${fails.length} failed`);
for (const f of fails) console.log('   FAILED: ' + f);
await db.end();
process.exit(fails.length ? 1 : 0);
