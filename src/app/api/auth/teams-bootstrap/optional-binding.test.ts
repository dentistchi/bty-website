import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/auth/teams-bootstrap/route";

const state=vi.hoisted(()=>({ mode:"success" as "success"|"throw"|"database-error", from:vi.fn(), update:vi.fn(), eq:vi.fn(), verify:vi.fn(), bridge:vi.fn() }));
vi.mock("@/lib/bty/teams/tabSsoTokenVerifier.server",()=>({verifyTeamsTabSsoToken:state.verify}));
vi.mock("@/lib/bty/teams/teamsSessionBridge.server",()=>({bridgeTeamsIdentityToSession:state.bridge}));
vi.mock("@/lib/bty/announcement/trackAnnouncement.server",()=>({bindAnnouncementRecipients:vi.fn(async()=>0)}));
vi.mock("@/lib/bty/foundry/events/microsoftManagerSync.server",()=>({evaluateMicrosoftManagerEntitlement:vi.fn(async()=>{})}));
vi.mock("@/lib/bty/foundry/teams/bindTeamsParticipants.server",()=>({bindTeamsTrainingParticipants:vi.fn(async()=>0)}));
vi.mock("@/lib/supabase-admin",()=>({getSupabaseAdmin:()=>({from:state.from})}));

const TID="11111111-1111-1111-1111-111111111111",OID="22222222-2222-2222-2222-222222222222",USER="81f08aa1-0000-0000-0000-000000000000";
const SESSION={access_token:"synthetic-access",refresh_token:"synthetic-refresh",expires_in:3600,expires_at:1800000000};
const req=()=>new NextRequest("https://arena.example/api/auth/teams-bootstrap",{method:"POST",headers:{authorization:"Bearer synthetic-teams-token","content-type":"application/json"},body:JSON.stringify({userId:"attacker",tenantId:"attacker",oid:"attacker"})});
beforeEach(()=>{
 vi.clearAllMocks();state.mode="success";
 vi.spyOn(console,"error").mockImplementation(()=>{});
 vi.stubGlobal("fetch",vi.fn(async()=>{throw Error("Unexpected external request");}));
 state.verify.mockResolvedValue({ok:true,identity:{tenantId:TID,aadObjectId:OID}});
 state.bridge.mockResolvedValue({ok:true,userId:USER,session:SESSION});
 const chain:any={eq:state.eq,then:(resolve:any,reject:any)=>Promise.resolve({data:null,error:state.mode==="database-error"?{code:"42501",message:"SYNTHETIC_PRIVATE_DETAIL"}:null}).then(resolve,reject)};
 state.eq.mockReturnValue(chain);
 state.update.mockImplementation(()=>{if(state.mode==="throw")throw Error("SYNTHETIC_PRIVATE_DETAIL");return chain;});
 state.from.mockImplementation((table:string)=>{if(table!=="bty_microsoft_directory_authority")throw Error("Unexpected table");return {update:state.update};});
});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});

describe("Teams successful sign-in survives optional directory binding failure",()=>{
 it("returns the resolved session when an optional directory update throws",async()=>{
  state.mode="throw";
  const response=await POST(req());
  expect(response.status).toBe(200);expect(await response.json()).toEqual({session:SESSION});
  expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("SYNTHETIC_PRIVATE_DETAIL");
 });
 it("returns the session when PostgREST reports a directory update error",async()=>{
  state.mode="database-error";
  const response=await POST(req());expect(response.status).toBe(200);expect(await response.json()).toEqual({session:SESSION});
  expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("SYNTHETIC_PRIVATE_DETAIL");
 });
 it("binds only the verified tuple to the resolver's canonical user",async()=>{
  const response=await POST(req());expect(response.status).toBe(200);
  expect(state.update).toHaveBeenCalledWith(expect.objectContaining({linked_user_id:USER}));
  expect(state.eq.mock.calls).toEqual([["tenant_id",TID],["aad_object_id",OID]]);
 });
 it("does not attempt directory binding for an unresolved or invalid identity",async()=>{
  state.bridge.mockResolvedValue({ok:false,kind:"needs_first_sign_in"});
  expect((await POST(req())).status).toBe(200);expect(state.from).not.toHaveBeenCalled();
  state.verify.mockResolvedValue({ok:false,reason:"invalid_token"});
  expect((await POST(req())).status).toBe(401);expect(state.from).not.toHaveBeenCalled();
 });
});
