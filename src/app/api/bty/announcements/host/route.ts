import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import { canTrackWithBty } from "@/lib/bty/authority/platformAdmin.server";
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
 * What replaces it is STRICTER about the thing that matters here: the caller must not only be
 * authenticated, they must hold Track capability — the same `canTrackWithBty` (active Platform
 * Admin OR active Foundry Host) that guards the Teams Track gates. Before this change any
 * authenticated, consented person could call this route and receive an empty list; now a
 * non-Host is refused outright.
 *
 * The recipient side (`/mine`, `/respond`) keeps its consent contract untouched: that IS learner
 * data, answered by a learner, and this slice does not reason about it.
 */
export async function GET(req: NextRequest) {
  const { user, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ ok: false, items: [] }, { status: 503 });

  // Capability, not consent. Same predicate as the Track gates, so the person who could create a
  // run is exactly the person who can read one back.
  if (!(await canTrackWithBty(admin, user.id))) {
    const denied = NextResponse.json({ error: "track_capability_required" }, { status: 403 });
    copyCookiesAndDebug(base, denied, req, false);
    return denied;
  }

  // Owner scoping stays in the QUERY, where no later renderer can forget it.
  const items = await listHostAnnouncements(admin, user.id);
  const res = NextResponse.json({ ok: true, items }, { status: 200 });
  res.headers.set("Cache-Control", "private, no-store");
  copyCookiesAndDebug(base, res, req, true);
  return res;
}
