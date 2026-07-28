import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { signEventQrToken } from "@/lib/bty/event-qr/event-qr-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/bty/events/mine/{eventId} — OWNER-SCOPED Reality Event detail + participant roster
 * (Slice 3.2E-EVENT-HOST-R1). Read-only, additive; no schema/RPC/migration.
 *
 * Nested under `mine/` (not a dynamic sibling of `mine`/`scan`) to avoid opennext dynamic-route
 * shadowing.
 *
 * Authorization (server-enforced, the client gate is NOT authorization):
 *   - session resolved server-side; anonymous → 401.
 *   - the event is loaded WHERE id = {eventId} AND creator_id = session user; a non-owned/unknown
 *     event → NON-DISCLOSING 404 (a different Host / a mere participant cannot read it).
 *   - participation rows are read ONLY after ownership succeeds.
 *
 * QR reopen: the `btyev1` token is a STATELESS HMAC (not stored) minted from the event's own
 * canonical fields, and `verifyEventQrToken` checks signature+presence+expiry only — so the owner's
 * QR is re-derivable here by re-signing an EQUIVALENT valid capability (old QR stays valid; no
 * rotation, no hash reversal, no schema change). Only offered while the event is ACTIVE (a re-minted
 * token for an ended/cancelled event would only scan to 410/409). Returned to the OWNER only.
 *
 * Identity source: `arena_profiles.display_name` (BTY's canonical human-readable name, per
 * leaderboardService), returned as `displayName` (null when unset → the client shows a generic
 * fallback). NEVER user_id / email / creator_id / org ids / token hash / Core-XP internals.
 */
type Participant = { displayName: string | null; participatedAt: string };

export async function GET(req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "ADMIN_CLIENT_UNAVAILABLE" }, { status: 503 });

  // Owner-scoped load — id AND creator_id = session user. Not owned → 404 (non-disclosing).
  const { data: ev, error: evErr } = await admin
    .from("bty_events")
    .select("id, title, status, valid_until, created_at")
    .eq("id", eventId)
    .eq("creator_id", user.id)
    .maybeSingle();
  if (evErr) {
    console.error("[events/mine/:id] event read failed", { code: evErr.code, message: evErr.message });
    return NextResponse.json({ error: "event_read_failed" }, { status: 500 });
  }
  if (!ev) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Participation roster (owner authorized) — oldest-first, then resolve human-readable names.
  const { data: partData, error: partErr } = await admin
    .from("bty_event_participation")
    .select("user_id, scanned_at")
    .eq("event_id", eventId)
    .order("scanned_at", { ascending: true });
  if (partErr) {
    console.error("[events/mine/:id] participation read failed", { code: partErr.code, message: partErr.message });
    return NextResponse.json({ error: "event_read_failed" }, { status: 500 });
  }
  const rows = partData ?? [];
  const userIds = [...new Set(rows.map((r) => r.user_id as string))];
  const names = new Map<string, string | null>();
  if (userIds.length > 0) {
    const { data: profs } = await admin.from("arena_profiles").select("user_id, display_name").in("user_id", userIds);
    for (const p of profs ?? []) names.set(p.user_id as string, (p.display_name as string | null) ?? null);
  }
  const participants: Participant[] = rows.map((r) => ({
    displayName: names.get(r.user_id as string) ?? null, // client renders a generic fallback when null
    participatedAt: r.scanned_at as string,
  }));

  const now = Date.now();
  const state = ev.status === "cancelled" ? "CANCELLED" : new Date(ev.valid_until as string).getTime() <= now ? "ENDED" : "ACTIVE";

  // Re-derive the QR capability for the OWNER only, and only while the event is ACTIVE.
  let qr: { available: boolean; payload?: string } = { available: false };
  if (state === "ACTIVE") {
    try {
      const token = signEventQrToken({
        type: "event",
        eventId: eventId,
        issuedBy: user.id, // owner (== creator_id, enforced above)
        issuedAt: Date.now(),
        exp: new Date(ev.valid_until as string).getTime(),
      });
      const origin = req.headers.get("origin") ?? req.nextUrl.origin;
      const localeRaw = req.nextUrl.searchParams.get("locale");
      const locale = localeRaw === "ko" ? "ko" : "en";
      qr = { available: true, payload: `${origin}/${locale}/bty/events/scan?ev=${encodeURIComponent(token)}` };
    } catch {
      qr = { available: false };
    }
  }

  const res = NextResponse.json({
    event: {
      eventId: ev.id as string,
      title: (ev.title as string) ?? "",
      state,
      createdAt: ev.created_at as string,
      closesAt: (ev.valid_until as string) ?? null,
      participationCount: rows.length,
      qr,
    },
    participants,
  });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
