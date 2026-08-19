import { NextRequest } from "next/server";
import { requireManager, managerJson } from "@/lib/bty/foundry/events/managerGate";
import { getTrainingOutcome } from "@/lib/bty/foundry/events/foundryTrainingOutcomeService";
import { readUserTzContext } from "@/lib/bty/daily/userDay";

export const runtime = "nodejs";

/**
 * GET /api/bty/foundry/events/[eventId]/outcome — the Host's "did anything change?" aggregate
 * (Slice R4-R3A). Owner-scoped, READ-ONLY: it writes nothing and names no private learner column.
 *
 * A SIBLING ROUTE, not a snapshot extension, and deliberately so. The follow-up panel on this same
 * event already reads through `/events/[eventId]/followups?tz=`, so the outcome panel reads the
 * same way — one transport for the same kind of Host-facing, timezone-sensitive read. It also
 * keeps the control-room snapshot URL unchanged, which is what the roster poll depends on.
 *
 * TIMEZONE. "Overdue" is a BTY DAY-KEY question and is only correct in the reader's own frame:
 * judged in UTC, a Host in Asia/Seoul can be shown a follow-up as overdue a day early or late. The
 * `?tz=` hint feeds `readUserTzContext` — the READ-ONLY twin of the canonical resolver, with the
 * identical precedence (profile tz, then a valid device hint, then UTC) and the best-effort
 * profile write removed. Opening a panel to look at an outcome must not mutate the Host's
 * profile: a screen that answers "did anything change?" should not itself change anything.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ eventId: string }> }) {
  const gate = await requireManager(req);
  if (!gate.ok) return gate.response;
  const { user, admin, base } = gate.ctx;

  const { eventId } = await ctx.params;
  const { timezone } = await readUserTzContext(admin, user.id, req.nextUrl.searchParams.get("tz"));
  const outcome = await getTrainingOutcome(admin, user.id, eventId, new Date(), timezone);
  if (!outcome) return managerJson(base, req, { error: "not_found" }, 404);

  return managerJson(base, req, { ok: true, outcome });
}
