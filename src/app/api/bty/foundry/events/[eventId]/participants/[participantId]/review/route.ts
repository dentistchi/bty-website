import { NextRequest } from "next/server";
import { requireManager, managerJson } from "@/lib/bty/foundry/events/managerGate";
import {
  setSharedReview,
  getSharedUnderstandingForOwner,
  type HostReviewStatus,
} from "@/lib/bty/foundry/events/foundrySharedReviewService";

export const runtime = "nodejs";

const REVIEWABLE: HostReviewStatus[] = ["ALIGNED", "PARTIALLY_CLEAR", "FOLLOW_UP_NEEDED"];

/**
 * POST /api/bty/foundry/events/[eventId]/participants/[participantId]/review — set the Host
 * educational review status (+ optional note) for a submitted shared response (Slice 3.1B-3G).
 * Owner-scoped (requireManager + owner re-check inside the RPC). The review NEVER changes
 * completion, XP, the assignment claim, or the learner's response; every real change is audited;
 * an identical resubmission is an idempotent no-op. A Host may set ALIGNED / PARTIALLY_CLEAR /
 * FOLLOW_UP_NEEDED only (NOT_REVIEWED is the automatic on-submit state, not a Host action).
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ eventId: string; participantId: string }> },
) {
  const gate = await requireManager(req);
  if (!gate.ok) return gate.response;
  const { user, admin, base } = gate.ctx;

  const { eventId, participantId } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const status = body?.status as HostReviewStatus;
  if (!REVIEWABLE.includes(status)) return managerJson(base, req, { error: "invalid_status" }, 400);
  const note = typeof body?.note === "string" ? body.note : null;

  const result = await setSharedReview(admin, user.id, eventId, participantId, status, note);
  if (result !== "reviewed" && result !== "unchanged") {
    return managerJson(base, req, { error: result }, result === "not_owner" ? 404 : 400);
  }
  const view = await getSharedUnderstandingForOwner(admin, user.id, eventId);
  return managerJson(base, req, { ok: true, result, ...(view ?? {}) });
}
