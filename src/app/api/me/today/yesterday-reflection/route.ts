/**
 * /api/me/today/yesterday-reflection — the learner's private "From yesterday" reflection (Slice 3.1B-3I).
 *
 * GET: authenticate → OWNER-SCOPED read of yesterday's most-recent eligible Private Reflection
 *      (server-canonical BTY day boundary in the caller's tz) → return the entry (or null).
 * Read-only: NO writes, NO generation, NO AI. The body is the caller's OWN (linked_user_id = user);
 * it is NEVER Host-visible, NEVER cached (private, no-store), and is delivered only to its owner.
 * Fail-soft → { reflection: null } so Today never breaks.
 */
import { NextRequest, NextResponse } from "next/server";
import { consentRequiredResponse, isConsentCurrent } from "@/lib/legal/activeConsent";
import { getSupabaseServer } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { loadYesterdayReflection } from "@/lib/bty/daily/yesterdayReflection.server";

export const dynamic = "force-dynamic";

const noStore = (res: NextResponse) => {
  // Private Reflection body → never cache it anywhere.
  res.headers.set("Cache-Control", "private, no-store");
  return res;
};

export async function GET(req: NextRequest) {
  try {
    const supabase = await getSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return noStore(NextResponse.json({ ok: false, code: "UNAUTHENTICATED", reflection: null }, { status: 401 }));
    if (!(await isConsentCurrent(supabase, user.id))) return consentRequiredResponse();

    const admin = getSupabaseAdmin();
    if (!admin) return noStore(NextResponse.json({ ok: true, reflection: null }, { status: 200 }));

    const tz = req.nextUrl.searchParams.get("tz");
    const r = await loadYesterdayReflection(admin, user.id, new Date(), tz || null);
    // Explicit owner-private DTO allow-list.
    const reflection = r
      ? {
          entryId: r.entryId,
          eventTitle: r.eventTitle,
          contentType: r.contentType,
          completedAt: r.completedAt,
          responseText: r.responseText,
          additionalCount: r.additionalCount,
        }
      : null;
    return noStore(NextResponse.json({ ok: true, reflection }, { status: 200 }));
  } catch {
    return noStore(NextResponse.json({ ok: true, reflection: null }, { status: 200 }));
  }
}
