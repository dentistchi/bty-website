import { NextRequest, NextResponse } from "next/server";
import { arenaRunIdFromUnknown } from "@/domain/arena/scenarios";
import { buildElitePatternMirrorNarrativeV2 } from "@/lib/bty/pattern-engine/elitePatternMirrorNarrativeV2";
import { copyCookiesAndDebug, requireUser, unauthenticated } from "@/lib/supabase/route-client";

export const runtime = "nodejs";

/**
 * GET /api/arena/run/pattern-mirror-narrative?runId=…
 * Pattern Mirror (Elite step 5) copy — **v2 only** (`pattern_signals` exit + `pattern_states`).
 * Does not use legacy AIR / stance / reinforcement / micro-victory lines.
 */
export async function GET(req: NextRequest) {
  const { user, supabase, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  const runIdParam = req.nextUrl.searchParams.get("runId");
  const runId = arenaRunIdFromUnknown(runIdParam ?? "");
  if (runId === null) {
    const out = NextResponse.json({ ok: false, error: "runId_required" }, { status: 400 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const { data: runRow, error: runErr } = await supabase
    .from("arena_runs")
    .select("run_id")
    .eq("run_id", runId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (runErr) {
    const out = NextResponse.json({ ok: false, error: runErr.message }, { status: 500 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }
  if (!runRow) {
    const out = NextResponse.json({ ok: false, error: "run_not_found" }, { status: 404 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  try {
    const patternNarrative = (await buildElitePatternMirrorNarrativeV2(user.id, runId, supabase)).trim();
    const out = NextResponse.json({ ok: true, patternNarrative });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "mirror_narrative_failed";
    const out = NextResponse.json({ ok: false, error: msg }, { status: 500 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }
}
