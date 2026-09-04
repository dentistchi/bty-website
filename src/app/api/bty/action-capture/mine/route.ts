import { NextRequest, NextResponse } from "next/server";
import { copyCookiesAndDebug, requireUser, unauthenticated } from "@/lib/supabase/route-client";
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
/*
  ★ ARENA LEARNER CONSENT IS NOT THE AUTHORITY FOR A PERSON'S OWN SAVED ITEMS
  (device FAIL, 2026-09-04, measured — the THIRD time this exact boundary error has been found).

  A real non-host participant saved a Teams message successfully — capture `a2945cd1`, `saved_at`
  set at 08:30:07 PDT — and their Saved for later screen said "Saved items could not be loaded."

  MEASURED, not inferred: this route called `requireConsentedUser`, which reads `arena_profiles`
  under the caller's own RLS. That user has ZERO rows there — and so does almost everyone:
  `arena_profiles` holds **3 rows in the entire production database**, against 15 Microsoft-linked
  users. So the request was refused `403 consent_required` before `listMyActionCaptures` ever ran,
  and the client, which only distinguishes ok from not-ok, rendered its failure state. Nothing was
  broken about the query, the write, the session or the data.

  It is the same error already corrected on `/api/bty/announcements/host` and on `/mine` +
  `/respond`: Arena consent governs what a LEARNER agreed about their own PRACTICE data. This
  endpoint returns a person the list of things THEY chose to save. Requiring them to accept a
  learner document to read their own list is a boundary error, not a safeguard — and a Teams-first
  person never passes through the Arena flow at all, so for them it is not a gate but a wall.

  ★ WHAT DID NOT MOVE, BECAUSE IT IS THE PART THAT WAS ALWAYS LOAD-BEARING. Ownership. The query
  is service-role and scopes `.eq("user_id", user.id)` on the SESSION user, which no client can
  supply; `bty_action_captures` is RLS-on with ZERO policies, so this server route remains the only
  way the table is reachable at all. A participant reads their own saved captures and nobody else's.

  The 219 Arena practice / training / observation / learning routes keep their consent requirement
  untouched. That IS learner data.
*/
export async function GET(req: NextRequest) {
  const { user, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

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
