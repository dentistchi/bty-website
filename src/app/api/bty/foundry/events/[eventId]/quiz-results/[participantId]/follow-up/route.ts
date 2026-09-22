import { NextRequest } from "next/server";
import { requireManager, managerJson } from "@/lib/bty/foundry/events/managerGate";
import { beginFollowUpContact } from "@/lib/bty/foundry/events/hostQuizFollowUp.server";

export const runtime = "nodejs";

/**
 * POST /api/bty/foundry/events/:eventId/quiz-results/:participantId/follow-up
 * Slice Training Result → Human Teams Chat V1.
 *
 * ★ IT SENDS NOTHING. It returns the address a Teams chat window points at and records that this
 * Host initiated contact. The message is composed, edited and sent by the Host in Teams; BTY opens
 * the window and is not a party to the conversation. Nothing here posts an activity, and the bot
 * is not involved at all — a human follow-up should arrive from the human.
 *
 * ★ WHY A POST FOR SOMETHING THAT READS AN ADDRESS. Because it is not a read: it is the moment the
 * Host decided to reach out, which is the one fact worth keeping. Resolving the address here
 * rather than when the detail opens also means a UPN exists only for the tap that uses it.
 */
const STATUS: Record<string, number> = {
  not_owner: 404,
  not_found: 404,
  no_attempt: 404,
  quiz_missing: 404,
  no_teams_identity: 409,
  address_unavailable: 503,
};

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ eventId: string; participantId: string }> },
) {
  const gate = await requireManager(req);
  if (!gate.ok) return gate.response;
  const { eventId, participantId } = await ctx.params;
  const { admin, user, base } = gate.ctx;

  const result = await beginFollowUpContact(admin, { eventId, ownerUserId: user.id, participantId });
  if (!result.ok) return managerJson(base, req, { error: result.reason }, STATUS[result.reason] ?? 400);
  return managerJson(base, req, { ok: true, chatTarget: result.chatTarget, trainingTitle: result.trainingTitle });
}
