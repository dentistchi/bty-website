import { getSupabaseAdmin } from "@/lib/supabase-admin";

type Row = Record<string, unknown>;
type Failure = { ok: false; status: 400 | 403 | 409 | 500 | 503; error: string };
type Result<T> = { ok: true; value: T } | Failure;
export type AtomicAct = { completedActs: number[] };
export type AtomicRitual = { starterUnlockGranted: "PRM" | "SAG" | null; idempotent: boolean };
const record = (v: unknown): v is Row => v !== null && typeof v === "object" && !Array.isArray(v);
const instant = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v) && Number.isFinite(Date.parse(v));
function failed(): Failure { return { ok: false, status: 500, error: "HEALING_COMPLETION_FAILED" }; }
function databaseFailure(error: unknown, operation: "act" | "ritual"): Failure {
  if (!record(error)) return failed();
  if (error.code === "PGRST202" || error.code === "42883") return { ok: false, status: 503, error: "HEALING_STORAGE_UNAVAILABLE" };
  if (error.message === "NOT_ELIGIBLE") return { ok: false, status: operation === "act" ? 403 : 400, error: "NOT_ELIGIBLE" };
  if (error.message === "ACT_ALREADY_COMPLETED" || error.message === "HEALING_COMPLETION_REVIEW_REQUIRED") return { ok: false, status: 409, error: error.message };
  if (error.message === "INVALID_ACT_ID" || error.message === "INVALID_HEALING_INPUT" || error.message === "ACT_PREREQUISITE") return { ok: false, status: 400, error: error.message };
  return failed();
}
function common(data: unknown, userId: string, operation: "act" | "ritual"): data is Row {
  return record(data) && data.policyVersion === "healing-completion/v1" && data.operation === operation
    && typeof data.userId === "string" && data.userId.toLowerCase() === userId.toLowerCase();
}

/** One private transaction; missing storage/transport never falls back to owner-client writes. */
export async function completeAtomicAct(userId: string, actId: number): Promise<Result<AtomicAct>> {
  try {
    const writer = getSupabaseAdmin();
    if (!writer) return { ok: false, status: 503, error: "HEALING_WRITER_UNAVAILABLE" };
    const { data, error } = await writer.rpc("bty_complete_healing_awakening_act", { p_user_id: userId, p_act_id: actId });
    if (error) return databaseFailure(error, "act");
    if (!common(data, userId, "act") || data.actId !== actId || data.idempotent !== false
      || !Array.isArray(data.completedActs) || data.completedActs.length !== actId
      || !data.completedActs.every((id, i) => id === i + 1) || !instant(data.actCompletedAt)
      || (actId === 3 ? (!instant(data.completedAt) || Date.parse(data.completedAt) !== Date.parse(data.actCompletedAt)) : data.completedAt !== null)) return failed();
    return { ok: true, value: { completedActs: data.completedActs as number[] } };
  } catch { return failed(); }
}

export async function completeAtomicRitual(userId: string, starter: "PRM" | "SAG" | null): Promise<Result<AtomicRitual>> {
  try {
    const writer = getSupabaseAdmin();
    if (!writer) return { ok: false, status: 503, error: "HEALING_WRITER_UNAVAILABLE" };
    const { data, error } = await writer.rpc("bty_complete_second_awakening", { p_user_id: userId, p_starter_unlock: starter });
    if (error) return databaseFailure(error, "ritual");
    if (!common(data, userId, "ritual") || !instant(data.completedAt) || typeof data.idempotent !== "boolean"
      || ![null, "PRM", "SAG"].includes(data.starterUnlockGranted as null | "PRM" | "SAG")
      || (!data.idempotent && data.starterUnlockGranted !== starter)) return failed();
    return { ok: true, value: { starterUnlockGranted: data.starterUnlockGranted as "PRM" | "SAG" | null, idempotent: data.idempotent } };
  } catch { return failed(); }
}
