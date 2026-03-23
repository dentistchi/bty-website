import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { arenaScenarioIdFromUnknown } from "@/domain/arena/scenarios";

/**
 * POST /api/arena/lab/start
 * Leadership Lab: session start for a scenario (client-side run 흐름과 정합).
 * Body: `{ scenarioId: string }` — **`arenaScenarioIdFromUnknown`** 로 정규화; 실패 시 **400** `scenario_id_required`.
 */
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

  const bodyObj = body as { scenarioId?: unknown };
  const scenarioId = arenaScenarioIdFromUnknown(bodyObj?.scenarioId);
  if (!scenarioId) {
    return NextResponse.json({ error: "scenario_id_required" }, { status: 400 });
  }

  return NextResponse.json({ ok: true, scenarioId }, { status: 201 });
}
