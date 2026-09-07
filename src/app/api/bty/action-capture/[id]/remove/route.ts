import { NextRequest, NextResponse } from "next/server";
import { copyCookiesAndDebug, requireUser, unauthenticated } from "@/lib/supabase/route-client";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { removeFromSavedLane } from "@/lib/bty/action-capture/ensureActionCapture.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/bty/action-capture/[id]/remove — clear ONE item from the caller's Saved for later.
 *
 * ★ REMOVE MEANS CLEAR MY QUEUE. It is not deletion, and the boundary is structural rather than
 * promised: the service this calls names `saved_removed_at`, `triage_choice` and `triaged_at` and no
 * other column, so nothing here can reach the source, the permalink, the capture's identity, its
 * promotion history, or a Track that references it as `source_capture_id`. There is no DELETE
 * anywhere in the path — `service_role` has held none on this table since 20260915, deliberately.
 *
 * ★ `saved_at` IS NEVER TOUCHED. That they saved this, once, at that moment, stays true afterwards.
 * Membership of the lane is the conjunction of two separate facts, and only the second one moves.
 *
 * OWNERSHIP IS THE SESSION. The id comes from the path, the owner from `requireUser`, and the two
 * are combined in the UPDATE's WHERE clause. A capture belonging to somebody else and a capture that
 * does not exist return the SAME 404, so this cannot be used to discover whether one exists.
 *
 * 200 `changed: true`  — it left the queue now.
 * 200 `changed: false` — it had already left. The removal moment is NOT moved; they let it go when
 *   they let it go, and pressing the same control again does not make that a more recent decision.
 *   Same convention as the capture producer's `created: false` and triage's `changed: false`.
 * 404 — not theirs, not there, or never in the lane at all (Track-only source evidence).
 *
 * ★ NO ARENA CONSENT GATE, for the reason measured three times on neighbouring routes and recorded
 * on `/triage`: Arena consent governs a LEARNER's practice data. This returns a person control over
 * a list THEY built. `arena_profiles` holds 3 rows against 15 Microsoft-linked users, so requiring
 * it would be a wall for exactly the Teams-first people this feature is for. Ownership — the part
 * that is actually load-bearing — is unchanged: service-role query, `.eq("user_id", user.id)`, and
 * `bty_action_captures` is RLS-on with zero policies, so this route is the only way in.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, base } = await requireUser(req);

  const send = (body: Record<string, unknown>, status: number) => {
    const out = NextResponse.json(body, { status });
    out.headers.set("Cache-Control", "private, no-store");
    copyCookiesAndDebug(base, out, req, true);
    return out;
  };

  if (!user) return unauthenticated(req, base);

  const captureId = (await ctx.params)?.id?.trim();
  if (!captureId) return send({ ok: false, error: "NOT_FOUND" }, 404);

  // Nothing is read from the body. The only inputs are the path id and the session.
  const admin = getSupabaseAdmin();
  if (!admin) return send({ ok: false, error: "SERVER_ERROR" }, 500);

  const result = await removeFromSavedLane(admin, { userId: user.id, captureId });
  if (!result.ok) {
    return result.code === "not_found"
      ? send({ ok: false, error: "NOT_FOUND" }, 404)
      : send({ ok: false, error: "SERVER_ERROR" }, 500);
  }
  return send({ ok: true, capture: result.capture, changed: result.changed }, 200);
}
