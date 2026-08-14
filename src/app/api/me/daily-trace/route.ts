import { NextRequest, NextResponse } from "next/server";
import { requireConsentedUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import { projectDailyTrace } from "@/lib/bty/daily/dailyTrace.server";
import type { DailyTrace } from "@/domain/daily/dailyTrace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/me/daily-trace — Center Daily Trace (STEP 1B).
 *
 * Read-only, Center/self-owned 7-day self-return projection sourced EXCLUSIVELY from `user_day`
 * (no Arena, no weekly-stats, no localStorage). Returns presence-as-light — `{ dailyTrace: [{ date,
 * intensity: 0 | 1 }] }` — numberless, no streak/count/score. User-scoped client (requireUser →
 * RLS); never service-role. Fail-quiet: any projection error degrades to a resting series rather
 * than 500. This route is NOT yet wired into WeeklyOrb (the meWeeklyRhythm flip is STEP 1C).
 */
export async function GET(req: NextRequest) {
  const { user, supabase, base, consentDenied } = await requireConsentedUser(req);
  if (!user) return unauthenticated(req, base);
  if (consentDenied) return consentDenied;

  let out: NextResponse;
  try {
    const trace: DailyTrace = await projectDailyTrace(supabase, user.id, new Date());
    out = NextResponse.json(trace);
  } catch (e) {
    console.warn("[api/me/daily-trace] degraded → resting:", e instanceof Error ? e.message : e);
    out = NextResponse.json({ dailyTrace: [] } satisfies DailyTrace);
  }
  copyCookiesAndDebug(base, out, req, true);
  return out;
}
