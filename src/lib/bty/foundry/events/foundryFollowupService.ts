import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveUserTzContext } from "@/lib/bty/daily/userDay";
import {
  classifyFollowUpDue,
  computeFollowUpDue,
  isFollowUpDays,
  isFollowUpOutcome,
  type FollowUpOutcome,
  type FollowUpStatus,
} from "@/domain/foundry/followup/followUpObligation";

/**
 * Foundry Follow-up Obligation service (Slice 3.1B-3K).
 *
 * A follow-up obligation is materialized EXACTLY ONCE per (completed progress, checkpoint) from
 * the frozen module_snapshot.followUpDays, keyed on the server-derived authenticated learner
 * identity. It is a SEPARATE evidence stage: it never awards XP, rewrites completed_at, reopens
 * an assignment, or touches Shared Understanding / Private Reflection. All writes go through the
 * service-role SECURITY DEFINER RPCs (bty_foundry_materialize_followup / _submit_followup /
 * _get_my_followup); this table stores NO free text (no reflection, no shared response, no AI).
 */

const TITLE_MAX = 300;

export type MaterializeResult = "created" | "exists" | "skipped" | "error";

/**
 * Materialize the follow-up obligation for a canonical completed progress row, ONCE. Called only
 * with a server-derived authUserId (authenticated completion OR authenticated claim) — never for an
 * anonymous, unclaimed completion. Fail-soft: any error is swallowed and returned as a result so it
 * can NEVER block completion / claim / XP. Idempotent via the RPC's ON CONFLICT (progress_id, days).
 */
export async function materializeFollowupObligation(
  admin: SupabaseClient,
  params: {
    eventId: string;
    progressId: string;
    authUserId: string;
    completedAtIso: string;
    deviceTz?: string | null;
  },
): Promise<MaterializeResult> {
  try {
    const { eventId, progressId, authUserId, completedAtIso } = params;
    if (!eventId || !progressId || !authUserId || !completedAtIso) return "skipped";

    // 1) Frozen authoring intent. 0 / absent / anything not in {7,30} → no obligation.
    const { data: mod } = await admin
      .from("foundry_event_module")
      .select("module_snapshot")
      .eq("event_id", eventId)
      .maybeSingle<{ module_snapshot: { followUpDays?: unknown } | null }>();
    const followUpDays = mod?.module_snapshot?.followUpDays;
    if (!isFollowUpDays(followUpDays)) return "skipped";

    // 2) Source training title (bounded to the CHECK domain; never empty).
    const { data: ev } = await admin
      .from("foundry_events")
      .select("title")
      .eq("id", eventId)
      .maybeSingle<{ title: string | null }>();
    const title = (ev?.title ?? "Foundry training").trim().slice(0, TITLE_MAX) || "Foundry training";

    // 3) Assignment binding — ONLY when the immutable publish-time user_id_snapshot matches the
    //    authenticated learner (assigned learning). Open-link learning → null assignment.
    const { data: asn } = await admin
      .from("foundry_event_assignments")
      .select("id, organization_id")
      .eq("event_id", eventId)
      .eq("user_id_snapshot", authUserId)
      .maybeSingle<{ id: string; organization_id: string | null }>();
    const assignmentId = asn?.id ?? null;
    const organizationId = asn?.organization_id ?? null;

    // 4) Resolve the tz via the settled ladder (profile → device[+capture] → UTC) for THIS request,
    //    then compute the fixed due instant ONCE. Never recomputed at read.
    const { timezone } = await resolveUserTzContext(admin, authUserId, params.deviceTz ?? null);
    const { completionBtyDay, dueBtyDay, dueAtIso } = computeFollowUpDue(
      completedAtIso,
      timezone,
      followUpDays,
    );

    const { data, error } = await admin.rpc("bty_foundry_materialize_followup", {
      p_event_id: eventId,
      p_progress_id: progressId,
      p_assignment_id: assignmentId,
      p_organization_id: organizationId,
      p_user_id_snapshot: authUserId,
      p_source_training_title: title,
      p_follow_up_days: followUpDays,
      p_completed_at: completedAtIso,
      p_timezone_snapshot: timezone,
      p_completion_bty_day: completionBtyDay,
      p_due_bty_day: dueBtyDay,
      p_due_at: dueAtIso,
    });
    if (error) return "error";
    const row = (Array.isArray(data) ? data[0] : data) as { result?: string } | undefined;
    if (row?.result === "created" || row?.result === "exists" || row?.result === "skipped") {
      return row.result;
    }
    return "error";
  } catch {
    return "error"; // materialization must NEVER throw into the completion/claim path
  }
}

/** Derived due state for the learner surface (RESPONDED once answered; else classified vs now/tz). */
export type LearnerFollowupState = "due_today" | "overdue" | "upcoming" | "responded";

/** One follow-up obligation as the learner's focused response surface sees it. No private text. */
export type LearnerFollowupView = {
  id: string;
  eventId: string | null;
  sourceTrainingTitle: string;
  followUpDays: number;
  completedAt: string;
  dueAt: string;
  status: FollowUpStatus;
  /** Derived (not stored): RESPONDED, else overdue / due_today / upcoming vs the reader tz. */
  dueState: LearnerFollowupState;
  outcome: FollowUpOutcome | null;
  respondedAt: string | null;
  /** Canonical expected-behavior text (module completion prompt) ONLY when one exists. */
  expectedBehavior: string | null;
};

/**
 * Read ONE follow-up obligation for the authenticated learner, owner-scoped via the SECURITY
 * DEFINER RPC (a foreign / not-owned id resolves to null — a safe 404). Enriches with the canonical
 * expected-behavior (module completion prompt) when the frozen snapshot carries one.
 */
export async function getMyFollowupView(
  admin: SupabaseClient,
  authUserId: string,
  followupId: string,
  now: Date,
  tz: string,
): Promise<LearnerFollowupView | null> {
  if (!authUserId || !followupId) return null;
  const { data, error } = await admin.rpc("bty_foundry_get_my_followup", {
    p_auth_user_id: authUserId,
    p_followup_id: followupId,
  });
  if (error) return null;
  const row = (Array.isArray(data) ? data[0] : data) as
    | {
        id: string;
        event_id: string | null;
        source_training_title: string;
        follow_up_days: number;
        completed_at: string;
        due_at: string;
        status: FollowUpStatus;
        outcome: FollowUpOutcome | null;
        responded_at: string | null;
      }
    | undefined;
  if (!row?.id) return null;

  let expectedBehavior: string | null = null;
  if (row.event_id) {
    const { data: mod } = await admin
      .from("foundry_event_module")
      .select("module_snapshot")
      .eq("event_id", row.event_id)
      .maybeSingle<{ module_snapshot: { completionPrompt?: unknown } | null }>();
    const prompt = mod?.module_snapshot?.completionPrompt;
    expectedBehavior = typeof prompt === "string" && prompt.trim().length > 0 ? prompt.trim() : null;
  }

  const dueState: LearnerFollowupState =
    row.status === "RESPONDED" ? "responded" : classifyFollowUpDue(row.due_at, now, tz);

  return {
    id: row.id,
    eventId: row.event_id,
    sourceTrainingTitle: row.source_training_title,
    followUpDays: row.follow_up_days,
    completedAt: row.completed_at,
    dueAt: row.due_at,
    status: row.status,
    dueState,
    outcome: row.outcome,
    respondedAt: row.responded_at,
    expectedBehavior,
  };
}

export type SubmitFollowupResult =
  | { result: "responded" | "unchanged"; status: FollowUpStatus; outcome: FollowUpOutcome }
  | { result: "already_responded"; status: FollowUpStatus; outcome: FollowUpOutcome }
  | { result: "invalid_outcome" | "not_found" | "not_owner" | "error" };

/**
 * Submit the learner's self-reported outcome, owner-scoped + locked via the RPC. A conflicting
 * second outcome never overwrites the first (returns already_responded + the settled state); an
 * identical resubmission is idempotent (unchanged). Never touches completion/XP/assignment/shared.
 */
export async function submitFollowupOutcome(
  admin: SupabaseClient,
  authUserId: string,
  followupId: string,
  outcome: unknown,
): Promise<SubmitFollowupResult> {
  if (!isFollowUpOutcome(outcome)) return { result: "invalid_outcome" };
  if (!authUserId || !followupId) return { result: "not_found" };
  const { data, error } = await admin.rpc("bty_foundry_submit_followup", {
    p_followup_id: followupId,
    p_auth_user_id: authUserId,
    p_outcome: outcome,
  });
  if (error) return { result: "error" };
  const row = (Array.isArray(data) ? data[0] : data) as
    | { result?: string; status?: string; outcome?: string }
    | undefined;
  const r = row?.result;
  if (r === "responded" || r === "unchanged" || r === "already_responded") {
    return {
      result: r,
      status: (row?.status as FollowUpStatus) ?? "RESPONDED",
      outcome: (row?.outcome as FollowUpOutcome) ?? (outcome as FollowUpOutcome),
    };
  }
  if (r === "invalid_outcome" || r === "not_found" || r === "not_owner") return { result: r };
  return { result: "error" };
}

/** Derived Host-facing status for one participant's follow-up (learner-reported, never verified). */
export type HostFollowupState = "pending" | "due" | "overdue" | "responded";

/** One participant's follow-up row for the Host control-room section. NO private text ever. */
export type HostFollowupRow = {
  followupId: string;
  participantId: string | null;
  displayName: string;
  followUpDays: number;
  dueAt: string;
  state: HostFollowupState;
  /** Learner-reported outcome, or null while pending. Labeled "Learner reported: …" in the UI. */
  outcome: FollowUpOutcome | null;
  respondedAt: string | null;
};

export type HostFollowupView = {
  eventId: string;
  rows: HostFollowupRow[];
};

/**
 * Host per-event follow-up projection, owner-scoped by foundry_events.owner_user_id (a foreign
 * event id resolves to null — no leak). Independent of the Shared Question / Shared Understanding
 * gate: a training with followUpDays > 0 and no shared question STILL shows Follow-up Status.
 * The SELECT is a safe allow-list (this table has no private columns); participant display names
 * are joined via the completed progress row. Derived state uses the CURRENT reader instant.
 */
export async function getEventFollowupsForOwner(
  admin: SupabaseClient,
  ownerUserId: string,
  eventId: string,
  now: Date,
  tz: string,
): Promise<HostFollowupView | null> {
  if (!ownerUserId || !eventId) return null;

  const { data: ev } = await admin
    .from("foundry_events")
    .select("id")
    .eq("id", eventId)
    .eq("owner_user_id", ownerUserId) // authorization — a foreign event id resolves nothing
    .maybeSingle<{ id: string }>();
  if (!ev) return null;

  const { data: rows } = await admin
    .from("foundry_participant_followups")
    .select("id, progress_id, follow_up_days, due_at, status, outcome, responded_at")
    .eq("event_id", eventId);

  const followups = (rows ?? []) as Array<{
    id: string;
    progress_id: string | null;
    follow_up_days: number;
    due_at: string;
    status: FollowUpStatus;
    outcome: FollowUpOutcome | null;
    responded_at: string | null;
  }>;

  // Map progress_id → participant_id → display name (identity already allowed in the control room).
  const progressIds = followups.map((f) => f.progress_id).filter((v): v is string => Boolean(v));
  const participantByProgress = new Map<string, string>();
  if (progressIds.length > 0) {
    const { data: progs } = await admin
      .from("foundry_event_training_progress")
      .select("id, participant_id")
      .in("id", progressIds);
    for (const p of (progs ?? []) as Array<{ id: string; participant_id: string }>) {
      participantByProgress.set(p.id, p.participant_id);
    }
  }
  const participantIds = [...new Set([...participantByProgress.values()])];
  const nameById = new Map<string, string>();
  if (participantIds.length > 0) {
    const { data: parts } = await admin
      .from("foundry_event_participants")
      .select("id, display_name")
      .eq("event_id", eventId)
      .in("id", participantIds);
    for (const p of (parts ?? []) as Array<{ id: string; display_name: string }>) {
      nameById.set(p.id, p.display_name);
    }
  }

  const rowsOut: HostFollowupRow[] = followups.map((f) => {
    const participantId = f.progress_id ? participantByProgress.get(f.progress_id) ?? null : null;
    // Same day-key boundary as the learner Today classification (classifyFollowUpDue), so Host +
    // learner agree: responded → responded, else overdue / due (today) / pending (upcoming) by reader tz.
    let state: HostFollowupState;
    if (f.status === "RESPONDED") state = "responded";
    else {
      const due = classifyFollowUpDue(f.due_at, now, tz);
      state = due === "overdue" ? "overdue" : due === "due_today" ? "due" : "pending";
    }
    return {
      followupId: f.id,
      participantId,
      displayName: (participantId && nameById.get(participantId)) || "",
      followUpDays: f.follow_up_days,
      dueAt: f.due_at,
      state,
      outcome: f.outcome,
      respondedAt: f.responded_at,
    };
  });

  return { eventId, rows: rowsOut };
}
