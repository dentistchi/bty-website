#!/usr/bin/env node
/**
 * Opt-in database rehearsal. ONLY an isolated loopback database with this exact name is allowed.
 * It creates fictional auth identities, applies the new migration twice, and tests real SQL locks.
 * Run: BTY_REWARDS_TEST_DATABASE_URL=postgresql://...@127.0.0.1:PORT/bty_learning_rewards_test node scripts/verify-learning-rewards-db.mjs
 * Never consumes application Supabase credentials or contacts a remote database.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Client } from 'pg';

const connectionString = process.env.BTY_REWARDS_TEST_DATABASE_URL;
if (!connectionString) throw Error('Explicit isolated test database URL required');
const url = new URL(connectionString);
if (!['127.0.0.1','localhost','[::1]'].includes(url.hostname) || url.pathname !== '/bty_learning_rewards_test' || url.search || url.hash) {
  throw Error('Refused: only the dedicated loopback rewards test database is permitted');
}
const db = new Client({ connectionString });
await db.connect();
let checks = 0;
const check = (condition, message) => { assert.ok(condition,message); checks++; };
const migration = await readFile(new URL('../supabase/migrations/20261030221620_learning_rewards_v1_atomic_ledger.sql',import.meta.url),'utf8');
const user = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';
const empty = '00000000-0000-4000-8000-000000000003';
const evidence = (overrides = {}) => ({
  policy_version:'learning-rewards/v1',source_type:'foundry_learn',source_id:'learn-1',
  assignment_key:'assignment-1',content_key:'module-1',content_version:'v1',action:'learn',
  completed_at:'2026-10-15T15:00:00.000Z',timezone:'America/Los_Angeles',
  metadata:{moduleKey:'module-1'},...overrides,
});
async function record(item, userId = user, client = db) {
  return (await client.query('select * from public.bty_record_learning_reward($1,$2::jsonb)',[userId,JSON.stringify(item)])).rows[0];
}
async function refused(item, expected) {
  await assert.rejects(record(item), expected); checks++;
}
async function state(userId = user) {
  return (await db.query('select public.bty_get_learning_reward_state($1) as state',[userId])).rows[0].state;
}
async function parallel(items, userId) {
  const clients = await Promise.all(items.map(async () => { const c = new Client({connectionString}); await c.connect(); await c.query('set role service_role'); return c; }));
  try { return await Promise.all(items.map((item,i)=>record(item,userId,clients[i]))); }
  finally { await Promise.all(clients.map(c=>c.end())); }
}
try {
  // Bootstrap only the dependencies of this migration, in an otherwise isolated test database.
  await db.query(`do $$ begin
    if not exists(select from pg_roles where rolname='anon') then create role anon nologin; end if;
    if not exists(select from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
    if not exists(select from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
  end $$;
  create schema if not exists auth;
  create table if not exists auth.users(id uuid primary key);
  grant usage on schema public,auth to anon,authenticated,service_role;`);
  // Supabase-style broad defaults must be narrowed, not merely followed by smaller GRANTs.
  await db.query('alter default privileges in schema public grant all on tables to anon,authenticated,service_role');
  await db.query(migration);
  await db.query(migration);
  check(true,'Migration reapplication is idempotent');
  const policy = await db.query(`select started_at from public.learning_reward_policy where policy_version='learning-rewards/v1'`);
  check(policy.rows.length === 1,'One immutable activation baseline after replay');
  // Move ONLY the isolated test policy baseline back so deterministic fictional dates qualify.
  await db.query(`update public.learning_reward_policy set started_at='2026-10-01T00:00:00Z'`);
  await db.query('insert into auth.users(id) values($1),($2),($3) on conflict do nothing',[user,other,empty]);
  const rls = await db.query(`select relname,relrowsecurity from pg_class where relname in
    ('learning_reward_policy','learning_reward_profiles','learning_reward_completions','learning_reward_ledger')`);
  check(rls.rows.length === 4 && rls.rows.every(r=>r.relrowsecurity),'All four exposed tables have RLS');
  for (const role of ['anon','authenticated']) {
    const acl = await db.query(`select has_function_privilege($1,'public.bty_record_learning_reward(uuid,jsonb)','EXECUTE') as award,
      has_function_privilege($1,'public.bty_get_learning_reward_state(uuid)','EXECUTE') as read,
      has_table_privilege($1,'public.learning_reward_ledger','SELECT') as ledger,
      has_function_privilege($1,'public.bty_acknowledge_learning_achievements(uuid,text[])','EXECUTE') as ack`,[role]);
    check(!acl.rows[0].award && !acl.rows[0].read && !acl.rows[0].ledger && !acl.rows[0].ack,`${role} cannot invoke rewards or read another learner`);
  }
  await db.query('set role service_role');
  const blank = await state(empty);
  check(blank.completions.length === 0 && blank.ledger.length === 0 && blank.timezone === null,'Read-only empty state has no profile side effect');
  const first = await record(evidence());
  check(first.xp === 10 && first.disposition === 'awarded','Learn credits 10');
  const duplicate = await record(evidence());
  check(duplicate.xp === 0 && duplicate.disposition === 'duplicate' && duplicate.completion_id === first.completion_id,'Exact retry adds no XP');
  const sameAssignment = await record(evidence({source_id:'different-attempt'}));
  check(sameAssignment.disposition === 'duplicate','A new attempt ID does not re-award the same assignment/content');
  const capped = await record(evidence({source_id:'learn-2',assignment_key:'assignment-2',content_key:'module-2'}));
  check(capped.disposition === 'daily_cap' && capped.xp === 0,'Distinct same-day Learn respects type cap');
  const afterCap = await state();
  check(afterCap.completions.length === 2 && afterCap.ledger.length === 1,'Capped learning remains badge evidence');
  check((await record(evidence({source_id:'learn-2',assignment_key:'assignment-2',content_key:'module-2'}))).disposition === 'duplicate','Capped completion cannot be claimed again tomorrow');
  const beforeFive = await record(evidence({source_id:'learn-before-five',assignment_key:'assignment-before-five',completed_at:'2026-10-16T11:59:59Z'}));
  const atFive = await record(evidence({source_id:'learn-at-five',assignment_key:'assignment-at-five',completed_at:'2026-10-16T12:00:00Z'}));
  check(beforeFive.disposition === 'daily_cap' && atFive.disposition === 'awarded','BTY day turns over at 05:00 local');
  const tzSwitch = await record(evidence({source_id:'learn-tz',assignment_key:'assignment-tz',completed_at:'2026-10-16T12:01:00Z',timezone:'Asia/Seoul'}));
  check(tzSwitch.disposition === 'daily_cap' && (await state()).timezone === 'America/Los_Angeles','Timezone hint cannot reset cap');
  const p = await record(evidence({source_type:'clinical_practice',source_id:'clinical-1',assignment_key:'clinical-1',content_key:'drchi-001',action:'practice',metadata:{clinicalCaseId:'drchi-001'}}));
  check(p.xp === 20,'Practice independently credits 20');
  const revisitMeta={revisitBaselineAt:'2026-10-12T15:00:00Z',revisitVariant:'variant-2',baselineVariant:'variant-1'};
  await refused(evidence({source_type:'assigned_revisit',source_id:'too-soon',assignment_key:'too-soon',action:'revisit',completed_at:'2026-10-15T14:59:59Z',metadata:revisitMeta}),/INVALID_REVISIT_EVIDENCE/);
  await refused(evidence({source_type:'assigned_revisit',source_id:'same-variant',assignment_key:'same-variant',action:'revisit',metadata:{...revisitMeta,revisitVariant:'variant-1'}}),/INVALID_REVISIT_EVIDENCE/);
  const revisit = await record(evidence({source_type:'assigned_revisit',source_id:'revisit-1',assignment_key:'revisit-1',action:'revisit',metadata:revisitMeta}));
  check(revisit.xp === 20,'A distinct variant at exactly 72 hours credits 20');
  const follow = await record(evidence({source_type:'foundry_followup',source_id:'follow-1',assignment_key:'follow-1',action:'followup',metadata:{followupDays:30}}));
  check(follow.xp === 10,'Follow-up independently credits 10');
  await refused(evidence({source_id:'old',assignment_key:'old',completed_at:'2026-09-30T23:59:59Z'}),/REWARD_OUTSIDE_POLICY_WINDOW/);
  await refused(evidence({source_id:'future',assignment_key:'future',completed_at:'2999-01-01T00:00:00Z'}),/REWARD_OUTSIDE_POLICY_WINDOW/);
  await refused(evidence({timezone:'Not/A_Zone'}),/INVALID_REWARD_TIMEZONE/);
  await refused(evidence({metadata:{reflection:'Patient private note'}}),/INVALID_REWARD_EVIDENCE/);
  await refused(evidence({source_type:'clinical_practice',action:'learn'}),/INVALID_REWARD_EVIDENCE/);
  check((await state()).ledger.reduce((sum,r)=>sum+r.xp,0) === 70,'Lifetime sum contains only credits, no duplicate/capped rows');
  const same = await parallel(Array.from({length:12},()=>evidence({source_id:'race-identical',assignment_key:'race-identical'})),other);
  check(same.filter(r=>r.disposition==='awarded').length === 1 && same.reduce((sum,r)=>sum+r.xp,0) === 10,'12 concurrent identical requests award once');
  const different = await parallel(Array.from({length:12},(_,i)=>evidence({source_type:'clinical_practice',source_id:`race-${i}`,assignment_key:`race-${i}`,content_key:`case-${i}`,action:'practice',metadata:{clinicalCaseId:`case-${i}`}})),other);
  check(different.filter(r=>r.disposition==='awarded').length === 1 && different.filter(r=>r.disposition==='daily_cap').length === 11,'12 concurrent distinct practices respect one daily credit');
  const otherState = await state(other);
  check(otherState.completions.length === 13 && otherState.ledger.length === 2,'Race preserves every distinct learning completion');
  check((await state(empty)).ledger.length === 0,'Owner-scoped state never returns another user rewards');
  await db.query('update public.learning_reward_profiles set featured_badge_id=$2 where user_id=$1',[user,'first']);
  check((await state()).featured_badge_id === 'first','Server can persist the selected badge');
  const acks = await parallelAcks([['badge:first'],['badge:clinical'],['level:10']]);
  check(acks.length === 3 && (await state()).seen_achievement_ids.length === 3,'Concurrent achievement acknowledgements union without lost updates');
  const countBeforeAck = (await state()).ledger.length;
  await db.query('select public.bty_acknowledge_learning_achievements($1,$2::text[])',[user,['badge:first']]);
  check((await state()).ledger.length === countBeforeAck,'Acknowledgement/replay never writes XP');
  await assert.rejects(db.query('select public.bty_acknowledge_learning_achievements($1,$2::text[])',[user,['invented:future']]),/INVALID_ACHIEVEMENT_ACKNOWLEDGEMENT/); checks++;
  await assert.rejects(db.query('update public.learning_reward_profiles set timezone=$2 where user_id=$1',[user,'Asia/Seoul']),/permission denied/); checks++;
  await assert.rejects(db.query('delete from public.learning_reward_ledger where user_id=$1',[user]),/permission denied/); checks++;
  // Force a ledger failure in the isolated database: the completion must roll back atomically.
  await db.query('reset role');
  await db.query(`create function public.rewards_test_refuse_insert() returns trigger language plpgsql as $$ begin raise exception 'TEST_LEDGER_FAILURE'; end $$;
    create trigger rewards_test_failure before insert on public.learning_reward_ledger for each row execute function public.rewards_test_refuse_insert();`);
  await db.query('set role service_role');
  await refused(evidence({source_id:'atomic-failure',assignment_key:'atomic-failure',completed_at:'2026-10-17T15:00:00Z'}),/TEST_LEDGER_FAILURE/);
  check(!(await state()).completions.some(r=>r.source_id==='atomic-failure'),'Ledger failure does not leave a completion/XP half-write');
  await db.query('reset role');
  await db.query('drop trigger rewards_test_failure on public.learning_reward_ledger; drop function public.rewards_test_refuse_insert();');
  console.log(JSON.stringify({ok:true,checks,scope:'isolated PostgreSQL; fictional records only; no Supabase or production access'}));
} finally { await db.end(); }

async function parallelAcks(items) {
  const clients = await Promise.all(items.map(async () => { const c = new Client({connectionString}); await c.connect(); await c.query('set role service_role'); return c; }));
  try { return await Promise.all(items.map((ids,i)=>clients[i].query('select public.bty_acknowledge_learning_achievements($1,$2::text[])',[user,ids]))); }
  finally { await Promise.all(clients.map(c=>c.end())); }
}
