import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";

/** POST body: { runId, step (2|3|4|5), emotionIndex? | riskIndex? | integrityIndex? | decisionIndex? } */
export async function POST(req: Request) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const runId = String(body?.runId ?? "");
  const step = Number(body?.step);
  if (!runId || ![2, 3, 4, 5].includes(step)) {
    return NextResponse.json({ error: "runId and step 2-5 required" }, { status: 400 });
  }

  const eventType =
    step === 2 ? "BEGINNER_EMOTION" :
    step === 3 ? "BEGINNER_RISK" :
    step === 4 ? "BEGINNER_INTEGRITY" :
    "BEGINNER_DECISION";

  const meta: Record<string, number> = {};
  if (typeof body.emotionIndex === "number") meta.emotionIndex = body.emotionIndex;
  if (typeof body.riskIndex === "number") meta.riskIndex = body.riskIndex;
  if (typeof body.integrityIndex === "number") meta.integrityIndex = body.integrityIndex;
  if (typeof body.decisionIndex === "number") meta.decisionIndex = body.decisionIndex;

  const { data: run } = await supabase
    .from("arena_runs")
    .select("run_id, scenario_id")
    .eq("run_id", runId)
    .eq("user_id", user.id)
    .eq("run_type", "beginner")
    .maybeSingle();

  if (!run) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const { error } = await supabase.from("arena_events").insert({
    run_id: runId,
    user_id: user.id,
    step,
    event_type: eventType,
    scenario_id: (run as { scenario_id: string }).scenario_id,
    meta: Object.keys(meta).length ? meta : null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
