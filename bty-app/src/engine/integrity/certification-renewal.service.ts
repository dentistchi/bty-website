/**
 * When {@link expireCertifiedLeaderGrants} marks a grant EXPIRED, evaluates renewal:
 * LRI ≥ 0.80 (80) and no `integrity_slip_log` row in trailing 7 days → new `certified_leader_grants` row (+90d).
 * Persists each attempt to `certification_renewal_log`; emits `certified_leader_renewed` / `certified_leader_lapsed`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { LRI_READINESS_THRESHOLD } from "@/domain/leadership-engine/lri";
import { getLRI } from "@/engine/integrity/lri-calculator.service";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

/** Keep in sync with {@link CERTIFIED_LEADER_DURATION_MS} in `certified-leader.monitor`. */
const CERTIFIED_LEADER_GRANT_DURATION_MS = 90 * 24 * 60 * 60 * 1000;

const SLIP_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

export type CertifiedLeaderExpiredContext = {
  userId: string;
  grantId: string;
  grantedAt: string;
  expiresAt: string;
};

export type CertifiedLeaderRenewedPayload = {
  event: "certified_leader_renewed";
  userId: string;
  expiredGrantId: string;
  newGrantId: string;
  expiresAt: string;
};

export type CertifiedLeaderLapsedPayload = {
  event: "certified_leader_lapsed";
  userId: string;
  expiredGrantId: string;
  lriAtAttempt: number | null;
};

const renewedListeners = new Set<(p: CertifiedLeaderRenewedPayload) => void | Promise<void>>();
const lapsedListeners = new Set<(p: CertifiedLeaderLapsedPayload) => void | Promise<void>>();

export function onCertifiedLeaderRenewed(
  fn: (p: CertifiedLeaderRenewedPayload) => void | Promise<void>,
): () => void {
  renewedListeners.add(fn);
  return () => renewedListeners.delete(fn);
}

export function onCertifiedLeaderLapsed(
  fn: (p: CertifiedLeaderLapsedPayload) => void | Promise<void>,
): () => void {
  lapsedListeners.add(fn);
  return () => lapsedListeners.delete(fn);
}

function emitRenewed(p: CertifiedLeaderRenewedPayload): void {
  for (const fn of renewedListeners) {
    try {
      void fn(p);
    } catch {
      /* no-op */
    }
  }
}

function emitLapsed(p: CertifiedLeaderLapsedPayload): void {
  for (const fn of lapsedListeners) {
    try {
      void fn(p);
    } catch {
      /* no-op */
    }
  }
}

export type RenewalHistory = {
  id: string;
  attemptedAt: string;
  renewed: boolean;
  lriAtAttempt: number | null;
  expiredGrantId: string | null;
  newGrantId: string | null;
  blockReason: string | null;
};

async function hasIntegritySlipInLast7Days(
  userId: string,
  client: SupabaseClient,
): Promise<boolean> {
  const cutoff = new Date(Date.now() - SLIP_LOOKBACK_MS).toISOString();
  const { data, error } = await client
    .from("integrity_slip_log")
    .select("id")
    .eq("user_id", userId)
    .gte("created_at", cutoff)
    .limit(1);

  if (error) throw new Error(`hasIntegritySlipInLast7Days: ${error.message}`);
  return (data?.length ?? 0) > 0;
}

async function insertRenewalLog(
  client: SupabaseClient,
  row: {
    user_id: string;
    renewed: boolean;
    lri_at_attempt: number | null;
    expired_grant_id: string | null;
    new_grant_id: string | null;
    block_reason: string | null;
  },
): Promise<void> {
  const { error } = await client.from("certification_renewal_log").insert({
    user_id: row.user_id,
    renewed: row.renewed,
    lri_at_attempt: row.lri_at_attempt,
    expired_grant_id: row.expired_grant_id,
    new_grant_id: row.new_grant_id,
    block_reason: row.block_reason,
    attempted_at: new Date().toISOString(),
  });
  if (error) throw new Error(`insertRenewalLog: ${error.message}`);
}

/**
 * Run after a grant is flipped to EXPIRED (same cron batch). Idempotent per expiry event via caller.
 */
export async function processCertifiedLeaderExpired(
  ctx: CertifiedLeaderExpiredContext,
  options?: { supabase?: SupabaseClient },
): Promise<void> {
  const admin = options?.supabase ?? getSupabaseAdmin();
  if (!admin) return;

  const { userId, grantId: expiredGrantId } = ctx;

  let lriAtAttempt: number | null = null;
  try {
    const snap = await getLRI(userId);
    lriAtAttempt = Number.isFinite(snap.lri) ? snap.lri : null;
  } catch {
    lriAtAttempt = null;
  }

  const lriOk = lriAtAttempt != null && lriAtAttempt >= LRI_READINESS_THRESHOLD;

  if (!lriOk) {
    await insertRenewalLog(admin, {
      user_id: userId,
      renewed: false,
      lri_at_attempt: lriAtAttempt,
      expired_grant_id: expiredGrantId,
      new_grant_id: null,
      block_reason: "lri_below_80",
    });
    emitLapsed({
      event: "certified_leader_lapsed",
      userId,
      expiredGrantId,
      lriAtAttempt,
    });
    return;
  }

  const slip = await hasIntegritySlipInLast7Days(userId, admin);
  if (slip) {
    await insertRenewalLog(admin, {
      user_id: userId,
      renewed: false,
      lri_at_attempt: lriAtAttempt,
      expired_grant_id: expiredGrantId,
      new_grant_id: null,
      block_reason: "integrity_slip_7d",
    });
    return;
  }

  const grantedAt = new Date();
  const expiresAt = new Date(grantedAt.getTime() + CERTIFIED_LEADER_GRANT_DURATION_MS);

  const { data: inserted, error: insErr } = await admin
    .from("certified_leader_grants")
    .insert({
      user_id: userId,
      granted_at: grantedAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      status: "ACTIVE",
    })
    .select("id, expires_at")
    .single();

  if (insErr) {
    await insertRenewalLog(admin, {
      user_id: userId,
      renewed: false,
      lri_at_attempt: lriAtAttempt,
      expired_grant_id: expiredGrantId,
      new_grant_id: null,
      block_reason: `grant_insert_failed:${insErr.message}`,
    });
    throw new Error(`processCertifiedLeaderExpired: ${insErr.message}`);
  }

  const row = inserted as { id: string; expires_at: string };

  await insertRenewalLog(admin, {
    user_id: userId,
    renewed: true,
    lri_at_attempt: lriAtAttempt,
    expired_grant_id: expiredGrantId,
    new_grant_id: row.id,
    block_reason: null,
  });

  emitRenewed({
    event: "certified_leader_renewed",
    userId,
    expiredGrantId,
    newGrantId: row.id,
    expiresAt: row.expires_at,
  });
}

/**
 * Recent renewal attempts for Leadership Engine — Certified section.
 */
export async function getRenewalHistory(
  userId: string,
  options?: { supabase?: SupabaseClient; limit?: number },
): Promise<RenewalHistory[]> {
  const admin = options?.supabase ?? getSupabaseAdmin();
  if (!admin) return [];

  const limit = Math.min(50, Math.max(1, options?.limit ?? 12));
  const { data, error } = await admin
    .from("certification_renewal_log")
    .select("id, attempted_at, renewed, lri_at_attempt, expired_grant_id, new_grant_id, block_reason")
    .eq("user_id", userId)
    .order("attempted_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`getRenewalHistory: ${error.message}`);

  return (data ?? []).map((r) => {
    const x = r as {
      id: string;
      attempted_at: string;
      renewed: boolean;
      lri_at_attempt: number | null;
      expired_grant_id: string | null;
      new_grant_id: string | null;
      block_reason: string | null;
    };
    return {
      id: x.id,
      attemptedAt: x.attempted_at,
      renewed: x.renewed,
      lriAtAttempt: x.lri_at_attempt == null ? null : Number(x.lri_at_attempt),
      expiredGrantId: x.expired_grant_id,
      newGrantId: x.new_grant_id,
      blockReason: x.block_reason,
    };
  });
}
