import { NextRequest } from "next/server";
import { requireManager, managerJson, attachJoinUrl } from "@/lib/bty/foundry/events/managerGate";
import { publishDraft, type Locale } from "@/lib/bty/foundry/events/foundryPublishService";

export const runtime = "nodejs";

/**
 * POST /api/bty/foundry/modules/[id]/publish — publish an approved-ready builder
 * draft into a live Foundry event through the canonical transaction (event +
 * immutable module snapshot + participant content + QR). Manager-gated + owner-
 * scoped. Body: optional { locale } (drives ONLY the blank-completion-prompt
 * default). Returns the control-room snapshot incl. join_url (200; `reused: true`
 * on an idempotent replay). 400 with the failing reason on a not-ready draft,
 * 404 non-disclosing if not owned/missing, 409 on a publish conflict.
 *
 * Placed at `modules/[id]/publish` (static child of a dynamic segment) — the same
 * proven shape as `events/[eventId]/close`; NOT a route nested under a dynamic
 * sibling (which the opennextjs-cloudflare runtime router shadows).
 */
function statusForReason(reason: string): number {
  if (reason === "draft_not_found") return 404;
  if (reason === "draft_not_mutable" || reason === "publish_conflict" || reason === "draft_not_publishable") return 409;
  return 400;
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireManager(req);
  if (!gate.ok) return gate.response;
  const { user, admin, base } = gate.ctx;

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const locale: Locale = body?.locale === "en" ? "en" : "ko";

  const result = await publishDraft(admin, user.id, id, locale);
  if (!result.ok) return managerJson(base, req, { error: result.reason }, statusForReason(result.reason));

  return managerJson(base, req, { ...attachJoinUrl(req, result.value.snapshot), reused: result.value.reused });
}
