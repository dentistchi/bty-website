import { NextRequest } from "next/server";
import { requireManager, managerJson } from "@/lib/bty/foundry/events/managerGate";
import { generateQuizDraft } from "@/lib/bty/foundry/events/quickTrainingQuizGeneration";
export const runtime = "nodejs";
export async function POST(req: NextRequest) { const gate=await requireManager(req); if(!gate.ok)return gate.response; const body=await req.json().catch(()=>({})); const result=await generateQuizDraft(body?.sourceText,body?.questionCount,body?.locale); return managerJson(gate.ctx.base,req,result,result.ok?200:result.code==="provider_unavailable"?503:result.code==="timeout"?504:400); }
