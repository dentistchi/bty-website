import type { SupabaseClient } from "@supabase/supabase-js";
import { validateEventTitle, type FoundryEventStatus } from "@/domain/foundry/events/foundry-event";
import {
  validateCompletionPrompt,
  validateSharedQuestionOptional,
  resolveSharedResponse,
  validateResponse,
  projectManagerRosterStatus,
  projectPublicTrainingStage,
  type ManagerRosterStatus,
  type PublicTrainingStage,
  type TrainingProgressMarkers,
  FOUNDRY_TRAINING_XP,
} from "@/domain/foundry/events/foundry-training";
import { parseYoutubeVideoId, youtubeThumbnailUrl } from "@/domain/foundry/youtube";
import {
  resolveYoutubeEmbeddable,
  embedCheckAllowsCreate,
  embedCheckReason,
} from "./youtubeEmbed";
import { applyDirectCoreXp } from "@/lib/bty/arena/applyCoreXp";
import { claimAssignmentForParticipant, type AssignmentClaimResult } from "./foundryAssignmentPublishService";
import { resolveUserTzContext } from "@/lib/bty/daily/userDay";
import { userDayStartInstant } from "@/domain/daily/userDayStartInstant";
import {
  getOwnerEventSnapshot,
  resolveEventByToken,
  findParticipantBySession,
  type EventRow,
  type ParticipantRow,
  type ServiceResult,
} from "./foundryEventService";

/**
 * Foundry YouTube Training — service layer.
 *
 * Extends the base Event Rooms service with: training content (one video + one
 * prompt per event), participant progress (watch → respond → complete), and the
 * Core XP loop. Core XP is awarded through the CANONICAL path only
 * (core_xp_ledger idempotency insert + applyDirectCoreXp), attributed as
 * source_type='foundry_training_completion' / source_id=progress.id. Never
 * writes an XP total itself. The completion response is PRIVATE — it is read by
 * these service routes for validation only and never returned to the manager.
 */

const SOURCE_TYPE = "foundry_training_completion";

type ContentRow = {
  event_id: string;
  youtube_video_id: string;
  youtube_title: string | null;
  youtube_channel_title: string | null;
  youtube_thumbnail_url: string | null;
  completion_prompt: string;
  shared_question: string | null;
};

type ProgressRow = {
  id: string;
  event_id: string;
  participant_id: string;
  video_started_at: string | null;
  video_completed_at: string | null;
  response_text: string | null;
  completed_at: string | null;
  linked_user_id: string | null;
  xp_awarded_at: string | null;
};

const PROGRESS_COLS =
  "id, event_id, participant_id, video_started_at, video_completed_at, response_text, completed_at, linked_user_id, xp_awarded_at";

// ---------------------------------------------------------------------------
// Manager: create training event + control-room snapshot
// ---------------------------------------------------------------------------

export type ManagerTrainingParticipant = {
  id: string;
  display_name: string;
  joined_at: string;
  training_status: ManagerRosterStatus;
};

export type ManagerTrainingSnapshot = {
  event: {
    id: string;
    title: string;
    status: FoundryEventStatus;
    content_type: "youtube";
    join_token: string;
    created_at: string;
    closed_at: string | null;
    training: {
      youtube_video_id: string;
      youtube_title: string | null;
      youtube_thumbnail_url: string;
      completion_prompt: string;
    } | null;
  };
  participants: ManagerTrainingParticipant[];
  joined_count: number;
  completed_count: number;
};

async function getContent(admin: SupabaseClient, eventId: string): Promise<ContentRow | null> {
  const { data } = await admin
    .from("foundry_event_training_content")
    .select("event_id, youtube_video_id, youtube_title, youtube_channel_title, youtube_thumbnail_url, completion_prompt, shared_question")
    .eq("event_id", eventId)
    .maybeSingle<ContentRow>();
  return data ?? null;
}

/**
 * Create a training event: validate the three fields, parse the canonical video
 * id, insert the event + content. If the content insert fails, the event row is
 * compensated (deleted) so no partial event is left behind.
 */
export async function createTrainingEvent(
  admin: SupabaseClient,
  ownerUserId: string,
  input: { title?: unknown; youtube_url?: unknown; completion_prompt?: unknown; shared_question?: unknown },
): Promise<ServiceResult<ManagerTrainingSnapshot>> {
  const title = validateEventTitle(input.title);
  if (!title.ok) return { ok: false, reason: title.reason };

  const videoId = parseYoutubeVideoId(input.youtube_url);
  if (!videoId) return { ok: false, reason: "youtube_url_invalid" };

  const prompt = validateCompletionPrompt(input.completion_prompt);
  if (!prompt.ok) return { ok: false, reason: prompt.reason };

  // Shared Understanding question (Slice 3.1B-3G) — OPTIONAL; NULL ⇒ no shared question.
  const sharedQ = validateSharedQuestionOptional(input.shared_question);
  if (!sharedQ.ok) return { ok: false, reason: sharedQ.reason };

  // Embeddability gate — BEFORE any insert, so a non-embeddable video creates NO
  // event/content rows (atomic). A video whose owner disabled embedding would
  // otherwise strand employees with IFrame error 101/150.
  const embed = await resolveYoutubeEmbeddable(videoId);
  if (!embedCheckAllowsCreate(embed)) return { ok: false, reason: embedCheckReason(embed) };

  const { data: event, error: evErr } = await admin
    .from("foundry_events")
    .insert({ owner_user_id: ownerUserId, title: title.value })
    .select("id")
    .single<{ id: string }>();
  if (evErr || !event) return { ok: false, reason: evErr?.message ?? "event_insert_failed" };

  const { error: contentErr } = await admin.from("foundry_event_training_content").insert({
    event_id: event.id,
    youtube_video_id: videoId,
    completion_prompt: prompt.value,
    shared_question: sharedQ.value,
  });
  if (contentErr) {
    // Compensate — never leave a training event without its content.
    await admin.from("foundry_events").delete().eq("id", event.id).eq("owner_user_id", ownerUserId);
    return { ok: false, reason: "content_insert_failed" };
  }

  const snapshot = await getOwnerTrainingSnapshot(admin, ownerUserId, event.id);
  if (!snapshot) return { ok: false, reason: "snapshot_failed" };
  return { ok: true, value: snapshot };
}

/** Owner control-room snapshot: base event + content + roster w/ training status + counts. */
export async function getOwnerTrainingSnapshot(
  admin: SupabaseClient,
  ownerUserId: string,
  eventId: string,
): Promise<ManagerTrainingSnapshot | null> {
  const base = await getOwnerEventSnapshot(admin, ownerUserId, eventId);
  if (!base) return null;

  const content = await getContent(admin, eventId);

  const { data: progress } = await admin
    .from("foundry_event_training_progress")
    .select("participant_id, video_started_at, video_completed_at, completed_at, xp_awarded_at")
    .eq("event_id", eventId)
    .returns<
      Pick<
        ProgressRow,
        "participant_id" | "video_started_at" | "video_completed_at" | "completed_at" | "xp_awarded_at"
      >[]
    >();

  const byParticipant = new Map<string, TrainingProgressMarkers>();
  for (const p of progress ?? []) {
    byParticipant.set(p.participant_id, {
      video_started_at: p.video_started_at,
      video_completed_at: p.video_completed_at,
      completed_at: p.completed_at,
      xp_awarded_at: p.xp_awarded_at,
    });
  }

  let completed = 0;
  const participants: ManagerTrainingParticipant[] = base.participants.map((p) => {
    const markers = byParticipant.get(p.id) ?? null;
    if (markers?.completed_at) completed += 1;
    return {
      id: p.id,
      display_name: p.display_name,
      joined_at: p.joined_at,
      training_status: projectManagerRosterStatus("joined", markers),
    };
  });

  return {
    event: {
      id: base.event.id,
      title: base.event.title,
      status: base.event.status,
      content_type: "youtube",
      join_token: base.event.join_token,
      created_at: base.event.created_at,
      closed_at: base.event.closed_at,
      training: content
        ? {
            youtube_video_id: content.youtube_video_id,
            youtube_title: content.youtube_title,
            youtube_thumbnail_url: content.youtube_thumbnail_url ?? youtubeThumbnailUrl(content.youtube_video_id),
            completion_prompt: content.completion_prompt,
          }
        : null,
    },
    participants,
    joined_count: participants.length,
    completed_count: completed,
  };
}

// ---------------------------------------------------------------------------
// Public: employee training progress
// ---------------------------------------------------------------------------

export type PublicXpStatus = "awarded" | "claimable" | "owner_ineligible" | "daily_limit" | "none";

export type PublicTrainingSnapshot = {
  event: { title: string; status: FoundryEventStatus } | null;
  participant: { display_name: string } | null;
  training: {
    youtube_video_id: string;
    completion_prompt: string | null;
    /** Shared Understanding question (Slice 3.1B-3G). null = no shared question OR not yet unlocked. */
    shared_question: string | null;
  } | null;
  stage: PublicTrainingStage;
  xp_status: PublicXpStatus;
};

async function getProgress(
  admin: SupabaseClient,
  eventId: string,
  participantId: string,
): Promise<ProgressRow | null> {
  const { data } = await admin
    .from("foundry_event_training_progress")
    .select(PROGRESS_COLS)
    .eq("event_id", eventId)
    .eq("participant_id", participantId)
    .maybeSingle<ProgressRow>();
  return data ?? null;
}

async function ensureProgress(
  admin: SupabaseClient,
  eventId: string,
  participantId: string,
): Promise<ProgressRow | null> {
  const existing = await getProgress(admin, eventId, participantId);
  if (existing) return existing;
  const { error } = await admin
    .from("foundry_event_training_progress")
    .insert({ event_id: eventId, participant_id: participantId });
  // On a unique-violation race, the row now exists — re-read either way.
  if (error && (error as { code?: string }).code !== "23505") return null;
  return getProgress(admin, eventId, participantId);
}

function markers(p: ProgressRow | null): TrainingProgressMarkers | null {
  if (!p) return null;
  return {
    video_started_at: p.video_started_at,
    video_completed_at: p.video_completed_at,
    completed_at: p.completed_at,
    xp_awarded_at: p.xp_awarded_at,
  };
}

/** Build the employee-facing snapshot from a resolved event + participant + progress. */
function buildPublicSnapshot(
  event: EventRow,
  participant: ParticipantRow | null,
  progress: ProgressRow | null,
  content: ContentRow | null,
  tokenVersionCurrent: boolean,
  xpOverride?: PublicXpStatus,
): PublicTrainingSnapshot {
  const hasParticipant = Boolean(participant);
  const stage = projectPublicTrainingStage({
    participantStatus: participant?.status ?? null,
    eventStatus: event.status,
    progress: markers(progress),
    hasParticipant,
  });

  // Pre-join on a stale (rotated) QR must not reveal the event.
  if (!hasParticipant && !tokenVersionCurrent) {
    return { event: null, participant: null, training: null, stage: "inactive", xp_status: "none" };
  }
  if (stage === "removed" || stage === "inactive") {
    return { event: null, participant: null, training: null, stage, xp_status: "none" };
  }

  const showVideo =
    stage === "watch" || stage === "response" || stage === "completed_awarded" || stage === "completed_claimable";
  const unlockedPrompt =
    stage === "response" || stage === "completed_awarded" || stage === "completed_claimable";

  const training =
    content && showVideo
      ? {
          youtube_video_id: content.youtube_video_id,
          completion_prompt: unlockedPrompt ? content.completion_prompt : null,
          // Shared Understanding question — surfaced with the completion prompt (same unlock gate).
          shared_question: unlockedPrompt ? content.shared_question : null,
        }
      : null;

  const derivedXp: PublicXpStatus = progress?.xp_awarded_at
    ? "awarded"
    : progress?.completed_at
      ? "claimable"
      : "none";
  // An award attempt can end owner_ineligible / daily_limit while completion is
  // valid — that outcome isn't derivable from timestamps, so the action overrides.
  const xp_status: PublicXpStatus = xpOverride ?? derivedXp;

  return {
    event: { title: event.title, status: event.status },
    participant: participant ? { display_name: participant.display_name } : null,
    training,
    stage,
    xp_status,
  };
}

/** Resolve event + participant for a public progress action. */
export async function resolvePublic(
  admin: SupabaseClient,
  token: string,
  sessionToken: string | null | undefined,
): Promise<
  | { ok: true; event: EventRow; participant: ParticipantRow; tokenVersionCurrent: boolean }
  | { ok: false; reason: string }
> {
  const resolved = await resolveEventByToken(admin, token);
  if (!resolved.ok) return { ok: false, reason: "inactive" };
  const participant = await findParticipantBySession(admin, resolved.event.id, sessionToken);
  if (!participant) return { ok: false, reason: "no_session" };
  if (participant.status === "removed") return { ok: false, reason: "removed" };
  return {
    ok: true,
    event: resolved.event,
    participant,
    tokenVersionCurrent: resolved.tokenVersion === resolved.event.join_version,
  };
}

/** The unified public snapshot for `/f/[token]` (pre-join and every training stage). */
export async function getPublicTrainingSnapshot(
  admin: SupabaseClient,
  token: string,
  sessionToken: string | null | undefined,
): Promise<PublicTrainingSnapshot> {
  const resolved = await resolveEventByToken(admin, token);
  if (!resolved.ok) {
    return { event: null, participant: null, training: null, stage: "inactive", xp_status: "none" };
  }
  const { event, tokenVersion } = resolved;
  const participant = await findParticipantBySession(admin, event.id, sessionToken);
  const progress = participant ? await getProgress(admin, event.id, participant.id) : null;
  const content = participant ? await getContent(admin, event.id) : null;

  if (participant) {
    void admin
      .from("foundry_event_participants")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", participant.id)
      .then(() => undefined, () => undefined);
  }

  return buildPublicSnapshot(event, participant, progress, content, tokenVersion === event.join_version);
}

async function snapshotFor(
  admin: SupabaseClient,
  event: EventRow,
  participant: ParticipantRow,
  xpOverride?: PublicXpStatus,
): Promise<PublicTrainingSnapshot> {
  const progress = await getProgress(admin, event.id, participant.id);
  const content = await getContent(admin, event.id);
  return buildPublicSnapshot(event, participant, progress, content, true, xpOverride);
}

/** Compute the caller's canonical BTY-day window [start, end) (05:00 user-local). */
async function btyDayWindow(admin: SupabaseClient, userId: string): Promise<{ start: string; end: string }> {
  const { timezone } = await resolveUserTzContext(admin, userId, null);
  const now = new Date();
  const start = userDayStartInstant(now, timezone, 5);
  const end = userDayStartInstant(new Date(start.getTime() + 86_400_000 + 1), timezone, 5);
  return { start: start.toISOString(), end: end.toISOString() };
}

export type ProgressResult =
  | { ok: true; snapshot: PublicTrainingSnapshot; assignmentClaim?: AssignmentClaimResult }
  | { ok: false; reason: string };

/** Mark the video started (once). */
export async function startVideo(
  admin: SupabaseClient,
  token: string,
  sessionToken: string | null | undefined,
): Promise<ProgressResult> {
  const r = await resolvePublic(admin, token, sessionToken);
  if (!r.ok) return { ok: false, reason: r.reason };
  const prog = await ensureProgress(admin, r.event.id, r.participant.id);
  if (!prog) return { ok: false, reason: "progress_failed" };
  if (!prog.video_started_at) {
    await admin
      .from("foundry_event_training_progress")
      .update({ video_started_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", prog.id)
      .is("video_started_at", null);
  }
  return { ok: true, snapshot: await snapshotFor(admin, r.event, r.participant) };
}

/** Mark the video completed (once) — this is what unlocks the response, not XP. */
export async function completeVideo(
  admin: SupabaseClient,
  token: string,
  sessionToken: string | null | undefined,
): Promise<ProgressResult> {
  const r = await resolvePublic(admin, token, sessionToken);
  if (!r.ok) return { ok: false, reason: r.reason };
  const prog = await ensureProgress(admin, r.event.id, r.participant.id);
  if (!prog) return { ok: false, reason: "progress_failed" };
  if (!prog.video_completed_at) {
    const now = new Date().toISOString();
    await admin
      .from("foundry_event_training_progress")
      .update({
        video_completed_at: now,
        video_started_at: prog.video_started_at ?? now,
        updated_at: now,
      })
      .eq("id", prog.id)
      .is("video_completed_at", null);
  }
  return { ok: true, snapshot: await snapshotFor(admin, r.event, r.participant) };
}

export type AwardOutcome = "awarded" | "already_awarded" | "owner_ineligible" | "daily_limit";

/** Map an award outcome to the public xp_status the client renders. */
export function outcomeToXpStatus(outcome: AwardOutcome): PublicXpStatus {
  if (outcome === "owner_ineligible") return "owner_ineligible";
  if (outcome === "daily_limit") return "daily_limit";
  return "awarded"; // awarded | already_awarded (via this or another participant)
}

/**
 * Award 10 Core XP through the integrity gate:
 *  - the event OWNER never earns XP from their own event (owner_ineligible),
 *  - one award per (user, event), one per completion, max 3 per canonical BTY day,
 *    all enforced race-safely in the SECURITY DEFINER RPC (advisory-locked),
 *  - the authoritative total + avatar bump stays in the canonical applyDirectCoreXp,
 *    called ONLY on a fresh 'awarded' result.
 * Never writes an XP total directly; never logs identifiers.
 */
export async function awardTrainingCoreXp(
  admin: SupabaseClient,
  userId: string,
  eventId: string,
  ownerUserId: string,
  progressId: string,
): Promise<AwardOutcome> {
  if (userId === ownerUserId) return "owner_ineligible";

  const window = await btyDayWindow(admin, userId);
  const { data, error } = await admin.rpc("bty_foundry_award_daily_capped", {
    p_user_id: userId,
    p_event_id: eventId,
    p_source_id: progressId,
    p_xp: FOUNDRY_TRAINING_XP,
    p_day_start: window.start,
    p_day_end: window.end,
    p_max_per_day: 3,
  });

  if (error) return "already_awarded"; // fail-safe: never double-award on RPC error
  const result = String(data);

  if (result === "awarded") {
    // Fresh ledger row committed atomically — now bump the authoritative total + avatar.
    const bump = await applyDirectCoreXp(admin, userId, FOUNDRY_TRAINING_XP);
    if ("error" in bump) {
      // Ledger row exists (XP is audited); total bump can be reconciled — treat as awarded.
      return "awarded";
    }
    return "awarded";
  }
  if (result === "daily_limit") return "daily_limit";
  // already_awarded | event_already_awarded → the user already holds this event's XP
  return "already_awarded";
}

/**
 * Submit the completion response. Server-gated: requires the video to be
 * server-marked complete; rejects if the event is closed and not already
 * complete; idempotent (a second submit returns the existing result). If the
 * caller has an authenticated BTY session, Core XP is awarded immediately;
 * otherwise completion is recorded and XP is left claimable.
 */
export async function completeTraining(
  admin: SupabaseClient,
  token: string,
  sessionToken: string | null | undefined,
  rawResponse: unknown,
  authUserId: string | null,
  rawSharedResponse?: unknown,
): Promise<ProgressResult> {
  const r = await resolvePublic(admin, token, sessionToken);
  if (!r.ok) return { ok: false, reason: r.reason };

  const prog = await ensureProgress(admin, r.event.id, r.participant.id);
  if (!prog) return { ok: false, reason: "progress_failed" };

  // Already complete → idempotent (do not re-award, do not overwrite the response).
  if (prog.completed_at) return { ok: true, snapshot: await snapshotFor(admin, r.event, r.participant) };

  if (r.event.status === "closed") return { ok: false, reason: "event_closed" };
  if (!prog.video_completed_at) return { ok: false, reason: "video_not_complete" };

  // response_text = PRIVATE Reflection (unchanged, never Host-visible). Still required today.
  const response = validateResponse(rawResponse);
  if (!response.ok) return { ok: false, reason: response.reason };

  // Shared Understanding (Slice 3.1B-3G): required ONLY when the module has a shared_question.
  // Written to a SEPARATE column with a NOT_REVIEWED status; never conflated with response_text.
  const { data: content } = await admin
    .from("foundry_event_training_content")
    .select("shared_question")
    .eq("event_id", r.event.id)
    .maybeSingle<{ shared_question: string | null }>();
  const shared = resolveSharedResponse(content?.shared_question ?? null, rawSharedResponse);
  if (!shared.ok) return { ok: false, reason: shared.reason };

  const now = new Date().toISOString();
  const sharedWrite = shared.value
    ? { shared_understanding_response: shared.value, shared_response_submitted_at: now, host_review_status: "NOT_REVIEWED" }
    : {};
  const { data: updated } = await admin
    .from("foundry_event_training_progress")
    .update({ response_text: response.value, completed_at: now, updated_at: now, ...sharedWrite })
    .eq("id", prog.id)
    .is("completed_at", null)
    .select(PROGRESS_COLS)
    .maybeSingle<ProgressRow>();

  const progressId = updated?.id ?? prog.id;

  // Immediate award for an authenticated participant (owner excluded, capped).
  let xpOverride: PublicXpStatus | undefined;
  if (authUserId) {
    const outcome = await awardTrainingCoreXp(admin, authUserId, r.event.id, r.event.owner_user_id, progressId);
    if (outcome === "awarded") {
      await admin
        .from("foundry_event_training_progress")
        .update({ linked_user_id: authUserId, xp_awarded_at: new Date().toISOString() })
        .eq("id", progressId)
        .is("xp_awarded_at", null);
    }
    xpOverride = outcomeToXpStatus(outcome);
  }

  return { ok: true, snapshot: await snapshotFor(admin, r.event, r.participant, xpOverride) };
}

/**
 * Claim XP after an anonymous completion, once the participant authenticates.
 * Requires a completed progress row for this session; idempotent; awards via the
 * same canonical path; allowed even after the event is closed.
 */
export async function claimXp(
  admin: SupabaseClient,
  token: string,
  sessionToken: string | null | undefined,
  authUserId: string,
): Promise<ProgressResult> {
  const r = await resolvePublic(admin, token, sessionToken);
  if (!r.ok) return { ok: false, reason: r.reason };

  const prog = await getProgress(admin, r.event.id, r.participant.id);
  if (!prog || !prog.completed_at) return { ok: false, reason: "not_completed" };

  // Slice 3.1B-3D (fix): connect the assignment on EVERY completed claim-xp call, BEFORE the
  // XP early-return. The claim is idempotent (already_claimed is a no-op), so this is safe
  // and RETRIABLE — the earlier bug attempted it only on the XP-awarding call, so if XP was
  // already awarded (e.g. a prior/auto claim) the assignment was never connected.
  const assignmentClaim = await claimAssignmentForParticipant(admin, r.event.id, r.participant.id, authUserId);

  if (prog.xp_awarded_at) {
    return { ok: true, snapshot: await snapshotFor(admin, r.event, r.participant, "awarded"), assignmentClaim };
  }

  const outcome = await awardTrainingCoreXp(admin, authUserId, r.event.id, r.event.owner_user_id, prog.id);
  if (outcome === "awarded") {
    await admin
      .from("foundry_event_training_progress")
      .update({ linked_user_id: authUserId, xp_awarded_at: new Date().toISOString() })
      .eq("id", prog.id)
      .is("xp_awarded_at", null);
  }

  return {
    ok: true,
    snapshot: await snapshotFor(admin, r.event, r.participant, outcomeToXpStatus(outcome)),
    assignmentClaim,
  };
}
