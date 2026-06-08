import type { SupabaseClient } from "@supabase/supabase-js";
import {
  canCompleteHealingAwakeningAct,
  isValidHealingAwakeningActId,
  nextHealingAwakeningActAfter,
  type AwakeningActId,
} from "@/domain/healing";
import { getSecondAwakening } from "@/lib/bty/emotional-stats/secondAwakening";

export type CompleteAwakeningActApiResult =
  | { ok: true; completedActs: AwakeningActId[] }
  | { status: 400 | 403 | 409 | 500; error: string };

/**
 * Record one Healing/Awakening act completion (DB + domain order).
 */
export async function completeHealingAwakeningAct(
  supabase: SupabaseClient,
  userId: string,
  rawActId: unknown
): Promise<CompleteAwakeningActApiResult> {
  const n = typeof rawActId === "number" ? rawActId : Number(rawActId);
  if (!isValidHealingAwakeningActId(n)) {
    return { status: 400, error: "INVALID_ACT_ID" };
  }
  const actId = n as AwakeningActId;

  const { data: rows, error: selErr } = await supabase
    .from("user_healing_awakening_acts")
    .select("act_id")
    .eq("user_id", userId)
    .order("act_id", { ascending: true });

  if (selErr) return { status: 500, error: selErr.message };

  const completed = (rows ?? []).map((r) => (r as { act_id: number }).act_id as AwakeningActId);
  if (completed.includes(actId)) {
    return { status: 409, error: "ACT_ALREADY_COMPLETED" };
  }
  if (!canCompleteHealingAwakeningAct(actId, completed)) {
    return { status: 400, error: "ACT_PREREQUISITE" };
  }

  // Second Awakening eligibility gate (server-side enforcement; UI-only gate was
  // bypassable via direct POST). 결정3 / B2: gate = train 완주 (distinct day == 28),
  // sourced from getSecondAwakening().eligible. Re-insert is blocked by the PK
  // (user_id, act_id) per migration 20260317120000. Forward-only: existing rows
  // are unaffected because the gate runs immediately before insert. 403
  // NOT_ELIGIBLE response contract preserved (UI response unchanged).
  const awakening = await getSecondAwakening(supabase, userId);
  if (!awakening.eligible) {
    return { status: 403, error: "NOT_ELIGIBLE" };
  }

  const { error: insErr } = await supabase.from("user_healing_awakening_acts").insert({
    user_id: userId,
    act_id: actId,
  });

  if (insErr) {
    const code = (insErr as { code?: string }).code;
    if (code === "23505" || String(insErr.message ?? "").toLowerCase().includes("unique")) {
      return { status: 409, error: "ACT_ALREADY_COMPLETED" };
    }
    return { status: 500, error: insErr.message };
  }

  const next = [...completed, actId].sort((a, b) => a - b) as AwakeningActId[];

  if (next.length === 3) {
    const { data: existing } = await supabase
      .from("user_healing_milestones")
      .select("second_awakening_completed_at")
      .eq("user_id", userId)
      .maybeSingle();
    const alreadySet = !!(existing as { second_awakening_completed_at: string | null } | null)
      ?.second_awakening_completed_at;
    if (!alreadySet) {
      await supabase.from("user_healing_milestones").upsert(
        { user_id: userId, second_awakening_completed_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
    }
  }

  return { ok: true, completedActs: next };
}

export type HealingAwakeningProgressResult =
  | { ok: true; completedActs: AwakeningActId[]; nextAct: AwakeningActId | null }
  | { status: 500; error: string };

/** Second Awakening 액트 진행 조회 (GET healing/progress). */
export async function getHealingAwakeningProgress(
  supabase: SupabaseClient,
  userId: string
): Promise<HealingAwakeningProgressResult> {
  const { data: rows, error } = await supabase
    .from("user_healing_awakening_acts")
    .select("act_id")
    .eq("user_id", userId)
    .order("act_id", { ascending: true });

  if (error) return { status: 500, error: error.message };

  const completed = (rows ?? []).map((r) => (r as { act_id: number }).act_id as AwakeningActId);
  const nextAct = nextHealingAwakeningActAfter(completed);
  return { ok: true, completedActs: completed, nextAct };
}
