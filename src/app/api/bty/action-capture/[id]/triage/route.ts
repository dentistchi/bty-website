import { NextRequest, NextResponse } from "next/server";
import { copyCookiesAndDebug, requireConsentedUser, unauthenticated } from "@/lib/supabase/route-client";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { setActionCaptureTriage } from "@/lib/bty/action-capture/ensureActionCapture.server";
import { parseTriageChoice } from "@/domain/action-capture/triage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/bty/action-capture/[id]/triage — record the ONE decision a saved item allows (Slice T2).
 *
 * Body: `{ "choice": "soon" }` or `{ "choice": "later" }`. Nothing else is read from it.
 *
 * TRIAGE IS NOT PROMOTION. This route writes exactly two columns on one row. It creates no Action
 * Contract, sets no deadline, schedules no reminder, and touches no Arena, Foundry, XP, AIR or
 * review path — `soon` is a position in the user's own saved list and nothing more. That is not a
 * style preference: the Arena session gate selects open contracts with no `action_type` filter, so
 * a capture turned into a contract would block Arena play.
 *
 * OWNERSHIP IS THE SESSION. The row id comes from the path, the owner from `requireConsentedUser`,
 * and the two are combined in the UPDATE's WHERE clause — a capture belonging to someone else is
 * never selected. A non-owned id and a non-existent id both return the SAME 404, so the endpoint
 * cannot be used to discover whether a capture exists.
 *
 * 200 with `changed: true` — the decision was recorded.
 * 200 with `changed: false` — it was already decided; the standing decision is returned UNCHANGED.
 *   That mirrors this codebase's existing convention for a repeated intent (the capture producer
 *   answers a repeat save with `created: false`), and it is why V1 needs no separate conflict code:
 *   the caller's intent is satisfied either way, and re-triage is deliberately not offered.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, base, consentDenied } = await requireConsentedUser(req);
  if (!user) return unauthenticated(req, base);
  if (consentDenied) return consentDenied;

  const send = (body: Record<string, unknown>, status: number) => {
    const out = NextResponse.json(body, { status });
    out.headers.set("Cache-Control", "private, no-store");
    copyCookiesAndDebug(base, out, req, true);
    return out;
  };

  const { id } = await ctx.params;
  const captureId = typeof id === "string" ? id.trim() : "";
  if (!captureId) return send({ ok: false, error: "NOT_FOUND" }, 404);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return send({ ok: false, error: "INVALID_JSON" }, 400);
  }

  // An unrecognised choice is refused rather than normalised: the caller is asking to record a
  // decision, so a value we do not recognise means we do not know what they decided.
  const choice = parseTriageChoice((body as { choice?: unknown } | null)?.choice);
  if (!choice) return send({ ok: false, error: "INVALID_CHOICE" }, 400);

  const admin = getSupabaseAdmin();
  if (!admin) return send({ ok: false, error: "SERVER_ERROR" }, 500);

  const result = await setActionCaptureTriage(admin, { userId: user.id, captureId, choice });
  if (!result.ok) {
    return result.code === "not_found"
      ? send({ ok: false, error: "NOT_FOUND" }, 404)
      : send({ ok: false, error: "SERVER_ERROR" }, 500);
  }
  return send({ ok: true, capture: result.capture, changed: result.changed }, 200);
}
