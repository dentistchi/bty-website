import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { NextResponse } from "next/server";
import { consentRequiredResponse, isConsentCurrent } from "@/lib/legal/activeConsent";
import { arenaRunIdFromUnknown, arenaScenarioIdFromUnknown } from "@/domain/arena/scenarios";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { applySeasonalXpToCore } from "@/lib/bty/arena/applyCoreXp";
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

  const alreadyCompleted = (storedScore: unknown) => {
    if (typeof storedScore !== "number" || !Number.isFinite(storedScore)) {
      return NextResponse.json({ error: "COMPLETION_RESULT_UNAVAILABLE" }, { status: 409 });
    }
    const storedFeedback = getMaturityFeedback(storedScore);
    return NextResponse.json({ ok: true, idempotent: true, beginner_maturity_score: storedScore,
      band: storedFeedback.band, label: storedFeedback.label, message: storedFeedback.message });
  };
  if ((run as { status?: string }).status === "DONE") {
    return alreadyCompleted((run as { beginner_maturity_score?: number }).beginner_maturity_score);
  }
  if ((run as { status?: string }).status !== "IN_PROGRESS") {
    return NextResponse.json({ error: "RUN_NOT_ACTIVE" }, { status: 409 });
  }
  const xpWriter = getSupabaseAdmin();
  if (!xpWriter) return NextResponse.json({ error: "XP_WRITER_UNAVAILABLE" }, { status: 503 });

  const nowIso = new Date().toISOString();
  const { data: claimed, error: updErr } = await supabase
    .from("arena_runs")
    .update({
      status: "DONE",
      completed_at: nowIso,
      beginner_maturity_score: score,
    })
    .eq("run_id", runId)
    .eq("user_id", user.id)
    .eq("status", "IN_PROGRESS")
    .select("run_id")
    .maybeSingle();

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  if (!claimed) {
    const { data: current } = await supabase.from("arena_runs")
      .select("status, beginner_maturity_score").eq("run_id", runId).eq("user_id", user.id).maybeSingle();
    if ((current as { status?: string } | null)?.status === "DONE") {
      return alreadyCompleted((current as { beginner_maturity_score?: number }).beginner_maturity_score);
    }
    return NextResponse.json({ error: "RUN_COMPLETION_CONFLICT" }, { status: 409 });
  }

  const beginnerSeasonalXp = 30;
  await supabase.rpc("ensure_arena_profile");
  // Atomic weekly_xp increment (UPSERT) — prevents read-modify-write lost writes.
  const { error: wxErr } = await xpWriter.rpc("increment_weekly_xp", {
    p_user_id: user.id,
    p_league_id: null,
    p_delta: beginnerSeasonalXp,
  });
  if (wxErr) return NextResponse.json({ error: "XP_AWARD_FAILED" }, { status: 500 });
  const coreResult = await applySeasonalXpToCore(supabase, user.id, beginnerSeasonalXp);
  if ("error" in coreResult) {
    // log but don't fail the request
  }

  // Store reflection event for analytics
  await supabase.from("arena_events").insert({
    run_id: runId,
    user_id: user.id,
    step: 7,
    event_type: "BEGINNER_REFLECTION",
    scenario_id: scenarioId,
    meta: reflectionText ? { reflectionText } : null,
  });

  return NextResponse.json({
    ok: true,
    beginner_maturity_score: score,
    band: feedback.band,
    label: feedback.label,
    message: feedback.message,
  });
}
