import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireConsentedUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import { listMyFieldActions } from "@/lib/bty/action-contract/myFieldActions.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/bty/action-contract/mine — READ-ONLY canonical learner Field Action inventory.
 *
 * Every field_action contract OWNED by the authenticated learner across the canonical lifecycle
 * (pending / submitted / escalated / rejected / approved), independent of Today ranking or reminder
 * eligibility. Ownership comes from the session (`requireUser` → `user.id`), never the client. Pure
 * read over `bty_action_contracts` — no write, no Arena/AIR/XP effect.
 *
 * Unlike a fail-soft Today projection, this route returns a NON-200 on failure so the focused surface
 * can render an explicit "could not be loaded / try again" state (error MUST be distinguishable from
 * an empty inventory). 401 unauth; 500 when the admin client or the query is unavailable.
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
    const items = await listMyFieldActions(admin, user.id);
    out = NextResponse.json({ ok: true, items });
    out.headers.set("Cache-Control", "private, no-store");
  } catch {
    out = NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
  copyCookiesAndDebug(base, out, req, true);
  return out;
}
