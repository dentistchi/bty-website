import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import { applyStageTransition } from "@/lib/bty/leadership-engine/state-service";
import type { StageTransitionContext } from "@/domain/leadership-engine";

const VALID_CONTEXTS: StageTransitionContext[] = [
  "repeat_1_without_delegation",
  "repeat_2_without_corrective_activation",
  "air_below_threshold",
  "stage_4_completion",
];

/**
 * POST /api/arena/leadership-engine/transition
 * Body: { context: StageTransitionContext }.
 * Applies deterministic transition rule (domain getNextStage); returns applied flag and current stage.
 * UI must not compute transitions; only call this API when context is determined elsewhere.
 */
export async function POST(req: NextRequest) {
  const { user, supabase, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  let body: { context?: string };
  try {
    body = await req.json();
  } catch {
    const out = NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
    copyCookiesAndDebug(base, out, req, false);
    return out;
  }

  const raw = body?.context;
  if (typeof raw !== "string" || !VALID_CONTEXTS.includes(raw as StageTransitionContext)) {
    const out = NextResponse.json(
      { error: "INVALID_CONTEXT", allowed: VALID_CONTEXTS },
      { status: 400 }
    );
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const context = raw as StageTransitionContext;
  const result = await applyStageTransition(supabase, user.id, context);

  const res = NextResponse.json({
    applied: result.applied,
    currentStage: result.currentStage,
    previousStage: result.previousStage ?? null,
    stageName: result.stageName,
  });
  copyCookiesAndDebug(base, res, req, true);
  return res;
}
