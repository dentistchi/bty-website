import { NextResponse } from "next/server";
import { consentRequiredResponse, isConsentCurrent } from "@/lib/legal/activeConsent";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/bty/events/mine — the authenticated Host's OWN Reality Events + participation
 * COUNT (Slice 3.2E-EVENT-HOST V1, count-only). Read-only, additive; no schema/RPC/migration.
 *
 * Authorization: the session user is resolved server-side; `creator_id` is NEVER accepted from
 * the client — the query is scoped to `creator_id = user.id`, so a Host sees only their own events.
 * Anonymous → 401.
 *
 * Privacy (locked V1): the payload carries ONLY event id (for keying) + title + canonical state +
 * timestamps + participation count. It NEVER exposes participant ids/emails/names/rows, creator_id,
 * organization ids, the QR token/payload, or Core-XP internals.
 *
 * Cost: at most two reads — (1) owner events, (2) participation rows limited to those event ids —
 * with counts assembled in memory. Event state reuses the scan route's canonical semantics
 * (cancelled → CANCELLED; valid_until in the past → ENDED; otherwise ACTIVE); participation rows
 * are never modified.
 */
type HostEvent = {
  eventId: string;
  title: string;
  state: "ACTIVE" | "ENDED" | "CANCELLED";
  createdAt: string;
  opensAt: string | null;
  closesAt: string | null;
  participationCount: number;
};

export async function GET() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  if (!(await isConsentCurrent(supabase, user.id))) return consentRequiredResponse();

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "ADMIN_CLIENT_UNAVAILABLE" }, { status: 503 });

  // (1) Owner events only — creator_id is server-derived, never from the request.
  const { data: eventsData, error: evErr } = await admin
    .from("bty_events")
    .select("id, title, status, valid_until, created_at")
    .eq("creator_id", user.id)
    .order("created_at", { ascending: false });
  if (evErr) {
    console.error("[events/mine] owner events read failed", { code: evErr.code, message: evErr.message });
    return NextResponse.json({ error: "events_read_failed" }, { status: 500 });
  }
  const events = eventsData ?? [];

  // (2) Participation counts for exactly those events (single bounded read; count in memory).
  const ids = events.map((e) => e.id as string);
  const counts = new Map<string, number>();
  if (ids.length > 0) {
    const { data: parts, error: partErr } = await admin
      .from("bty_event_participation")
      .select("event_id")
      .in("event_id", ids);
    if (partErr) {
      console.error("[events/mine] participation read failed", { code: partErr.code, message: partErr.message });
      return NextResponse.json({ error: "events_read_failed" }, { status: 500 });
    }
    for (const p of parts ?? []) {
      const id = p.event_id as string;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }

  const now = Date.now();
  const out: HostEvent[] = events.map((e) => ({
    eventId: e.id as string,
    title: (e.title as string) ?? "",
    state:
      e.status === "cancelled"
        ? "CANCELLED"
        : new Date(e.valid_until as string).getTime() <= now
          ? "ENDED"
          : "ACTIVE",
    createdAt: e.created_at as string,
    opensAt: null, // the schema has no distinct open time; creation = availability start.
    closesAt: (e.valid_until as string) ?? null,
    participationCount: counts.get(e.id as string) ?? 0,
  }));

  const res = NextResponse.json({ events: out });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
