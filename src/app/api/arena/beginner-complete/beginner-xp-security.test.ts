import {beforeEach,describe,it,expect,vi} from 'vitest';
const state=vi.hoisted(()=>({owned:true,admin:true,run:{run_id:'00000000-0000-4000-8000-000000000002',scenario_id:'senior_staff_resists_new_protocol_033',run_type:'beginner',status:'IN_PROGRESS',beginner_maturity_score:null as number|null},userCalls:[]as {fn:string,args:unknown}[],serviceCalls:[]as {fn:string,args:unknown}[],writes:[]as unknown[]}));
vi.mock('@/lib/legal/activeConsent',()=>({isConsentCurrent:async()=>true,consentRequiredResponse:()=>Response.json({},{status:403})}));
vi.mock('@/lib/bty/arena/applyCoreXp',()=>({applySeasonalXpToCore:async()=>({coreGain:0,newCoreTotal:0})}));
vi.mock('@/lib/supabase-admin',()=>({getSupabaseAdmin:()=>state.admin?{rpc:async(fn:string,args:unknown)=>{state.serviceCalls.push({fn,args});return{error:null}}}:null}));
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
beforeEach(()=>{state.owned=true;state.admin=true;state.run.status='IN_PROGRESS';state.run.beginner_maturity_score=null;state.userCalls.length=0;state.serviceCalls.length=0;state.writes.length=0});
describe('beginner completion trusted one-time award',()=>{
 it('fails503 before updating completion or paying when private writer is unavailable',async()=>{state.admin=false;const r=await POST(req());expect(r.status).toBe(503);expect(state.writes).toEqual([]);expect(state.userCalls).toEqual([]);});
 it('returns the stored completed result without awarding it again',async()=>{state.run.status='DONE';state.run.beginner_maturity_score=80;const r=await POST(req());expect(r.status).toBe(200);expect(await r.json()).toMatchObject({ok:true,idempotent:true,beginner_maturity_score:80});expect(state.serviceCalls).toEqual([]);expect(state.userCalls).toEqual([]);expect(state.writes).toEqual([]);});
 it('lets only one concurrent owned IN_PROGRESS claim award the fixed30 weekly XP',async()=>{const rs=await Promise.all([POST(req()),POST(req())]);expect(rs.map(r=>r.status)).toEqual([200,200]);expect(state.serviceCalls).toEqual([{fn:'increment_weekly_xp',args:{p_user_id:'00000000-0000-4000-8000-000000000001',p_league_id:null,p_delta:30}}]);expect(state.userCalls.filter(c=>c.fn==='increment_weekly_xp')).toEqual([]);});
 it('denies a foreign run without a privileged write',async()=>{state.owned=false;const r=await POST(req());expect(r.status).toBe(404);expect(state.writes).toEqual([]);expect(state.serviceCalls).toEqual([]);});
});
