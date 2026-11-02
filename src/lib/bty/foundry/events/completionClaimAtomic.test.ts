import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/engine/avatar/avatar-state.service", () => ({ syncAvatarStateAfterCoreXpChange: async () => {} }));
import { redeemCompletionClaim } from "./completionClaimService";
import { hashClaimCode } from "./completion-claim-code";
const USER="00000000-0000-4000-8000-000000000001", EVENT="00000000-0000-4000-8000-000000000002";
const PROGRESS="00000000-0000-4000-8000-000000000003", OTHER="00000000-0000-4000-8000-000000000004";
const CODE="0123456789AB";
let assignments: Record<string, unknown>[];
let failedTable: string | null, failDecision: boolean;
let progress: Record<string, unknown>, ack: unknown, error: {message:string;code?:string}|null;
const calls: {name:string;args:Record<string,unknown>}[]=[];
const xp={policyVersion:"foundry-core-atomic/v1",outcome:"awarded",userId:USER,eventId:EVENT,
 requestedProgressId:PROGRESS,awardedProgressId:PROGRESS,receiptId:"00000000-0000-4000-8000-000000000005",
 ledgerId:1,deltaXp:10,coreBefore:0,coreAfter:10,replayed:false};
const admin={from(table:string){
 const filters: ((r:Record<string,unknown>)=>boolean)[]=[];
 let selected="";
 const q={select:(fields:string)=>{selected=fields;return q;},eq:(k:string,v:unknown)=>{filters.push(r=>r[k]===v);return q;},
 is:(k:string,v:unknown)=>{filters.push(r=>(r[k]??null)===v);return q;},
 not:(k:string,_op:string,v:unknown)=>{filters.push(r=>(r[k]??null)!==v);return q;},
 neq:(k:string,v:unknown)=>{filters.push(r=>r[k]!==v);return q;},
 async maybeSingle(){
 if(table===failedTable||(failDecision&&table==='foundry_event_training_progress'&&selected==='id'))return{data:null,error:{code:'XX001',message:'synthetic preparation read failed'}};
 const rows=table==='foundry_event_training_progress'?[progress]:table==='foundry_event_participants'?[{id:'participant',user_id:null}]
 :table==='foundry_events'?[{id:EVENT,owner_user_id:OTHER,title:'Synthetic training'}]:table==='foundry_event_assignments'?assignments:[];
 const hits=rows.filter(r=>filters.every(f=>f(r)));return hits.length>1?{data:null,error:{code:"PGRST116"}}:{data:hits[0]??null,error:null};}};return q;
},async rpc(name:string,args:Record<string,unknown>){calls.push({name,args});if(error)return{data:null,error};
 if(name==='bty_foundry_redeem_completion_claim')return{data:new Date(String(progress.claim_secret_expires_at)).getTime()<=Date.now()?[]:[{progress_id:PROGRESS,event_id:EVENT,xp_result:'awarded'}],error:null};
 return{data:ack,error:null};}} as never;
beforeEach(()=>{calls.length=0;error=null;assignments=[];failedTable=null;failDecision=false;progress={id:PROGRESS,event_id:EVENT,participant_id:'participant',completed_at:new Date().toISOString(),
 claim_secret_hash:hashClaimCode(CODE),claim_secret_expires_at:new Date(Date.now()+86400000).toISOString(),linked_user_id:null,claim_consumed_at:null,decision_response_text:null};
 ack={policyVersion:'foundry-claim-atomic/v1',progressId:PROGRESS,eventId:EVENT,
 claimReceiptId:'00000000-0000-4000-8000-000000000006',expiresAt:progress.claim_secret_expires_at,replayed:false,xp};});
describe('deferred claim atomic Core receipt boundary',()=>{
 it('requires an atomic claim+Core receipt, rather than trusting the old ledger-only row',async()=>{
  const result=await redeemCompletionClaim(admin,CODE,USER);expect(result).toMatchObject({ok:true,eventId:EVENT,progressId:PROGRESS,xpStatus:'awarded'});
  expect(calls).toHaveLength(1);expect(calls[0].name).toBe('bty_foundry_redeem_completion_claim_atomic');
 });
 it.each(['PGRST202','XX001'])('reports infrastructure outage %s as unavailable, not a bad credential',async code=>{
  error={message:'synthetic private RPC outage',code};expect(await redeemCompletionClaim(admin,CODE,USER)).toEqual({ok:false,reason:'unavailable'});
 });
 it('does not consume an ambiguous historical reward as a successful paid claim',async()=>{
  error={message:'FOUNDRY_XP_REVIEW_REQUIRED'};expect(await redeemCompletionClaim(admin,CODE,USER)).toEqual({ok:false,reason:'review_required'});
 });
 it('resolves the same-account lost acknowledgement from a consumed claim receipt',async()=>{
  progress.linked_user_id=USER;progress.claim_consumed_at=new Date().toISOString();ack={...(ack as object),replayed:true};
  expect(await redeemCompletionClaim(admin,CODE,USER)).toMatchObject({ok:true,eventId:EVENT,xpStatus:'awarded'});
 });
 it('never permits another account to replay a consumed credential',async()=>{
  progress.linked_user_id=OTHER;progress.claim_consumed_at=new Date().toISOString();
  expect(await redeemCompletionClaim(admin,CODE,USER)).toEqual({ok:false,reason:'invalid'});expect(calls).toEqual([]);
 });
 it('does not extend the original claim expiry on replay',async()=>{
  progress.claim_secret_expires_at='2000-01-01T00:00:00Z';
  expect(await redeemCompletionClaim(admin,CODE,USER)).toEqual({ok:false,reason:'invalid'});
 });
 it.each(['foundry_event_training_progress','foundry_event_participants','foundry_events','foundry_event_module','foundry_event_assignments','arena_profiles'])(
  'does not consume a claim when authoritative context %s fails to load',async table=>{
   failedTable=table;expect(await redeemCompletionClaim(admin,CODE,USER)).toEqual({ok:false,reason:'unavailable'});expect(calls).toEqual([]);
  });
 it('does not treat an errored decision predicate as no Apply obligation',async()=>{
  failDecision=true;expect(await redeemCompletionClaim(admin,CODE,USER)).toEqual({ok:false,reason:'unavailable'});expect(calls).toEqual([]);
 });
 it('resolves the active assignment when an archived revoked membership snapshot also exists',async()=>{
  const active='00000000-0000-4000-8000-000000000008',organization='00000000-0000-4000-8000-000000000009';
  assignments=[{id:OTHER,event_id:EVENT,user_id_snapshot:USER,status:'revoked',organization_id:OTHER},
   {id:active,event_id:EVENT,user_id_snapshot:USER,status:'pending',organization_id:organization}];
  expect(await redeemCompletionClaim(admin,CODE,USER)).toMatchObject({ok:true});
  expect(calls[0].args).toMatchObject({p_assignment_id:active,p_organization_id:organization});
 });
 it('does not attach a revoked assignment when no active assignment exists',async()=>{
  assignments=[{id:OTHER,event_id:EVENT,user_id_snapshot:USER,status:'revoked',organization_id:OTHER}];
  expect(await redeemCompletionClaim(admin,CODE,USER)).toMatchObject({ok:true});
  expect(calls[0].args).toMatchObject({p_assignment_id:null,p_organization_id:null});
 });
 it('rejects a malformed success instead of asserting that Core was awarded',async()=>{
  ack={ok:true};expect(await redeemCompletionClaim(admin,CODE,USER)).toEqual({ok:false,reason:'unavailable'});
 });
});
