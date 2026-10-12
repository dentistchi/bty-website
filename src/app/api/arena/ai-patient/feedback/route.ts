import { NextResponse } from "next/server";
import { reviewSession } from "@/lib/bty/arena/aiPatient/aiPatientService";
import { failureResponse, noStore, openSession, requireLearner } from "@/lib/bty/arena/aiPatient/aiPatientHttp";

export const runtime = "nodejs";

/**
 * POST /api/arena/ai-patient/feedback — coaching feedback on a finished (or ended) conversation.
 * Body: { state }. Evidence-checked against the sealed transcript; no score, nothing stored.
 */
export async function POST(req: Request) {
  const gate = await requireLearner("feedback");
  if (!gate.ok) return gate.response;
  const body = (await req.json().catch(() => ({}))) as { state?: unknown };
  const opened = await openSession(body.state, gate.userId);
  if (!opened.ok) return opened.response;
  const result = await reviewSession(opened.state, Date.now());
  if (!result.ok) return failureResponse(result.reason);
  return NextResponse.json({ feedback: result.feedback }, { headers: noStore });
}
