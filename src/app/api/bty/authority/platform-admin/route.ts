import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import { isActivePlatformAdmin } from "@/lib/bty/authority/platformAdmin.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/bty/authority/platform-admin — "is the caller an active platform admin?" Slice TQ-2.
 *
 * ★ WHY A ROUTE EXISTS AT ALL FOR A BOOLEAN.
 *
 * The Teams display diagnostic has to be reachable from inside the running tab, and it must not be
 * reachable by everyone in it. `isActivePlatformAdmin` is SERVER ONLY by construction — it reads
 * `bty_platform_admin_grants` with the service key — so a client that needs to know the answer has
 * to ask. This is that question and nothing else.
 *
 * ★ WHAT IT ANSWERS ABOUT, AND WHAT IT REFUSES TO.
 *
 * It answers ONLY about the authenticated caller. There is no user id parameter, no email, no
 * lookup by anything the request can name — so it cannot be used to enumerate who holds a grant,
 * which is the one thing a roster endpoint would leak. The session identifies the subject; the
 * request body cannot.
 *
 * ★ IT IS NOT ITSELF A GATE.
 *
 * Nothing is authorized by this answer. Every admin-only route still runs `requirePlatformAdmin`
 * for itself, and this endpoint's only consumer hides a MEASUREMENT overlay that reads geometry
 * from the caller's own DOM. A forged `true` on the client would reveal the size of the reader's
 * own screen to the reader.
 *
 * ★ FAILS CLOSED. No session → 401. No admin client → false. A lookup that errors → false, inside
 * `isActivePlatformAdmin` itself. Read-only: no write, no upsert, no audit row, no cache.
 */
export async function GET(req: NextRequest) {
  const { user, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  const admin = getSupabaseAdmin();
  const isPlatformAdmin = admin ? await isActivePlatformAdmin(admin, user.id) : false;

  const out = NextResponse.json({ ok: true, isPlatformAdmin });
  copyCookiesAndDebug(base, out, req, true);
  return out;
}
