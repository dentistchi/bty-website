import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";

/**
 * POST /api/arena/run — 시나리오 런 시작.
 * Body: { scenarioId: string, locale?: string, difficulty?: string, meta?: object }.
 * Response 200: { run: { run_id, scenario_id, started_at, status } }.
 * Errors: 401 { error: "UNAUTHENTICATED" }, 400 { error: "scenarioId_required" }, 500 { error: string }.
 */
export async function POST(req: Request) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const scenarioId = String(body?.scenarioId ?? "");
  const locale = body?.locale ? String(body.locale) : null;
  const difficulty = body?.difficulty != null ? String(body.difficulty) : null;
  const meta = body?.meta != null && typeof body.meta === "object" ? body.meta : null;
  if (!scenarioId) return NextResponse.json({ error: "scenarioId_required" }, { status: 400 });

  await supabase.rpc("ensure_arena_profile");

  const insertRow: Record<string, unknown> = {
    user_id: user.id,
    scenario_id: scenarioId,
    locale,
  };
  if (difficulty !== null && difficulty !== "") insertRow.difficulty = difficulty;
  if (meta !== null) insertRow.meta = meta;

  const { data, error } = await supabase
    .from("arena_runs")
    .insert(insertRow)
    .select("run_id, scenario_id, started_at, status")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ run: data });
}
