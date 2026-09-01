import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireConsentedUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import { listMyAnnouncements } from "@/lib/bty/announcement/announcementService.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/bty/announcements/mine — what needs THIS person's response. Slice A1.
 *
 * Ownership is the session. The projection is built by a whitelisting select that never reads the
 * captured message body or any internal Microsoft identifier, so a private-channel source cannot
 * leak to someone who merely happens to be in the audience.
 */
export async function GET(req: NextRequest) {
  const { user, base, consentDenied } = await requireConsentedUser(req);
  if (!user) return unauthenticated(req, base);
  if (consentDenied) return consentDenied;

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ ok: false, items: [] }, { status: 503 });

  const items = await listMyAnnouncements(admin, user.id);
  const res = NextResponse.json({ ok: true, items }, { status: 200 });
  res.headers.set("Cache-Control", "private, no-store");
  copyCookiesAndDebug(base, res, req, true);
  return res;
}
