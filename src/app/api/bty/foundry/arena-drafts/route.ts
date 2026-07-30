import { NextRequest } from "next/server";
import { requireManager, managerJson } from "@/lib/bty/foundry/events/managerGate";
import {
  createOrOpenArenaDraftShell,
  listOwnerArenaDraftsForEvent,
  toClientArenaDraft,
} from "@/lib/bty/foundry/arena/foundryArenaDraftService";
import { hasPublishedForEvent } from "@/lib/bty/foundry/arena/foundryArenaPublishService";
import { parseGuidedAnswers } from "@/domain/foundry/arena-draft/validate";

export const runtime = "nodejs";

/**
 * Foundry Guided Arena Builder — Arena scenario drafts (manager-gated, owner-scoped).
 *
 * POST — create a draft from a source event + two guided answers. The source
 *        version is bound server-side from the frozen module snapshot; the AI
 *        generates a validated three-phase draft (deterministic fallback on
 *        provider failure — never a fake success). 400 bad input, 404
 *        non-disclosing if the source is missing/not owned, 409 if the event has
 *        no published module. Returns { draft, warnings }.
 * GET  — list the caller's drafts for one source event (?eventId=). Returns
 *        { drafts } summaries. No cross-owner disclosure.
 */

function localeFrom(raw: unknown): "en" | "ko" {
  return raw === "ko" ? "ko" : "en";
}

function statusForReason(reason: string): number {
  if (reason === "source_not_found" || reason === "source_not_owned") return 404;
  if (reason === "source_no_module") return 409;
  return 400;
}

export async function POST(req: NextRequest) {
  const gate = await requireManager(req);
  if (!gate.ok) return gate.response;
  const { user, admin, base } = gate.ctx;

  const body = await req.json().catch(() => ({}));
  const sourceEventId = typeof body?.sourceEventId === "string" ? body.sourceEventId : "";
  if (!sourceEventId) return managerJson(base, req, { error: "source_event_id_required" }, 400);

  const guided = parseGuidedAnswers(body?.guidedAnswers);
  if (!guided.ok) return managerJson(base, req, { error: "invalid_guided_answers", fields: guided.errors }, 400);

  // Idempotent create-or-OPEN (Slice 3.2I-R5B1A): a repeat "Create practice" reopens the
  // existing canonical shell instead of duplicating it. The server owns shell authority.
  const result = await createOrOpenArenaDraftShell(admin, user.id, {
    sourceEventId,
    guidedAnswers: guided.value,
    locale: localeFrom(body?.locale),
  });
  if (!result.ok) return managerJson(base, req, { error: result.reason }, statusForReason(result.reason));

  return managerJson(
    base,
    req,
    { draft: toClientArenaDraft(result.value.row), opened: result.value.opened },
    result.value.opened ? 200 : 201,
  );
}

export async function GET(req: NextRequest) {
  const gate = await requireManager(req);
  if (!gate.ok) return gate.response;
  const { user, admin, base } = gate.ctx;

  const eventId = req.nextUrl.searchParams.get("eventId") ?? "";
  if (!eventId) return managerJson(base, req, { error: "event_id_required" }, 400);

  const drafts = await listOwnerArenaDraftsForEvent(admin, user.id, eventId);
  const hasPublished = await hasPublishedForEvent(admin, user.id, eventId);
  return managerJson(base, req, { drafts, has_published: hasPublished });
}
