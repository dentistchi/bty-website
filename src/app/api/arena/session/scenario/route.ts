import { NextRequest, NextResponse } from "next/server";
import { resolveArenaScenarioForUser } from "@/lib/bty/arena/arenaScenarioResolve.server";
import { copyCookiesAndDebug, requireUser, unauthenticated } from "@/lib/supabase/route-client";

export const runtime = "nodejs";

/**
 * GET /api/arena/session/scenario — resolve a {@link Scenario} for the current user (catalog, `pswitch_*`, or `mirror:*`).
 * Query: `scenarioId` (required), `locale` (optional, `ko` | default `en`).
 */
export async function GET(req: NextRequest) {
  const { user, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  const scenarioId = req.nextUrl.searchParams.get("scenarioId")?.trim() ?? "";
  if (!scenarioId) {
    const res = NextResponse.json({ ok: false, error: "scenarioId_required" }, { status: 400 });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  }

  const raw = req.nextUrl.searchParams.get("locale");
  const locale = raw === "ko" ? "ko" : "en";

  try {
    const scenario = await resolveArenaScenarioForUser(user.id, scenarioId, locale);
    if (!scenario) {
      const res = NextResponse.json(
        { ok: false, error: "scenario_not_found", code: "scenario_not_found" as const },
        { status: 404 },
      );
      copyCookiesAndDebug(base, res, req, true);
      return res;
    }
    const res = NextResponse.json({ ok: true, scenario });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "resolve_failed";
    const res = NextResponse.json({ ok: false, error: msg }, { status: 500 });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  }
}
