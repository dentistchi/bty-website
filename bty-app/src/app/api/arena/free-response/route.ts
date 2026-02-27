import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";

const FREE_RESPONSE_XP = 25;
const MAX_RESPONSE_LENGTH = 2000;

const DEFAULT_FEEDBACK = {
  praise: "You took time to put your response in your own words.",
  suggestion: "Next time, try linking your idea to the scenario context.",
};

export async function POST(req: Request) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const runId = (body as { runId?: string })?.runId;
  const scenarioId = (body as { scenarioId?: string })?.scenarioId;
  const rawText = (body as { responseText?: string })?.responseText;
  const responseText = typeof rawText === "string" ? rawText.trim() : "";

  if (!runId || typeof runId !== "string") {
    return NextResponse.json({ error: "runId_required" }, { status: 400 });
  }
  if (!scenarioId || typeof scenarioId !== "string") {
    return NextResponse.json({ error: "scenarioId_required" }, { status: 400 });
  }
  if (responseText.length === 0) {
    return NextResponse.json({ error: "responseText_required" }, { status: 400 });
  }
  if (responseText.length > MAX_RESPONSE_LENGTH) {
    return NextResponse.json({ error: "responseText_too_long" }, { status: 400 });
  }

  const { data: run, error: runErr } = await supabase
    .from("arena_runs")
    .select("run_id, user_id, status")
    .eq("run_id", runId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (runErr) return NextResponse.json({ error: runErr.message }, { status: 500 });
  if (!run) return NextResponse.json({ error: "RUN_NOT_FOUND" }, { status: 404 });

  const { count, error: countErr } = await supabase
    .from("arena_events")
    .select("event_id", { count: "exact", head: true })
    .eq("run_id", runId)
    .eq("user_id", user.id)
    .eq("event_type", "FREE_RESPONSE");

  if (countErr) return NextResponse.json({ error: countErr.message }, { status: 500 });
  if ((count ?? 0) > 0) {
    return NextResponse.json({ error: "FREE_RESPONSE_ALREADY_SUBMITTED" }, { status: 409 });
  }

  const feedback = DEFAULT_FEEDBACK;
  const meta = {
    responseText: responseText.slice(0, 2000),
    praise: feedback.praise,
    suggestion: feedback.suggestion,
  };

  const { error: insErr } = await supabase.from("arena_events").insert({
    run_id: runId,
    user_id: user.id,
    step: 2,
    event_type: "FREE_RESPONSE",
    scenario_id: scenarioId,
    xp: FREE_RESPONSE_XP,
    meta,
  });

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  const { error: rpcErr } = await supabase.rpc("increment_arena_xp", {
    p_user_id: user.id,
    p_run_id: runId,
    p_xp: FREE_RESPONSE_XP,
  });

  if (rpcErr) return NextResponse.json({ error: rpcErr.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    xp: FREE_RESPONSE_XP,
    feedback,
  });
}
