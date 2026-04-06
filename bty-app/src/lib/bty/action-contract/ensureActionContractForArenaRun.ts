/**
 * Idempotent Action Contract row for a completed Arena run.
 * Obtains Supabase admin internally — callers must not pass a client.
 */

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { ensureActionContractWithAdmin } from "./ensureActionContract";

export async function ensureActionContractForArenaRun(params: {
  userId: string;
  runId: string;
  scenarioId?: string;
  nbaLogId?: string | null;
  /** When pattern threshold fired, ENGINE §5 rule 4 — contract row ties to family. */
  patternFamily?: string | null;
}): Promise<{
  ok: boolean;
  contractId: string | null;
  created: boolean;
}> {
  const admin = getSupabaseAdmin();
  const featureFlags: Record<string, unknown> = {};
  console.log("[arena] pipeline gate", {
    featureFlags,
    env: process.env.NODE_ENV,
    mode: "arena",
    selectedPipeline: admin ? "new" : "legacy",
    reason: admin
      ? "action_contract: service role client available"
      : "action_contract disabled: getSupabaseAdmin() null — set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
  });
  if (!admin) {
    console.error(
      "[ensureActionContract] CRITICAL: getSupabaseAdmin() returned null. Check SUPABASE_SERVICE_ROLE_KEY in production environment.",
      { userId: params.userId, runId: params.runId },
    );
    return { ok: false, contractId: null, created: false };
  }

  return ensureActionContractWithAdmin(admin, {
    userId: params.userId,
    runId: params.runId,
    scenarioId: params.scenarioId ?? "",
    nbaLogId: params.nbaLogId ?? null,
    patternFamily: params.patternFamily ?? null,
  });
}
