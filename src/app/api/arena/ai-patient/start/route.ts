import { NextResponse } from "next/server";
import { CASE_ACCEPTANCE_01 } from "@/domain/arena/aiPatient/caseAcceptance01";
import { isAiPatientAvailable, newSession } from "@/lib/bty/arena/aiPatient/aiPatientService";
import { isSpeechAvailable } from "@/lib/bty/arena/aiPatient/speech";
import { AiPatientConfigError } from "@/lib/bty/arena/aiPatient/sessionSeal";
import { jsonError, noStore, requireLearner, sessionView } from "@/lib/bty/arena/aiPatient/aiPatientHttp";

export const runtime = "nodejs";

/**
 * POST /api/arena/ai-patient/start — begin one fictional-patient practice session.
 * Body: { acknowledged: true } — the learner has read the synthetic-case notice.
 * Returns the sealed session, the authored opening line and the limits. Nothing is stored.
 */
export async function POST(req: Request) {
  const gate = await requireLearner("start");
  if (!gate.ok) return gate.response;
  const body = (await req.json().catch(() => ({}))) as { acknowledged?: unknown };
  if (body.acknowledged !== true) return jsonError("acknowledgement_required", 400);
  // Fail closed: without the dedicated AI Patient provider key nothing is started or spent.
  if (!isAiPatientAvailable()) return jsonError("ai_patient_unconfigured", 503);
  try {
    const view = await sessionView(newSession(gate.userId, Date.now()));
    return NextResponse.json(
      { ...view, patientName: CASE_ACCEPTANCE_01.patientName, briefing: CASE_ACCEPTANCE_01.learnerBriefing, voiceAvailable: isSpeechAvailable() },
      { headers: noStore },
    );
  } catch (e) {
    if (e instanceof AiPatientConfigError) return jsonError("ai_patient_unconfigured", 503);
    throw e;
  }
}
