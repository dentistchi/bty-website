import type { SupabaseClient } from "@supabase/supabase-js";
import {
  APPLY_WINDOW_DAYS,
  computeApplyWindow,
  type ApplyWindowState,
  classifyApplyWindow,
} from "@/domain/foundry/apply-window/applyWindow";
import { journeyActionDecision, type RealityGroundedJourneyV1 } from "@/domain/foundry/module/journey";
import { resolveUserTzContext } from "@/lib/bty/daily/userDay";

/**
 * FOUNDRY APPLY WINDOW — service layer (Slice 3.2R-R2).
 *
 * Materializes and reads the application window created by a learner's own Action Decision.
 * Deliberately modelled on `foundryFollowupService`, because that shape is already proven across
 * completion, claim, XP retry and reload — the one thing this slice must not do is invent a
 * second obligation mechanism next to a working one.
 *
 * WHAT THIS SERVICE CANNOT DO, BY CONSTRUCTION: mark a window complete, record an outcome, or
 * touch the evidence ladder. There is no update path and no status column. APPLIED is established
 * only by `bty_foundry_submit_followup`, and nothing here can reach it.
 *
 * FAIL-SOFT, LIKE THE FOLLOW-UP IT MIRRORS. Every path returns rather than throws. A learner who
 * truthfully finished a training must never be told they did not because an obligation table was
 * unreachable — and until the R2 migration is applied, that table IS unreachable, so this must
 * degrade to "no window" rather than to a broken completion.
 */

const APPLY_WINDOWS = "foundry_participant_apply_windows";

export type MaterializeApplyResult = "created" | "exists" | "skipped" | "error";

/**
 * The ONLY place a materialization outcome becomes a client-visible signal (Slice R4-R5C9A).
 *
 * `created` and `exists` are one learner truth — a Reality step is live for this training — so
 * the terminal must not distinguish them; it describes state, not mutation history. `skipped` and
 * `error` produce NOTHING, which is what keeps the narration from ever becoming an optimistic
 * promise: completion without an Apply window is routine, not a failure.
 */
export function applyNarration(
  result: MaterializeApplyResult,
): { applyWindow?: "created" | "exists" } {
  return result === "created" || result === "exists" ? { applyWindow: result } : {};
}


type ProgressRow = {
  event_id: string | null;
  completed_at: string | null;
  decision_response_text: string | null;
};

/**
 * Create the window for one completed progress row, exactly once.
 *
 * ALL FOUR CONDITIONS ARE RE-DERIVED SERVER-SIDE, never trusted from the caller:
 *   1. the training is completed,
 *   2. the FROZEN published journey carries a grounded `action_decision`,
 *   3. a decision was actually recorded on this row,
 *   4. a durable learner identity exists.
 * Any one missing → `skipped`, and skipping is a correct outcome, not a failure.
 */
export async function materializeApplyWindow(
  admin: SupabaseClient,
  args: {
    eventId: string;
    progressId: string;
    authUserId: string | null;
    completedAtIso?: string | null;
    deviceTz?: string | null;
  },
): Promise<MaterializeApplyResult> {
  const { eventId, progressId, authUserId } = args;
  // (4) No account, no window. An anonymous completion materializes nothing here and acquires its
  // window later at the authenticated claim — the identical rule 3.1B-3K proved for follow-ups.
  if (!authUserId || !progressId || !eventId) return "skipped";

  try {
    // (1) + (3) read from the durable row, never from the request.
    const { data: prog } = await admin
      .from("foundry_event_training_progress")
      .select("event_id, completed_at, decision_response_text")
      .eq("id", progressId)
      .maybeSingle<ProgressRow>();
    if (!prog?.completed_at) return "skipped";
    const decision = (prog.decision_response_text ?? "").trim();
    if (decision.length < 1) return "skipped";

    // (2) THE FROZEN JOURNEY DECIDES, not the client and not the presence of the answer. A row
    // could in principle carry a decision for an event that no longer publishes one; the window
    // belongs to what was actually published to this learner.
    const { data: mod } = await admin
      .from("foundry_event_module")
      .select("module_snapshot")
      .eq("event_id", eventId)
      .maybeSingle<{ module_snapshot: { realityGroundedJourneyV1?: RealityGroundedJourneyV1 } | null }>();
    if (!journeyActionDecision(mod?.module_snapshot?.realityGroundedJourneyV1)) return "skipped";

    /*
      Title snapshot — non-learner-authored context so the row still says what it came from after
      its FKs are nulled. The same field, for the same reason, as the follow-up obligation.

      `foundry_events` HAS NO `organization_id` (Slice 3.2R-R2.6). Selecting one returned 42703 for
      the whole statement, so `ev` was null, the title silently became the "Foundry training"
      fallback, and the org was lost — on a fail-soft path that reports neither. The organization
      is carried by the ASSIGNMENT, which is where the follow-up sibling has always read it from.
    */
    const { data: ev } = await admin
      .from("foundry_events")
      .select("title")
      .eq("id", eventId)
      .maybeSingle<{ title: string | null }>();

    // Assignment lineage when the learner reached this training through one. Optional by measured
    // precedent: only 4 of 7 live follow-up rows carry it.
    const { data: assignment } = await admin
      .from("foundry_event_assignments")
      .select("id, organization_id")
      .eq("event_id", eventId)
      .eq("user_id_snapshot", authUserId)
      .maybeSingle<{ id: string; organization_id: string | null }>();

    /*
      THE WINDOW OPENS ON THE COMPLETION DAY, NOT TODAY.

      `completedAtIso` is passed by the completion path (which already holds the instant it just
      wrote) and falls back to the stored value — which is what makes the CLAIM path correct: an
      anonymous completion claimed a week later still gets the window it would have had, because
      the math runs on the original completion instant, never on `now`.
    */
    const completedAtIso = args.completedAtIso ?? prog.completed_at;
    const tz = await resolveUserTzContext(admin, authUserId, args.deviceTz ?? null);
    const win = computeApplyWindow(completedAtIso, tz.timezone);

    const { data, error } = await admin.rpc("bty_foundry_materialize_apply_window", {
      p_event_id: eventId,
      p_progress_id: progressId,
      p_assignment_id: assignment?.id ?? null,
      p_organization_id: assignment?.organization_id ?? null,
      p_user_id_snapshot: authUserId,
      // Never empty — the CHECK domain requires a value, and an untitled event is not a data error.
      p_source_training_title: (ev?.title ?? "").trim().slice(0, 300) || "Foundry training",
      p_apply_days: APPLY_WINDOW_DAYS,
      p_completed_at: completedAtIso,
      p_timezone_snapshot: tz.timezone,
      p_completion_bty_day: win.completionBtyDay,
      p_due_bty_day: win.dueBtyDay,
      p_due_at: win.dueAtIso,
    });
    if (error) return "error";
    const row = Array.isArray(data) ? data[0] : data;
    const result = (row as { result?: string } | null)?.result;
    return result === "created" || result === "exists" || result === "skipped" ? result : "error";
  } catch {
    // Includes "relation does not exist" before the migration is applied. Never blocks completion.
    return "error";
  }
}

/** One learner's window, as the Today projection needs it. Carries NO learner-authored text. */
export type MyApplyWindow = {
  readonly id: string;
  readonly eventId: string | null;
  readonly progressId: string | null;
  readonly sourceTrainingTitle: string;
  readonly completionBtyDay: string;
  readonly dueBtyDay: string;
  readonly dueAtIso: string;
  /** Derived against the CURRENT reader timezone. Never stored. */
  readonly state: ApplyWindowState;
};

/**
 * The authenticated learner's own windows, owner-scoped through the SECURITY DEFINER RPC.
 *
 * Returns every window with its derived state; SUPPRESSION and rendering are the caller's job,
 * because "which of these should Today show" is a projection question and this is a read.
 * Fail-soft to `[]`.
 */
export async function listMyApplyWindows(
  admin: SupabaseClient,
  authUserId: string,
  now: Date,
  tz: string,
): Promise<MyApplyWindow[]> {
  if (!authUserId) return [];
  try {
    const { data, error } = await admin.rpc("bty_foundry_list_my_apply_windows", {
      p_auth_user_id: authUserId,
    });
    if (error) return [];
    return ((data ?? []) as Array<{
      id: string;
      event_id: string | null;
      progress_id: string | null;
      source_training_title: string;
      completion_bty_day: string;
      due_bty_day: string;
      due_at: string;
    }>).map((r) => ({
      id: r.id,
      eventId: r.event_id,
      progressId: r.progress_id,
      sourceTrainingTitle: r.source_training_title,
      completionBtyDay: r.completion_bty_day,
      dueBtyDay: r.due_bty_day,
      dueAtIso: r.due_at,
      state: classifyApplyWindow(r.completion_bty_day, r.due_bty_day, now, tz),
    }));
  } catch {
    return [];
  }
}
