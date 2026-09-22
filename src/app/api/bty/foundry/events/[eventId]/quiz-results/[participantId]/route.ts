import { NextRequest } from "next/server";
import { requireManager, managerJson } from "@/lib/bty/foundry/events/managerGate";
import { readLearnerResultDetail } from "@/lib/bty/foundry/events/hostQuizFollowUp.server";

export const runtime = "nodejs";

/**
 * GET /api/bty/foundry/events/:eventId/quiz-results/:participantId — one learner's missed items.
 * Slice Training Result → Human Teams Chat V1.
 *
 * The sibling collection route deliberately excludes raw answers, because a roster-wide read has
 * no reason to carry them. THIS route is the deliberate, owner-scoped exception: a Host who has
 * opened one learner is asking the only question a score cannot answer — which item did not land.
 *
 * It returns the objective quiz only: the missed question, the choice the learner picked, the
 * correct choice, and the Host's own explanation if they wrote one. Private Reflection and Shared
 * Understanding live on a table this path never reads.
 */
const STATUS: Record<string, number> = { not_owner: 404, not_found: 404, no_attempt: 404, quiz_missing: 404 };

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ eventId: string; participantId: string }> },
) {
  const gate = await requireManager(req);
  if (!gate.ok) return gate.response;
  const { eventId, participantId } = await ctx.params;
  const { admin, user, base } = gate.ctx;

  const result = await readLearnerResultDetail(admin, { eventId, ownerUserId: user.id, participantId });
  /*
    A training this Host does not own is reported as NOT FOUND, not as forbidden: "you may not see
    this" and "this does not exist" must be indistinguishable to someone probing for event ids.
  */
  if (!result.ok) return managerJson(base, req, { error: result.reason }, STATUS[result.reason] ?? 400);
  return managerJson(base, req, result.detail);
}
