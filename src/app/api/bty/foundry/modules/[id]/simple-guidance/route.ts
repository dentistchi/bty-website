import { NextRequest } from "next/server";
import { requireManager, managerJson } from "@/lib/bty/foundry/events/managerGate";
import { getOwnerDraft } from "@/lib/bty/foundry/events/foundryModuleService";
import { generateSimpleGuidance, SIMPLE_GOAL_MAX_CHARS } from "@/lib/bty/foundry/events/directionCopilotService";
import { rateLimitKV, getCfClientIp } from "@/lib/rate-limit";

/**
 * POST /api/bty/foundry/modules/[id]/simple-guidance — Simple Mode default written material
 * (Slice 2). Called at Create, in parallel with program generation. ALWAYS answers with usable
 * text: a failed model call returns the deterministic fallback (`source: "fallback"`), because a
 * training must never be blocked on optional prose. Nothing is written here; the Builder saves
 * the text through its ordinary answers PATCH.
 */
export const runtime = "nodejs";
const RATE_LIMIT = 10;
const RATE_WINDOW_SECONDS = 60;
const FIELD_MAX = 300;

const text = (v: unknown, max: number): string | null =>
  typeof v === "string" && v.trim().length > 0 && v.trim().length <= max ? v.trim() : null;

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireManager(req);
  if (!gate.ok) return gate.response;
  const { user, admin, base } = gate.ctx;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const goal = text(body?.goal, SIMPLE_GOAL_MAX_CHARS);
  const behavior = text(body?.behavior, FIELD_MAX);
  const when = text(body?.when, FIELD_MAX);
  const title = text(body?.title, FIELD_MAX) ?? "";
  if (!goal || !behavior || !when) return managerJson(base, req, { error: "invalid_request" }, 400);
  const locale = body?.locale === "ko" ? "ko" : "en";
  const draft = await getOwnerDraft(admin, user.id, id);
  if (!draft) return managerJson(base, req, { error: "not_found" }, 404);
  if (draft.status !== "draft") return managerJson(base, req, { error: "draft_not_editable" }, 409);
  const limited = await rateLimitKV({
    endpoint: "foundry-simple-guidance",
    identifier: `${user.id}:${getCfClientIp(req)}`,
    limit: RATE_LIMIT,
    windowSeconds: RATE_WINDOW_SECONDS,
  });
  if (!limited.allowed) return managerJson(base, req, { error: "rate_limited", retry_after: limited.retryAfterSeconds }, 429);
  const r = await generateSimpleGuidance({ goal, title, behavior, when, locale });
  return managerJson(base, req, { guidance: r.text, source: r.source });
}
