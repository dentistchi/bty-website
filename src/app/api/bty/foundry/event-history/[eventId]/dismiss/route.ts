import { NextRequest, NextResponse } from "next/server";
import { requireManager, managerJson } from "@/lib/bty/foundry/events/managerGate";
import { dismissTrainingFromHistory } from "@/lib/bty/foundry/events/foundryEventHistoryDismissal.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/bty/foundry/event-history/[eventId]/dismiss
 * — hide ONE finished training session from the caller's own history.
 *
 * ★ IT HIDES, IT DOES NOT DELETE. The service names two tables: `foundry_events` (read, to check
 * ownership and lifecycle) and the dismissal table (insert). The session, its participants, their
 * progress and every completion record are untouched, and no other person's view can change.
 *
 * ★ OWNERSHIP IS RE-DERIVED FROM THE SESSION, NOT THE REQUEST. The id comes from the path and the
 * user from the session; the service then requires `owner_user_id = caller`. Nothing is read from
 * the body. A session that is not theirs and one that does not exist both answer 404, so this
 * cannot be used to discover whether a session exists.
 *
 * ★ ONLY A CLOSED SESSION. An open one is live work; hiding it would hide an obligation, so it is
 * refused with its own code rather than folded into "not found" — the caller is entitled to know
 * the difference about their own session.
 *
 * 200 `changed: true`  — it left this person's history now.
 * 200 `changed: false` — it had already left. The primary key makes that idempotent, not a
 *   read-then-write the service layer would have to get right. Same convention as the capture
 *   producer's `created: false` and the Saved lane's `changed: false`.
 * 404 — not theirs, or not there.  409 — open, so not removable.
 *
 * Behind `requireManager`, matching the two history reads this subtracts from: both are
 * owner-scoped Host surfaces, so the only person with history to tidy here is the owner.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ eventId: string }> }) {
  const gate = await requireManager(req);
  if (!gate.ok) return gate.response;
  const { user, admin, base } = gate.ctx;

  const eventId = (await ctx.params)?.eventId?.trim();
  if (!eventId) return managerJson(base, req, { ok: false, error: "NOT_FOUND" }, 404);

  const result = await dismissTrainingFromHistory(admin, { userId: user.id, eventId });
  if (!result.ok) {
    const status = result.code === "not_found" ? 404 : result.code === "not_closed" ? 409 : 500;
    return managerJson(base, req, { ok: false, error: result.code.toUpperCase() }, status);
  }
  return managerJson(base, req, { ok: true, changed: result.changed });
}
