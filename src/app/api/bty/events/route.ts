import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { hasHostCapability } from "@/lib/bty/authority/platformAdmin.server";
import { signEventQrToken } from "@/lib/bty/event-qr/event-qr-token";

export const runtime = "nodejs";

/**
 * POST /api/bty/events — Reality Event creation (Slice 2a, creation ONLY).
 *
 * A leader-track-approved member creates a Reality Event row in `bty_events` and
 * receives a signed Event QR token (second QR family, `btyev1`). NO scan / NO
 * participation / NO XP / NO activity_xp_events write — those are later slices.
 *
 * Auth/gate order: requireUser (401) → Host capability (403 foundry_host_required)
 * → input validation (400) → service-role insert → sign token.
 *
 * Insert uses the service-role client: `bty_events` RLS exposes only a SELECT
 * policy (no INSERT policy), so the gate is enforced at the route layer and the
 * privileged write goes through `getSupabaseAdmin()` (measured BTY pattern).
 *
 * Body: { title: string; event_type: string; xp_value: number (10–100);
 *         valid_until: string (future ISO timestamp) }
 */
export async function POST(req: NextRequest) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  // Service-role client — required for the authority read and the bty_events insert
  // (the table has no RLS insert policy).
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "ADMIN_CLIENT_UNAVAILABLE" }, { status: 503 });

  /*
    ★ ORGANIZATIONAL AUTHORING AUTHORITY — ONE RULE, THE ONE THE DOOR ALREADY USES (2026-09-04).

    This route asked for TWO things nobody in production could satisfy:

      requireApprovedMembership  → `arena_membership_requests`   MEASURED: 0 rows
      isLeaderTrack              → `leadership_engine_state`     MEASURED: 0 rows

    So Event creation was refused for EVERY user, including both platform admins — and `bty_events`
    has 0 rows, meaning an event has never once been created. Meanwhile the DOOR that opens this
    form (`LearnDoors`, `canCreate`) is gated on a THIRD authority: `hasHostCapability`. A
    host-capable person was therefore shown a complete Event form and, on submit, a flat
    "You're not authorized to open events." — which is what a real DSO demonstration hit.

    Worse, the two refusals rendered the SAME sentence, so the screen could not even say which
    authority had refused.

    The room now uses the door's authority: `hasHostCapability` — active Platform Admin OR active
    Foundry Host grant — the same rule that already governs Training/Module authoring across 31
    manager routes. One organizational-authoring authority instead of three.

    ★ ARENA MEMBERSHIP WAS NOT A SAFEGUARD HERE. It gates Arena PRACTICE entry (5 other routes keep
    it, untouched). A Reality Event is a leader opening a real moment for their team; requiring the
    learner-practice membership for it is the same borrowed-authority error that put Arena consent
    in front of a Host's own tracking audit.

    ★ THIS DOES NOT WIDEN XP. `xp_value` is validated below exactly as before, and awarding still
    happens only through the scan route's signed token. A participant gains nothing here: they
    cannot see the door and, if they forge the call, they are refused by this line.
  */
  if (!(await hasHostCapability(admin, user.id))) {
    return NextResponse.json({ error: "foundry_host_required" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));

  // title: non-empty string.
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!title) return NextResponse.json({ error: "title_required" }, { status: 400 });

  // event_type: non-empty string (bare text, no enum — matches schema).
  const eventType = typeof body?.event_type === "string" ? body.event_type.trim() : "";
  if (!eventType) return NextResponse.json({ error: "event_type_required" }, { status: 400 });

  // xp_value: integer 10–100 (mirror the DB check; reject early).
  const xpValue = body?.xp_value;
  if (typeof xpValue !== "number" || !Number.isInteger(xpValue) || xpValue < 10 || xpValue > 100) {
    return NextResponse.json({ error: "xp_value_invalid" }, { status: 400 });
  }

  // valid_until: parseable timestamp, must be in the future.
  const validUntilRaw = typeof body?.valid_until === "string" ? body.valid_until.trim() : "";
  const validUntilMs = validUntilRaw ? new Date(validUntilRaw).getTime() : NaN;
  if (!Number.isFinite(validUntilMs)) {
    return NextResponse.json({ error: "valid_until_invalid" }, { status: 400 });
  }
  if (validUntilMs <= Date.now()) {
    return NextResponse.json({ error: "valid_until_must_be_future" }, { status: 400 });
  }
  const validUntilIso = new Date(validUntilMs).toISOString();

  // Insert — creator_id = caller; status defaults to 'active' in the schema.
  const { data: event, error } = await admin
    .from("bty_events")
    .insert({
      creator_id: user.id,
      title,
      event_type: eventType,
      xp_value: xpValue,
      valid_until: validUntilIso,
    })
    .select("id, title, event_type, xp_value, valid_until, status, created_at")
    .single();

  if (error || !event) {
    return NextResponse.json({ error: error?.message ?? "event_insert_failed" }, { status: 500 });
  }

  // Sign the Event QR token (scan route consumes it in a later slice).
  let token: string;
  try {
    token = signEventQrToken({
      type: "event",
      eventId: String(event.id),
      issuedBy: user.id,
      issuedAt: Date.now(),
      exp: new Date(event.valid_until).getTime(),
    });
  } catch {
    return NextResponse.json({ error: "token_mint_failed" }, { status: 500 });
  }

  // Forward-reference deep link for the QR. The scan endpoint that consumes `ev`
  // is a later slice; the URL is returned now so the creator can render the QR.
  const origin = req.headers.get("origin") ?? req.nextUrl.origin;
  const localeRaw = req.nextUrl.searchParams.get("locale");
  const locale = localeRaw === "ko" ? "ko" : "en";
  const qrUrl = `${origin}/${locale}/bty/events/scan?ev=${encodeURIComponent(token)}`;

  return NextResponse.json({
    event: {
      id: event.id,
      title: event.title,
      event_type: event.event_type,
      xp_value: event.xp_value,
      valid_until: event.valid_until,
      status: event.status,
      created_at: event.created_at,
    },
    token,
    qrUrl,
  });
}
