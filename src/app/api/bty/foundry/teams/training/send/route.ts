import { NextRequest } from "next/server";
import { requireManager, managerJson } from "@/lib/bty/foundry/events/managerGate";
import { sendTrainingToTeams } from "@/lib/bty/foundry/teams/trainingDelivery.server";

export const runtime = "nodejs";

/**
 * POST /api/bty/foundry/teams/training/send — deliver a training into recipients' Teams chats.
 * Slice Teams Chat-Native Text Training + Quiz V1.
 *
 * ★ WHAT THE CLIENT MAY SAY: `{ eventId, aadObjectIds }` — the training, and the Entra object ids
 * Teams' own People Picker returned. That is the complete accepted surface.
 *
 * ★ WHAT IT MAY NOT SAY, and cannot: a recipient's email, UPN or display name; a BTY user id; a
 * tenant id; a conversation id; a service url. None is read, so none can be smuggled. Every one of
 * those is derived server-side — the Host from the session, ownership from the database, the
 * tenant from configuration, eligibility from Graph, routing from a tenant route only a verified
 * Bot Framework activity can have written.
 *
 * ★ THE HOST PRESSED SEND. The confirmation happens in the UI before this is called, which is what
 * authorizes the bot notifications: nothing is sent on selection alone.
 */
const STATUS: Record<string, number> = {
  not_owner: 403,
  event_not_found: 404,
  unsupported_material: 409,
  no_quiz: 409,
  graph_unavailable: 503,
  tenant_not_configured: 503,
  bot_unavailable: 503,
};

export async function POST(req: NextRequest) {
  const gate = await requireManager(req);
  if (!gate.ok) return gate.response;
  const { user, admin, base } = gate.ctx;

  const body = await req.json().catch(() => ({}));
  const eventId = typeof body?.eventId === "string" ? body.eventId.trim() : "";
  const rawIds = Array.isArray(body?.aadObjectIds) ? body.aadObjectIds : [];
  if (!eventId || rawIds.length === 0) return managerJson(base, req, { error: "recipients_required" }, 400);
  // A bounded selection. A People Picker cannot realistically return more, and an unbounded list
  // would be an unbounded number of Graph calls and bot messages from one request.
  if (rawIds.length > 50) return managerJson(base, req, { error: "too_many_recipients" }, 400);

  const result = await sendTrainingToTeams(admin, {
    ownerUserId: user.id,
    eventId,
    aadObjectIds: rawIds.map((v: unknown) => String(v ?? "")),
  });
  if (!result.ok) return managerJson(base, req, { error: result.reason }, STATUS[result.reason] ?? 400);

  /*
    THE HOST'S ANSWER. Counts, plus the DISPLAY NAMES of anyone who could not receive it — a Host
    needs to know whom to follow up with. The product reason is carried; the Microsoft error string
    never is, and stays in the server log.
  */
  const sent = result.outcomes.filter((o) => o.status === "sent").length;
  const alreadySent = result.outcomes.filter((o) => o.status === "already_sent").length;
  const undeliverable = result.outcomes
    .filter((o) => o.status === "undeliverable")
    .map((o) => ({ displayName: o.displayName, reason: o.status === "undeliverable" ? o.reason : "failed" }));

  return managerJson(base, req, { ok: true, sent, alreadySent, undeliverable });
}
