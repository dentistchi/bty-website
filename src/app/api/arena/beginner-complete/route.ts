import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { NextResponse } from "next/server";
import { consentRequiredResponse, isConsentCurrent } from "@/lib/legal/activeConsent";
import { arenaRunIdFromUnknown, arenaScenarioIdFromUnknown } from "@/domain/arena/scenarios";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { completeBeginnerReward } from "@/lib/bty/arena/legacyRewards.server";
import { syncAvatarStateAfterCoreXpChange } from "@/engine/avatar/avatar-state.service";
import { getBeginnerScenarioById } from "@/lib/bty/scenario/beginnerScenarios";
import {
  computeBeginnerMaturityScore,
  getMaturityFeedback,
  type BeginnerRunResponses,
} from "@/lib/bty/scenario/beginnerTypes";

/** POST body: { runId, scenarioId, … } — `runId` / `scenarioId` via domain parsers (trim, max length, runId no inner whitespace). */
export async function POST(req: Request) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  if (!(await isConsentCurrent(supabase, user.id))) return consentRequiredResponse();

  const body = await req.json().catch(() => ({}));
  const runId = arenaRunIdFromUnknown(body?.runId);
  const scenarioId = arenaScenarioIdFromUnknown(body?.scenarioId);
  const emotionIndex = Number(body?.emotionIndex);
  const riskIndex = Number(body?.riskIndex);
  const integrityIndex = Number(body?.integrityIndex);
  const decisionIndex = Number(body?.decisionIndex);
  const reflectionText = typeof body?.reflectionText === "string" ? body.reflectionText : null;

  if (!runId) {
    return NextResponse.json({ error: "runId_required" }, { status: 400 });
  }
  if (!scenarioId) {
    return NextResponse.json({ error: "scenarioId_required" }, { status: 400 });
  }

  const scenario = getBeginnerScenarioById(scenarioId);
  if (!scenario) return NextResponse.json({ error: "SCENARIO_NOT_FOUND" }, { status: 404 });

  const { data: run, error: runErr } = await supabase
    .from("arena_runs")
    .select("run_id, scenario_id, run_type, status, beginner_maturity_score")
    .eq("run_id", runId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (runErr || !run) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if ((run as { scenario_id?: string }).scenario_id !== scenarioId) {
    return NextResponse.json({ error: "RUN_SCENARIO_MISMATCH" }, { status: 409 });
  }
  if (reflectionText !== null && reflectionText.length > 20000) {
    return NextResponse.json({ error: "INVALID_REWARD_INPUT" }, { status: 400 });
  }
  if ((run as { run_type?: string }).run_type !== "beginner") {
    return NextResponse.json({ error: "NOT_BEGINNER_RUN" }, { status: 400 });
  }

  const responses: BeginnerRunResponses = {
    emotionIndex: Number.isFinite(emotionIndex) ? Math.max(0, Math.min(3, emotionIndex)) : 0,
    riskIndex: Number.isFinite(riskIndex) ? Math.max(0, Math.min(scenario.riskOptions.length - 1, riskIndex)) : 0,
    integrityIndex: Number.isFinite(integrityIndex) ? (integrityIndex === 1 ? 1 : 0) : 0,
    decisionIndex: Number.isFinite(decisionIndex) ? Math.max(0, Math.min(2, decisionIndex)) : 0,
    reflectionText: reflectionText ?? null,
  };

  const riskLen = scenario.riskOptions.length === 3 ? 3 : 2;
  const score = computeBeginnerMaturityScore(responses, riskLen);
  const feedback = getMaturityFeedback(score);

  // DONE can be a committed request whose HTTP response was lost. The receipt,
  // not a local status shortcut, decides whether this is a safe replay.
  if (!["IN_PROGRESS", "DONE"].includes((run as { status: string }).status)) {
    return NextResponse.json({ error: "RUN_NOT_ACTIVE" }, { status: 409 });
  }
  const writer = getSupabaseAdmin();
  if (!writer) return NextResponse.json({ error: "XP_WRITER_UNAVAILABLE" }, { status: 503 });
  const result = await completeBeginnerReward(writer, {
    userId: user.id, runId, scenarioId, responses, score, feedback,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  const receipt = result.receipt;
  // Derived avatar state is best effort. It must never turn a committed reward
  // into an apparent failure or replay old progression over a newer profile.
  if (!receipt.replayed) {
    try {
      void syncAvatarStateAfterCoreXpChange(user.id, supabase, receipt.coreBefore, receipt.coreAfter).catch(() => {});
    } catch { /* The durable reward remains successful. */ }
  }
  return NextResponse.json({ ok: true, beginner_maturity_score: receipt.score,
    ...receipt.feedback, receiptId: receipt.receiptId, idempotent: receipt.replayed });
}
