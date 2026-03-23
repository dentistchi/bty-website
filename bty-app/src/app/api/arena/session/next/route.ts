import { NextRequest, NextResponse } from "next/server";
import { getNextScenarioForSession } from "@/engine/integration/scenario-type-router";
import { ScenarioSelectionError, type ScenarioLocalePreference } from "@/engine/scenario/scenario-selector.service";
import { copyCookiesAndDebug, requireUser, unauthenticated } from "@/lib/supabase/route-client";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { user, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  const raw = req.nextUrl.searchParams.get("locale");
  const locale: ScenarioLocalePreference = raw === "ko" ? "ko" : "en";

  try {
    const routed = await getNextScenarioForSession(user.id, locale);
    if (routed === null) {
      const res = NextResponse.json(
        {
          ok: false,
          error: "Arena access suspended until Center requirements are met.",
          code: "user_ejected_from_arena" as const,
        },
        { status: 403 },
      );
      copyCookiesAndDebug(base, res, req, true);
      return res;
    }
    const res = NextResponse.json({
      ok: true,
      scenario: routed.scenario,
      scenarioRoute: routed.route,
      delayedOutcomePending: routed.delayedOutcomePending,
      ...(routed.recallPrompt ? { recallPrompt: routed.recallPrompt } : {}),
      ...(routed.route === "mirror" && routed.mirrors ? { mirrors: routed.mirrors } : {}),
    });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  } catch (e) {
    if (e instanceof ScenarioSelectionError && e.code === "user_ejected_from_arena") {
      const res = NextResponse.json({ ok: false, error: e.message, code: e.code }, { status: 403 });
      copyCookiesAndDebug(base, res, req, true);
      return res;
    }
    if (e instanceof ScenarioSelectionError && e.code === "no_scenario_available") {
      const res = NextResponse.json({ ok: false, error: e.message, code: e.code }, { status: 404 });
      copyCookiesAndDebug(base, res, req, true);
      return res;
    }
    const msg = e instanceof Error ? e.message : "selection_failed";
    const res = NextResponse.json({ ok: false, error: msg }, { status: 500 });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  }
}
