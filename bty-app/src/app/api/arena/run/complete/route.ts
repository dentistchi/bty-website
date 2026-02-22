import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";

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
  if (!runId || typeof runId !== "string") {
    return NextResponse.json({ error: "MISSING_RUN_ID" }, { status: 400 });
  }

  const { data: existing, error: selErr } = await supabase
    .from("arena_runs")
    .select("run_id, status, scenario_id")
    .eq("run_id", runId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (selErr) return NextResponse.json({ error: selErr.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const scenarioId = (existing as { scenario_id?: string }).scenario_id ?? "";

  if (existing.status !== "DONE") {
    const nowIso = new Date().toISOString();
    const { error: updErr } = await supabase
      .from("arena_runs")
      .update({ status: "DONE", completed_at: nowIso })
      .eq("run_id", runId)
      .eq("user_id", user.id);

    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  // Spec 9-1 B: Apply XP to weekly_xp ONCE per run (idempotent via RUN_COMPLETED_APPLIED)
  const { data: applied, error: appliedErr } = await supabase
    .from("arena_events")
    .select("event_id")
    .eq("user_id", user.id)
    .eq("run_id", runId)
    .eq("event_type", "RUN_COMPLETED_APPLIED")
    .limit(1);

  if (appliedErr) return NextResponse.json({ error: appliedErr.message }, { status: 500 });

  if ((applied ?? []).length > 0) {
    return NextResponse.json({ ok: true, runId, status: "DONE", idempotent: true });
  }

  const { data: evs, error: evErr } = await supabase
    .from("arena_events")
    .select("xp, event_type")
    .eq("user_id", user.id)
    .eq("run_id", runId);

  if (evErr) return NextResponse.json({ error: evErr.message }, { status: 500 });

  const delta = (evs ?? []).reduce((sum, row) => sum + (typeof row.xp === "number" ? row.xp : 0), 0);

  const { data: row, error: rowErr } = await supabase
    .from("weekly_xp")
    .select("id, xp_total")
    .eq("user_id", user.id)
    .is("league_id", null)
    .maybeSingle();

  if (rowErr) return NextResponse.json({ error: rowErr.message }, { status: 500 });

  if (!row) {
    const { error: insErr } = await supabase
      .from("weekly_xp")
      .insert({ user_id: user.id, league_id: null, xp_total: delta });

    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
  } else {
    const nextTotal = (typeof row.xp_total === "number" ? row.xp_total : 0) + delta;
    const { error: uErr } = await supabase
      .from("weekly_xp")
      .update({ xp_total: nextTotal })
      .eq("id", row.id);

    if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });
  }

  const { error: markErr } = await supabase.from("arena_events").insert({
    user_id: user.id,
    run_id: runId,
    event_type: "RUN_COMPLETED_APPLIED",
    step: 7,
    scenario_id: scenarioId || "unknown",
    xp: 0,
  });

  if (markErr) return NextResponse.json({ error: markErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, runId, status: "DONE", deltaApplied: delta });
}
