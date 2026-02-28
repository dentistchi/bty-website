import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import { getSecondAwakening } from "@/lib/bty/emotional-stats/secondAwakening";

/** GET: Second Awakening eligibility and ritual payload (private_only). */
export async function GET(req: NextRequest) {
  const { user, supabase, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  try {
    const result = await getSecondAwakening(supabase, user.id);
    const out = NextResponse.json(result);
    copyCookiesAndDebug(base, out, req, true);
    return out;
  } catch (e) {
    const out = NextResponse.json(
      { error: "Failed to load Second Awakening", eligible: false, completed: false },
      { status: 500 }
    );
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }
}
