import { NextRequest } from "next/server";
import { requireManager, managerJson } from "@/lib/bty/foundry/events/managerGate";
import { getOwnerDraft } from "@/lib/bty/foundry/events/foundryModuleService";
import { generateDirections } from "@/lib/bty/foundry/events/directionCopilotService";
import { problemStatementsCompatible } from "@/domain/foundry/module/direction-copilot";
import { PROBLEM_MAX } from "@/domain/foundry/module/module-builder";
import { rateLimitKV, getCfClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * Intent-to-Module Direction Copilot — generate three training directions for a
 * draft the Host owns (manager-gated, owner-scoped, Slice 2.4A).
 *
 * POST — authenticate Host → load the draft owner-scoped → confirm it is editable
 *        (status 'draft') → confirm the request problem matches the SAVED draft
 *        problem (stale guard) → rate-limit → generate → return ONLY validated,
 *        client-safe suggestions. This route NEVER mutates the draft, never returns
 *        raw provider output, and never logs the problem statement. On any failure
 *        it returns a stable error code; the manual Builder path is unaffected.
 *
 * A foreign owner's draft is indistinguishable from a missing one (both 404).
 */

const RATE_LIMIT = 10; // generations per window per Host
const RATE_WINDOW_SECONDS = 60;

function pickLocale(v: unknown): "en" | "ko" {
  return v === "ko" ? "ko" : "en";
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireManager(req);
  if (!gate.ok) return gate.response;
  const { user, admin, base } = gate.ctx;

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  // Request shape — problem statement bounded to the same cap the Builder saves.
  const problem = typeof body?.problem_statement === "string" ? body.problem_statement : null;
  if (problem === null || problem.trim().length === 0) {
    return managerJson(base, req, { error: "invalid_request" }, 400);
  }
  if (problem.trim().length > PROBLEM_MAX) {
    return managerJson(base, req, { error: "problem_too_long" }, 400);
  }
  const locale = pickLocale(body?.locale);

  // Ownership + existence (non-disclosing) — server never trusts client draft_id.
  const draft = await getOwnerDraft(admin, user.id, id);
  if (!draft) return managerJson(base, req, { error: "not_found" }, 404);

  // Editability — only a live draft may be assisted.
  if (draft.status !== "draft") return managerJson(base, req, { error: "draft_not_editable" }, 409);

  // Stale guard — the request must be about the problem currently saved on the draft.
  const savedProblem = typeof draft.answers?.problem === "string" ? draft.answers.problem : "";
  if (!problemStatementsCompatible(problem, savedProblem)) {
    return managerJson(base, req, { error: "problem_mismatch" }, 409);
  }

  // Rate limit — durable, isolate-safe, fail-closed in staging/prod (per Host).
  const limited = await rateLimitKV({
    endpoint: "foundry-direction-copilot",
    identifier: `${user.id}:${getCfClientIp(req)}`,
    limit: RATE_LIMIT,
    windowSeconds: RATE_WINDOW_SECONDS,
  });
  if (!limited.allowed) {
    return managerJson(base, req, { error: "rate_limited", retry_after: limited.retryAfterSeconds }, 429);
  }

  const result = await generateDirections({ problemStatement: problem, locale });
  if (result.ok) {
    return managerJson(base, req, { suggestions: result.suggestions, generation_version: result.version });
  }

  // Fail-closed — stable codes, no provider/parsing internals, no partial cards.
  const status =
    result.code === "provider_unavailable" ? 503 : result.code === "timeout" ? 504 : 502;
  return managerJson(base, req, { error: "generation_failed", code: result.code }, status);
}
