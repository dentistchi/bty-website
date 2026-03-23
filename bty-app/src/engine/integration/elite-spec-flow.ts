/**
 * Elite Spec nomination: when {@link getPromotionReadiness} crosses the readiness gate without
 * promotion blocks and the user has no active Certified Leader grant, insert `elite_spec_nominations`
 * and emit `elite_spec_nominated`. Mentor approval grants Certified Leader (`certified_leader_grants`)
 * and emits `certified_leader_granted`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CERTIFIED_LEADER_DURATION_MS,
  getCertifiedStatus,
} from "@/engine/integrity/certified-leader.monitor";
import { getPromotionReadiness } from "@/engine/integrity/promotion-readiness.service";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

/** Normalized readiness in [0,1]; gate is 85%. */
export const ELITE_SPEC_READINESS_THRESHOLD = 0.85 as const;

export type EliteSpecNominatedPayload = {
  event: "elite_spec_nominated";
  userId: string;
  nominationId: string;
  readinessScore: number;
  nominatedAt: string;
};

export type CertifiedLeaderGrantedFromElitePayload = {
  event: "certified_leader_granted";
  userId: string;
  grantId: string;
  grantedAt: string;
  expiresAt: string;
  source: "elite_spec_approval";
};

export type EliteSpecResult =
  | { ok: true; action: "nominated"; nominationId: string }
  | {
      ok: true;
      action: "skipped";
      reason: "below_threshold" | "blocked" | "already_active" | "already_pending";
    }
  | { ok: false; error: string };

export type ApproveEliteSpecResult =
  | { ok: true; nominationId: string; userId: string; grantId: string | null }
  | { ok: false; error: string };

const nominatedListeners = new Set<(p: EliteSpecNominatedPayload) => void | Promise<void>>();
const grantedListeners = new Set<(p: CertifiedLeaderGrantedFromElitePayload) => void | Promise<void>>();

export function onEliteSpecNominated(
  fn: (p: EliteSpecNominatedPayload) => void | Promise<void>,
): () => void {
  nominatedListeners.add(fn);
  return () => nominatedListeners.delete(fn);
}

export function onCertifiedLeaderGrantedFromEliteSpec(
  fn: (p: CertifiedLeaderGrantedFromElitePayload) => void | Promise<void>,
): () => void {
  grantedListeners.add(fn);
  return () => grantedListeners.delete(fn);
}

function emitNominated(p: EliteSpecNominatedPayload): void {
  for (const fn of nominatedListeners) {
    try {
      void fn(p);
    } catch {
      /* listeners must not break flow */
    }
  }
}

function emitGrantedElite(p: CertifiedLeaderGrantedFromElitePayload): void {
  for (const fn of grantedListeners) {
    try {
      void fn(p);
    } catch {
      /* listeners must not break flow */
    }
  }
}

async function hasActiveCertifiedGrantRow(admin: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await admin
    .from("certified_leader_grants")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "ACTIVE")
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data != null;
}

async function findPendingNominationId(admin: SupabaseClient, userId: string): Promise<string | null> {
  const { data, error } = await admin
    .from("elite_spec_nominations")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "PENDING")
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? (data as { id: string }).id : null;
}

/**
 * When promotion readiness ≥ {@link ELITE_SPEC_READINESS_THRESHOLD} and not blocked: if no active
 * Certified Leader grant (table + {@link getCertifiedStatus}) and no pending nomination, inserts
 * PENDING row and emits `elite_spec_nominated`.
 */
export async function handleEliteSpecNomination(userId: string): Promise<EliteSpecResult> {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return { ok: false, error: "supabase_admin_not_configured" };
  }

  const pr = await getPromotionReadiness(userId, { supabase: admin });
  if (pr.readiness_score < ELITE_SPEC_READINESS_THRESHOLD) {
    return { ok: true, action: "skipped", reason: "below_threshold" };
  }
  if (pr.promotion_blocked) {
    return { ok: true, action: "skipped", reason: "blocked" };
  }

  if (await hasActiveCertifiedGrantRow(admin, userId)) {
    return { ok: true, action: "skipped", reason: "already_active" };
  }

  const certified = await getCertifiedStatus(userId);
  if (certified.state === "active") {
    return { ok: true, action: "skipped", reason: "already_active" };
  }

  if (await findPendingNominationId(admin, userId)) {
    return { ok: true, action: "skipped", reason: "already_pending" };
  }

  const nominatedAt = new Date().toISOString();
  const { data: inserted, error: insErr } = await admin
    .from("elite_spec_nominations")
    .insert({
      user_id: userId,
      nominated_at: nominatedAt,
      readiness_score: pr.readiness_score,
      status: "PENDING",
    })
    .select("id")
    .single();

  if (insErr) {
    if (insErr.code === "23505") {
      return { ok: true, action: "skipped", reason: "already_pending" };
    }
    return { ok: false, error: insErr.message };
  }

  const nominationId = (inserted as { id: string }).id;

  emitNominated({
    event: "elite_spec_nominated",
    userId,
    nominationId,
    readinessScore: pr.readiness_score,
    nominatedAt,
  });

  return { ok: true, action: "nominated", nominationId };
}

/**
 * Mentor approval: set nomination APPROVED, insert `certified_leader_grants` when none active, emit
 * `certified_leader_granted` when a new grant row is created.
 */
export async function approveEliteSpecNomination(nominationId: string): Promise<ApproveEliteSpecResult> {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return { ok: false, error: "supabase_admin_not_configured" };
  }

  const { data: row, error } = await admin
    .from("elite_spec_nominations")
    .select("id, user_id, status")
    .eq("id", nominationId)
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message };
  }
  if (!row) {
    return { ok: false, error: "nomination_not_found" };
  }

  const r = row as { id: string; user_id: string; status: string };
  if (r.status !== "PENDING") {
    return { ok: false, error: "invalid_status" };
  }

  const approvedAt = new Date();

  const alreadyActive = await hasActiveCertifiedGrantRow(admin, r.user_id);
  let grantId: string | null = null;

  if (!alreadyActive) {
    const grantedAt = approvedAt;
    const expiresAt = new Date(grantedAt.getTime() + CERTIFIED_LEADER_DURATION_MS);

    const { data: grant, error: gErr } = await admin
      .from("certified_leader_grants")
      .insert({
        user_id: r.user_id,
        granted_at: grantedAt.toISOString(),
        expires_at: expiresAt.toISOString(),
        status: "ACTIVE",
      })
      .select("id")
      .single();

    if (gErr) {
      if (gErr.code === "23505") {
        return { ok: false, error: "grant_exists" };
      }
      return { ok: false, error: gErr.message };
    }

    grantId = (grant as { id: string }).id;

    emitGrantedElite({
      event: "certified_leader_granted",
      userId: r.user_id,
      grantId,
      grantedAt: grantedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      source: "elite_spec_approval",
    });
  }

  const { error: upErr } = await admin
    .from("elite_spec_nominations")
    .update({
      status: "APPROVED",
      mentor_approved_at: approvedAt.toISOString(),
    })
    .eq("id", nominationId)
    .eq("status", "PENDING");

  if (upErr) {
    return { ok: false, error: upErr.message };
  }

  return { ok: true, nominationId: r.id, userId: r.user_id, grantId };
}
