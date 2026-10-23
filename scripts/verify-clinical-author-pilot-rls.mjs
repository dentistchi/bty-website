import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

// Run only in-memory. No URL or database connection is accepted.
if (!process.argv[2]) throw Error('Pass the absolute repository root as the only argument.');
const base = resolve(process.argv[2], 'supabase/migrations') + '/';
const original = readFileSync(base + '20260919131044_clinical_reasoning_trace_v1.sql', 'utf8');
const lifecycle = readFileSync(base + '20260920210152_clinical_encounter_attempt_lifecycle.sql', 'utf8');
const migration = readFileSync(base + '20261023201720_clinical_author_pilot_api_owned.sql', 'utf8');
const db = new PGlite();
const log = [];
const note = (s) => { log.push(s); console.log(s); };
const owner = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const table = 'public.clinical_reasoning_traces';
const row = async (id, schema, user = owner) => db.query(`insert into ${table}
  (trace_id,user_id,case_id,case_version,trace_schema_version,trace_role,raw_trace,derived_metrics,status,source_product,content_provenance,started_at)
  values ($1,$2,'drchi-023','2026-10-23.1',$3,'learner','{"original":"kept"}','{}','active','isolated fixture','{}',now()) returning trace_id`, [id,user,schema]);
async function denied(label, f) {
  let error;
  try { await f(); } catch (e) { error = e; }
  assert.equal(error?.code, '42501', label + ': expected RLS insufficient_privilege');
  note('PASS ' + label + ' (42501)');
}
try {
  note('Environment: @electric-sql/pglite@0.5.11, in-memory WASM; no remote DB');
  note((await db.query('select version() as version')).rows[0].version);
  await db.exec(`create schema auth;
    create table auth.users(id uuid primary key);
    create role authenticated;
    create role service_role bypassrls;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    insert into auth.users values ('${owner}'),('${other}');`);
  await db.exec(original);
  await db.exec(lifecycle);
  await db.exec(`grant usage on schema public,auth to authenticated,service_role;
    grant select,insert,update,delete on ${table} to authenticated,service_role;`);
  await row('pilot-existing', 'clinical-author-pilot/v1');
  await row('other-existing', 'clinical-encounter-trace/v2', other);
  await db.exec(migration);
  await db.exec(migration);
  const policies = (await db.query(`select policyname,permissive,cmd from pg_policies where tablename='clinical_reasoning_traces' and policyname like 'clinical_author_pilot_api_owned%' order by policyname`)).rows;
  assert.equal(policies.length, 2);
  assert.ok(policies.every(p => p.permissive === 'RESTRICTIVE'));
  note('PASS migration applied twice, exactly two restrictive pilot policies remain');
  await db.exec('set role authenticated');
  await db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [owner]);
  await denied('authenticated pilot insert denied', () => row('pilot-auth', 'clinical-author-pilot/v1'));
  const changed = await db.query(`update ${table} set raw_trace='{"original":"tampered"}' where trace_id='pilot-existing' returning trace_id`);
  assert.equal(changed.rows.length,0);
  note('PASS authenticated pilot update filtered to zero rows');
  const selected = await db.query(`select trace_id,raw_trace from ${table} where trace_id='pilot-existing'`);
  assert.equal(selected.rows.length,1);
  assert.equal(selected.rows[0].raw_trace.original,'kept');
  note('PASS owner SELECT still reads original pilot row');
  assert.equal((await row('legacy-own','clinical-encounter-trace/v2')).rows.length,1);
  assert.equal((await db.query(`update ${table} set raw_trace='{"legacy":"updated"}' where trace_id='legacy-own' returning trace_id`)).rows.length,1);
  note('PASS legacy owner insert/update still allowed');
  await denied('legacy-to-pilot schema change denied', () => db.query(`update ${table} set trace_schema_version='clinical-author-pilot/v1' where trace_id='legacy-own' returning trace_id`));
  await denied('cross-owner insert denied', () => row('cross-owner','clinical-encounter-trace/v2',other));
  assert.equal((await db.query(`select trace_id from ${table} where trace_id='other-existing'`)).rows.length,0);
  assert.equal((await db.query(`update ${table} set raw_trace='{}' where trace_id='other-existing' returning trace_id`)).rows.length,0);
  note('PASS cross-owner SELECT/UPDATE return zero rows');
  await db.exec('reset role; set role service_role');
  assert.equal((await row('server-pilot','clinical-author-pilot/v1')).rows.length,1);
  assert.equal((await db.query(`update ${table} set raw_trace='{"server":"appended"}' where trace_id='server-pilot' returning trace_id`)).rows.length,1);
  note('PASS service_role BYPASSRLS pilot insert/update allowed');
  await db.exec('reset role');
  assert.equal((await db.query(`select raw_trace from ${table} where trace_id='pilot-existing'`)).rows[0].raw_trace.original,'kept');
  assert.equal((await db.query(`select trace_schema_version from ${table} where trace_id='legacy-own'`)).rows[0].trace_schema_version,'clinical-encounter-trace/v2');
  note('PASS denied writes did not modify original pilot or legacy schema');
  note('LIMIT: isolated SQL semantics only; production policies/grants, auth JWTs, REST and live persistence not verified.');
} catch (e) {
  note('FAIL ' + (e?.stack ?? e));
  process.exitCode = 1;
} finally {
  await db.close();
}
