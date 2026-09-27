import { trackAnnouncement } from "./trackAnnouncement.server";
import { isTrackInScope } from "@/domain/daily/todayDismissal";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
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
  source_url text,
  source_type text, external_key text, source_metadata jsonb, status text, saved_at timestamptz,
  unique(user_id,source_type,external_key)
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
  `create table public.bty_teams_tenant_routes(tenant_id text primary key,service_url text);
   create table public.bty_organizations(id uuid primary key,status text not null check(status in ('active','inactive')));
   create table public.bty_org_memberships(user_id uuid references auth.users(id),organization_id uuid references public.bty_organizations(id),status text not null check(status in ('active','inactive')),is_primary boolean not null,unique(user_id,organization_id));
   create unique index active_primary_membership on public.bty_org_memberships(user_id) where status='active' and is_primary;`,
  read("20260829000000_bty_microsoft_identity_resolver_v1.sql"),
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
 await db.query(`insert into auth.identities(user_id,provider,identity_data) values($1,'azure',$2)`,[host,JSON.stringify({custom_claims:{tid:oid(100),oid:host}})]);
 const org=(await db.query("insert into public.bty_organizations values(gen_random_uuid(),'active') returning id")).rows[0].id;
 await db.query("insert into public.bty_org_memberships values($1,$2,'active',true)",[host,org]);
 const users: Record<string,string>={};
 for(let i=1;i<=10;i++) {
  const user=(await db.query("insert into auth.users default values returning id")).rows[0].id; users[oid(i)]=user;
  // Each seed uses a distinct tenant so canonical OIDs cannot collide across fixtures.
  await db.query("insert into auth.identities(user_id,provider,identity_data) values($1,'azure',$2)",[user,JSON.stringify({custom_claims:{tid:host,oid:oid(i)}})]);
  await db.query("insert into public.bty_org_memberships values($1,$2,'active',true)",[user,org]);
 }
 await db.query("update auth.identities set identity_data=$2 where user_id=$1",[host,JSON.stringify({custom_claims:{tid:host,oid:host}})]);
 return {host,cap,org,users};
}
async function track(s: {host:string;cap:string}, recipients: string[], mode="acknowledgment") {
 return (await db.query("select * from public.bty_track_announcement_v1($1::uuid,$1::text,$2,'Notice',$3,$4,null)",
 [s.host,JSON.stringify({provider:"teams",tenant_id:s.host,conversation_id:"conversation",message_id:s.cap}),recipients.map(o=>o===oid(99)?s.host:o),mode])).rows[0];
}
async function recipient(ann: string, index=1) {
 return (await db.query("select user_id from public.bty_tracked_announcement_recipients where announcement_id=$1 and aad_object_id=$2",[ann,oid(index)])).rows[0].user_id;
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
  await expect(track({...s,host:oid(999)},[oid(2)])).rejects.toThrow("invalid_actor");
 });
 it("legacy rows have no invented evidence; existing RPC and existing Track reuse preserve legacy mode",async()=> {
  const s=await seed();const legacy=(await db.query("select * from public.bty_track_announcement($1,$2,'Legacy',$3,'conversation',null,$4)",[s.host,s.cap,oid(100),[oid(1)]])).rows[0];
  await db.query("update public.bty_action_captures set source_type='teams_message',external_key=$2 where id=$1",[s.cap,`teams:${s.host}:conversation:${s.cap}`]);
  expect((await track(s,[oid(1)],"response")).already_existed).toBe(true);
  const user=s.users[oid(1)];
  await db.query("update public.bty_tracked_announcement_recipients set user_id=$1,bound_at=now() where announcement_id=$2",[user,legacy.announcement_id]);
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
   expect((await db.query("select has_function_privilege($1,'public.bty_track_announcement_v1(uuid,text,jsonb,text,text[],text,text)','EXECUTE') allowed",[role])).rows[0].allowed).toBe(false);
  }
  expect((await db.query("select has_function_privilege('service_role','public.bty_record_announcement_evidence(uuid,uuid,text,text)','EXECUTE') allowed")).rows[0].allowed).toBe(true);
 });
});

async function counts() {
 const tables=["bty_action_captures","bty_tracked_announcements","bty_tracked_announcement_recipients","bty_announcement_thread_messages","bty_announcement_thread_message_reads","bty_today_dismissals","bty_teams_tenant_routes"];
 return Object.fromEntries(await Promise.all(tables.map(async t=>[t,Number((await db.query(`select count(*) n from public.${t}`)).rows[0].n)])));
}
function serviceDb() {
 return {rpc:async(name:string,args:Record<string,unknown>)=> {
  const keys=Object.keys(args);try {
   const result=await db.query(`select * from public.${name}(${keys.map((k,i)=>`${k} => $${i+1}`).join(",")})`,keys.map(k=>args[k]));
   return {data:result.rows,error:null};
  } catch(e) {return {data:null,error:{message:(e as Error).message,code:"TEST_REFUSAL"}};}
 }} as never;
}
describe.runIf(!!URL)("release blockers: actual service and PostgreSQL transaction",()=> {
 it.each(["self-only","empty","malformed","unresolved","inactive","revoked","cross-tenant","cross-org","invalid-mode","missing-source","nine-valid-one-invalid"])("%s has exactly zero writes in every related table",async failure=> {
  const s=await seed();let picked=[oid(1)];let mode="response";let message=s.cap;
  if(failure==="self-only") picked=[s.host];
  if(failure==="empty") picked=[];
  if(failure==="malformed") picked=[oid(1),"invalid"];
  if(failure==="unresolved") picked=[oid(500)];
  if(failure==="nine-valid-one-invalid") picked=[...Array.from({length:9},(_,i)=>oid(i+1)),oid(500)];
  if(failure==="inactive") await db.query("update public.bty_org_memberships set status='inactive' where user_id=$1",[s.users[oid(1)]]);
  // Canonical membership has active/inactive, not a fictional revoked enum value.
  if(failure==="revoked") await db.query("delete from public.bty_org_memberships where user_id=$1",[s.users[oid(1)]]);
  if(failure==="cross-tenant") await db.query("update auth.identities set identity_data=jsonb_set(identity_data,'{custom_claims,tid}',to_jsonb($2::text)) where user_id=$1",[s.users[oid(1)],oid(700)]);
  if(failure==="cross-org") {
   const org=(await db.query("insert into public.bty_organizations values(gen_random_uuid(),'active') returning id")).rows[0].id;
   await db.query("update public.bty_org_memberships set organization_id=$2 where user_id=$1",[s.users[oid(1)],org]);
  }
  if(failure==="invalid-mode") mode="invalid";
  if(failure==="missing-source") message="";
  const before=await counts();
  const result=await trackAnnouncement(serviceDb(),{ownerUserId:s.host,actorAadObjectId:s.host,capture:{provider:"teams",tenant_id:s.host,conversation_id:"conversation",message_id:message},hostFramingRaw:"Notice",pickedRaw:picked,trackingMode:mode as "response"});
  expect(result.ok).toBe(false);expect(await counts()).toEqual(before);
 });
 it("a recipient insert failure rolls back the capture and announcement too",async()=> {
  const s=await seed();const before=await counts();
  await db.query(`create function public.test_refuse_recipient() returns trigger language plpgsql as $$ begin raise exception 'test failure'; end $$;
   create trigger test_refuse before insert on public.bty_tracked_announcement_recipients for each row execute function public.test_refuse_recipient()`);
  try {await expect(track(s,[oid(1)])).rejects.toThrow("test failure");expect(await counts()).toEqual(before);}
  finally {await db.query("drop trigger test_refuse on public.bty_tracked_announcement_recipients; drop function public.test_refuse_recipient()");}
 });
 it("atomic Track preserves an existing Saved source byte-for-byte and creates new source evidence with no saved_at",async()=> {
  const s=await seed();
  await db.query("update public.bty_action_captures set source_type='teams_message',external_key=$2,saved_at=now(),preview_text='Original',status='captured' where id=$1",[s.cap,`teams:${s.host.toUpperCase()}:conversation:${s.cap}`]);
  const before=(await db.query("select * from public.bty_action_captures where id=$1",[s.cap])).rows[0];
  const result=await trackAnnouncement(serviceDb(),{ownerUserId:s.host,actorAadObjectId:s.host,capture:{provider:"teams",tenant_id:s.host.toUpperCase(),conversation_id:"conversation",message_id:s.cap},hostFramingRaw:"Notice",pickedRaw:[s.host,oid(1)],trackingMode:"response"});
  expect(result.ok).toBe(true);if(!result.ok) throw new Error("track failed");const ann=result.announcementId;
  expect((await db.query("select * from public.bty_action_captures where id=$1",[s.cap])).rows[0]).toEqual(before);
  expect((await db.query("select source_capture_id,resolved_count from public.bty_tracked_announcements where id=$1",[ann])).rows[0]).toEqual({source_capture_id:s.cap,resolved_count:1});
  const other={...s,cap:"second-message"};const second=await track(other,[oid(1)]);
  expect((await db.query("select c.saved_at from public.bty_tracked_announcements a join public.bty_action_captures c on c.id=a.source_capture_id where a.id=$1",[second.announcement_id])).rows[0].saved_at).toBeNull();
 });
 it("eleven synthetic production legacy announcements survive migration reapplication without backfill",async()=> {
  const ids:string[]=[];
  for(let i=0;i<11;i++) {
   const s=await seed();const ann=(await db.query("select * from public.bty_track_announcement($1,$2,'Legacy',$3,'conversation',null,$4)",[s.host,s.cap,s.host,[oid(1)]])).rows[0].announcement_id;ids.push(ann);
   if(i<8) await db.query("update public.bty_tracked_announcement_recipients set user_id=$2,bound_at=now(),response=$3,responded_at=now() where announcement_id=$1",[ann,s.users[oid(1)],i<2?"ACKNOWLEDGED":i<7?"QUESTION":"HELP_NEEDED"]);
  }
  const query="select to_jsonb(a) announcement,to_jsonb(r) recipient from public.bty_tracked_announcements a join public.bty_tracked_announcement_recipients r on r.announcement_id=a.id where a.id=any($1::uuid[]) order by a.id";
  const before=(await db.query(query,[ids])).rows;
  await db.query(read(MIGRATION));
  expect((await db.query(query,[ids])).rows).toEqual(before);
  expect(before).toHaveLength(11);expect(before.every(v=>v.announcement.tracking_mode===null&&v.recipient.response_submitted_at===null)).toBe(true);
 });
 it.each(["acknowledgment","response"])("%s completion remains removed under the previous Worker Today selector",async mode=> {
  const s=await seed();const {announcement_id:ann}=await track(s,[oid(1)],mode);const user=await recipient(ann);
  await evidence(ann,user,"open");const opened=await row(ann);
  expect(opened.responded_at).toBeNull();expect(opened.acknowledged_at).toBeNull();expect(opened.response_submitted_at).toBeNull();
  expect(isTrackInScope("today",{historical:false,dismissedActivityVersion:null,currentActivityVersion:0})).toBe(true);
  await evidence(ann,user,mode==="response"?"respond":"acknowledge","Answer");const done=await row(ann);
  expect(done.responded_at).not.toBeNull();
  expect(mode==="response"?done.response_submitted_at:done.acknowledged_at).not.toBeNull();
  if(mode==="acknowledgment") expect(done.response_submitted_at).toBeNull();
  const dismissal=(await db.query("select dismissed_activity_version from public.bty_today_dismissals where user_id=$1 and item_id=$2",[user,done.id])).rows[0];
  expect(isTrackInScope("today",{historical:false,dismissedActivityVersion:Number(dismissal.dismissed_activity_version),currentActivityVersion:0})).toBe(false);
 });
});

// Signed-transport boundary is stubbed; route parsing, canonical identity resolution,
// Track service and all database RPCs below are real. The positive control proves writes work.
const routingToken = vi.hoisted(() => ({ claim: undefined as string | undefined }));
vi.mock("@/lib/bty/teams/botTokenVerifier.server", () => ({
 verifyBotFrameworkToken: async () => ({ ok: true, payload: { serviceUrl: routingToken.claim } }),
}));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => process.env.BTY_ROLLBACK_SOURCE_ROOT ? rollbackDb() : serviceDb() }));
import { NextRequest } from "next/server";
import * as trackService from "./trackAnnouncement.server";
async function invokeTrack(s: Awaited<ReturnType<typeof seed>>, serviceUrl: unknown, locale="en") {
 const { POST } = await import("@/app/api/bty/teams/invoke/route");
 return POST(new NextRequest("https://arena.btydaily.com/api/bty/teams/invoke", {
  method:"POST",headers:{"content-type":"application/json",authorization:"Bearer synthetic"},
  body:JSON.stringify({name:"composeExtension/submitAction",locale,serviceUrl,
   channelData:{tenant:{id:s.host}},from:{aadObjectId:s.host},conversation:{id:"conversation"},
   value:{commandId:"trackWithBty",messagePayload:{id:s.cap,body:{content:"Synthetic fixture"}},
    data:{trackingMode:"response",hostFraming:"Synthetic notice",recipients:oid(1)}}}),
 }));
}
describe.runIf(!!URL)("Track invoke routing: real route and PostgreSQL",()=>{
 it.each(["absent","invalid","mismatch"] as const)("%s returns visible EN/KO errors with zero writes to all seven tables",async reason=>{
  const s=await seed();vi.stubEnv("TEAMS_BOT_TENANT_ID",s.host);
  const spy=vi.spyOn(trackService,"trackAnnouncement");
  const log=vi.spyOn(console,"error").mockImplementation(()=>{});
  routingToken.claim=reason==="mismatch"?"https://smba.trafficmanager.net/amer/":undefined;
  const url=reason==="absent"?undefined:reason==="invalid"?"http://invalid.example/":"https://smba.trafficmanager.net/emea/";
  try {for(const locale of ["en","ko"]) {
   const before=await counts(),res=await invokeTrack(s,url,locale),body=await res.json();
   expect(await counts()).toEqual(before);
   expect(res.status).toBe(200);expect(body.task?.type).toBe("continue");
   expect(body.task.value.card.content.type).toBe("AdaptiveCard");
   expect(JSON.stringify(body)).toContain(locale==="ko"?"이 메시지의 출처를 확인할 수 없어 추적하지 않았습니다.":"BTY couldn’t verify where this message came from. Nothing was tracked.");
   expect(spy).not.toHaveBeenCalled();expect(await counts()).toEqual(before);
  }
  expect(log.mock.calls).toEqual(Array.from({length:2},()=>["[teams-invoke] track routing refused",{reason}]));
  } finally {spy.mockRestore();log.mockRestore();vi.unstubAllEnvs();routingToken.claim=undefined;}
 });
 it("valid routing reaches the actual transaction and creates exactly one capture/run/recipient",async()=>{
  const s=await seed();vi.stubEnv("TEAMS_BOT_TENANT_ID",s.host);routingToken.claim=undefined;
  try {const before=await counts(),res=await invokeTrack(s,"https://smba.trafficmanager.net/emea/"),body=await res.json(),after=await counts();
   expect(body.task?.type).toBe("continue");
   for(const t of Object.keys(before)) expect(after[t]-before[t]).toBe(["bty_action_captures","bty_tracked_announcements","bty_tracked_announcement_recipients"].includes(t)?1:0);
  } finally {vi.unstubAllEnvs();}
 });
});

// Optional exact-old-source gate. Run this file using a temporary Vitest config whose
// @ alias points entirely at the clean rollback checkout (commands in the rollout doc).
import { execFileSync } from "node:child_process";
function rollbackDb() {
 return { ...(serviceDb() as object),auth:{admin:{getUserById:async(id:string)=>({data:{user:{identities:(await db.query("select provider,identity_data from auth.identities where user_id=$1",[id])).rows}},error:null})}},from:(table:string)=>{
 let selection="",filters:any[]=[],ordering="";
 const q: any={maybeSingle:async()=>{const result=await q.returns();return {...result,data:result.data[0]??null}},upsert:async(value:Record<string,unknown>)=>{await db.query("insert into public.bty_teams_tenant_routes(tenant_id,service_url) values($1,$2) on conflict(tenant_id) do update set service_url=excluded.service_url",[value.tenant_id,value.service_url]);return {error:null}},select:(s:string)=>{selection=s;return q},eq:(k:string,v:unknown)=>{filters.push([k,"=",v]);return q},in:(k:string,v:unknown)=>{filters.push([k,"= any",v]);return q},order:(k:string)=>{ordering=k;return q},returns:async()=>{
 let joins="",cols="t.*";
 if(table==="bty_tracked_announcement_recipients"&&selection.includes("bty_tracked_announcements")) {joins=" join public.bty_tracked_announcements a on a.id=t.announcement_id left join public.bty_action_captures c on c.id=a.source_capture_id";cols+=",to_jsonb(a)||jsonb_build_object('bty_action_captures',jsonb_build_object('source_url',c.source_url)) as bty_tracked_announcements";}
 if(table==="bty_tracked_announcements") {joins=" join public.bty_action_captures c on c.id=t.source_capture_id";cols+=",jsonb_build_object('preview_text',c.preview_text,'source_url',c.source_url) as bty_action_captures";}
 const where=filters.map(([k,op],i)=>`t.${k} ${op} ${op==="= any"?"(":""}$${i+1}${op==="= any"?")":""}`).join(" and ");
 const sql=`select ${cols} from public.${table} t${joins}${where?" where "+where:""}${ordering?" order by t."+ordering:""}`;
 const result=await db.query(sql,filters.map(f=>f[2]));return {data:JSON.parse(JSON.stringify(result.rows)),error:null};
 }};return q;
 }} as never;
}

describe.runIf(!!URL && !!process.env.BTY_ROLLBACK_SOURCE_ROOT)("exact production rollback Worker source",()=>{
 it("pins the clean source checkout",()=>{
  const root=process.env.BTY_ROLLBACK_SOURCE_ROOT!;
  expect(execFileSync("git",["-C",root,"rev-parse","HEAD"],{encoding:"utf8"}).trim()).toBe("b20e715a1650c911ed97fe5d9269dfa52cfeeba8");
  expect(execFileSync("git",["-C",root,"status","--porcelain"],{encoding:"utf8"}).trim()).toBe("");
 });
 it.each(["acknowledgment","response","opened-only"])("%s on migrated schema has correct old Today visibility",async kind=>{
  const s=await seed(),mode=kind==="response"?"response":"acknowledgment";
  const {announcement_id:ann}=await track(s,[oid(1),oid(2)],mode),user=s.users[oid(1)];
  await evidence(ann,user,kind==="opened-only"?"open":kind==="response"?"respond":"acknowledge","Synthetic response");
  const {listMyAnnouncements}=await import("@/lib/bty/announcement/announcementService.server");
  expect(await listMyAnnouncements(rollbackDb(),user)).toHaveLength(kind==="opened-only"?1:0);
  expect(await listMyAnnouncements(rollbackDb(),s.users[oid(2)])).toHaveLength(1);
 });
 it.each(["acknowledgment","response"])("package 1.0.14 %s submit is accepted by the exact old handler",async mode=>{
  const manifest=JSON.parse(readFileSync(join(process.cwd(),"teams/manifest/manifest.json"),"utf8"));
  expect(manifest.version).toBe("1.0.14");const command=manifest.composeExtensions[0].commands.find((c:{id:string})=>c.id==="trackWithBty");
  expect(command.fetchTask).toBe(true);expect(command.context).toEqual(["message"]);
  const s=await seed();vi.stubEnv("TEAMS_BOT_TENANT_ID",s.host);routingToken.claim=undefined;
  await db.query("update public.bty_action_captures set source_type='teams_message',external_key=$2,source_metadata='{}',status='captured' where id=$1",[s.cap,`teams:${s.host}:conversation:${s.cap}`]);
  const {POST}=await import("@/app/api/bty/teams/invoke/route");
  const payload={name:"composeExtension/fetchTask",serviceUrl:"https://smba.trafficmanager.net/emea/",channelData:{tenant:{id:s.host}},from:{aadObjectId:s.host},conversation:{id:"conversation"},value:{commandId:command.id,messagePayload:{id:s.cap},data:{trackingMode:mode,hostFraming:"Synthetic notice",recipients:oid(1)}}};
  const send=()=>POST(new NextRequest("https://arena.btydaily.com/api/bty/teams/invoke",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)}));
  try {expect((await (await send()).json()).task.type).toBe("continue");payload.name="composeExtension/submitAction";
   const res=await send();expect(res.status).toBe(200);expect((await res.json()).task.type).toBe("continue");
   expect(Number((await db.query("select count(*) n from public.bty_tracked_announcements where owner_user_id=$1",[s.host])).rows[0].n)).toBe(1);
   expect((await db.query("select tracking_mode from public.bty_tracked_announcements where owner_user_id=$1",[s.host])).rows[0].tracking_mode).toBeNull();
  } finally {vi.unstubAllEnvs();}
 });
});
