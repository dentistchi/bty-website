import { NextRequest, NextResponse } from "next/server";
import { requireConsentedUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import { buildTodayIntelligence } from "@/lib/bty/daily/todayIntelligence.server";
import { deriveTodayIntelligence } from "@/domain/daily/todayIntelligence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/me/today-intelligence — BTY Today Intelligence v1 (STEP 7B).
 *
 * Read-only. Returns the deterministic Today brief (relationship focus + confidence +
 * reason codes + fallback mode) derived from existing evidence. User-scoped Supabase
 * client (requireUser) → RLS applies; never service-role. No LLM. Fail-quiet: any throw
 * degrades to a clean-start `read_error` brief so the daily entry never 500s.
 *
 * Kept as a separate route from /api/me/daily (composability), matching /api/me/pulse.
 */
export async function GET(req: NextRequest) {
  const { user, supabase, base, consentDenied } = await requireConsentedUser(req);
  if (!user) return unauthenticated(req, base);
  if (consentDenied) return consentDenied;

  let out: NextResponse;
  try {
    const intel = await buildTodayIntelligence(supabase, user.id);
    out = NextResponse.json(intel);
  } catch (e) {
    console.warn(
      "[api/me/today-intelligence] degraded → clean start:",
      e instanceof Error ? e.message : e,
    );
    out = NextResponse.json(deriveTodayIntelligence({ gate: "OPEN_DAY", readError: true }));
  }
  copyCookiesAndDebug(base, out, req, true);
  return out;
}
