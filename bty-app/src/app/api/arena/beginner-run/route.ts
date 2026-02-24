import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";

/** POST body: { scenarioId: string } */
export async function POST(req: Request) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const scenarioId = String(body?.scenarioId ?? "");
  if (!scenarioId) return NextResponse.json({ error: "scenarioId_required" }, { status: 400 });

  await supabase.rpc("ensure_arena_profile");

  const { data, error } = await supabase
    .from("arena_runs")
    .insert({
      user_id: user.id,
      scenario_id: scenarioId,
      run_type: "beginner",
      status: "IN_PROGRESS",
    })
    .select("run_id, scenario_id, started_at, status")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ run: data });
}
