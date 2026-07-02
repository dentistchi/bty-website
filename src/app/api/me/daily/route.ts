import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import { evaluateDailyGate, type DailyGateSnapshot } from "@/lib/bty/daily/dailyGateCheck";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/me/daily — BTY Daily OS v0.1 Daily Gate Check (Slice 1).
 *
 * Read-only. Returns the single authoritative gate snapshot for the first 60 seconds
 * (Scope Lock §5). User-scoped Supabase client (requireUser) → RLS applies; never
 * service-role. Fail-quiet: any orchestrator throw degrades to OPEN_DAY (never 500s
 * the daily entry). Triggers no write.
 */
export async function GET(req: NextRequest) {
  const { user, supabase, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  let out: NextResponse;
  try {
    const snapshot: DailyGateSnapshot = await evaluateDailyGate(supabase, user.id);
    out = NextResponse.json(snapshot);
  } catch (e) {
    console.warn("[api/me/daily] degraded → OPEN_DAY:", e instanceof Error ? e.message : e);
    out = NextResponse.json({
      gate: "OPEN_DAY",
      destination: { kind: "today" },
    } satisfies DailyGateSnapshot);
  }
  copyCookiesAndDebug(base, out, req, true);
  return out;
}
