import { NextRequest, NextResponse } from "next/server";
import { consentRequiredResponse, isConsentCurrent } from "@/lib/legal/activeConsent";
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
  if (!(await isConsentCurrent(supabase, user.id))) return consentRequiredResponse();

  const localeParam = req.nextUrl.searchParams.get("locale");
  const locale: Locale = localeParam === "ko" ? "ko" : "en";

  const result = await getMyPageIdentityState(supabase, user.id, locale);
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 500 });
  }

  // Quiet-mirror payload minimization: ship only the derived signalCount. Raw metric numerics
  // (xp / AIR / TII / relational/operational/emotional bias) and the raw signals[] trait/meta
  // vectors are intentionally not serialized — the authed My Page UI renders none of them.
  const signalCount = result.data.metrics?.signalCount ?? 0;

  return NextResponse.json({
    metrics: { signalCount },
    leadershipState: result.data.leadershipState,
    recoveryTriggered: result.data.recoveryTriggered,
    recoveryEntryCount: result.data.recoveryEntryCount,
    reflections: result.data.reflections,
    open_action_contract: result.data.open_action_contract,
    awaiting_verification_contracts: result.data.awaiting_verification_contracts,
  });
}
