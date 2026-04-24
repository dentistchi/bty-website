/**
 * Leadership Engine — AIR-based account lockout (48h Arena block).
 * When AIR (7d) falls below {@link FORCED_RESET_AIR_7D_THRESHOLD} (high-band floor **0.80**, same as `AIR_BAND_MID_HIGH`),
 * user status becomes LOCKED until {@link getUnlockAt} elapses.
 *
 * **Not** Pattern Shift; execution integrity (AIR) only.
 *
 * Pure orchestration over timestamps + scalars; persistence is caller responsibility.
 */

import { FORCED_RESET_AIR_7D_THRESHOLD } from "@/domain/leadership-engine/forced-reset";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

/**
 * Legacy weekly-XP / slip gate (0–1 on AIR scale). **Not** the forced-reset high-band floor (0.80).
 * @see FORCED_RESET_AIR_7D_THRESHOLD for Stage-4 AIR policy messaging.
 */
export const AIR_LOCKOUT_THRESHOLD = 0.6 as const;

/** Milliseconds for one lockout window (48 hours). */
export const LOCKOUT_DURATION_MS = 48 * 60 * 60 * 1000;

export type UserLockoutStatus = "ACTIVE" | "LOCKED";

export interface LockoutState {
  status: UserLockoutStatus;
  /** Set when status becomes LOCKED; cleared when lock expires or AIR recovers. */
  lockoutStart: Date | null;
}

export function createInitialLockoutState(): LockoutState {
  return { status: "ACTIVE", lockoutStart: null };
}

/** Expiry instant for the current lockout window (lockoutStart + 48h). */
export function getUnlockAt(lockoutStart: Date): Date {
  return new Date(lockoutStart.getTime() + LOCKOUT_DURATION_MS);
}

function isLockWindowActive(lockoutStart: Date | null, now: Date): boolean {
  if (!lockoutStart) return false;
  return now.getTime() < getUnlockAt(lockoutStart).getTime();
}

/**
 * True when the user must be blocked from Arena (LOCKED and still inside the 48h window).
 */
export function isArenaAccessBlocked(state: LockoutState, now: Date): boolean {
  return state.status === "LOCKED" && isLockWindowActive(state.lockoutStart, now);
}

/**
 * Applies AIR vs threshold: below → LOCKED + lockout_start; at/above → ACTIVE.
 * Expires an elapsed lockout before re-evaluating; if still below threshold, starts a new lockout from `now`.
 */
export function syncLockoutFromAir(
  air7d: number,
  threshold: number,
  previous: LockoutState,
  now: Date
): LockoutState {
  let state: LockoutState = previous;

  if (state.status === "LOCKED" && state.lockoutStart && now.getTime() >= getUnlockAt(state.lockoutStart).getTime()) {
    state = { status: "ACTIVE", lockoutStart: null };
  }

  if (air7d >= threshold) {
    return { status: "ACTIVE", lockoutStart: null };
  }

  if (state.status === "LOCKED" && isLockWindowActive(state.lockoutStart, now)) {
    return state;
  }

  return { status: "LOCKED", lockoutStart: now };
}

/**
 * Persist LOCKED on `arena_profiles` (requires migration `account_status` + `lockout_start`).
 */
export async function lockUser(userId: string): Promise<void> {
  const admin = getSupabaseAdmin();
  if (!admin) {
    throw new Error("lockUser: Supabase service role not configured");
  }
  const at = new Date().toISOString();
  const { error } = await admin
    .from("arena_profiles")
    .update({
      account_status: "LOCKED",
      lockout_start: at,
      updated_at: at,
    })
    .eq("user_id", userId);
  if (error) throw error;
}

/**
 * True when `arena_profiles` is LOCKED and the 48h window from `lockout_start` is still active.
 */
export async function isArenaAccountLockoutActive(
  userId: string,
  now: Date = new Date(),
): Promise<boolean> {
  const admin = getSupabaseAdmin();
  if (!admin) {
    throw new Error("isArenaAccountLockoutActive: Supabase service role not configured");
  }
  const { data, error } = await admin
    .from("arena_profiles")
    .select("account_status, lockout_start")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  const row = data as { account_status?: string; lockout_start?: string | null } | null;
  if (!row || row.account_status !== "LOCKED") return false;
  if (row.lockout_start == null || row.lockout_start === "") return true;
  const start = new Date(row.lockout_start);
  return now.getTime() < getUnlockAt(start).getTime();
}

export class LockoutService {
  constructor(private readonly airThreshold: number = FORCED_RESET_AIR_7D_THRESHOLD) {}

  get threshold(): number {
    return this.airThreshold;
  }

  static lockUser(userId: string): Promise<void> {
    return lockUser(userId);
  }

  /** Lockout expiry (48h after {@param lockoutStart}). */
  unlockAt(lockoutStart: Date): Date {
    return getUnlockAt(lockoutStart);
  }

  syncFromAir(air7d: number, previous: LockoutState, now: Date): LockoutState {
    return syncLockoutFromAir(air7d, this.airThreshold, previous, now);
  }

  isArenaBlocked(state: LockoutState, now: Date): boolean {
    return isArenaAccessBlocked(state, now);
  }
}
