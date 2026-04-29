/**
 * Certified Leader — after each LRI persist, grant 90d window when `promotion_ready` and no ACTIVE grant;
 * daily cron (00:00 UTC) expires past grants and emits `certified_leader_expired`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { processCertifiedLeaderExpired } from "@/engine/integrity/certification-renewal.service";
import { getLRI } from "@/engine/integrity/lri-calculator.service";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const CERTIFIED_LEADER_DURATION_MS = 90 * 24 * 60 * 60 * 1000;

export type CertifiedLeaderStatus =
  | {
      state: "none";
    }
  | {
      state: "active";
      grantId: string;
      grantedAt: string;
      expiresAt: string;
    }
  | {
      state: "expired";
      grantId: string;
      grantedAt: string;
      expiresAt: string;
    };

export type CertifiedLeaderExpiredPayload = {
  event: "certified_leader_expired";
  userId: string;
  grantId: string;
  grantedAt: string;
  expiresAt: string;
};

const expiredListeners = new Set<(payload: CertifiedLeaderExpiredPayload) => void>();

export function onCertifiedLeaderExpired(
  listener: (payload: CertifiedLeaderExpiredPayload) => void,
): () => void {
  expiredListeners.add(listener);
  return () => expiredListeners.delete(listener);
}

function emitExpired(payload: CertifiedLeaderExpiredPayload): void {
  for (const fn of expiredListeners) {
    try {
      fn(payload);
    } catch {
      // listeners must not break cron
    }
  }
}

async function hasActiveGrant(admin: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await admin
    .from("certified_leader_grants")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "ACTIVE")
    .maybeSingle();

  if (error) throw error;
  return data != null;
}

/**
 * Invoke after each `leadership_readiness_index` write. Calls {@link getLRI}, grants when eligible.
 */
export async function onLRIWrite(userId: string): Promise<void> {
  const admin = getSupabaseAdmin();
  if (!admin) return;

  const snap = await getLRI(userId);
  if (!snap.promotion_ready) return;
  if (await hasActiveGrant(admin, userId)) return;

  const grantedAt = new Date();
  const expiresAt = new Date(grantedAt.getTime() + CERTIFIED_LEADER_DURATION_MS);

  const { error } = await admin.from("certified_leader_grants").insert({
    user_id: userId,
    granted_at: grantedAt.toISOString(),
    expires_at: expiresAt.toISOString(),
    status: "ACTIVE",
  });

  if (error) {
    if (error.code === "23505" || (typeof error.message === "string" && error.message.includes("duplicate"))) {
      return;
    }
    throw error;
  }

  void import("@/engine/integration/notification-router.service").then((m) =>
    m.insertNotificationForEvent(userId, "certified_leader_granted").catch(() => {}),
  );
  void import("@/engine/avatar/avatar-outfit-unlock.service").then((m) =>
    m.checkOutfitUnlocks(userId, admin).catch(() => {}),
  );
}

/**
 * Latest grant for the user: `active` only when row is ACTIVE and not past `expires_at` (cron may lag).
 */
export async function getCertifiedStatus(userId: string): Promise<CertifiedLeaderStatus> {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return { state: "none" };
  }

  const { data, error } = await admin
    .from("certified_leader_grants")
    .select("id, granted_at, expires_at, status")
    .eq("user_id", userId)
    .order("granted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return { state: "none" };
  }

  const row = data as {
    id: string;
    granted_at: string;
    expires_at: string;
    status: string;
  };

  const expiresMs = new Date(row.expires_at).getTime();
  const now = Date.now();

  if (row.status === "ACTIVE" && expiresMs > now) {
    return {
      state: "active",
      grantId: row.id,
      grantedAt: row.granted_at,
      expiresAt: row.expires_at,
    };
  }

  return {
    state: "expired",
    grantId: row.id,
    grantedAt: row.granted_at,
    expiresAt: row.expires_at,
  };
}

export type ExpireCertifiedGrantsResult = {
  ok: boolean;
  expiredCount: number;
  error?: string;
};

/**
 * Daily 00:00 UTC cron: set `EXPIRED` on grants past `expires_at`, emit {@link CertifiedLeaderExpiredPayload} each.
 */
export async function expireCertifiedLeaderGrants(
  options?: { at?: Date; supabase?: SupabaseClient },
): Promise<ExpireCertifiedGrantsResult> {
  const admin = options?.supabase ?? getSupabaseAdmin();
  if (!admin) {
    return { ok: false, expiredCount: 0, error: "supabase_admin_not_configured" };
  }

  const at = options?.at ?? new Date();
  const atIso = at.toISOString();

  const { data: rows, error: selErr } = await admin
    .from("certified_leader_grants")
    .select("id, user_id, granted_at, expires_at")
    .eq("status", "ACTIVE")
    .lt("expires_at", atIso);

  if (selErr) {
    return { ok: false, expiredCount: 0, error: selErr.message };
  }

  const due = (rows ?? []) as Array<{
    id: string;
    user_id: string;
    granted_at: string;
    expires_at: string;
  }>;

  if (due.length === 0) {
    return { ok: true, expiredCount: 0 };
  }

  const ids = due.map((r) => r.id);
  const { data: updated, error: updErr } = await admin
    .from("certified_leader_grants")
    .update({ status: "EXPIRED" })
    .in("id", ids)
    .eq("status", "ACTIVE")
    .select("id, user_id, granted_at, expires_at");

  if (updErr) {
    return { ok: false, expiredCount: 0, error: updErr.message };
  }

  const touched = (updated ?? []) as Array<{
    id: string;
    user_id: string;
    granted_at: string;
    expires_at: string;
  }>;

  for (const r of touched) {
    emitExpired({
      event: "certified_leader_expired",
      userId: r.user_id,
      grantId: r.id,
      grantedAt: r.granted_at,
      expiresAt: r.expires_at,
    });
    try {
      await processCertifiedLeaderExpired(
        {
          userId: r.user_id,
          grantId: r.id,
          grantedAt: r.granted_at,
          expiresAt: r.expires_at,
        },
        { supabase: admin },
      );
    } catch (e) {
      console.error("[expireCertifiedLeaderGrants] certification renewal:", e);
    }
  }

  return { ok: true, expiredCount: touched.length };
}
