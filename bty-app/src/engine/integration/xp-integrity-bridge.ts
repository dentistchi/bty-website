/**
 * XP award gate — integrity slip + Arena lockout.
 *
 * - **Lockout** ({@link isArenaAccountLockoutActive}): block **all** XP (`core` + `weekly`).
 * - **Integrity slip** ({@link isIntegritySlipDeltaActive}): block **weekly** only; **core** allowed.
 *
 * Call {@link validateXPAward} before any XP write path.
 */

import { isArenaAccountLockoutActive } from "@/engine/forced-reset/lockout.service";
import { isIntegritySlipDeltaActive } from "@/engine/integrity/integrity-slip.monitor";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export type XpAwardType = "core" | "weekly";

export type XPAwardResult = {
  allowed: boolean;
  /** Amount that may be applied (0 when blocked). */
  allowedAmount: number;
  blockedReason: "none" | "lockout_all_xp" | "integrity_slip_weekly_xp";
};

const REASON_LOCKOUT_BLOCK_ALL = "lockout_active_blocked_all_xp" as const;
const REASON_SLIP_BLOCK_WEEKLY = "integrity_slip_active_blocked_weekly_xp" as const;

async function insertXpIntegrityBlockLog(row: {
  userId: string;
  xpType: XpAwardType;
  amount: number;
  reason: string;
}): Promise<void> {
  const admin = getSupabaseAdmin();
  if (!admin) {
    throw new Error("insertXpIntegrityBlockLog: Supabase service role not configured");
  }
  const { error } = await admin.from("xp_integrity_block_log").insert({
    user_id: row.userId,
    xp_type: row.xpType,
    amount: row.amount,
    reason: row.reason,
  });
  if (error) throw error;
}

/**
 * Gate before XP persistence: lockout → no awards; slip (24h Δ log) → weekly blocked, core OK.
 */
export async function validateXPAward(
  userId: string,
  xpType: XpAwardType,
  amount: number,
): Promise<XPAwardResult> {
  const n = typeof amount === "number" && Number.isFinite(amount) ? Math.max(0, amount) : 0;

  if (n <= 0) {
    return { allowed: true, allowedAmount: 0, blockedReason: "none" };
  }

  if (await isArenaAccountLockoutActive(userId)) {
    await insertXpIntegrityBlockLog({
      userId,
      xpType,
      amount: n,
      reason: REASON_LOCKOUT_BLOCK_ALL,
    });
    return { allowed: false, allowedAmount: 0, blockedReason: "lockout_all_xp" };
  }

  if (xpType === "core") {
    return { allowed: true, allowedAmount: n, blockedReason: "none" };
  }

  if (await isIntegritySlipDeltaActive(userId)) {
    await insertXpIntegrityBlockLog({
      userId,
      xpType: "weekly",
      amount: n,
      reason: REASON_SLIP_BLOCK_WEEKLY,
    });
    return { allowed: false, allowedAmount: 0, blockedReason: "integrity_slip_weekly_xp" };
  }

  return { allowed: true, allowedAmount: n, blockedReason: "none" };
}
