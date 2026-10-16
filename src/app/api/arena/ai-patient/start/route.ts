import { NextResponse } from "next/server";
import { scenarioFor } from "@/domain/arena/aiPatient/scenarios";
import { DEFAULT_SCENARIO_ID, isScenarioId } from "@/domain/arena/aiPatient/scenarioCatalog";
import { isAiPatientAvailable, newSession } from "@/lib/bty/arena/aiPatient/aiPatientService";
import { isSpeechAvailable } from "@/lib/bty/arena/aiPatient/speech";
import { AiPatientConfigError } from "@/lib/bty/arena/aiPatient/sessionSeal";
import { jsonError, noStore, requireLearner, sessionView } from "@/lib/bty/arena/aiPatient/aiPatientHttp";

export const runtime = "nodejs";

/**
 * POST /api/arena/ai-patient/start — begin one fictional-patient practice session.
 * Body: { acknowledged: true, scenarioId?: one of the scenario pack ids } — the learner has read the
 * synthetic-case notice and chosen a situation (absent = Cost Concern). An unknown id is refused.
 * Returns the sealed session, the authored opening line and the limits. Nothing is stored.
 */
export async function POST(req: Request) {
  const gate = await requireLearner("start");
  if (!gate.ok) return gate.response;
  const body = (await req.json().catch(() => ({}))) as { acknowledged?: unknown; scenarioId?: unknown };
  if (body.acknowledged !== true) return jsonError("acknowledgement_required", 400);
  if (body.scenarioId !== undefined && !isScenarioId(body.scenarioId)) return jsonError("unknown_scenario", 400);
  const scenarioId = isScenarioId(body.scenarioId) ? body.scenarioId : DEFAULT_SCENARIO_ID;
  const kase = scenarioFor(scenarioId);
  if (!isAiPatientAvailable()) return jsonError("llm_unavailable", 503);
  try {
    const view = await sessionView(newSession(gate.userId, Date.now(), scenarioId));
    return NextResponse.json(
      { ...view, scenarioId, patientName: kase.patientName, briefing: kase.learnerBriefing, voiceAvailable: isSpeechAvailable() },
      { headers: noStore },
    );
  } catch (e) {
    if (e instanceof AiPatientConfigError) return jsonError("ai_patient_unconfigured", 503);
    throw e;
  }
}
