import { NextRequest } from "next/server";
import { requireManager, managerJson } from "@/lib/bty/foundry/events/managerGate";
import { getOwnerDraft } from "@/lib/bty/foundry/events/foundryModuleService";
import { generateModuleDraft } from "@/lib/bty/foundry/events/moduleDraftCopilotService";
import { moduleDraftContext, moduleDraftContextFingerprint } from "@/domain/foundry/module/module-draft-copilot";
import type { BuilderAnswers } from "@/domain/foundry/module/module-builder";
import { rateLimitKV, getCfClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * Direction-to-Module Draft Copilot — draft the remaining module sections for a draft
 * the Host owns (manager-gated, owner-scoped, Slice 2.4B).
 *
 * POST — authenticate Host → load the owner-scoped draft → confirm editable → RECONSTRUCT
 *        the canonical generation context from the SERVER draft (never trust client
 *        context) → confirm the minimum context is present (else 422) → reject a stale
 *        client context via fingerprint (409) → rate-limit → generate → return ONLY
 *        validated, client-safe advisory data. Zero draft mutation; raw provider output
 *        is never returned; the problem statement is never logged.
 */

const RATE_LIMIT = 8; // module-draft generations per window per Host
const RATE_WINDOW_SECONDS = 60;
const FINGERPRINT_MAX = 12_000; // generous bound on the client-sent fingerprint string

function pickLocale(v: unknown): "en" | "ko" {
  return v === "ko" ? "ko" : "en";
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireManager(req);
  if (!gate.ok) return gate.response;
  const { user, admin, base } = gate.ctx;

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const locale = pickLocale(body?.locale);

  // Ownership + existence (non-disclosing).
  const draft = await getOwnerDraft(admin, user.id, id);
  if (!draft) return managerJson(base, req, { error: "not_found" }, 404);
  if (draft.status !== "draft") return managerJson(base, req, { error: "draft_not_editable" }, 409);

  // Reconstruct the canonical context from the SERVER draft — the client cannot
  // substitute another draft's context; generation always runs on this.
  const serverCtx = moduleDraftContext(draft.answers as BuilderAnswers);
  if (!serverCtx) return managerJson(base, req, { error: "insufficient_context" }, 422);

  // Stale guard — the request must be about the context currently saved on the draft.
  const clientFp = body?.context_fingerprint;
  if (clientFp !== undefined) {
    if (typeof clientFp !== "string" || clientFp.length > FINGERPRINT_MAX) {
      return managerJson(base, req, { error: "invalid_request" }, 400);
    }
    if (clientFp !== moduleDraftContextFingerprint(serverCtx)) {
      return managerJson(base, req, { error: "context_mismatch" }, 409);
    }
  }

  // Rate limit — durable, isolate-safe, fail-closed in staging/prod (per Host).
  const limited = await rateLimitKV({
    endpoint: "foundry-module-draft-copilot",
    identifier: `${user.id}:${getCfClientIp(req)}`,
    limit: RATE_LIMIT,
    windowSeconds: RATE_WINDOW_SECONDS,
  });
  if (!limited.allowed) {
    return managerJson(base, req, { error: "rate_limited", retry_after: limited.retryAfterSeconds }, 429);
  }

  const result = await generateModuleDraft(serverCtx, locale);
  if (result.ok) {
    return managerJson(base, req, {
      module_draft: result.value.module_draft,
      assumptions: result.value.assumptions,
      warnings: result.value.warnings,
      generation_version: result.version,
    });
  }

  const status =
    result.code === "provider_unavailable" ? 503 : result.code === "timeout" ? 504 : 502;
  return managerJson(base, req, { error: "generation_failed", code: result.code }, status);
}
