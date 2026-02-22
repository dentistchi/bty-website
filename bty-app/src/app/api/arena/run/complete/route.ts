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
    .select("run_id, status")
    .eq("run_id", runId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (selErr) return NextResponse.json({ error: selErr.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  if (existing.status === "DONE") {
    return NextResponse.json({ ok: true, runId, status: "DONE", idempotent: true });
  }

  const nowIso = new Date().toISOString();

  const { error: updErr } = await supabase
    .from("arena_runs")
    .update({ status: "DONE", completed_at: nowIso })
    .eq("run_id", runId)
    .eq("user_id", user.id);

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  // Re-read to confirm completed_at is actually set
  const { data: after, error: afterErr } = await supabase
    .from("arena_runs")
    .select("run_id, status, completed_at")
    .eq("run_id", runId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (afterErr) {
    return NextResponse.json({
      ok: true,
      runId,
      status: "DONE",
      completed_at: null,
      note: afterErr.message,
    });
  }
  return NextResponse.json({
    ok: true,
    runId,
    status: (after?.status as string) ?? "DONE",
    completed_at: after?.completed_at ?? null,
  });
}
