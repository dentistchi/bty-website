import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const URL = process.env.BTY_TRACKING_PG_TEST_URL ?? "";
const MIGRATIONS = join(process.cwd(), "supabase/migrations");
const read = (f: string) => readFileSync(join(MIGRATIONS, f), "utf8");
const CANONICAL = "uuid, uuid, text, text, text, text, text[]";
const BOOTSTRAP = `
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
end $$;
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key default gen_random_uuid());
create table if not exists auth.identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  identity_data jsonb not null default '{}'::jsonb
);
create table if not exists public.bty_action_captures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  preview_text text,
  source_url text
);
`;

/** History, then the production shape 20260912 expects, then everything applied since. */
const ADOPT_PRODUCTION_SHAPE = `
drop function if exists public.bty_track_announcement(uuid, uuid, text, text, text, text[], text);
create or replace function public.bty_track_announcement(
  p_owner_user_id uuid, p_source_capture_id uuid, p_host_framing text, p_tenant_id text,
  p_conversation_id text, p_service_url text, p_recipient_oids text[]
) returns table (announcement_id uuid, resolved_count integer, already_existed boolean)
language plpgsql security definer set search_path = pg_catalog, public
as $fn$ begin return query select null::uuid, 0, false; end; $fn$;
revoke all on function public.bty_track_announcement(${CANONICAL}) from public, anon, authenticated;
grant execute on function public.bty_track_announcement(${CANONICAL}) to service_role;
`;

const APPLIED = [
  BOOTSTRAP,
  read("20260902000000_bty_tracked_announcements_v1.sql"),
  read("20260906000000_bty_announcement_recipient_handled_v1.sql"),
  read("20260907000000_bty_announcement_service_url_v1.sql"),
  read("20260911000000_bty_bind_recipients_on_canonical_entry_v1.sql"),
  ADOPT_PRODUCTION_SHAPE,
  read("20260912000000_bty_announcement_thread_v1.sql"),
  read("20260913000000_bty_today_dismissal_v1.sql"),
  read("20260914000000_bty_identity_integrity_reconciliation_v1.sql"),
];

const MIGRATION = "20260927051100_announcement_tracking_modes_v1.sql";
let root: Pool; let db: Pool;
const name = `tracking_v1_${process.pid}`;
beforeAll(async () => {
 if (!URL) return;
 const url = new globalThis.URL(URL);
 if (!["localhost", "127.0.0.1"].includes(url.hostname)) throw new Error("Local PostgreSQL only");
 root = new Pool({ connectionString: URL });
 await root.query(`create database ${name}`);
 url.pathname = `/${name}`;
 db = new Pool({ connectionString: url.toString(), max: 12 });
 for (const sql of [...APPLIED, read("20260915000000_bty_host_track_history_retention_v1.sql")]) await db.query(sql);
 await db.query(read(MIGRATION));
 await db.query(read(MIGRATION));
}, 60000);
afterAll(async () => { await db?.end(); if (root) { await root.query(`drop database ${name}`); await root.end(); } });
const oid = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12,"0")}`;
async function seed() {
 const host = (await db.query("insert into auth.users default values returning id")).rows[0].id;
 const cap = (await db.query("insert into public.bty_action_captures(user_id) values($1) returning id",[host])).rows[0].id;
 await db.query(`insert into auth.identities(user_id,provider,identity_data) values($1,'azure',$2)`,[host,JSON.stringify({custom_claims:{oid:oid(99)}})]);
 return {host,cap};
}
async function track(s: {host:string;cap:string}, recipients: string[], mode="acknowledgment") {
 return (await db.query("select * from public.bty_track_announcement_v1($1,$2,'Notice',$3,'conversation',null,$4,$5)",[s.host,s.cap,oid(100),recipients,mode])).rows[0];
}
async function recipient(ann: string, index=1) {
 const user=(await db.query("insert into auth.users default values returning id")).rows[0].id;
 await db.query("update public.bty_tracked_announcement_recipients set user_id=$1,bound_at=now() where announcement_id=$2 and aad_object_id=$3",[user,ann,oid(index)]);
 return user;
}
async function evidence(ann: string,user:string,action:string,text:string|null=null) {
 return (await db.query("select * from public.bty_record_announcement_evidence($1,$2,$3,$4)",[ann,user,action,text])).rows[0].result;
}
async function row(ann:string) { return (await db.query("select * from public.bty_tracked_announcement_recipients where announcement_id=$1",[ann])).rows[0]; }

describe.runIf(!!URL)("announcement modes: real migrations, RPC, roles and retries",()=> {
 it("excludes self, freezes exactly ten recipients, and concurrent retries preserve a single audience and mode",async()=> {
  const s=await seed(); const audience=Array.from({length:10},(_,i)=>oid(i+1));
  const results=await Promise.all(Array.from({length:8},()=>track(s,[oid(99),...audience,...audience])));
  expect(new Set(results.map(r=>r.announcement_id)).size).toBe(1);
  expect(results.filter(r=>!r.already_existed)).toHaveLength(1);
  expect(results.every(r=>r.resolved_count===10)).toBe(true);
  const ann=results[0].announcement_id;
  expect(Number((await db.query("select count(*) n from public.bty_tracked_announcement_recipients where announcement_id=$1",[ann])).rows[0].n)).toBe(10);
  await track(s,[oid(1)],"response");
  expect((await db.query("select tracking_mode from public.bty_tracked_announcements where id=$1",[ann])).rows[0].tracking_mode).toBe("acknowledgment");
 });
 it("self-only and empty audience create no announcement",async()=> {
  const s=await seed();
  await expect(track(s,[oid(99)])).rejects.toThrow("zero_recipients");
  await expect(track(s,[])).rejects.toThrow("zero_recipients");
  expect(Number((await db.query("select count(*) n from public.bty_tracked_announcements where source_capture_id=$1",[s.cap])).rows[0].n)).toBe(0);
 });
 it("opening only records opening; explicit acknowledgment completes exactly once",async()=> {
  const s=await seed();const {announcement_id:ann}=await track(s,[oid(1)]);const user=await recipient(ann);
  expect(await evidence(ann,user,"open")).toBe("recorded");
  const opened=await row(ann);expect(opened.opened_at).not.toBeNull();expect(opened.acknowledged_at).toBeNull();expect(opened.response_submitted_at).toBeNull();
  expect(await evidence(ann,user,"respond","a reply")).toBe("invalid_action");
  expect(await evidence(ann,user,"acknowledge")).toBe("recorded");const ack=(await row(ann)).acknowledged_at;
  await evidence(ann,user,"acknowledge");expect((await row(ann)).acknowledged_at).toEqual(ack);
 });
 it("response requires nonempty answer; neither open nor acknowledgment completes; retries retain text",async()=> {
  const s=await seed();const {announcement_id:ann}=await track(s,[oid(1)],"response");const user=await recipient(ann);
  await evidence(ann,user,"open");expect(await evidence(ann,user,"acknowledge")).toBe("invalid_action");
  expect(await evidence(ann,user,"respond"," ")).toBe("invalid_response");expect((await row(ann)).response_submitted_at).toBeNull();
  expect(await evidence(ann,user,"respond","My answer")).toBe("recorded");const first=await row(ann);
  await evidence(ann,user,"respond","changed");const second=await row(ann);
  expect(second.response_text).toBe("My answer");expect(second.response_submitted_at).toEqual(first.response_submitted_at);expect(second.acknowledged_at).toBeNull();
 });
 it("non-recipient cannot open/complete, closed announcements reject and source ownership is checked",async()=> {
  const s=await seed();const {announcement_id:ann}=await track(s,[oid(1)]);const user=await recipient(ann);
  expect(await evidence(ann,s.host,"acknowledge")).toBe("not_a_recipient");
  await db.query("update public.bty_tracked_announcements set status='closed',closed_at=now() where id=$1",[ann]);
  expect(await evidence(ann,user,"acknowledge")).toBe("closed");
  await expect(track({...s,host:user},[oid(2)])).rejects.toThrow("invalid_source_owner");
 });
 it("legacy rows have no invented evidence; existing RPC and existing Track reuse preserve legacy mode",async()=> {
  const s=await seed();const legacy=(await db.query("select * from public.bty_track_announcement($1,$2,'Legacy',$3,'conversation',null,$4)",[s.host,s.cap,oid(100),[oid(1)]])).rows[0];
  const user=await recipient(legacy.announcement_id);
  await track(s,[oid(1)],"response");
  expect((await db.query("select tracking_mode from public.bty_tracked_announcements where id=$1",[legacy.announcement_id])).rows[0].tracking_mode).toBeNull();
  expect(await evidence(legacy.announcement_id,user,"open")).toBe("legacy");
  expect((await row(legacy.announcement_id)).opened_at).toBeNull();
  expect((await db.query("select * from public.bty_respond_to_announcement($1,$2,'ACKNOWLEDGED',null)",[legacy.announcement_id,user])).rows[0].result).toBe("responded");
 });
 it("RLS stays enabled and only the service role can execute evidence/creation RPCs",async()=> {
  const flags=await db.query("select relrowsecurity from pg_class where oid in ('public.bty_tracked_announcements'::regclass,'public.bty_tracked_announcement_recipients'::regclass)");
  expect(flags.rows.every(r=>r.relrowsecurity)).toBe(true);
  for(const role of ["anon","authenticated"]) {
   for (const table of ["bty_tracked_announcements", "bty_tracked_announcement_recipients"]) {
    for (const privilege of ["SELECT", "INSERT", "UPDATE", "DELETE"]) {
     expect((await db.query("select has_table_privilege($1,$2,$3) allowed",[role,`public.${table}`,privilege])).rows[0].allowed).toBe(false);
    }
   }
   expect((await db.query("select has_function_privilege($1,'public.bty_record_announcement_evidence(uuid,uuid,text,text)','EXECUTE') allowed",[role])).rows[0].allowed).toBe(false);
   expect((await db.query("select has_function_privilege($1,'public.bty_track_announcement_v1(uuid,uuid,text,text,text,text,text[],text)','EXECUTE') allowed",[role])).rows[0].allowed).toBe(false);
  }
  expect((await db.query("select has_function_privilege('service_role','public.bty_record_announcement_evidence(uuid,uuid,text,text)','EXECUTE') allowed")).rows[0].allowed).toBe(true);
 });
});
