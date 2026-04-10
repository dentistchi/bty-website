import { NextRequest, NextResponse } from "next/server";
import { getSupabaseScenarioReader, loadArenaScenarioPayloadFromDb } from "@/lib/bty/arena/scenarioPayloadFromDb";
import { isEliteCanonicalRuntimeScenarioId } from "@/lib/bty/arena/eliteCanonicalRuntimeTruth";
import { copyCookiesAndDebug, requireUser, unauthenticated } from "@/lib/supabase/route-client";

export const runtime = "nodejs";

/**
 * GET `/api/arena/re-exposure/[scenarioId]` — playable {@link Scenario} for a **due** delayed outcome
 * tied to this `scenario_id` in `user_scenario_choice_history`. Canonical loader only (elite chain).
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ scenarioId: string }> },
) {
  const { user, base, supabase } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  const { scenarioId: rawId } = await context.params;
  const scenarioId = decodeURIComponent(typeof rawId === "string" ? rawId.trim() : "");
  if (!scenarioId) {
    const out = NextResponse.json({ ok: false, error: "scenario_id_required" }, { status: 400 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const localeParam = req.nextUrl.searchParams.get("locale");
  const locale = localeParam === "ko" ? "ko" : "en";

  const { data: histRows, error: hErr } = await supabase
    .from("user_scenario_choice_history")
    .select("id")
    .eq("user_id", user.id)
    .eq("scenario_id", scenarioId);

  if (hErr) {
    const out = NextResponse.json({ ok: false, error: hErr.message }, { status: 500 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const historyIds = (histRows ?? [])
    .map((r) => (r as { id?: string }).id)
    .filter((x): x is string => typeof x === "string" && x.length > 0);

  if (historyIds.length === 0) {
    const out = NextResponse.json({ ok: false, error: "no_choice_history_for_scenario" }, { status: 404 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const nowIso = new Date().toISOString();
  const { data: pend, error: pErr } = await supabase
    .from("arena_pending_outcomes")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .in("source_choice_history_id", historyIds)
    .lte("scheduled_for", nowIso)
    .limit(1)
    .maybeSingle();

  if (pErr) {
    const out = NextResponse.json({ ok: false, error: pErr.message }, { status: 500 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }
  if (!pend?.id) {
    const out = NextResponse.json({ ok: false, error: "no_pending_reexposure_for_scenario" }, { status: 403 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  if (!isEliteCanonicalRuntimeScenarioId(scenarioId)) {
    const out = NextResponse.json({ ok: false, error: "reexposure_elite_chain_only" }, { status: 400 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const reader = getSupabaseScenarioReader();
  const scenario = await loadArenaScenarioPayloadFromDb(reader, scenarioId, locale);
  if (!scenario) {
    const out = NextResponse.json({ ok: false, error: "scenario_payload_unavailable" }, { status: 404 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const out = NextResponse.json({
    ok: true,
    scenario: { ...scenario, source: "json" as const },
    scenarioId,
  });
  copyCookiesAndDebug(base, out, req, true);
  return out;
}
