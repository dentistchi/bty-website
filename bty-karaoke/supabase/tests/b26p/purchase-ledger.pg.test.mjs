// BUILD 26P — REAL PostgreSQL authority tests for the Apple purchase ledger.
//
// The route tests mock the ledger, so they prove routing, not safety. This proves what the
// DATABASE guarantees: that (environment, apple_transaction_id) is the serialization authority,
// that a cross-account claim cannot succeed even under concurrency, and — the assertion this
// whole build turns on — that recording a purchase creates NO Timed Pass grant.
//
// BUILD 26O-R1's lesson is applied directly: the safety mechanism is INSERT-and-handle-conflict,
// never SELECT-then-INSERT. A read cannot serialize two concurrent callers; a unique index can.
//
// Run via `bash supabase/tests/b26p/run.sh` (isolated throwaway cluster).
import pg from 'pg';

const CONN = { host: '127.0.0.1', port: Number(process.env.PGPORT || 54361), user: 'postgres', database: 'postgres' };
const db = new pg.Client(CONN); await db.connect();

let pass = 0; const fails = [];
const ok = (c, n) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fails.push(n); console.log('  ✗ ' + n); } };
const q = (t, p) => db.query(t, p).then(r => r.rows);
const one = async (t, p) => (await q(t, p))[0];
async function expectFail(text, params) {
  try { await db.query(text, params); return null; } catch (e) { return e; }
}

async function reset() {
  await db.query(`truncate table karaoke_apple_purchases, timed_access_pass_audit,
    timed_access_pass_grants, karaoke_accounts restart identity cascade`);
}
const seedAccount = async () => (await one(
  `insert into karaoke_accounts(timezone) values('America/Los_Angeles')
   returning id, purchase_owner_ref`));

/** The exact insert shape apple-purchase-ledger.server.ts writes. */
const insertPurchase = (acct, ownerRef, txnId, env = 'Sandbox', productCode = 'PASS_1H', status = 'VERIFIED') =>
  one(`insert into karaoke_apple_purchases
        (account_id, purchase_owner_ref, environment, apple_transaction_id,
         apple_original_transaction_id, storekit_product_id, product_code, purchase_date,
         quantity, signed_transaction_payload, signed_transaction_sha256,
         verification_status, verified_at, verification_attempts,
         grant_status, granted_seconds, pass_grant_id, source)
       values ($1,$2,$3,$4,$4,'com.btydaily.norebang.pass.1hour',$5, now(), 1,
               'aaa.bbb.ccc', repeat('d',64), $6, now(), 1,
               'NOT_GRANTED', null, null, 'STOREKIT_CLIENT')
       returning id, account_id, product_code, grant_status, verification_status`,
      [acct, ownerRef, env, txnId, productCode, status]);

console.log('\n== BUILD 26P: Apple purchase ledger ==\n');

// ─────────────────────────────────────────────────────────────────────────────────────────
console.log('-- the ledger records a purchase and grants NOTHING --');
await reset();
{
  const a = await seedAccount();
  const row = await insertPurchase(a.id, a.purchase_owner_ref, 'TXN-1');
  ok(row.grant_status === 'NOT_GRANTED', 'grant_status is NOT_GRANTED');
  ok(row.verification_status === 'VERIFIED', 'verification_status is VERIFIED');

  const grants = await one(`select count(*)::int n from timed_access_pass_grants`);
  ok(grants.n === 0, 'ZERO Timed Pass grants exist — verification did not become entitlement');

  const linked = await one(`select pass_grant_id, granted_seconds from karaoke_apple_purchases where id=$1`, [row.id]);
  ok(linked.pass_grant_id === null && linked.granted_seconds === null,
     'pass_grant_id and granted_seconds are both NULL');
}

// ─────────────────────────────────────────────────────────────────────────────────────────
console.log('\n-- grant_linkage_chk makes a phantom grant unrepresentable --');
await reset();
{
  const a = await seedAccount();
  const err = await expectFail(
    `insert into karaoke_apple_purchases
      (account_id, purchase_owner_ref, environment, apple_transaction_id, storekit_product_id,
       product_code, quantity, verification_status, grant_status, granted_seconds, pass_grant_id, source)
     values ($1,$2,'Sandbox','TXN-PHANTOM','com.btydaily.norebang.pass.1hour','PASS_1H',1,
             'VERIFIED','GRANTED',3600,null,'STOREKIT_CLIENT')`,
    [a.id, a.purchase_owner_ref]);
  ok(err !== null, 'a GRANTED row pointing at no grant is REJECTED by the database');

  const err2 = await expectFail(
    `insert into karaoke_apple_purchases
      (account_id, purchase_owner_ref, environment, apple_transaction_id, storekit_product_id,
       product_code, quantity, verification_status, grant_status, granted_seconds, pass_grant_id, source)
     values ($1,$2,'Sandbox','TXN-PHANTOM2','com.btydaily.norebang.pass.1hour','PASS_1H',1,
             'VERIFIED','NOT_GRANTED',3600,null,'STOREKIT_CLIENT')`,
    [a.id, a.purchase_owner_ref]);
  ok(err2 !== null, 'a NOT_GRANTED row claiming granted_seconds is REJECTED too');
}

// ─────────────────────────────────────────────────────────────────────────────────────────
console.log('\n-- (environment, apple_transaction_id) is the replay authority --');
await reset();
{
  const a = await seedAccount();
  const b = await seedAccount();
  await insertPurchase(a.id, a.purchase_owner_ref, 'TXN-2');

  const dupSame = await expectFail(
    `insert into karaoke_apple_purchases
      (account_id, purchase_owner_ref, environment, apple_transaction_id, storekit_product_id,
       product_code, quantity, verification_status, grant_status, source)
     values ($1,$2,'Sandbox','TXN-2','com.btydaily.norebang.pass.1hour','PASS_1H',1,
             'VERIFIED','NOT_GRANTED','STOREKIT_CLIENT')`,
    [a.id, a.purchase_owner_ref]);
  ok(dupSame !== null && dupSame.code === '23505', 'same account + same txn collides on the unique index (23505)');

  const dupOther = await expectFail(
    `insert into karaoke_apple_purchases
      (account_id, purchase_owner_ref, environment, apple_transaction_id, storekit_product_id,
       product_code, quantity, verification_status, grant_status, source)
     values ($1,$2,'Sandbox','TXN-2','com.btydaily.norebang.pass.1hour','PASS_1H',1,
             'VERIFIED','NOT_GRANTED','STOREKIT_CLIENT')`,
    [b.id, b.purchase_owner_ref]);
  ok(dupOther !== null && dupOther.code === '23505',
     'a DIFFERENT account cannot claim the same transaction — the index does not care who asks');

  const total = await one(`select count(*)::int n from karaoke_apple_purchases where apple_transaction_id='TXN-2'`);
  ok(total.n === 1, 'exactly one row exists for that transaction');
  const owner = await one(`select account_id from karaoke_apple_purchases where apple_transaction_id='TXN-2'`);
  ok(owner.account_id === a.id, 'and it still belongs to the account that recorded it first');
}

// ─────────────────────────────────────────────────────────────────────────────────────────
console.log('\n-- Sandbox and Production stay DISTINCT authorities --');
await reset();
{
  const a = await seedAccount();
  await insertPurchase(a.id, a.purchase_owner_ref, 'TXN-3', 'Sandbox');
  const prod = await insertPurchase(a.id, a.purchase_owner_ref, 'TXN-3', 'Production');
  ok(!!prod.id, 'the SAME transaction id is accepted in the other environment');
  const rows = await q(`select environment from karaoke_apple_purchases where apple_transaction_id='TXN-3' order by environment`);
  ok(rows.length === 2 && rows[0].environment === 'Production' && rows[1].environment === 'Sandbox',
     'both rows persist, each keeping its own environment');

  const bad = await expectFail(
    `insert into karaoke_apple_purchases
      (account_id, purchase_owner_ref, environment, apple_transaction_id, storekit_product_id,
       product_code, quantity, verification_status, grant_status, source)
     values ($1,$2,'Staging','TXN-4','com.btydaily.norebang.pass.1hour','PASS_1H',1,
             'VERIFIED','NOT_GRANTED','STOREKIT_CLIENT')`,
    [a.id, a.purchase_owner_ref]);
  ok(bad !== null, 'an environment Apple never issues is rejected by the CHECK');
}

// ─────────────────────────────────────────────────────────────────────────────────────────
console.log('\n-- CONCURRENCY: two simultaneous inserts of one transaction --');
await reset();
{
  const a = await seedAccount();
  const b = await seedAccount();
  const other = new pg.Client(CONN); await other.connect();

  await other.query('begin');
  await other.query(
    `insert into karaoke_apple_purchases
      (account_id, purchase_owner_ref, environment, apple_transaction_id, storekit_product_id,
       product_code, quantity, verification_status, grant_status, source)
     values ($1,$2,'Sandbox','TXN-RACE','com.btydaily.norebang.pass.1hour','PASS_1H',1,
             'VERIFIED','NOT_GRANTED','STOREKIT_CLIENT')`,
    [a.id, a.purchase_owner_ref]);

  // The loser cannot see the uncommitted row, attempts its own insert, and blocks on the index.
  const loser = db.query(
    `insert into karaoke_apple_purchases
      (account_id, purchase_owner_ref, environment, apple_transaction_id, storekit_product_id,
       product_code, quantity, verification_status, grant_status, source)
     values ($1,$2,'Sandbox','TXN-RACE','com.btydaily.norebang.pass.1hour','PASS_1H',1,
             'VERIFIED','NOT_GRANTED','STOREKIT_CLIENT')`,
    [b.id, b.purchase_owner_ref]).then(() => null, (e) => e);
  await new Promise(r => setTimeout(r, 250));
  await other.query('commit');
  await other.end();

  const err = await loser;
  ok(err !== null && err.code === '23505', 'the losing racer gets 23505, not a second row');
  const rows = await one(`select count(*)::int n from karaoke_apple_purchases where apple_transaction_id='TXN-RACE'`);
  ok(rows.n === 1, 'EXACTLY ONE row exists after the race');
  const winner = await one(`select account_id from karaoke_apple_purchases where apple_transaction_id='TXN-RACE'`);
  ok(winner.account_id === a.id, 'and it belongs to the racer that actually committed');
  const grants = await one(`select count(*)::int n from timed_access_pass_grants`);
  ok(grants.n === 0, 'no entitlement was created by either racer');
}

// ─────────────────────────────────────────────────────────────────────────────────────────
console.log('\n-- catalog authority and revocation --');
await reset();
{
  const a = await seedAccount();
  const unknown = await expectFail(
    `insert into karaoke_apple_purchases
      (account_id, purchase_owner_ref, environment, apple_transaction_id, storekit_product_id,
       product_code, quantity, verification_status, grant_status, source)
     values ($1,$2,'Sandbox','TXN-5','com.unknown.product','NOPE',1,
             'VERIFIED','NOT_GRANTED','STOREKIT_CLIENT')`,
    [a.id, a.purchase_owner_ref]);
  ok(unknown !== null, 'an unknown product_code cannot satisfy the catalog FK');

  const revoked = await insertPurchase(a.id, a.purchase_owner_ref, 'TXN-6', 'Sandbox', 'PASS_1H', 'REVOKED');
  ok(revoked.verification_status === 'REVOKED', 'a revoked transaction is representable as REVOKED');
  ok(revoked.grant_status === 'NOT_GRANTED', 'and still grants nothing');

  const cat = await q(`select product_code, is_active from karaoke_product_catalog order by display_order`);
  ok(cat.length === 3 && cat.every(c => c.is_active === false),
     'all three catalog products remain is_active = false — recording never activates one');
}

// ─────────────────────────────────────────────────────────────────────────────────────────
console.log('\n-- account retention: a purchase pins the account --');
await reset();
{
  const a = await seedAccount();
  await insertPurchase(a.id, a.purchase_owner_ref, 'TXN-7');
  const del = await expectFail(`delete from karaoke_accounts where id=$1`, [a.id]);
  ok(del !== null, 'an account holding a purchase cannot be hard-deleted (ON DELETE RESTRICT)');
  const b = await seedAccount();
  const delOk = await expectFail(`delete from karaoke_accounts where id=$1`, [b.id]);
  ok(delOk === null, 'negative control: a purchase-free account deletes fine');
}

console.log(`\n${pass} passed, ${fails.length} failed`);
if (fails.length) { for (const f of fails) console.log('FAILED: ' + f); process.exit(1); }
await db.end();
