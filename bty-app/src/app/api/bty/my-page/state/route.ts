import { NextRequest, NextResponse } from "next/server";
import { getMyPageIdentityState } from "@/lib/bty/identity";
import type { Locale } from "@/lib/i18n";
import { createSupabaseRouteClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * GET /api/bty/my-page/state?locale=en|ko — interpreted metrics + merged leadership copy (domain functions).
 */
export async function GET(req: NextRequest) {
  const supabase = await createSupabaseRouteClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const localeParam = req.nextUrl.searchParams.get("locale");
  const locale: Locale = localeParam === "ko" ? "ko" : "en";

  const result = await getMyPageIdentityState(supabase, user.id, locale);
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 500 });
  }

  const {
    AIR: _airOmitted,
    ...metricsPublic
  } = result.data.metrics ?? {};

  return NextResponse.json({
    metrics: metricsPublic,
    leadershipState: result.data.leadershipState,
    recoveryTriggered: result.data.recoveryTriggered,
    recoveryEntryCount: result.data.recoveryEntryCount,
    signals: result.data.signals,
    reflections: result.data.reflections,
    open_action_contract: result.data.open_action_contract,
  });
}
