import { NextResponse } from "next/server";
import { saveArenaSignalWithSeed, parseArenaSignalBody } from "@/lib/bty/identity";
import { createSupabaseRouteClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * POST /api/bty/arena/signals — Arena outcome + reflection seed (same transaction as two inserts).
 */
export async function POST(req: Request) {
  const supabase = await createSupabaseRouteClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseArenaSignalBody(raw);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const result = await saveArenaSignalWithSeed(supabase, {
    userId: user.id,
    scenarioId: parsed.scenarioId,
    primaryChoice: parsed.primaryChoice,
    reinforcementChoice: parsed.reinforcementChoice,
    traits: parsed.traits,
    meta: parsed.meta,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    signalId: result.signalId,
    seedId: result.seedId,
  });
}
