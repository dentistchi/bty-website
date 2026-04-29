/**
 * Arena ↔ Center ejection: when AIR falls below 40% (0–100 scale) or three consecutive
 * `INTEGRITY_SLIP` choice flags occur within 7 days, set `arena_profiles.arena_status = EJECTED`,
 * log {@link arena_ejection_log}, emit `arena_ejected`, and block {@link selectNextScenario}.
 *
 * {@link liftEjection} clears ejection after the user completes their current Center phase gate
 * ({@link getPhaseGateStatus}).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { handleEjectionLifecycle } from "@/engine/integration/ejection-recovery-router";
import { getPhaseGateStatus } from "@/engine/healing/healing-content.service";
import { getCurrentPhase, type HealingPhase } from "@/engine/healing/healing-phase.service";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

/** Normalized AIR [0,1]; below this (40 on 0–100) triggers ejection when {@link checkEjectionCondition} runs with `newAir`. */
export const AIR_EJECTION_THRESHOLD = 0.4 as const;

/** Rolling window for counting consecutive INTEGRITY_SLIP flags. */
export const INTEGRITY_SLIP_STREAK_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** Scenario / choice flag value for integrity-slip streak (matches `user_scenario_choice_history.flag_type`). */
export const INTEGRITY_SLIP_FLAG_TYPE = "INTEGRITY_SLIP" as const;

export const ARENA_EJECTED_EVENT = "arena_ejected" as const;

export type ArenaEjectionReason =
  | "air_below_40"
  | "three_consecutive_integrity_slip_7d";

export type ArenaEjectedPayload = {
  type: typeof ARENA_EJECTED_EVENT;
  userId: string;
  reason: ArenaEjectionReason;
  ejectedAt: string;
};

export type EjectionResult = {
  /** User was already `EJECTED` before this check. */
  alreadyEjected: boolean;
  /** Ejection was applied in this call. */
  ejectedNow: boolean;
  /** Set when `ejectedNow` is true. */
  reason: ArenaEjectionReason | null;
};

const arenaEjectedListeners = new Set<(payload: ArenaEjectedPayload) => void | Promise<void>>();

export function onArenaEjected(
  listener: (payload: ArenaEjectedPayload) => void | Promise<void>,
): () => void {
  arenaEjectedListeners.add(listener);
  return () => arenaEjectedListeners.delete(listener);
}

async function emitArenaEjected(payload: ArenaEjectedPayload): Promise<void> {
  for (const fn of arenaEjectedListeners) {
    try {
      await fn(payload);
    } catch {
      /* listeners must not break ejection */
    }
  }
  try {
    await handleEjectionLifecycle(payload.userId, "EJECTED");
  } catch {
    /* recovery router must not break ejection */
  }
}

function defaultPhaseWhenMissing(): HealingPhase {
  return "ACKNOWLEDGEMENT";
}

/**
 * True when `arena_profiles.arena_status` is `EJECTED` (reads via service role when available).
 */
export async function isUserArenaEjected(userId: string, supabase?: SupabaseClient): Promise<boolean> {
  const client = supabase ?? getSupabaseAdmin();
  if (!client) return false;

  const { data, error } = await client
    .from("arena_profiles")
    .select("arena_status")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return false;
  return (data as { arena_status?: string }).arena_status === "EJECTED";
}

async function hasThreeConsecutiveIntegritySlipsInWindow(
  userId: string,
  now: Date,
  supabase: SupabaseClient,
): Promise<boolean> {
  const cutoff = new Date(now.getTime() - INTEGRITY_SLIP_STREAK_WINDOW_MS).toISOString();
  const { data, error } = await supabase
    .from("user_scenario_choice_history")
    .select("flag_type, played_at")
    .eq("user_id", userId)
    .gte("played_at", cutoff)
    .order("played_at", { ascending: false })
    .limit(3);

  if (error) throw new Error(error.message);
  const rows = data ?? [];
  if (rows.length < 3) return false;
  return rows.every(
    (r) => (r as { flag_type?: string }).flag_type === INTEGRITY_SLIP_FLAG_TYPE,
  );
}

async function persistEjection(userId: string, reason: ArenaEjectionReason, supabase: SupabaseClient): Promise<string> {
  const ejectedAt = new Date().toISOString();
  const { error: logErr } = await supabase.from("arena_ejection_log").insert({
    user_id: userId,
    reason,
    ejected_at: ejectedAt,
  });
  if (logErr) throw new Error(logErr.message);

  const { error: upErr } = await supabase
    .from("arena_profiles")
    .update({ arena_status: "EJECTED", updated_at: ejectedAt })
    .eq("user_id", userId);
  if (upErr) throw new Error(upErr.message);

  return ejectedAt;
}

/**
 * Evaluates ejection rules after an AIR write. Pass **`newAir`** from the monitor so the sub-40% rule applies.
 * Idempotent: already-ejected users do not create duplicate log rows.
 * **`readonly`:** only checks current `arena_status` (no AIR/slip persistence) — for routing reads.
 */
export async function checkEjectionCondition(
  userId: string,
  context?: { newAir?: number; now?: Date; supabase?: SupabaseClient; readonly?: boolean },
): Promise<EjectionResult> {
  const admin = context?.supabase ?? getSupabaseAdmin();
  if (!admin) {
    return { alreadyEjected: false, ejectedNow: false, reason: null };
  }

  const now = context?.now ?? new Date();

  const { data: prof, error: profErr } = await admin
    .from("arena_profiles")
    .select("arena_status")
    .eq("user_id", userId)
    .maybeSingle();

  if (profErr) throw new Error(profErr.message);
  const status = (prof as { arena_status?: string } | null)?.arena_status;
  if (status === "EJECTED") {
    return { alreadyEjected: true, ejectedNow: false, reason: null };
  }

  if (context?.readonly) {
    return { alreadyEjected: false, ejectedNow: false, reason: null };
  }

  const newAir = context?.newAir;
  if (typeof newAir === "number" && Number.isFinite(newAir) && newAir < AIR_EJECTION_THRESHOLD) {
    const ejectedAt = await persistEjection(userId, "air_below_40", admin);
    const payload: ArenaEjectedPayload = {
      type: ARENA_EJECTED_EVENT,
      userId,
      reason: "air_below_40",
      ejectedAt,
    };
    await emitArenaEjected(payload);
    return { alreadyEjected: false, ejectedNow: true, reason: "air_below_40" };
  }

  if (await hasThreeConsecutiveIntegritySlipsInWindow(userId, now, admin)) {
    const ejectedAt = await persistEjection(userId, "three_consecutive_integrity_slip_7d", admin);
    const payload: ArenaEjectedPayload = {
      type: ARENA_EJECTED_EVENT,
      userId,
      reason: "three_consecutive_integrity_slip_7d",
      ejectedAt,
    };
    await emitArenaEjected(payload);
    return { alreadyEjected: false, ejectedNow: true, reason: "three_consecutive_integrity_slip_7d" };
  }

  return { alreadyEjected: false, ejectedNow: false, reason: null };
}

export type LiftEjectionErrorCode = "not_ejected" | "center_phase_gate_incomplete";

/**
 * Clears `arena_status` when the user has completed all required Center diagnostics for their
 * current healing phase ({@link getPhaseGateStatus}).
 */
export async function liftEjection(userId: string, supabase?: SupabaseClient): Promise<void> {
  const client = supabase ?? getSupabaseAdmin();
  if (!client) {
    throw new Error("liftEjection: Supabase client not configured");
  }

  const { data: prof, error: pErr } = await client
    .from("arena_profiles")
    .select("arena_status")
    .eq("user_id", userId)
    .maybeSingle();
  if (pErr) throw new Error(pErr.message);
  if ((prof as { arena_status?: string } | null)?.arena_status !== "EJECTED") {
    const e = new Error("liftEjection: user is not EJECTED");
    (e as Error & { code: LiftEjectionErrorCode }).code = "not_ejected";
    throw e;
  }

  const phase = (await getCurrentPhase(userId, client)) ?? defaultPhaseWhenMissing();
  const gate = await getPhaseGateStatus(userId, phase, client);
  if (gate.missing.length > 0) {
    const e = new Error(
      `liftEjection: center phase gate incomplete for ${phase}: ${gate.missing.join(", ")}`,
    );
    (e as Error & { code: LiftEjectionErrorCode; missing: string[] }).code =
      "center_phase_gate_incomplete";
    (e as Error & { missing: string[] }).missing = gate.missing;
    throw e;
  }

  const at = new Date().toISOString();
  const { error: upErr } = await client
    .from("arena_profiles")
    .update({ arena_status: "ACTIVE", updated_at: at })
    .eq("user_id", userId);
  if (upErr) throw new Error(upErr.message);

  try {
    await handleEjectionLifecycle(userId, "LIFTED", client);
  } catch (err) {
    console.warn("[liftEjection] handleEjectionLifecycle LIFTED", err);
  }
}
