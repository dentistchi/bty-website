/**
 * livingResponse (server) — persistence + atomic claim/settle for the Today Living Response.
 *
 * Writes go through the service-role admin client. The row is claimed atomically via the
 * claim_living_response RPC, then settled ONCE (generated|fallback) by a guarded UPDATE that only the
 * owning attempt_token may apply. Settled rows are immutable. No provider logic lives here.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LivingResponseRelationship, ResponseConfidence } from "@/domain/daily/livingResponse";

const TABLE = "today_living_responses";
/** Lease must exceed the real provider window (12s timeout × 2 attempts ≈ 24s) with margin. */
export const LIVING_RESPONSE_LEASE_SECONDS = 60;

export type ClaimStatus = "CLAIMED" | "SETTLED" | "IN_PROGRESS" | "RECLAIMED";

/** Client-facing projection (never exposes ids/attempt_token/fingerprint internals). */
export type LivingResponseView = {
  status: "pending" | "ready" | "fallback";
  relationship: LivingResponseRelationship;
  perspective: string | null;
  source: "generated" | "fallback" | null;
  confidence: ResponseConfidence | null;
};

type Row = {
  status: "pending" | "generated" | "fallback";
  relationship: string;
  perspective: string | null;
  source: string | null;
  confidence: string | null;
};

const VIEW_COLS = "status, relationship, perspective, source, confidence";

export function toView(row: Row | null): LivingResponseView | null {
  if (!row) return null;
  return {
    status: row.status === "generated" ? "ready" : row.status === "fallback" ? "fallback" : "pending",
    relationship: row.relationship as LivingResponseRelationship,
    perspective: row.perspective,
    source: (row.source ?? null) as "generated" | "fallback" | null,
    confidence: (row.confidence ?? null) as ResponseConfidence | null,
  };
}

export async function getLivingResponseView(admin: SupabaseClient, commitmentId: string): Promise<LivingResponseView | null> {
  const { data, error } = await admin.from(TABLE).select(VIEW_COLS).eq("commitment_id", commitmentId).maybeSingle();
  if (error) throw error;
  return toView(data as Row | null);
}

/** Read recent settled perspectives (for novelty), most recent first, own rows. */
export async function recentPerspectives(admin: SupabaseClient, userId: string, limit = 5): Promise<string[]> {
  try {
    const { data } = await admin
      .from(TABLE)
      .select("perspective, settled_at")
      .eq("user_id", userId)
      .not("perspective", "is", null)
      .order("settled_at", { ascending: false })
      .limit(limit);
    return ((data ?? []) as { perspective: string | null }[]).map((r) => r.perspective ?? "").filter(Boolean);
  } catch {
    return [];
  }
}

export async function claimLivingResponse(
  admin: SupabaseClient,
  args: {
    commitmentId: string;
    userId: string;
    dayKey: string;
    relationship: LivingResponseRelationship;
    promptVersion: string;
    policyVersion: string;
    attemptToken: string;
  },
): Promise<ClaimStatus> {
  const { data, error } = await admin.rpc("claim_living_response", {
    p_commitment_id: args.commitmentId,
    p_user_id: args.userId,
    p_day_key: args.dayKey,
    p_relationship: args.relationship,
    p_prompt_version: args.promptVersion,
    p_policy_version: args.policyVersion,
    p_attempt_token: args.attemptToken,
    p_lease_seconds: LIVING_RESPONSE_LEASE_SECONDS,
  });
  if (error) throw error;
  return data as ClaimStatus;
}

type SettlePatch = {
  status: "generated" | "fallback";
  perspective: string;
  source: "generated" | "fallback";
  confidence: ResponseConfidence;
  evidenceFingerprint: string | null;
  supportedCodes: string[];
  modelVersion: string | null;
  lastErrorCode: string | null;
};

/**
 * Settle the row ONCE. Guarded by (commitment_id, attempt_token, status='pending') so only the
 * owning attempt can settle and a settled row is never overwritten. Returns the canonical view —
 * on a lost race (0 rows updated) it reads back whatever the winner settled.
 */
export async function settleLivingResponse(
  admin: SupabaseClient,
  commitmentId: string,
  attemptToken: string,
  patch: SettlePatch,
  nowIso: string,
): Promise<LivingResponseView | null> {
  const { data, error } = await admin
    .from(TABLE)
    .update({
      status: patch.status,
      perspective: patch.perspective,
      source: patch.source,
      confidence: patch.confidence,
      evidence_fingerprint: patch.evidenceFingerprint,
      supported_codes: patch.supportedCodes,
      model_version: patch.modelVersion,
      last_error_code: patch.lastErrorCode,
      settled_at: nowIso,
      generated_at: patch.status === "generated" ? nowIso : null,
      attempt_token: null,
    })
    .eq("commitment_id", commitmentId)
    .eq("attempt_token", attemptToken)
    .eq("status", "pending")
    .select(VIEW_COLS);
  if (error) throw error;
  if (Array.isArray(data) && data.length > 0) return toView(data[0] as Row);
  // lost the race (already settled by another attempt) → return the canonical settled row
  return getLivingResponseView(admin, commitmentId);
}
