import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";

export async function POST(req: Request) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const runId = String(body?.runId ?? "");
  const scenarioId = String(body?.scenarioId ?? "");
  const step = Number(body?.step ?? 1);
  const eventType = String(body?.eventType ?? "");
  const choiceId = body?.choiceId ? String(body.choiceId) : null;
  const followUpIndex = typeof body?.followUpIndex === "number" ? body.followUpIndex : null;
  const xp = Number(body?.xp ?? 0);
  const deltas = body?.deltas ?? null;
  const meta = body?.meta ?? null;

  if (!runId || !scenarioId || !eventType) {
    return NextResponse.json({ error: "runId_scenarioId_eventType_required" }, { status: 400 });
  }

  const { error } = await supabase.from("arena_events").insert({
    run_id: runId,
    user_id: user.id,
    step,
    event_type: eventType,
    scenario_id: scenarioId,
    choice_id: choiceId,
    follow_up_index: followUpIndex,
    xp,
    deltas,
    meta,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (xp > 0) {
    await supabase.rpc("increment_arena_xp", {
      p_user_id: user.id,
      p_run_id: runId,
      p_xp: xp,
    });
  }

  return NextResponse.json({ ok: true });
}
