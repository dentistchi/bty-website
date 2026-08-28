import { NextRequest, NextResponse } from "next/server";
import { copyCookiesAndDebug, requireConsentedUser, unauthenticated } from "@/lib/supabase/route-client";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { listMyActionCaptures } from "@/lib/bty/action-capture/ensureActionCapture.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/bty/action-capture/mine — READ-ONLY Saved-for-later inventory for the caller.
 *
 * Owner-scoped by the SESSION user id (the client can never supply it), `status='captured'` only,
 * newest first. `bty_action_captures` has RLS enabled with ZERO policies, so this server route is
 * the only way the data is reachable at all — there is no browser-direct table read, no Host
 * endpoint and no organization endpoint, by design.
 *
 * Returns a NON-200 on failure so the surface can distinguish "could not load" from "nothing
 * saved" — an empty inbox and a broken one must never look the same.
 */
export async function GET(req: NextRequest) {
  const { user, base, consentDenied } = await requireConsentedUser(req);
  if (!user) return unauthenticated(req, base);
  if (consentDenied) return consentDenied;

  const admin = getSupabaseAdmin();
  if (!admin) {
    const out = NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  let out: NextResponse;
  try {
    const items = await listMyActionCaptures(admin, user.id);
    out = NextResponse.json({ ok: true, items });
    out.headers.set("Cache-Control", "private, no-store");
  } catch {
    out = NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
  copyCookiesAndDebug(base, out, req, true);
  return out;
}
