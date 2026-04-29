import { NextRequest, NextResponse } from "next/server";
import { arenaRunIdFromUnknown } from "@/domain/arena/scenarios";
import {
  ensureDraftActionContractWithAdmin,
  type EnsureDraftActionContractResult,
} from "@/lib/bty/action-contract/actionContractLifecycle.server";
import {
  isActionContractRouteDebugEnabled,
  supabaseProjectRefFromEnvForLogs,
} from "@/lib/bty/action-contract/actionContractRouteDebug";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { copyCookiesAndDebug, requireUser, unauthenticated } from "@/lib/supabase/route-client";
import { resolvePatternFamilyForContractTrigger } from "@/lib/bty/pattern-engine/resolvePatternFamilyForContractTrigger";
import { syncPatternStatesForUser } from "@/lib/bty/pattern-engine/syncPatternStates";

export const runtime = "nodejs";

const LOG_PREFIX = "[POST /api/action-contracts]";

type Body = {
  userId?: unknown;
  runId?: unknown;
  scenarioId?: unknown;
  primaryChoice?: unknown;
};

/**
 * POST /api/action-contracts — create draft contract (idempotent per user + session/run).
 * Body: runId, scenarioId, primaryChoice; userId must match authenticated user if sent.
 */
function jsonBodyForDraftFailure(result: Extract<EnsureDraftActionContractResult, { ok: false }>): Record<string, unknown> {
  const body: Record<string, unknown> = { error: result.error };
  if (isActionContractRouteDebugEnabled()) {
    body.debug = {
      failedStep: result.failedStep,
      supabaseMessage: result.supabaseMessage,
      supabaseCode: result.supabaseCode,
      supabaseDetails: result.supabaseDetails,
      supabaseHint: result.supabaseHint,
    };
  }
  return body;
}

export async function POST(req: NextRequest) {
  const { user, base, supabase } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  console.info(LOG_PREFIX, "request", {
    supabaseProjectRef: supabaseProjectRefFromEnvForLogs(),
    userId: user.id,
  });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    const out = NextResponse.json({ error: "invalid_json" }, { status: 400 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const bodyUserId = typeof body.userId === "string" ? body.userId.trim() : "";
  if (bodyUserId && bodyUserId !== user.id) {
    const out = NextResponse.json({ error: "user_mismatch" }, { status: 403 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const runId = arenaRunIdFromUnknown(typeof body.runId === "string" ? body.runId : "");
  const scenarioId = typeof body.scenarioId === "string" ? body.scenarioId.trim() : "";
  const primaryChoice = typeof body.primaryChoice === "string" ? body.primaryChoice.trim() : "";

  if (runId === null || !scenarioId || !primaryChoice) {
    const out = NextResponse.json(
      { error: "missing_fields", required: ["runId", "scenarioId", "primaryChoice"] },
      { status: 400 },
    );
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const { data: runRow, error: runErr } = await supabase
    .from("arena_runs")
    .select("run_id")
    .eq("run_id", runId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (runErr) {
    const body: Record<string, unknown> = { error: "run_lookup_failed" };
    if (isActionContractRouteDebugEnabled()) {
      const re = runErr as { details?: string; hint?: string };
      body.debug = {
        failedStep: "arena_run_lookup",
        supabaseMessage: runErr.message,
        supabaseCode: runErr.code,
        supabaseDetails: re.details ?? null,
        supabaseHint: re.hint ?? null,
      };
    }
    console.error(
      `${LOG_PREFIX} RETURNING_ERROR_RESPONSE`,
      JSON.stringify(
        { ...body, runId, scenarioId, primaryChoice, userId: user.id, runLookupMessage: runErr.message },
        null,
        2,
      ),
    );
    const out = NextResponse.json(body, { status: 500 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }
  if (!runRow) {
    const notFoundPayload = { error: "run_not_found", runId, scenarioId, primaryChoice, userId: user.id };
    console.warn(`${LOG_PREFIX} RETURNING_ERROR_RESPONSE`, JSON.stringify(notFoundPayload, null, 2));
    const out = NextResponse.json({ error: "run_not_found" }, { status: 404 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    const svcPayload = {
      error: "service_unavailable",
      reason: "getSupabaseAdmin() null",
      runId,
      scenarioId,
      primaryChoice,
      userId: user.id,
    };
    console.error(`${LOG_PREFIX} RETURNING_ERROR_RESPONSE`, JSON.stringify(svcPayload, null, 2));
    const out = NextResponse.json({ error: "service_unavailable" }, { status: 503 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  await syncPatternStatesForUser(supabase, user.id);
  const patternFamily = await resolvePatternFamilyForContractTrigger(supabase, user.id);
  console.info(LOG_PREFIX, "after sync + resolvePatternFamilyForContractTrigger", {
    patternFamily,
    runId,
    scenarioId,
    primaryChoice,
  });

  const result = await ensureDraftActionContractWithAdmin(admin, {
    userId: user.id,
    sessionId: runId,
    scenarioId,
    primaryChoice,
    patternFamily,
  });

  if (!result.ok) {
    const status = result.error === "open_contract_exists_for_family" ? 409 : 500;
    const responseJson = jsonBodyForDraftFailure(result);
    const failurePayload = {
      result,
      responseJson,
      runId,
      scenarioId,
      primaryChoice,
      userId: user.id,
      patternFamily,
    };
    console.error(`${LOG_PREFIX} RETURNING_ERROR_RESPONSE`, JSON.stringify(failurePayload, null, 2));
    const out = NextResponse.json(responseJson, { status });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  console.info(LOG_PREFIX, "ok", {
    contractId: result.contractId,
    created: result.created,
    gated: result.contractId === null && !result.created ? "pattern_threshold" : null,
  });

  const out = NextResponse.json({
    contractId: result.contractId,
    created: result.created,
    ...(result.contractId === null && !result.created
      ? { gated: "pattern_threshold" as const }
      : {}),
  });
  copyCookiesAndDebug(base, out, req, true);
  return out;
}
