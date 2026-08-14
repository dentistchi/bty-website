import { NextRequest, NextResponse } from "next/server";
import { requireConsentedUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import { projectRelationshipPulse, type RelationshipPulse } from "@/lib/bty/daily/relationshipPulse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/me/pulse — BTY Daily OS v0.1 Relationship Pulse (Slice 2).
 *
 * Read-only projection over a 14-day window → self/others/ground bands (Scope Lock §3,
 * §6, §7, §8). Band + copyKey only — no raw counts/scores leave the server. User-scoped
 * Supabase client (requireUser) → RLS applies; never service-role. Fail-quiet: degrades
 * to an all-`quiet` pulse rather than 500.
 *
 * Note: kept as a separate route from /api/me/daily for composability. The Today Shell UI
 * slice MAY consolidate both into one /api/me/today round-trip; not assumed here.
 */
export async function GET(req: NextRequest) {
  const { user, supabase, base, consentDenied } = await requireConsentedUser(req);
  if (!user) return unauthenticated(req, base);
  if (consentDenied) return consentDenied;

  let out: NextResponse;
  try {
    const pulse: RelationshipPulse = await projectRelationshipPulse(supabase, user.id);
    out = NextResponse.json(pulse);
  } catch (e) {
    console.warn("[api/me/pulse] degraded → quiet:", e instanceof Error ? e.message : e);
    out = NextResponse.json({
      overall: "quiet",
      domains: {
        self: { band: "quiet", copyKey: "today.pulse.self.quiet" },
        others: { band: "quiet", copyKey: "today.pulse.others.quiet" },
        ground: { band: "quiet", copyKey: "today.pulse.ground.quiet" },
      },
      hasAnyEvidence: false,
    } satisfies RelationshipPulse);
  }
  copyCookiesAndDebug(base, out, req, true);
  return out;
}
