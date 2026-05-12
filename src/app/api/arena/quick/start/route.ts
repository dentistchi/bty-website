import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import { selectAndRecordQuickScenario } from "@/lib/bty/arena/quickModeService";
import type { ScenarioLocalePreference } from "@/engine/scenario/scenario-selector.service";

export const runtime = "nodejs";

/** POST /api/arena/quick/start — select a scenario and record the quick intent. */
export async function POST(req: NextRequest) {
  const { user, supabase, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  const body = await req.json().catch(() => ({}));
  const locale: ScenarioLocalePreference = body?.locale === "ko" ? "ko" : "en";

  const result = await selectAndRecordQuickScenario(supabase, user.id, locale);

  if (!result.ok) {
    const out = NextResponse.json({ error: result.error }, { status: 500 });
    copyCookiesAndDebug(base, out, req, false);
    return out;
  }

  const out = NextResponse.json({
    ok: true,
    scenario: result.scenario,
    intentId: result.intentId,
  });
  copyCookiesAndDebug(base, out, req, false);
  return out;
}
