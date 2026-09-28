import { NextRequest } from "next/server";
import { requireManager, managerJson } from "@/lib/bty/foundry/events/managerGate";
import { getOwnerDraft } from "@/lib/bty/foundry/events/foundryModuleService";
import { generateSimpleSuggestion, SIMPLE_GOAL_MAX_CHARS } from "@/lib/bty/foundry/events/directionCopilotService";
import { rateLimitKV, getCfClientIp } from "@/lib/rate-limit";

/**
 * POST /api/bty/foundry/modules/[id]/simple-suggestion — Simple Mode step 2 (Slice 2).
 *
 * ONE suggestion from the manager's ONE sentence. Same gate, ownership, draft-status and
 * rate-limit rules as the three-direction copilot beside it. Nothing is written to the draft here:
 * the manager has not accepted anything yet. `title` and `successEvidence` travel for the Create
 * step only; the authoring UI renders `behavior` and `when`.
 */
export const runtime = "nodejs";
const RATE_LIMIT = 10;
const RATE_WINDOW_SECONDS = 60;

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireManager(req);
  if (!gate.ok) return gate.response;
  const { user, admin, base } = gate.ctx;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const goal = typeof body?.goal === "string" ? body.goal : "";
  if (goal.trim().length === 0) return managerJson(base, req, { error: "goal_required" }, 400);
  if (goal.trim().length > SIMPLE_GOAL_MAX_CHARS) return managerJson(base, req, { error: "goal_too_long" }, 400);
  const locale = body?.locale === "ko" ? "ko" : "en";
  const draft = await getOwnerDraft(admin, user.id, id);
  if (!draft) return managerJson(base, req, { error: "not_found" }, 404);
  if (draft.status !== "draft") return managerJson(base, req, { error: "draft_not_editable" }, 409);
  const limited = await rateLimitKV({
    endpoint: "foundry-simple-suggestion",
    identifier: `${user.id}:${getCfClientIp(req)}`,
    limit: RATE_LIMIT,
    windowSeconds: RATE_WINDOW_SECONDS,
  });
  if (!limited.allowed) return managerJson(base, req, { error: "rate_limited", retry_after: limited.retryAfterSeconds }, 429);
  const r = await generateSimpleSuggestion({ goal, locale });
  if (r.ok) return managerJson(base, req, { suggestion: r.suggestion, generation_version: r.version });
  const status = r.code === "provider_unavailable" ? 503 : r.code === "timeout" ? 504 : 502;
  return managerJson(base, req, { error: "generation_failed", code: r.code }, status);
}
