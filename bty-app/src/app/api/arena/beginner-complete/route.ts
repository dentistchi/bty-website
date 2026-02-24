import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { getBeginnerScenarioById } from "@/lib/bty/scenario/beginnerScenarios";
import {
  computeBeginnerMaturityScore,
  getMaturityFeedback,
  type BeginnerRunResponses,
} from "@/lib/bty/scenario/beginnerTypes";

/** POST body: { runId, scenarioId, emotionIndex, riskIndex, integrityIndex, decisionIndex, reflectionText? } */
export async function POST(req: Request) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const runId = String(body?.runId ?? "");
  const scenarioId = String(body?.scenarioId ?? "");
  const emotionIndex = Number(body?.emotionIndex);
  const riskIndex = Number(body?.riskIndex);
  const integrityIndex = Number(body?.integrityIndex);
  const decisionIndex = Number(body?.decisionIndex);
  const reflectionText = typeof body?.reflectionText === "string" ? body.reflectionText : null;

  if (!runId || !scenarioId) {
    return NextResponse.json({ error: "runId and scenarioId required" }, { status: 400 });
  }

  const scenario = getBeginnerScenarioById(scenarioId);
  if (!scenario) return NextResponse.json({ error: "SCENARIO_NOT_FOUND" }, { status: 404 });

  const { data: run, error: runErr } = await supabase
    .from("arena_runs")
    .select("run_id, scenario_id, run_type, status")
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

  const nowIso = new Date().toISOString();
  const { error: updErr } = await supabase
    .from("arena_runs")
    .update({
      status: "DONE",
      completed_at: nowIso,
      beginner_maturity_score: score,
    })
    .eq("run_id", runId)
    .eq("user_id", user.id);

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

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
