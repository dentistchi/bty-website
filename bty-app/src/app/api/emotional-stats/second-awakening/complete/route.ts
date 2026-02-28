import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import { getSecondAwakening, completeSecondAwakening } from "@/lib/bty/emotional-stats/secondAwakening";

/** POST: Enter Next Phase — mark Second Awakening complete and grant starter unlock if applicable. */
export async function POST(req: NextRequest) {
  const { user, supabase, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  const result = await getSecondAwakening(supabase, user.id);
  if (!result.eligible || result.completed) {
    const out = NextResponse.json(
      { ok: false, error: "Not eligible or already completed" },
      { status: 400 }
    );
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const complete = await completeSecondAwakening(supabase, user.id);
  if (!complete.ok) {
    const out = NextResponse.json(
      { ok: false, error: "Failed to complete" },
      { status: 500 }
    );
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const out = NextResponse.json({
    ok: true,
    starterUnlockGranted: complete.starterUnlockGranted ?? undefined,
  });
  copyCookiesAndDebug(base, out, req, true);
  return out;
}
