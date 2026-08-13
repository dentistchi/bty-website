// BUILD 26O — REAL PostgreSQL authority tests for
// 20260815120000_karaoke_pass_issuance_actor_attribution_v1.
//
// The schema test pins what the migration SAYS. This proves what the database DOES: that a grant
// cannot come into existence without its attribution, that a refusal writes nothing, that the
// unattributed signature is gone, and that none of the pass semantics around it moved.
//
// Run via `bash supabase/tests/b26o/run.sh` (isolated throwaway cluster).
import pg from 'pg';

const CONN = { host: '127.0.0.1', port: Number(process.env.PGPORT || 54351), user: 'postgres', database: 'postgres' };
const db = new pg.Client(CONN); await db.connect();

let pass = 0; const fails = [];
const ok = (c, n) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fails.push(n); console.log('  ✗ ' + n); } };
const q = (t, p) => db.query(t, p).then(r => r.rows);
const one = async (t, p) => (await q(t, p))[0];

async function expectFail(text, params) {
  try { await db.query(text, params); return null; } catch (e) { return e; }
}

const ISSUANCE = {
  version: 1,
  source: 'manager_issue',
  actor_kind: 'shared_manager_credential',
  actor_id: 'bty_mgr',
  session_fp: '0123456789abcdef',
};

/** Call the RPC the way the service layer does. */
const issue = (account, type, reason, key, issuance = ISSUANCE) =>
  one(`select public.issue_timed_access_pass($1,$2,$3,$4,$5) as r`,
      [account, type, reason, key, issuance === null ? null : JSON.stringify(issuance)]);

async function reset() {
  await db.query(`truncate table timed_access_pass_audit, timed_access_pass_grants,
    karaoke_host_plan_assignments, karaoke_accounts restart identity cascade`);
}
const seedAccount = async () => (await one(`insert into karaoke_accounts(timezone) values('America/Los_Angeles') returning id`)).id;

const counts = async () => one(
  `select (select count(*)::int from timed_access_pass_grants) g,
          (select count(*)::int from timed_access_pass_audit) a`);

console.log('\n== BUILD 26O: pass issuance actor attribution ==\n');

// ─────────────────────────────────────────────────────────────────────────────────────────
console.log('-- the unattributed signature is RETIRED --');
{
  // oidvectortypes gives the TYPE list alone. pg_get_function_identity_arguments would include
  // parameter NAMES, which would make this assertion a spelling test rather than a signature one.
  const sigs = await q(
    `select oidvectortypes(p.proargtypes) args
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname='public' and p.proname='issue_timed_access_pass' order by 1`);
  ok(sigs.length === 1, `exactly ONE issuance function exists (found ${sigs.length}: ${sigs.map(s => s.args).join(' | ')})`);
  ok(sigs[0]?.args === 'uuid, text, text, text, jsonb',
     `its signature requires the provenance document (${sigs[0]?.args})`);
  // The old 5-text overload would have been a live path that issues with no provenance at all.
  ok(!sigs.some(s => s.args === 'uuid, text, text, text, text'),
     'the legacy 5-text signature is gone — no callable bypass remains');
}

// ─────────────────────────────────────────────────────────────────────────────────────────
console.log('\n-- a normal issuance is attributed, atomically --');
await reset();
{
  const acct = await seedAccount();
  const r = (await issue(acct, 'ONE_HOUR', 'gate', 'k-ok')).r;
  ok(r.ok === true && r.reused === false, 'issuance succeeds');

  const grant = await one(`select * from timed_access_pass_grants where id=$1`, [r.passGrantId]);
  const audit = await one(`select * from timed_access_pass_audit where pass_grant_id=$1 and action='ISSUED'`, [r.passGrantId]);

  ok(!!audit, 'an ISSUED audit row exists');
  ok(audit.metadata !== null, 'its metadata is NOT null — the 53-row production defect is closed');
  ok(audit.metadata?.actor_kind === 'shared_manager_credential', 'metadata records the credential CLASS');
  ok(audit.metadata?.actor_id === 'bty_mgr', 'metadata records the shared operator label');
  ok(audit.metadata?.source === 'manager_issue', 'metadata records the server-side source route');
  ok(audit.metadata?.version === 1, 'metadata is versioned');
  ok(audit.metadata?.session_fp === ISSUANCE.session_fp, 'metadata carries the token fingerprint');
  ok(grant.issued_by_manager === 'bty_mgr' && audit.actor_ref === 'bty_mgr',
     'grant.issued_by_manager and audit.actor_ref agree — one document, one actor');

  // The forensic join BUILD 26M could not perform.
  const joined = await one(
    `select g.id, a.metadata->>'actor_kind' kind, a.metadata->>'session_fp' fp
       from timed_access_pass_grants g join timed_access_pass_audit a
         on a.pass_grant_id = g.id and a.action='ISSUED' where g.id=$1`, [r.passGrantId]);
  ok(joined.kind === 'shared_manager_credential' && joined.fp === ISSUANCE.session_fp,
     'grant -> issuance event -> actor/source joins cleanly');
}

// ─────────────────────────────────────────────────────────────────────────────────────────
console.log('\n-- the token fingerprint narrows the BUILD 26M question --');
await reset();
{
  const acct = await seedAccount();
  // Fifteen grants seconds apart: did they share an origin at all? Before 26O, unanswerable.
  // After 26O the answer is scoped to the TOKEN VALUE — not to a human and not to a physical
  // login session, because the credential is shared in both directions.
  for (let i = 0; i < 5; i++) await issue(acct, 'ONE_HOUR', null, `burst-a-${i}`, { ...ISSUANCE, session_fp: 'aaaaaaaaaaaaaaaa' });
  for (let i = 0; i < 3; i++) await issue(acct, 'ONE_HOUR', null, `burst-b-${i}`, { ...ISSUANCE, session_fp: 'bbbbbbbbbbbbbbbb' });
  const groups = await q(
    `select metadata->>'session_fp' fp, count(*)::int n from timed_access_pass_audit
      where action='ISSUED' group by 1 order by n desc`);
  ok(groups.length === 2, `two distinct TOKEN VALUES are distinguishable (found ${groups.length})`);
  ok(groups[0].n === 5 && groups[1].n === 3, "and each token's issuance count is exact (5 / 3)");
  // Stated as the limit, not the claim: this does not identify operators.
  const kinds = await q(`select distinct metadata->>'actor_kind' k, metadata->>'actor_id' a from timed_access_pass_audit where action='ISSUED'`);
  ok(kinds.length === 1 && kinds[0].k === 'shared_manager_credential' && kinds[0].a === 'bty_mgr',
     'both token groups still resolve to the SAME shared credential — the human stays unknown');
}

// ─────────────────────────────────────────────────────────────────────────────────────────
console.log('\n-- missing or malformed provenance REFUSES, and writes nothing --');
await reset();
{
  const acct = await seedAccount();
  const before = await counts();

  const cases = [
    ['null document', null],
    ['non-object jsonb', 123],
    ['missing actor_id', { version: 1, source: 's', actor_kind: 'k' }],
    ['blank actor_id', { version: 1, source: 's', actor_kind: 'k', actor_id: '   ' }],
    ['missing source', { version: 1, actor_kind: 'k', actor_id: 'bty_mgr' }],
    ['missing actor_kind', { version: 1, source: 's', actor_id: 'bty_mgr' }],
    ['missing version', { source: 's', actor_kind: 'k', actor_id: 'bty_mgr' }],
  ];
  let allRefused = true;
  for (const [name, doc] of cases) {
    const r = (await issue(acct, 'ONE_HOUR', null, `k-bad-${name}`, doc)).r;
    const refused = r.ok === false && r.error === 'issuance_provenance_required';
    if (!refused) allRefused = false;
    ok(refused, `refused: ${name}`);
  }
  const after = await counts();
  ok(allRefused, 'every malformed document is refused');
  ok(after.g === before.g && after.a === before.a,
     `a refusal mutates NOTHING (grants ${before.g}->${after.g}, audit ${before.a}->${after.a})`);
}

// ─────────────────────────────────────────────────────────────────────────────────────────
console.log('\n-- ATOMICITY: if attribution cannot be written, the grant does not exist --');
await reset();
{
  const acct = await seedAccount();
  const before = await counts();
  // Force the AUDIT insert to fail while the GRANT insert would have succeeded. If the two were
  // separable, this is exactly the state that leaves an unattributable grant behind.
  await db.query(`alter table timed_access_pass_audit add constraint b26o_boom check (reason is distinct from 'BOOM')`);
  const err = await expectFail(`select public.issue_timed_access_pass($1,$2,$3,$4,$5)`,
    [acct, 'ONE_HOUR', 'BOOM', 'k-atomic', JSON.stringify(ISSUANCE)]);
  await db.query(`alter table timed_access_pass_audit drop constraint b26o_boom`);

  ok(err !== null, 'the audit write failed as arranged');
  const after = await counts();
  ok(after.g === before.g, `NO grant survived the failed attribution (grants ${before.g} -> ${after.g})`);
  ok(after.a === before.a, 'and no audit row survived either');
}

// ─────────────────────────────────────────────────────────────────────────────────────────
console.log('\n-- the structural floor: a new unattributed ISSUED row is rejected --');
await reset();
{
  const acct = await seedAccount();
  const g = await one(
    `insert into timed_access_pass_grants(account_id,pass_type,duration_seconds,issue_idempotency_key)
     values($1,'ONE_HOUR',3600,'k-floor') returning id`, [acct]);

  const nullMeta = await expectFail(
    `insert into timed_access_pass_audit(pass_grant_id,account_id,actor_type,actor_ref,action,from_status,to_status)
     values($1,$2,'MANAGER','bty_mgr','ISSUED',null,'AVAILABLE')`, [g.id, acct]);
  ok(nullMeta !== null, 'an ISSUED row with NULL metadata is rejected by the constraint');

  const partial = await expectFail(
    `insert into timed_access_pass_audit(pass_grant_id,account_id,actor_type,actor_ref,action,from_status,to_status,metadata)
     values($1,$2,'MANAGER','bty_mgr','ISSUED',null,'AVAILABLE','{"version":1}'::jsonb)`, [g.id, acct]);
  ok(partial !== null, 'an ISSUED row missing required provenance keys is rejected');

  // Non-ISSUED actions are deliberately untouched — 26O constrains issuance, not the lifecycle.
  const other = await expectFail(
    `insert into timed_access_pass_audit(pass_grant_id,account_id,actor_type,actor_ref,action,from_status,to_status)
     values($1,$2,'HOST',null,'SELECTED','AVAILABLE','SELECTED')`, [g.id, acct]);
  ok(other === null, 'a SELECTED audit row still needs no metadata (lifecycle unchanged)');
}

// ─────────────────────────────────────────────────────────────────────────────────────────
console.log('\n-- HISTORICAL ROWS: never backfilled, never invalidated --');
await reset();
{
  const acct = await seedAccount();
  // A pre-26O ISSUED row: NULL metadata, exactly as the 53 production rows stand today. It can
  // only be created because the constraint is NOT VALID — which is the point.
  const g = await one(
    `insert into timed_access_pass_grants(account_id,pass_type,duration_seconds,issued_by_manager,issue_idempotency_key)
     values($1,'ONE_HOUR',3600,'bty_mgr','k-historical') returning id`, [acct]);
  await db.query(`set constraints all immediate`);
  const legacy = await expectFail(
    `insert into timed_access_pass_audit(pass_grant_id,account_id,actor_type,actor_ref,action,from_status,to_status)
     values($1,$2,'MANAGER','bty_mgr','ISSUED',null,'AVAILABLE')`, [g.id, acct]);
  ok(legacy !== null, 'a NEW unattributed ISSUED row cannot be created (so the fixture below stands in for history)');

  // Simulate the true historical state the migration inherits: rows written BEFORE the
  // constraint existed. Drop it, insert, re-add NOT VALID — precisely the production sequence.
  await db.query(`alter table timed_access_pass_audit drop constraint timed_pass_issue_attribution_chk`);
  await db.query(
    `insert into timed_access_pass_audit(pass_grant_id,account_id,actor_type,actor_ref,action,from_status,to_status)
     values($1,$2,'MANAGER','bty_mgr','ISSUED',null,'AVAILABLE')`, [g.id, acct]);
  await db.query(`alter table timed_access_pass_audit add constraint timed_pass_issue_attribution_chk
    check (action <> 'ISSUED' or (metadata is not null and metadata ? 'version' and metadata ? 'source'
           and metadata ? 'actor_kind' and metadata ? 'actor_id')) not valid`);

  const hist = await one(`select metadata from timed_access_pass_audit where pass_grant_id=$1 and action='ISSUED'`, [g.id]);
  ok(hist.metadata === null, 'the historical row keeps its NULL metadata — unknown stays unknown');

  // And a new issuance still works alongside it.
  const r = (await issue(acct, 'ONE_HOUR', null, 'k-new-alongside')).r;
  ok(r.ok === true, 'new attributed issuance still succeeds beside unattributed history');
  const rows = await q(`select metadata from timed_access_pass_audit where action='ISSUED' order by created_at`);
  ok(rows.length === 2 && rows[0].metadata === null && rows[1].metadata !== null,
     'old row unattributed, new row attributed — no backfill, no fabrication');
}

// ─────────────────────────────────────────────────────────────────────────────────────────
console.log('\n-- R1: the idempotency replay boundary --');
//
// `timed_pass_issue_idem_idx` is UNIQUE on (issue_idempotency_key) ALONE — global, not
// account-scoped — and the key is chosen by the CALLER. So a key already used for account A,
// presented again for account B, finds A's row. The unique index stops a duplicate grant; it
// does NOT stop the function reporting someone else's grant as a success for B.
//
// The repository already ratified the correct shape for this in create_additional_karaoke_room:
// "SAME key + SAME payload replays the existing Room (replayed:true); a DIFFERENT payload →
// 'idempotency_conflict'". A different ACCOUNT or a different PASS TYPE is a different payload.
await reset();
{
  const a = await seedAccount();
  const b = await seedAccount();

  const first = (await issue(a, 'ONE_HOUR', null, 'shared-key')).r;
  ok(first.ok === true && first.reused === false, 'A: first issuance succeeds');

  // ---- A. same key, DIFFERENT ACCOUNT ------------------------------------------------
  const cross = (await issue(b, 'ONE_HOUR', null, 'shared-key')).r;
  ok(cross.ok === false, 'A: a key already used by another account does NOT report success');
  ok(cross.error === 'idempotency_conflict', `A: it fails closed as idempotency_conflict (got ${cross.error ?? 'ok:true'})`);
  ok(cross.passGrantId === undefined, "A: the conflict does not leak the other account's passGrantId");
  ok(cross.status === undefined && cross.passType === undefined,
     "A: the conflict leaks no other-account status or pass type either");

  const bGrants = await one(`select count(*)::int n from timed_access_pass_grants where account_id=$1`, [b]);
  ok(bGrants.n === 0, 'A: account B received no grant');
  const total = await counts();
  ok(total.g === 1, 'A: no second grant was created anywhere');

  // ---- B. same key + same account, DIFFERENT PASS TYPE --------------------------------
  const wrongType = (await issue(a, 'FOUR_HOURS', null, 'shared-key')).r;
  ok(wrongType.ok === false, 'B: the same key for a DIFFERENT pass type does not replay');
  ok(wrongType.error === 'idempotency_conflict', `B: it fails closed as idempotency_conflict (got ${wrongType.error ?? 'ok:true'})`);
  const aGrants = await q(`select pass_type, duration_seconds from timed_access_pass_grants where account_id=$1`, [a]);
  ok(aGrants.length === 1 && aGrants[0].pass_type === 'ONE_HOUR',
     'B: the original ONE_HOUR grant is untouched and no FOUR_HOURS grant appeared');

  // ---- the TRUE replay still replays --------------------------------------------------
  const trueReplay = (await issue(a, 'ONE_HOUR', null, 'shared-key')).r;
  ok(trueReplay.ok === true && trueReplay.reused === true && trueReplay.passGrantId === first.passGrantId,
     'same account + same pass type + same key still replays the SAME grant');

  const auditRows = await one(`select count(*)::int n from timed_access_pass_audit where action='ISSUED'`);
  ok(auditRows.n === 1, 'a conflict writes no ISSUED audit row');
}

// ─────────────────────────────────────────────────────────────────────────────────────────
console.log('\n-- R1: the CONCURRENT collision reaches the same verdict --');
//
// The sequential cases above never reach the unique_violation handler: the read catches them
// first. A mutation test proved that gap was real — a handler rewritten to return
// `{ok:true, reused:true}` SURVIVED the whole suite. Only a genuine race exercises it.
//
// The advisory lock is keyed by ACCOUNT, so two accounts sharing one key take DIFFERENT locks
// and cannot exclude each other. The global unique index is the only thing standing between
// them, and this proves what the function does when it fires.
await reset();
{
  const a = await seedAccount();
  const b = await seedAccount();

  const other = new pg.Client(CONN); await other.connect();
  // Client 1 inserts and HOLDS the transaction open, so client 2's read cannot see the row.
  await other.query('begin');
  const first = (await other.query(
    `select public.issue_timed_access_pass($1,'ONE_HOUR',null,'race-key',$2) as r`,
    [a, JSON.stringify(ISSUANCE)])).rows[0].r;
  ok(first.ok === true, 'racer 1 issues inside an open transaction');

  // Client 2 finds nothing, attempts the insert, and blocks on the unique index.
  const racer2 = db.query(
    `select public.issue_timed_access_pass($1,'ONE_HOUR',null,'race-key',$2) as r`,
    [b, JSON.stringify(ISSUANCE)]);
  await new Promise(r => setTimeout(r, 250));   // let it reach the index and block
  await other.query('commit');
  await other.end();

  const second = (await racer2).rows[0].r;
  ok(second.ok === false, 'the losing racer does NOT report success');
  ok(second.error === 'idempotency_conflict',
     `the index collision surfaces as the SAME typed conflict (got ${second.error ?? 'ok:true'})`);
  ok(second.passGrantId === undefined, 'and still leaks no grant id');

  const total = await counts();
  ok(total.g === 1, 'exactly one grant exists after the race');
  const owner = await one(`select account_id from timed_access_pass_grants where issue_idempotency_key='race-key'`);
  ok(owner.account_id === a, 'and it belongs to the racer that actually won');
  ok(total.a === 1, 'exactly one ISSUED audit row — the loser wrote nothing');
}

// ─────────────────────────────────────────────────────────────────────────────────────────
console.log('\n-- EXISTING PASS SEMANTICS ARE UNCHANGED --');
await reset();
{
  const acct = await seedAccount();

  const h1 = (await issue(acct, 'ONE_HOUR', null, 'sem-1h')).r;
  const h4 = (await issue(acct, 'FOUR_HOURS', null, 'sem-4h')).r;
  const h24 = (await issue(acct, 'TWENTY_FOUR_HOURS', null, 'sem-24h')).r;
  const durs = await q(`select pass_type, duration_seconds from timed_access_pass_grants order by duration_seconds`);
  ok(durs.map(d => d.duration_seconds).join(',') === '3600,14400,86400', 'durations still 3600 / 14400 / 86400');
  ok(h1.status === 'AVAILABLE' && h4.status === 'AVAILABLE' && h24.status === 'AVAILABLE',
     'issuance still yields AVAILABLE (never active, never selected)');

  const g1 = await one(`select carryover_seconds, activated_at, expires_at, selected_at, source_type, is_paid, apple_purchase_id
                          from timed_access_pass_grants where id=$1`, [h1.passGrantId]);
  ok(Number(g1.carryover_seconds) === 0, 'carryover still 0 at issue');
  ok(g1.activated_at === null && g1.expires_at === null && g1.selected_at === null,
     'issuance still sets no activation/expiry/selection clock');
  ok(g1.source_type === 'MANUAL_PROMOTIONAL' && g1.is_paid === false && g1.apple_purchase_id === null,
     'commerce classification untouched — still MANUAL_PROMOTIONAL, unpaid, no Apple linkage');

  // Idempotent replay returns the SAME grant and creates no second audit row.
  const replay = (await issue(acct, 'ONE_HOUR', null, 'sem-1h')).r;
  ok(replay.reused === true && replay.passGrantId === h1.passGrantId, 'replay still returns the same grant');
  const auditsFor1h = await one(`select count(*)::int n from timed_access_pass_audit where pass_grant_id=$1`, [h1.passGrantId]);
  ok(auditsFor1h.n === 1, 'a replay writes no second ISSUED audit row');

  // A replay must not RE-ATTRIBUTE a grant someone else created.
  const replayOther = (await issue(acct, 'ONE_HOUR', null, 'sem-1h', { ...ISSUANCE, session_fp: 'ffffffffffffffff' })).r;
  ok(replayOther.reused === true, 'a replay from a different session is still a replay');
  const stillFirst = await one(`select metadata->>'session_fp' fp from timed_access_pass_audit where pass_grant_id=$1 and action='ISSUED'`, [h1.passGrantId]);
  ok(stillFirst.fp === ISSUANCE.session_fp, 'and it does NOT re-attribute the original issuance');

  // Pre-existing typed refusals survive.
  ok((await issue(acct, 'TWO_HOURS', null, 'sem-bad')).r.error === 'invalid_pass_type', 'invalid_pass_type preserved');
  ok((await issue(acct, 'ONE_HOUR', null, '  ')).r.error === 'idempotency_key_required', 'idempotency_key_required preserved');
  ok((await issue('11111111-1111-1111-1111-111111111111', 'ONE_HOUR', null, 'sem-noacct')).r.error === 'account_not_found',
     'account_not_found preserved');

  const pro = await seedAccount();
  await db.query(`insert into karaoke_host_plan_assignments(account_id, plan_code, status) values($1,'PRO','active')`, [pro]);
  ok((await issue(pro, 'ONE_HOUR', null, 'sem-pro')).r.error === 'account_is_pro', 'account_is_pro preserved');
}

// ─────────────────────────────────────────────────────────────────────────────────────────
console.log('\n-- SELECT / ACTIVATION / EXPIRY authority is not touched by 26O --');
await reset();
{
  const acct = await seedAccount();
  const r = (await issue(acct, 'ONE_HOUR', null, 'life-1')).r;
  const sel = (await one(`select public.select_timed_access_pass($1,$2,$3) as r`, [acct, r.passGrantId, 'sel-1'])).r;
  ok(sel.ok === true, 'select_timed_access_pass still works after the migration');
  const g = await one(`select status, selected_at, activated_at, expires_at from timed_access_pass_grants where id=$1`, [r.passGrantId]);
  ok(g.status === 'SELECTED' && g.selected_at !== null && g.activated_at === null && g.expires_at === null,
     'SELECTED still arms without starting the clock');
  const selAudit = await one(`select metadata from timed_access_pass_audit where pass_grant_id=$1 and action='SELECTED'`, [r.passGrantId]);
  ok(!!selAudit, 'the SELECTED audit row is still written, and needs no issuance metadata');
}

console.log(`\n${pass} passed, ${fails.length} failed`);
if (fails.length) { for (const f of fails) console.log('FAILED: ' + f); process.exit(1); }
await db.end();
