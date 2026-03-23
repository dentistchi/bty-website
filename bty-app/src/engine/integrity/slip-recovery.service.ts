/**
 * After `integrity_slip_log` rows: severity = (7d slip count) × |AIR Δ| × scale; optional recovery task + event.
 *
 * Completion is verified against `dear_me_letters`, `elite_mentor_requests`, `user_scenario_choice_history`, `dojo_submissions`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

/** Must match {@link INTEGRITY_SLIP_AIR_DELTA_REASON} in integrity-slip.monitor. */
const AIR_DELTA_SLIP_REASON = "air_delta_below_negative_10pct_within_24h" as const;

const MS_PER_DAY = 86_400_000;

/** Maps slip `reason` to recovery surface (proxy for product “flag_type”). */
export type SlipRecoveryTaskType =
  | "reflection_letter"
  | "mentor_session"
  | "scenario_retry"
  | "dojo_assessment";

export const RECOVERY_TASK_MAP: Record<string, SlipRecoveryTaskType> = {
  [AIR_DELTA_SLIP_REASON]: "scenario_retry",
  air_below_60_lockout: "dojo_assessment",
  /** Fallback when reason not listed — reflective writing path. */
  default: "reflection_letter",
};

export type SlipRecoveryNeededPayload = {
  event: "slip_recovery_needed";
  userId: string;
  slip_severity: number;
  slip_count_7d: number;
  air_delta_used: number;
  task_type: SlipRecoveryTaskType;
};

export type SlipRecoveryTask = {
  id: string;
  user_id: string;
  task_type: SlipRecoveryTaskType;
  assigned_at: string;
  completed_at: string | null;
  slip_severity: number;
  slip_reason: string;
};

/** Scale so typical |Δ|≈0.1 with a few slips can reach threshold 3. */
export const SLIP_SEVERITY_SCALE = 10 as const;
export const SLIP_RECOVERY_SEVERITY_THRESHOLD = 3 as const;

const listeners = new Set<(p: SlipRecoveryNeededPayload) => void>();

export function onSlipRecoveryNeeded(fn: (p: SlipRecoveryNeededPayload) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emitNeeded(p: SlipRecoveryNeededPayload): void {
  for (const fn of listeners) {
    try {
      fn(p);
    } catch {
      /* no-op */
    }
  }
}

export function recoveryTaskTypeForSlipReason(reason: string): SlipRecoveryTaskType {
  if (RECOVERY_TASK_MAP[reason]) return RECOVERY_TASK_MAP[reason]!;
  const r = reason.toLowerCase();
  if (r.includes("delta") || r.includes("10pct") || r.includes("air_delta")) return "scenario_retry";
  if (r.includes("60") || r.includes("lockout")) return "dojo_assessment";
  if (r.includes("mentor") || r.includes("ejection") || r.includes("consecutive")) return "mentor_session";
  return RECOVERY_TASK_MAP.default!;
}

async function countSlipsLast7Days(
  admin: SupabaseClient,
  userId: string,
  asOf: Date,
): Promise<number> {
  const cutoff = new Date(asOf.getTime() - 7 * MS_PER_DAY).toISOString();
  const { count, error } = await admin
    .from("integrity_slip_log")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", cutoff);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function hasOpenRecoveryTask(admin: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await admin
    .from("slip_recovery_tasks")
    .select("id")
    .eq("user_id", userId)
    .is("completed_at", null)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data != null;
}

/**
 * Call after each successful `integrity_slip_log` insert (service role).
 */
export async function processSlipRecoveryOnNewLog(input: {
  userId: string;
  reason: string;
  airDelta: number | null;
  at: Date;
}): Promise<void> {
  const admin = getSupabaseAdmin();
  if (!admin) return;

  const slip_count_7d = await countSlipsLast7Days(admin, input.userId, input.at);
  const air_delta_used = Math.abs(Number(input.airDelta ?? 0));
  const slip_severity = slip_count_7d * air_delta_used * SLIP_SEVERITY_SCALE;

  if (slip_severity < SLIP_RECOVERY_SEVERITY_THRESHOLD) return;

  const task_type = recoveryTaskTypeForSlipReason(input.reason);

  const payload: SlipRecoveryNeededPayload = {
    event: "slip_recovery_needed",
    userId: input.userId,
    slip_severity,
    slip_count_7d,
    air_delta_used,
    task_type,
  };
  emitNeeded(payload);

  if (await hasOpenRecoveryTask(admin, input.userId)) return;

  const { error } = await admin.from("slip_recovery_tasks").insert({
    user_id: input.userId,
    task_type,
    slip_severity,
    slip_reason: input.reason,
    assigned_at: input.at.toISOString(),
  });

  if (error) throw new Error(`slip_recovery_tasks insert: ${error.message}`);

  try {
    const { handleSlipRecovery } = await import("@/engine/integration/recovery-loop-router");
    await handleSlipRecovery(input.userId, { locale: "en", supabase: admin });
  } catch (e) {
    console.warn(
      "[slip-recovery] handleSlipRecovery failed:",
      e instanceof Error ? e.message : e,
    );
  }
}

function rowToTask(row: Record<string, unknown>): SlipRecoveryTask | null {
  const id = row.id;
  const uid = row.user_id;
  const tt = row.task_type;
  if (typeof id !== "string" || typeof uid !== "string" || typeof tt !== "string") return null;
  return {
    id,
    user_id: uid,
    task_type: tt as SlipRecoveryTaskType,
    assigned_at: typeof row.assigned_at === "string" ? row.assigned_at : String(row.assigned_at),
    completed_at:
      row.completed_at == null
        ? null
        : typeof row.completed_at === "string"
          ? row.completed_at
          : String(row.completed_at),
    slip_severity: Number(row.slip_severity ?? 0),
    slip_reason: typeof row.slip_reason === "string" ? row.slip_reason : "",
  };
}

/** Latest open recovery task, if any. */
export async function getRecoveryTask(
  userId: string,
  options?: { supabase?: SupabaseClient },
): Promise<SlipRecoveryTask | null> {
  const admin = options?.supabase ?? getSupabaseAdmin();
  if (!admin) return null;

  const { data, error } = await admin
    .from("slip_recovery_tasks")
    .select("id, user_id, task_type, assigned_at, completed_at, slip_severity, slip_reason")
    .eq("user_id", userId)
    .is("completed_at", null)
    .order("assigned_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return rowToTask(data as Record<string, unknown>);
}

async function verifyReflectionLetterDone(
  admin: SupabaseClient,
  userId: string,
  sinceIso: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from("dear_me_letters")
    .select("id")
    .eq("user_id", userId)
    .gte("created_at", sinceIso)
    .limit(1)
    .maybeSingle();
  if (error) return false;
  return data != null;
}

async function verifyMentorSessionDone(
  admin: SupabaseClient,
  userId: string,
  sinceIso: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from("elite_mentor_requests")
    .select("id, responded_at, updated_at")
    .eq("user_id", userId)
    .eq("status", "approved")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return false;
  const row = data as { responded_at?: string | null; updated_at?: string };
  const t = row.responded_at ?? row.updated_at;
  if (!t) return false;
  return new Date(t).getTime() >= new Date(sinceIso).getTime();
}

async function verifyScenarioRetryDone(
  admin: SupabaseClient,
  userId: string,
  sinceIso: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from("user_scenario_choice_history")
    .select("id")
    .eq("user_id", userId)
    .gte("played_at", sinceIso)
    .limit(1)
    .maybeSingle();
  if (error) return false;
  return data != null;
}

async function verifyDojoAssessmentDone(
  admin: SupabaseClient,
  userId: string,
  sinceIso: string,
): Promise<boolean> {
  const { data: micro, error: e1 } = await admin
    .from("user_dojo_attempts")
    .select("id")
    .eq("user_id", userId)
    .eq("passed", true)
    .gte("submitted_at", sinceIso)
    .limit(1)
    .maybeSingle();
  if (!e1 && micro != null) return true;

  const { data: legacy, error: e2 } = await admin
    .from("dojo_submissions")
    .select("id")
    .eq("user_id", userId)
    .gte("created_at", sinceIso)
    .limit(1)
    .maybeSingle();
  if (e2) return false;
  return legacy != null;
}

async function verifyCompletionForTaskType(
  admin: SupabaseClient,
  userId: string,
  task: SlipRecoveryTask,
): Promise<boolean> {
  const sinceIso = task.assigned_at;
  switch (task.task_type) {
    case "reflection_letter":
      return verifyReflectionLetterDone(admin, userId, sinceIso);
    case "mentor_session":
      return verifyMentorSessionDone(admin, userId, sinceIso);
    case "scenario_retry":
      return verifyScenarioRetryDone(admin, userId, sinceIso);
    case "dojo_assessment":
      return verifyDojoAssessmentDone(admin, userId, sinceIso);
    default:
      return false;
  }
}

export type MarkRecoveryCompleteResult = { ok: true } | { ok: false; error: string };

/**
 * Sets `completed_at` only when the expected artifact exists after `assigned_at`.
 */
export async function markRecoveryComplete(
  userId: string,
  taskId: string,
  options?: { supabase?: SupabaseClient; now?: Date },
): Promise<MarkRecoveryCompleteResult> {
  const admin = options?.supabase ?? getSupabaseAdmin();
  if (!admin) return { ok: false, error: "supabase_admin_not_configured" };

  const { data, error } = await admin
    .from("slip_recovery_tasks")
    .select("id, user_id, task_type, assigned_at, completed_at, slip_severity, slip_reason")
    .eq("id", taskId)
    .maybeSingle();

  if (error || !data) return { ok: false, error: "task_not_found" };

  const task = rowToTask(data as Record<string, unknown>);
  if (!task || task.user_id !== userId) return { ok: false, error: "forbidden" };
  if (task.completed_at) return { ok: true };

  const verified = await verifyCompletionForTaskType(admin, userId, task);
  if (!verified) return { ok: false, error: "completion_not_verified" };

  const now = options?.now ?? new Date();
  const { error: upErr } = await admin
    .from("slip_recovery_tasks")
    .update({ completed_at: now.toISOString() })
    .eq("id", taskId)
    .eq("user_id", userId);

  if (upErr) return { ok: false, error: upErr.message };
  return { ok: true };
}
