import { synthesizePatientLine, SpeechUnavailableError } from "@/lib/bty/arena/aiPatient/speech";
import { jsonError, openSession, requireLearner } from "@/lib/bty/arena/aiPatient/aiPatientHttp";
import { AI_PATIENT_LIMITS } from "@/domain/arena/aiPatient/sessionRules";

export const runtime = "nodejs";

/**
 * POST /api/arena/ai-patient/speech — the patient's voice for one of THEIR lines.
 * Body: { state, index }. Only a patient line already in the sealed transcript can be spoken, so this
 * is never a general text-to-speech service. Returns audio/mpeg; nothing is stored.
 */
export async function POST(req: Request) {
  const gate = await requireLearner("speech");
  if (!gate.ok) return gate.response;
  const body = (await req.json().catch(() => ({}))) as { state?: unknown; index?: unknown };
  const opened = await openSession(body.state, gate.userId);
  if (!opened.ok) return opened.response;
  const { state } = opened;
  if (Date.now() > state.expiresAt + AI_PATIENT_LIMITS.feedbackGraceSeconds * 1000) return jsonError("session_over", 410);
  const index = typeof body.index === "number" && Number.isInteger(body.index) ? body.index : -1;
  const turn = state.turns[index];
  if (!turn || turn.role !== "patient") return jsonError("not_a_patient_line", 400);
  try {
    const audio = await synthesizePatientLine(turn.text, AbortSignal.timeout(30_000));
    return new Response(audio, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof SpeechUnavailableError) return jsonError("voice_unavailable", 503);
    return jsonError("speech_failed", 502);
  }
}
