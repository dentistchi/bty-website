import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import { listHostAnnouncements } from "@/lib/bty/announcement/announcementService.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/bty/announcements/host — the Host's own runs and their outcomes. Slice A1.
 *
 * Owner-scoped by the session user. Returns five counts per run and never a combined score: a Host
 * shown one number has been told something nobody measured.
 *
 * ★ ARENA LEARNER CONSENT IS NOT PART OF THIS AUTHORITY (device FAIL, 2026-09-02T21:36Z).
 *
 * This route used `requireConsentedUser`, and a real Host was locked out of his own tracking by it.
 * MEASURED: hc's session was valid — `/auth/v1/user` returned 200 — and ZERO reads reached the
 * announcement tables, because `isConsentCurrent` found no `arena_profiles` row and the request was
 * refused `403 consent_required` before `listHostAnnouncements` ran. Two of thirteen linked
 * accounts carry a consent version; a Teams-first Host never passes through the Arena flow at all.
 *
 * The gate was simply the wrong one. Arena consent governs what a LEARNER agreed to about their own
 * practice data. This endpoint returns a Host their own audit of a message they captured and sent —
 * something they were already authorized to create, through a capability check that has nothing to
 * do with Arena. Asking a Host to accept a learner document to read back their own action is a
 * boundary error, not a safeguard.
 *
 * It was then briefly replaced by `canTrackWithBty` (active Platform Admin OR active Foundry
 * Host). That went too far in the other direction once Track became a participant capability: the
 * person who creates a run must be able to read it back, and 12 of 15 Microsoft-linked people held
 * no grant. Owner scoping in the query — never a capability — is what keeps one Host's audit out
 * of another's hands, and it is unchanged.
 *
 * The recipient side (`/mine`, `/respond`) keeps its consent contract untouched: that IS learner
 * data, answered by a learner, and this slice does not reason about it.
 */
export async function GET(req: NextRequest) {
  const { user, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ ok: false, items: [] }, { status: 503 });

  /*
    OWNERSHIP IS THE BOUNDARY HERE, NOT A CAPABILITY (2026-09-04).

    This route used `canTrackWithBty` — active Platform Admin OR active Foundry Host. Track is now
    a participant capability, so requiring a Host grant to read back or act on a run you yourself
    created would lock the ordinary person out of their own action the moment they took it.

    Nothing is loosened that was ever load-bearing. The thing that actually protects these rows is
    OWNER SCOPING, and it has always lived where no caller can reach it: in the query for the read,
    and inside the SECURITY DEFINER function for the write, which joins the recipient to its
    announcement owner and answers a non-owner exactly like a missing row. A person who owns
    nothing therefore sees nothing and can change nothing — the capability check was never what
    made that true.
  */

  // Owner scoping stays in the QUERY, where no later renderer can forget it.
  const items = await listHostAnnouncements(admin, user.id);
  const res = NextResponse.json({ ok: true, items }, { status: 200 });
  res.headers.set("Cache-Control", "private, no-store");
  copyCookiesAndDebug(base, res, req, true);
  return res;
}
