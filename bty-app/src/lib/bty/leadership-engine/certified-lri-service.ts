/**
 * Leadership Engine — Certified / LRI service.
 * Orchestrates domain certified + LRI; persist leader track approval via Supabase.
 * Single source: docs/LEADERSHIP_ENGINE_SPEC.md §7, ENGINE_ARCHITECTURE_DIRECTIVE_PLAN §4 P5.
 */

import {
  certifiedStatus,
  isCertified,
  type CertifiedInputs,
  type CertifiedStatusResult,
} from "@/domain/leadership-engine/certified";
import {
  computeLRI,
  canApproveLeaderTrack,
  type LRIInputs,
  type LRIResult,
} from "@/domain/leadership-engine/lri";

const TABLE = "leadership_engine_state" as const;

/** Fetches Certified inputs for a user (from activation logs, state, snapshots). Implemented by API/Infrastructure. */
export type GetCertifiedInputs = (userId: string) => Promise<CertifiedInputs>;

/** Fetches LRI inputs for a user. Implemented by API/Infrastructure. */
export type GetLRIInputs = (userId: string) => Promise<LRIInputs>;

/** Supabase client from createServerClient (typed loosely for dependency injection). */
export type SupabaseClient = any;

/**
 * Returns Certified status for a user (Leader only). Dynamic; re-evaluated quarterly and weekly.
 */
export async function getCertifiedStatus(
  userId: string,
  getInputs: GetCertifiedInputs
): Promise<CertifiedStatusResult> {
  const inputs = await getInputs(userId);
  return certifiedStatus(inputs);
}

/**
 * Returns true when user meets all Certified conditions. Convenience wrapper.
 */
export async function isUserCertified(
  userId: string,
  getInputs: GetCertifiedInputs
): Promise<boolean> {
  const inputs = await getInputs(userId);
  return isCertified(inputs);
}

/**
 * Computes LRI and readiness flag for a user (non-leader). LRI is non-public.
 */
export async function getLRI(
  userId: string,
  getInputs: GetLRIInputs
): Promise<LRIResult> {
  const inputs = await getInputs(userId);
  return computeLRI(inputs);
}

/**
 * Approves user for leader track when candidate has readiness_flag and approver is certified.
 * Persists is_leader_track, leader_approved_at, leader_approver_id on leadership_engine_state.
 */
export async function approveLeaderTrack(
  supabase: SupabaseClient,
  userId: string,
  approverId: string,
  getLRIInputs: GetLRIInputs,
  getCertifiedInputs: GetCertifiedInputs
): Promise<{ approved: boolean; reason?: string }> {
  const [lriResult, certResult] = await Promise.all([
    getLRI(userId, getLRIInputs),
    getCertifiedStatus(approverId, getCertifiedInputs),
  ]);

  if (!canApproveLeaderTrack(lriResult.readiness_flag, certResult.current)) {
    if (!lriResult.readiness_flag) {
      return { approved: false, reason: "candidate_readiness_not_met" };
    }
    return { approved: false, reason: "approver_not_certified" };
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from(TABLE)
    .update({
      is_leader_track: true,
      leader_approved_at: now,
      leader_approver_id: approverId,
      updated_at: now,
    })
    .eq("user_id", userId);

  if (error) {
    return { approved: false, reason: "update_failed" };
  }
  return { approved: true };
}
