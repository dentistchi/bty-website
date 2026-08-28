import { NextRequest, NextResponse } from "next/server";
import { copyCookiesAndDebug, requireConsentedUser, unauthenticated } from "@/lib/supabase/route-client";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { ensureActionCapture } from "@/lib/bty/action-capture/ensureActionCapture.server";
import type { TeamsCaptureInput } from "@/domain/action-capture/captureSource";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/bty/action-capture — save an external item so the user does not lose it.
 *
 * CAPTURE != COMMITMENT. This route creates a `bty_action_captures` row and NOTHING ELSE. It does
 * not create an Action Contract, does not set a deadline, does not touch Arena, Foundry, XP, AIR or
 * any review queue, and the item it creates can never appear in Today.
 *
 * OWNERSHIP IS THE SESSION (`requireConsentedUser` → `user.id`), never the body.
 *
 * SERVER-OWNED FIELDS ARE NOT ACCEPTED FROM THE CLIENT. `user_id`, `external_key`, `source_type`,
 * `status`, `promoted_at` and `promoted_action_contract_id` are rejected outright with 400 rather
 * than silently ignored: a caller sending them has a mistaken model of who owns identity, and a
 * silent drop would let that mistake ship. Identity is DERIVED server-side from the source ids.
 *
 * 201 a new capture · 200 the capture already existed (a repeat save is not an error, and never
 * rewrites the original row's provenance).
 */

/** Fields the server owns. Their presence in a request body is a client bug, not an input. */
const SERVER_OWNED = [
  "user_id",
  "userId",
  "external_key",
  "externalKey",
  "source_type",
  "sourceType",
  "status",
  "promoted_at",
  "promotedAt",
  "promoted_action_contract_id",
  "promotedActionContractId",
] as const;

export async function POST(req: NextRequest) {
  const { user, base, consentDenied } = await requireConsentedUser(req);
  if (!user) return unauthenticated(req, base);
  if (consentDenied) return consentDenied;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    const out = NextResponse.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }
  if (body == null || typeof body !== "object" || Array.isArray(body)) {
    const out = NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const offending = SERVER_OWNED.filter((k) => k in body);
  if (offending.length > 0) {
    const out = NextResponse.json({ ok: false, error: "SERVER_OWNED_FIELD" }, { status: 400 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    const out = NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const result = await ensureActionCapture(admin, {
    userId: user.id,
    input: body as unknown as TeamsCaptureInput,
  });

  let out: NextResponse;
  if (result.ok) {
    out = NextResponse.json({ ok: true, capture: result.capture, created: result.created }, {
      status: result.created ? 201 : 200,
    });
  } else if (result.code === "unsupported_provider" || result.code === "missing_identifier") {
    out = NextResponse.json({ ok: false, error: result.code.toUpperCase() }, { status: 400 });
  } else {
    out = NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
  copyCookiesAndDebug(base, out, req, true);
  return out;
}
