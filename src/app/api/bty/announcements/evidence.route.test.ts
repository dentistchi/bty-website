import { describe,it,expect,vi,beforeEach } from "vitest";
import { NextRequest } from "next/server";
const {requireUser,rpc}=vi.hoisted(()=>({requireUser:vi.fn(),rpc:vi.fn()}));
vi.mock("@/lib/supabase/route-client",()=>({requireUser,unauthenticated:()=>new Response("{}",{status:401}),copyCookiesAndDebug:()=>{}}));
vi.mock("@/lib/supabase-admin",()=>({getSupabaseAdmin:()=>({rpc})}));
import {POST} from "./[id]/evidence/route";
const post=(body:unknown)=>POST(new NextRequest("https://bty.test/api/bty/announcements/fixture/evidence",{method:"POST",body:JSON.stringify(body)}),{params:Promise.resolve({id:"fixture"})});
beforeEach(()=> {vi.clearAllMocks();requireUser.mockResolvedValue({user:{id:"session-actor"},base:new Response()});rpc.mockResolvedValue({data:[{result:"recorded"}],error:null});});
describe("announcement evidence authority",()=> {
 it("rejects anonymous requests before RPC",async()=> {requireUser.mockResolvedValue({user:null});expect((await post({action:"open"})).status).toBe(401);expect(rpc).not.toHaveBeenCalled();});
 it("uses only the verified session actor and never body identities",async()=> {
  expect((await post({action:"respond",text:" answer ",userId:"forged",recipientId:"forged"})).status).toBe(200);
  expect(rpc).toHaveBeenCalledWith("bty_record_announcement_evidence",{p_announcement_id:"fixture",p_actor_user_id:"session-actor",p_action:"respond",p_response_text:"answer"});
 });
 it.each([""," ","x".repeat(1001),null])("invalid answer fails without a write",async text=> {expect((await post({action:"respond",text})).status).toBe(400);expect(rpc).not.toHaveBeenCalled();});
 it("non-member is nondisclosing, error text and identifiers are never returned",async()=> {
  rpc.mockResolvedValue({data:[{result:"not_a_recipient"}],error:null});const res=await post({action:"open"});expect(res.status).toBe(404);expect(await res.json()).toEqual({ok:false});
 });
 it("wrong mode cannot acknowledge a response-only request",async()=> {rpc.mockResolvedValue({data:[{result:"invalid_action"}],error:null});expect((await post({action:"acknowledge"})).status).toBe(409);});
});
