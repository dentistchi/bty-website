import {beforeEach,describe,it,expect,vi} from 'vitest';
const state=vi.hoisted(()=>({owned:true,admin:true,run:{run_id:'00000000-0000-4000-8000-000000000002',scenario_id:'senior_staff_resists_new_protocol_033',run_type:'beginner',status:'IN_PROGRESS',beginner_maturity_score:null as number|null},receipt:null as Record<string,unknown>|null,rewardApplications:0,userCalls:[]as {fn:string,args:unknown}[],serviceCalls:[]as {fn:string,args:unknown}[],writes:[]as unknown[]}));
vi.mock('@/lib/legal/activeConsent',()=>({isConsentCurrent:async()=>true,consentRequiredResponse:()=>Response.json({},{status:403})}));
vi.mock('@/lib/supabase-admin',()=>({getSupabaseAdmin:()=>state.admin?{rpc:async(fn:string,args:Record<string,unknown>)=>{
 state.serviceCalls.push({fn,args});
 if(state.receipt)return{data:{...state.receipt,replayed:true},error:null};
 if(state.run.status==='DONE')return{data:null,error:{message:'LEGACY_REWARD_REVIEW_REQUIRED'}};
 state.receipt={
  policyVersion:'legacy-xp-atomic/v1',kind:'beginner_completion',runId:args.p_run_id,scenarioId:args.p_scenario_id,
  receiptId:'00000000-0000-4000-8000-000000000010',eventId:'00000000-0000-4000-8000-000000000011',replayed:false,
  score:args.p_score,feedback:args.p_feedback,seasonalXp:30,coreGain:0,coreBefore:0,coreAfter:0,
  coreBufferBefore:0,coreBufferAfter:2/3,weeklyXpTotal:30,
 };
 state.rewardApplications++;state.run.status='DONE';state.run.beginner_maturity_score=args.p_score as number;
 return{data:{...state.receipt},error:null};
}}:null}));
vi.mock('@/lib/bty/arena/supabaseServer',()=>({getSupabaseServerClient:async()=>({auth:{getUser:async()=>({data:{user:{id:'00000000-0000-4000-8000-000000000001'}}})},rpc:async(fn:string,args:unknown)=>{state.userCalls.push({fn,args});return{error:null}},from:(table:string)=>{
 let update:Record<string,unknown>|null=null;let expectedStatus:string|undefined;
 const result=()=>{
  if(update){if(expectedStatus&&state.run.status!==expectedStatus)return{data:null,error:null};Object.assign(state.run,update);state.writes.push(update);return{data:{run_id:state.run.run_id},error:null};}
  return{data:state.owned?{...state.run}:null,error:null};
 };
 const q:any={select:()=>q,eq:(name:string,value:string)=>{if(name==='status')expectedStatus=value;return q},neq:()=>q,update:(value:Record<string,unknown>)=>{update=value;return q},maybeSingle:async()=>result(),insert:async(value:unknown)=>{state.writes.push({table,value});return{error:null}},then:(resolve:(x:unknown)=>unknown)=>Promise.resolve(result()).then(resolve)};return q;
}})}));
import {POST} from '@/app/api/arena/beginner-complete/route';
const req=()=>new Request('https://local.test/api/arena/beginner-complete',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({runId:'00000000-0000-4000-8000-000000000002',scenarioId:'senior_staff_resists_new_protocol_033',emotionIndex:0,riskIndex:0,integrityIndex:0,decisionIndex:0})});
beforeEach(()=>{state.owned=true;state.admin=true;state.run.status='IN_PROGRESS';state.run.beginner_maturity_score=null;state.receipt=null;state.rewardApplications=0;state.userCalls.length=0;state.serviceCalls.length=0;state.writes.length=0});
describe('beginner completion trusted one-time award',()=>{
 it('fails503 before updating completion or paying when private writer is unavailable',async()=>{state.admin=false;const r=await POST(req());expect(r.status).toBe(503);expect(state.writes).toEqual([]);expect(state.userCalls).toEqual([]);});
 it('returns the stored completed receipt result without awarding it again',async()=>{
  state.run.status='DONE';state.run.beginner_maturity_score=18;
  state.receipt={
   policyVersion:'legacy-xp-atomic/v1',kind:'beginner_completion',runId:state.run.run_id,scenarioId:state.run.scenario_id,
   receiptId:'00000000-0000-4000-8000-000000000010',eventId:'00000000-0000-4000-8000-000000000011',replayed:false,
   score:18,feedback:{band:'intentional',label:'Intentional',message:'Frozen completion feedback.'},
   seasonalXp:30,coreGain:0,coreBefore:0,coreAfter:0,coreBufferBefore:0,coreBufferAfter:2/3,weeklyXpTotal:30,
  };
  const r=await POST(req());expect(r.status).toBe(200);
  expect(await r.json()).toMatchObject({ok:true,idempotent:true,beginner_maturity_score:18,band:'intentional',label:'Intentional',message:'Frozen completion feedback.'});
  expect(state.serviceCalls).toHaveLength(1);expect(state.serviceCalls[0].fn).toBe('bty_complete_beginner_reward');
  expect(state.rewardApplications).toBe(0);expect(state.userCalls).toEqual([]);expect(state.writes).toEqual([]);
 });
 it('blocks historical DONE without a receipt for review rather than assuming its XP was paid',async()=>{
  state.run.status='DONE';state.run.beginner_maturity_score=18;
  const r=await POST(req());expect(r.status).toBe(409);expect(await r.json()).toMatchObject({error:'LEGACY_REWARD_REVIEW_REQUIRED'});
  expect(state.rewardApplications).toBe(0);expect(state.serviceCalls).toHaveLength(1);expect(state.userCalls).toEqual([]);expect(state.writes).toEqual([]);
 });
 it('lets only one concurrent owned IN_PROGRESS completion award the fixed30 weekly XP',async()=>{
  const rs=await Promise.all([POST(req()),POST(req())]);expect(rs.map(r=>r.status)).toEqual([200,200]);
  const expected={fn:'bty_complete_beginner_reward',args:{
   p_user_id:'00000000-0000-4000-8000-000000000001',p_run_id:'00000000-0000-4000-8000-000000000002',p_scenario_id:'senior_staff_resists_new_protocol_033',
   p_responses:{emotionIndex:0,riskIndex:0,integrityIndex:0,decisionIndex:0,reflectionText:null},p_score:0,
   p_feedback:{band:'reactive',label:'Reactive',message:"You're reacting in the moment. Small pauses before acting can help."},
  }};
  expect(state.serviceCalls).toEqual([expected,expected]);expect(state.rewardApplications).toBe(1);expect(state.receipt).toMatchObject({seasonalXp:30});
  expect(state.userCalls).toEqual([]);expect(state.writes).toEqual([]);
 });
 it('denies a foreign run without a privileged write',async()=>{state.owned=false;const r=await POST(req());expect(r.status).toBe(404);expect(state.writes).toEqual([]);expect(state.serviceCalls).toEqual([]);});
});
