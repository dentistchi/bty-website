import {beforeEach,describe,it,expect,vi} from 'vitest';
const state=vi.hoisted(()=>({owned:true,admin:true,serviceError:false,userCalls:[] as unknown[],serviceCalls:[] as unknown[],writes:[] as Record<string,unknown>[]}));
vi.mock('@/lib/legal/activeConsent',()=>({isConsentCurrent:async()=>true,consentRequiredResponse:()=>Response.json({error:'consent'},{status:403})}));
vi.mock('@/lib/supabase-admin',()=>({getSupabaseAdmin:()=>state.admin?{rpc:async(fn:string,args:unknown)=>{state.serviceCalls.push({fn,args});return{error:state.serviceError?{message:'database refused award'}:null}}}:null}));
vi.mock('@/lib/bty/arena/supabaseServer',()=>({getSupabaseServerClient:async()=>({
 auth:{getUser:async()=>({data:{user:{id:'00000000-0000-4000-8000-000000000001'}}})},
 rpc:async(fn:string,args:unknown)=>{state.userCalls.push({fn,args});return{error:null}},
 from:(table:string)=>{
  const q:any={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:state.owned?{user_id:'00000000-0000-4000-8000-000000000001',scenario_id:'patient_refuses_treatment_001',reached_step_2_at:null}:null,error:null}),update:()=>q,insert:async(row:Record<string,unknown>)=>{state.writes.push({table,...row});return{error:null}},then:(resolve:(v:unknown)=>unknown)=>Promise.resolve({data:null,error:null}).then(resolve)};return q;
 }
})}));
import {POST} from '@/app/api/arena/event/route';
const request=(extra:Record<string,unknown>={})=>new Request('https://local.test/api/arena/event',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({runId:'00000000-0000-4000-8000-000000000002',scenarioId:'patient_refuses_treatment_001',step:2,eventType:'CHOICE_CONFIRMED',choiceId:'B',xp:99999999,deltas:{integrity:99999999},userId:'00000000-0000-4000-8000-000000000099',...extra})});
beforeEach(()=>{state.owned=true;state.admin=true;state.serviceError=false;state.userCalls.length=0;state.serviceCalls.length=0;state.writes.length=0});
describe('trusted XP server boundary',()=>{
 it('ignores forged choice XP/deltas and awards only canonical legacy value through service-role client',async()=>{
  const r=await POST(request());expect(r.status).toBe(200);
  expect(state.writes[0]).toMatchObject({xp:82,deltas:{integrity:1,communication:3,insight:3,resilience:1,gratitude:2}});
  expect(state.userCalls).toEqual([]);
  expect(state.serviceCalls).toEqual([{fn:'increment_arena_xp',args:{p_user_id:'00000000-0000-4000-8000-000000000001',p_run_id:'00000000-0000-4000-8000-000000000002',p_xp:82}}]);
 });
 it('does not award forged XP on a non-reward capture event',async()=>{
  const r=await POST(request({eventType:'SCENARIO_STARTED',step:1}));expect(r.status).toBe(200);
  expect(state.writes[0]).toMatchObject({xp:0,deltas:null});expect(state.userCalls).toEqual([]);expect(state.serviceCalls).toEqual([]);
 });
 it('refuses a foreign run before event capture or privilege escalation',async()=>{
  state.owned=false;const r=await POST(request());expect(r.status).toBe(404);expect(state.writes).toEqual([]);expect(state.serviceCalls).toEqual([]);expect(state.userCalls).toEqual([]);
 });
 it('returns503 before capturing or awarding when the private writer is unconfigured',async()=>{
  state.admin=false;const r=await POST(request());expect(r.status).toBe(503);expect(state.writes).toEqual([]);expect(state.userCalls).toEqual([]);
 });
 it('fails closed for an unknown choice instead of paying caller-provided XP',async()=>{
  const r=await POST(request({choiceId:'not-a-catalog-choice'}));expect(r.status).toBe(400);expect(state.writes).toEqual([]);expect(state.serviceCalls).toEqual([]);
 });
 it('does not report success when the configured award RPC fails',async()=>{
  state.serviceError=true;const r=await POST(request());expect(r.status).toBe(500);expect(state.userCalls).toEqual([]);
 });
});
