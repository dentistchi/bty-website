import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { verifyEventQrToken } from "@/lib/bty/event-qr/event-qr-token";
import { reprojectCoreDerivedFields } from "@/lib/bty/event-qr/reprojectCoreDerivedFields";

export const runtime = "nodejs";

/**
 * POST /api/bty/events/scan — Reality Event scan + Core XP award (Slice 2b).
 *
 * Any authenticated account scans a Reality Event QR (`btyev1` token) and is awarded
 * the event's Core XP exactly once. The Event QR is the participation invitation, so
 * this route does NOT require approved Arena membership (R3) — only a signed-in
 * session; Event CREATION still requires approved + leader-track (unchanged).
 *
 * Auth/gate order: requireUser (401) → body { token } (400) → verifyEventQrToken (401)
 * → DB event guard (404 / 409 cancelled / 410 expired) → atomic scan-award RPC → response.
 *
 * The participation insert and the permanent Core XP add are bound atomically by
 * the `bty_event_scan_award` Postgres function (idempotent via
 * unique(event_id, user_id)). Derived projections (tier/code/sub_name/avatar) are
 * recomputed best-effort after the RPC — see `reprojectCoreDerivedFields`. This
 * route does NOT touch the Action QR family, activity_xp_events, weekly XP,
 * leaderboard, band, or org/TII.
 *
 * Body: { token: string }
 *
 * R2: the whole handler is wrapped (below) so an unexpected throw NEVER reaches the
 * participant as a raw "Internal Server Error" — it returns a clean JSON 500 and the
 * exact backend error is logged server-side for diagnosis. Expected states (auth /
 * eligibility / event / idempotent duplicate) keep their canonical status codes.
 */
async function handleScan(req: NextRequest) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  // Participant authorization (Slice 3.2D-EVENT-R3): a valid Event QR is the participation
  // invitation capability. Recording participation requires ONLY an authenticated server session
  // (above) + a valid btyev1 token (below) + an active Event — NOT pre-existing approved Arena
  // membership (that gate is for Arena runs / Event CREATION, unchanged). user_id stays
  // server-derived; anonymous is still blocked by the 401 above.

  const body = await req.json().catch(() => ({}));
  const token = typeof body?.token === "string" ? body.token.trim() : "";
  if (!token) return NextResponse.json({ ok: false, error: "token_required" }, { status: 400 });

  // Token-layer verification (HMAC + payload + exp). Reasons: expired /
  // bad_signature / invalid_token / invalid_payload / server_misconfigured.
  const verified = verifyEventQrToken(token);
  if (!verified.ok) {
    return NextResponse.json({ ok: false, error: verified.reason }, { status: 401 });
  }
  const eventId = verified.payload.eventId; // camelCase from the token payload.

  // Service-role client — participation insert / Core XP add go through the RPC
  // (no RLS insert policy on bty_event_participation).
  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "ADMIN_CLIENT_UNAVAILABLE" }, { status: 503 });
  }

  // DB-authority event guard. Double-checks status/expiry against live data —
  // defends against clock skew / a tampered-but-unexpired token. The token's own
  // exp is already enforced by verifyEventQrToken above.
  const { data: event, error: evErr } = await admin
    .from("bty_events")
    .select("id, title, event_type, xp_value, valid_until, status")
    .eq("id", eventId)
    .maybeSingle();
  if (evErr) {
    // Log the exact backend error (server-only; never returned to the client).
    console.error("[events/scan] event_lookup_failed", { code: evErr.code, message: evErr.message });
    return NextResponse.json({ ok: false, error: "event_lookup_failed" }, { status: 500 });
  }
  if (!event) return NextResponse.json({ ok: false, error: "event_not_found" }, { status: 404 });

  if (event.status === "cancelled") {
    return NextResponse.json({ ok: false, error: "event_cancelled" }, { status: 409 });
  }
  if (new Date(event.valid_until).getTime() <= Date.now()) {
    return NextResponse.json({ ok: false, error: "event_expired" }, { status: 410 });
  }

  // Atomic: insert participation + add permanent Core XP in one transaction.
  // Idempotent — a duplicate scan returns already_scanned with no XP.
  const { data: rpcData, error: rpcErr } = await admin.rpc("bty_event_scan_award", {
    p_event_id: eventId,
    p_user_id: user.id,
    p_xp: event.xp_value,
  });
  if (rpcErr) {
    // The RPC failed (e.g. a new-participant profile-init / FK / constraint issue). Log the exact
    // Postgres error server-side so the first canonical backend error is captured (no secrets, and
    // never returned to the client) — the client only ever sees the generic scan-failed code.
    console.error("[events/scan] scan_award_failed", { code: rpcErr.code, message: rpcErr.message, details: rpcErr.details });
    return NextResponse.json({ ok: false, error: "scan_award_failed" }, { status: 500 });
  }
  const result = Array.isArray(rpcData) ? rpcData[0] : rpcData;
  if (!result) {
    return NextResponse.json({ ok: false, error: "scan_award_failed" }, { status: 500 });
  }

  // Duplicate scan — benign, no XP (D2 shape).
  if (result.already_scanned) {
    return NextResponse.json({ ok: true, already_scanned: true, xp_awarded: 0 });
  }

  const newCoreTotal = Number(result.new_core_xp ?? 0);
  const xpAwarded = typeof result.xp_awarded === "number" ? result.xp_awarded : event.xp_value;

  // Best-effort derived projection — non-fatal: the permanent Core XP is already
  // atomically committed by the RPC, so a projection failure self-heals later.
  await reprojectCoreDerivedFields(admin, user.id, newCoreTotal, xpAwarded).catch((err) =>
    console.warn("[events/scan] core derived reprojection non-fatal failure", err),
  );

  return NextResponse.json({
    ok: true,
    already_scanned: false,
    xp_awarded: xpAwarded,
    event: {
      id: event.id,
      title: event.title,
      event_type: event.event_type,
      xp_value: event.xp_value,
      valid_until: event.valid_until,
      status: event.status,
    },
    newCoreTotal,
  });
}

/**
 * Wrapper (R2): converts ANY unexpected throw into a clean JSON 500 with a stable code, so a
 * participant never sees a raw "Internal Server Error". The exact error is logged server-side
 * (no secrets, never returned to the client). All expected outcomes are already handled inside
 * `handleScan` with their canonical status codes.
 */
export async function POST(req: NextRequest) {
  try {
    return await handleScan(req);
  } catch (err) {
    console.error("[events/scan] unhandled", err instanceof Error ? { message: err.message, stack: err.stack } : err);
    return NextResponse.json({ ok: false, error: "scan_failed" }, { status: 500 });
  }
}
