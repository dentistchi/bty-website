/**
 * Phase A reinforcement: after re-exposure validation, schedule optional follow-up delayed outcomes
 * (`unstable` / `no_change`) or mark loop satisfied (`changed`). Domain rules live here; route orchestrates DB order.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PatternShiftBand } from "@/domain/leadership-engine/patternShift";
import type { ReexposureValidationPayload } from "@/lib/bty/arena/reexposureValidation.server";

/** Medium follow-up — same axis, pattern still moving. */
export const REINFORCEMENT_UNSTABLE_DELAY_DAYS = 5;
/** Stronger follow-up — same axis, pattern stuck (higher sensitivity / sooner). */
export const REINFORCEMENT_NO_CHANGE_DELAY_DAYS = 3;

/** Durable JSON stored in `arena_pending_outcomes.validation_payload.reinforcement_loop`. */
export type ArenaReinforcementLoopJson = {
  validation_result: PatternShiftBand;
  /** Pending row that was validated (the event source); same as seed FK on follow-up rows. */
  source_pending_outcome_id: string;
  loop_iteration: number;
  loop_reason:
    | "reinforcement_unstable_same_axis"
    | "reinforcement_no_change_same_axis"
    | "loop_satisfied_changed"
    | "validated_chained_follow_up";
  next_scheduled_for: string | null;
  axis: string;
  pattern_family: string | null;
  follow_up_intensity?: "medium" | "high" | null;
  loop_satisfied?: boolean;
};

/** Iteration stamped in `validation_payload.reinforcement_loop` when follow-up rows are chained. */
export function loopIterationForPendingRow(row: { validation_payload?: unknown; reinforcement_loop?: unknown }): number {
  const vp = row.validation_payload;
  const fromPayload =
    vp && typeof vp === "object" && !Array.isArray(vp)
      ? (vp as { reinforcement_loop?: unknown }).reinforcement_loop
      : undefined;
  const j = fromPayload ?? row.reinforcement_loop;
  if (
    j &&
    typeof j === "object" &&
    !Array.isArray(j) &&
    typeof (j as { loop_iteration?: unknown }).loop_iteration === "number"
  ) {
    const n = (j as { loop_iteration: number }).loop_iteration;
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
  }
  return 1;
}

function addDaysFromNow(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

function reinforcementCopy(params: {
  axis: string;
  patternFamily: string | null;
  intensity: "medium" | "high";
  loopIteration: number;
}): { outcome_title: string; outcome_body: string; choice_type: string } {
  const { axis, patternFamily, intensity, loopIteration } = params;
  const fam = patternFamily?.trim() || "pattern";
  const titleKo =
    intensity === "high"
      ? `재노출 후속 · 축 고정 (${loopIteration}차)`
      : `재노출 후속 · 축 점검 (${loopIteration}차)`;
  const titleEn =
    intensity === "high"
      ? `Re-exposure follow-up · axis held (${loopIteration})`
      : `Re-exposure follow-up · axis check (${loopIteration})`;
  const bodyKo =
    intensity === "high"
      ? `동일 축(${axis})에서 패턴(${fam}) 변화가 충분히 드러나지 않았습니다. 다음 세션에서 같은 축을 한 단계 더 민감하게 점검합니다.`
      : `동일 축(${axis})에서 패턴(${fam})의 안정성을 추적합니다. 다음 세션에서 리듬을 조정해 보세요.`;
  const bodyEn =
    intensity === "high"
      ? `On the same axis (${axis}), pattern (${fam}) did not show enough shift. Next session: a sharper check on this axis.`
      : `On the same axis (${axis}), we track pattern (${fam}) stability. Next session: adjust rhythm on this axis.`;
  const choice_type = `reinforcement_${intensity}_iter${loopIteration}_${fam.replace(/\W+/g, "_").slice(0, 32)}`;
  return {
    outcome_title: titleKo,
    outcome_body: `${bodyKo}\n\n--- EN ---\n${bodyEn}\n\n--- META ---\naxis: ${axis}\ntemplate: ${titleEn}`,
    choice_type,
  };
}

/**
 * After validation payload is computed: insert follow-up pending row (caller consumed closing row already).
 * Idempotent by scanning existing pending rows with the same `source_choice_history_id` and
 * `validation_payload.reinforcement_seeded_from_pending_id`.
 */
export async function insertReinforcementDelayedOutcome(
  admin: SupabaseClient,
  params: {
    userId: string;
    closingPendingOutcomeId: string;
    sourceChoiceHistoryId: string;
    validationResult: "unstable" | "no_change";
    payload: ReexposureValidationPayload;
    nextLoopIteration: number;
  },
): Promise<{
  ok: boolean;
  newPendingId: string | null;
  next_scheduled_for: string | null;
  error?: string;
}> {
  const { data: dupRows } = await admin
    .from("arena_pending_outcomes")
    .select("id, validation_payload")
    .eq("user_id", params.userId)
    .eq("status", "pending")
    .eq("source_choice_history_id", params.sourceChoiceHistoryId);
  const dup = (dupRows ?? []).find((row) => {
    const vp =
      row != null &&
      typeof (row as { validation_payload?: unknown }).validation_payload === "object" &&
      (row as { validation_payload?: unknown }).validation_payload != null &&
      !Array.isArray((row as { validation_payload?: unknown }).validation_payload)
        ? ((row as { validation_payload: Record<string, unknown> }).validation_payload as Record<string, unknown>)
        : null;
    return (
      vp != null &&
      typeof vp.reinforcement_seeded_from_pending_id === "string" &&
      vp.reinforcement_seeded_from_pending_id === params.closingPendingOutcomeId
    );
  }) as { id?: string } | undefined;

  if (dup?.id && typeof dup.id === "string") {
    const { data: row } = await admin
      .from("arena_pending_outcomes")
      .select("scheduled_for")
      .eq("id", dup.id)
      .maybeSingle();
    const sf = (row as { scheduled_for?: string } | null)?.scheduled_for;
    return {
      ok: true,
      newPendingId: dup.id as string,
      next_scheduled_for: typeof sf === "string" ? sf : null,
    };
  }

  const days =
    params.validationResult === "no_change" ? REINFORCEMENT_NO_CHANGE_DELAY_DAYS : REINFORCEMENT_UNSTABLE_DELAY_DAYS;
  const intensity = params.validationResult === "no_change" ? "high" : "medium";
  const scheduledFor = addDaysFromNow(days);
  const axis = params.payload.after_axis || params.payload.before_axis || "";
  const patternFamily = params.payload.after_pattern_family ?? params.payload.before_pattern_family ?? null;

  const copy = reinforcementCopy({
    axis,
    patternFamily,
    intensity,
    loopIteration: params.nextLoopIteration,
  });

  const loopMeta: ArenaReinforcementLoopJson = {
    validation_result: params.validationResult,
    source_pending_outcome_id: params.closingPendingOutcomeId,
    loop_iteration: params.nextLoopIteration,
    loop_reason:
      params.validationResult === "no_change"
        ? "reinforcement_no_change_same_axis"
        : "reinforcement_unstable_same_axis",
    next_scheduled_for: scheduledFor,
    axis,
    pattern_family: patternFamily,
    follow_up_intensity: intensity,
  };

  const { data: ins, error } = await admin
    .from("arena_pending_outcomes")
    .insert({
      user_id: params.userId,
      source_choice_history_id: params.sourceChoiceHistoryId,
      source_event_id: null,
      choice_type: copy.choice_type,
      outcome_title: copy.outcome_title,
      outcome_body: copy.outcome_body,
      status: "pending",
      scheduled_for: scheduledFor,
      validation_payload: {
        scenario_id: params.payload.scenario_id,
        reinforcement_seeded_from_pending_id: params.closingPendingOutcomeId,
        reinforcement_loop: loopMeta,
      } as unknown as Record<string, unknown>,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      const { data: againRows } = await admin
        .from("arena_pending_outcomes")
        .select("id, validation_payload")
        .eq("user_id", params.userId)
        .eq("status", "pending")
        .eq("source_choice_history_id", params.sourceChoiceHistoryId);
      const again = (againRows ?? []).find((row) => {
        const vp =
          row != null &&
          typeof (row as { validation_payload?: unknown }).validation_payload === "object" &&
          (row as { validation_payload?: unknown }).validation_payload != null &&
          !Array.isArray((row as { validation_payload?: unknown }).validation_payload)
            ? ((row as { validation_payload: Record<string, unknown> }).validation_payload as Record<string, unknown>)
            : null;
        return (
          vp != null &&
          typeof vp.reinforcement_seeded_from_pending_id === "string" &&
          vp.reinforcement_seeded_from_pending_id === params.closingPendingOutcomeId
        );
      }) as { id?: string } | undefined;
      return {
        ok: true,
        newPendingId: typeof again?.id === "string" ? again.id : null,
        next_scheduled_for: scheduledFor,
      };
    }
    return { ok: false, newPendingId: null, next_scheduled_for: null, error: error.message };
  }

  const id = (ins as { id?: string })?.id;
  return {
    ok: true,
    newPendingId: typeof id === "string" ? id : null,
    next_scheduled_for: scheduledFor,
  };
}
