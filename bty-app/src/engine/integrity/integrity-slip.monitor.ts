/**
 * Leadership Engine — AIR write monitor: integrity slip (delta below -10pp in 24h) + sub-60 lockout.
 * Call after persisting a new AIR snapshot. Uses `integrity_slip_log` + `lockout.service.lockUser`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { checkEjectionCondition } from "@/engine/integration/arena-center-ejection";
import { AIR_LOCKOUT_THRESHOLD, lockUser } from "@/engine/forced-reset/lockout.service";
import { processSlipRecoveryOnNewLog } from "@/engine/integrity/slip-recovery.service";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

/** Matches `insertIntegritySlipLog` reason when AIR Δ &lt; −10pp within 24h. */
export const INTEGRITY_SLIP_AIR_DELTA_REASON = "air_delta_below_negative_10pct_within_24h" as const;

/** −10 percentage points on normalized AIR [0, 1]. */
export const AIR_DELTA_SLIP_THRESHOLD = -0.1 as const;

/** Rolling window for delta-based slip vs previous sample. */
export const AIR_WRITE_WINDOW_MS = 24 * 60 * 60 * 1000;

export type IntegritySlipEventPayload = {
  readonly kind: "integrity_slip";
  readonly userId: string;
  readonly previousAir: number;
  readonly newAir: number;
  readonly delta: number;
  readonly recordedAt: string;
};

export type AirWriteInput = {
  userId: string;
  newAir: number;
  previousAir: number | null;
  previousAirRecordedAt: Date | null;
  now: Date;
  /** Optional hook when Δ slip fires (e.g. event bus). */
  emit?: (e: IntegritySlipEventPayload) => void | Promise<void>;
};

async function insertIntegritySlipLog(
  row: {
    userId: string;
    reason: string;
    previousAir: number | null;
    newAir: number;
    airDelta: number | null;
  },
  at: Date,
): Promise<void> {
  const admin = getSupabaseAdmin();
  if (!admin) {
    throw new Error("insertIntegritySlipLog: Supabase service role not configured");
  }
  const { error } = await admin.from("integrity_slip_log").insert({
    user_id: row.userId,
    reason: row.reason,
    previous_air: row.previousAir,
    new_air: row.newAir,
    air_delta: row.airDelta,
  });
  if (error) throw error;
  try {
    await processSlipRecoveryOnNewLog({
      userId: row.userId,
      reason: row.reason,
      airDelta: row.airDelta,
      at,
    });
  } catch {
    /* recovery must not break AIR pipeline */
  }
}

/**
 * Run after each AIR write: may emit `integrity_slip`, insert audit rows, and lock account if AIR is below 0.6 (60 on 0–100).
 */
export async function onAirWrite(input: AirWriteInput): Promise<{
  events: IntegritySlipEventPayload[];
  lockoutApplied: boolean;
}> {
  const events: IntegritySlipEventPayload[] = [];
  const { userId, newAir, previousAir, previousAirRecordedAt, now, emit } = input;

  const within24h =
    previousAir != null &&
    previousAirRecordedAt != null &&
    now.getTime() - previousAirRecordedAt.getTime() <= AIR_WRITE_WINDOW_MS;

  if (within24h && previousAir != null) {
    const delta = newAir - previousAir;
    if (delta < AIR_DELTA_SLIP_THRESHOLD) {
      const recordedAt = now.toISOString();
      const payload: IntegritySlipEventPayload = {
        kind: "integrity_slip",
        userId,
        previousAir,
        newAir,
        delta,
        recordedAt,
      };
      events.push(payload);
      await emit?.(payload);
      await insertIntegritySlipLog(
        {
          userId,
          reason: INTEGRITY_SLIP_AIR_DELTA_REASON,
          previousAir,
          newAir,
          airDelta: delta,
        },
        now,
      );
    }
  }

  let lockoutApplied = false;
  if (newAir < AIR_LOCKOUT_THRESHOLD) {
    await lockUser(userId);
    lockoutApplied = true;
    await insertIntegritySlipLog(
      {
        userId,
        reason: "air_below_60_lockout",
        previousAir,
        newAir,
        airDelta: previousAir != null ? newAir - previousAir : null,
      },
      now,
    );
  }

  try {
    await checkEjectionCondition(userId, { newAir, now });
  } catch {
    /* ejection persistence must not break AIR write pipeline */
  }

  return { events, lockoutApplied };
}

/**
 * Final session AIR delta (same formula as {@link onAirWrite}): `newAir − previousAir` on [0, 1].
 */
export function computeAirDelta(previousAir: number, newAir: number): number {
  return newAir - previousAir;
}

/**
 * True when a monitor-style integrity slip (AIR Δ) row exists in the rolling 24h window.
 * Used by XP / award gates before writes.
 */
export async function isIntegritySlipDeltaActive(
  userId: string,
  options?: { supabase?: SupabaseClient; now?: Date },
): Promise<boolean> {
  const client = options?.supabase ?? getSupabaseAdmin();
  if (!client) {
    throw new Error("isIntegritySlipDeltaActive: Supabase client not configured");
  }
  const now = options?.now ?? new Date();
  const cutoff = new Date(now.getTime() - AIR_WRITE_WINDOW_MS).toISOString();
  const { data, error } = await client
    .from("integrity_slip_log")
    .select("id")
    .eq("user_id", userId)
    .eq("reason", INTEGRITY_SLIP_AIR_DELTA_REASON)
    .gte("created_at", cutoff)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data != null;
}
