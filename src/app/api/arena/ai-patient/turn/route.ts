import { NextResponse } from "next/server";
import { AI_PATIENT_LIMITS, cleanLearnerText, sessionPhase } from "@/domain/arena/aiPatient/sessionRules";
import { takeTurn } from "@/lib/bty/arena/aiPatient/aiPatientService";
import { SpeechProviderError, SpeechUnavailableError, transcribeClip } from "@/lib/bty/arena/aiPatient/speech";
import { failureResponse, jsonError, noStore, openSession, requireLearner, sessionView } from "@/lib/bty/arena/aiPatient/aiPatientHttp";

export const runtime = "nodejs";

/**
 * POST /api/arena/ai-patient/turn — the learner speaks or types; the patient answers.
 *   JSON       { state, text }              typed turn
 *   multipart  state=<sealed>, audio=<clip> spoken turn: transcribed here, then the same path
 * The clip is forwarded for transcription and not stored.
 */
export async function POST(req: Request) {
  const gate = await requireLearner();
  if (!gate.ok) return gate.response;

  const isMultipart = (req.headers.get("content-type") ?? "").toLowerCase().startsWith("multipart/form-data");
  let sealed: unknown;
  let rawText: unknown;
  let audio: Blob | null = null;

  if (isMultipart) {
    const form = await req.formData().catch(() => null);
    if (!form) return jsonError("bad_request", 400);
    sealed = form.get("state");
    const a = form.get("audio");
    if (!(a instanceof Blob) || a.size === 0) return jsonError("audio_missing", 400);
    if (a.size > AI_PATIENT_LIMITS.maxAudioBytes) return jsonError("audio_too_large", 413);
    audio = a;
  } else {
    const body = (await req.json().catch(() => ({}))) as { state?: unknown; text?: unknown };
    sealed = body.state;
    rawText = body.text;
  }

  const opened = await openSession(sealed, gate.userId);
  if (!opened.ok) return opened.response;
  const now = Date.now();
  // A finished session is refused BEFORE any provider is paid to transcribe.
  if (sessionPhase(opened.state, now) !== "active") return failureResponse("session_over");

  if (audio) {
    try {
      rawText = await transcribeClip(audio, AbortSignal.timeout(30_000));
    } catch (e) {
      if (e instanceof SpeechUnavailableError) return jsonError("voice_unavailable", 503);
      if (e instanceof SpeechProviderError && e.status < 500) return jsonError("audio_unreadable", 422);
      return jsonError("transcription_failed", 502);
    }
  }

  const cleaned = cleanLearnerText(rawText);
  if (!cleaned.ok) return jsonError(cleaned.reason === "too_long" ? "too_long" : audio ? "nothing_heard" : "empty", 422);

  const result = await takeTurn(opened.state, cleaned.text, audio ? "voice" : "text", now);
  if (!result.ok) return failureResponse(result.reason);
  return NextResponse.json({ ...(await sessionView(result.state)), learnerText: cleaned.text, patientText: result.patientText }, { headers: noStore });
}
