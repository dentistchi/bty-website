import type { SupabaseClient } from "@supabase/supabase-js";
import { validateEventTitle, type FoundryEventStatus } from "@/domain/foundry/events/foundry-event";
import {
  validateCompletionPrompt,
  validateResponse,
  projectManagerRosterStatus,
  projectPublicTrainingStage,
  type ManagerRosterStatus,
  type PublicTrainingStage,
  type TrainingProgressMarkers,
  FOUNDRY_TRAINING_XP,
} from "@/domain/foundry/events/foundry-training";
import { parseYoutubeVideoId, youtubeThumbnailUrl } from "@/domain/foundry/youtube";
import { applyDirectCoreXp } from "@/lib/bty/arena/applyCoreXp";
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
    .select("event_id, youtube_video_id, youtube_title, youtube_channel_title, youtube_thumbnail_url, completion_prompt")
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
  input: { title?: unknown; youtube_url?: unknown; completion_prompt?: unknown },
): Promise<ServiceResult<ManagerTrainingSnapshot>> {
  const title = validateEventTitle(input.title);
  if (!title.ok) return { ok: false, reason: title.reason };

  const videoId = parseYoutubeVideoId(input.youtube_url);
  if (!videoId) return { ok: false, reason: "youtube_url_invalid" };

  const prompt = validateCompletionPrompt(input.completion_prompt);
  if (!prompt.ok) return { ok: false, reason: prompt.reason };

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

export type PublicTrainingSnapshot = {
  event: { title: string; status: FoundryEventStatus } | null;
  participant: { display_name: string } | null;
  training: { youtube_video_id: string; completion_prompt: string | null } | null;
  stage: PublicTrainingStage;
  xp_status: "awarded" | "claimable" | "none";
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
        }
      : null;

  const xp_status: PublicTrainingSnapshot["xp_status"] = progress?.xp_awarded_at
    ? "awarded"
    : progress?.completed_at
      ? "claimable"
      : "none";

  return {
    event: { title: event.title, status: event.status },
    participant: participant ? { display_name: participant.display_name } : null,
    training,
    stage,
    xp_status,
  };
}

/** Resolve event + participant for a public progress action. */
async function resolvePublic(
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
): Promise<PublicTrainingSnapshot> {
  const progress = await getProgress(admin, event.id, participant.id);
  const content = await getContent(admin, event.id);
  return buildPublicSnapshot(event, participant, progress, content, true);
}

export type ProgressResult =
  | { ok: true; snapshot: PublicTrainingSnapshot }
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

/** Award (idempotent) via the canonical Core XP path. Never writes a total itself. */
async function awardTrainingCoreXp(
  admin: SupabaseClient,
  userId: string,
  progressId: string,
): Promise<{ awarded: boolean } | { error: string }> {
  const { error } = await admin.from("core_xp_ledger").insert({
    user_id: userId,
    delta_xp: FOUNDRY_TRAINING_XP,
    source_type: SOURCE_TYPE,
    source_id: progressId,
  });
  if (error) {
    // 23505 = the (source_type, source_id) row already exists → already awarded.
    if ((error as { code?: string }).code === "23505") return { awarded: false };
    return { error: error.message };
  }
  const res = await applyDirectCoreXp(admin, userId, FOUNDRY_TRAINING_XP);
  if ("error" in res) return { error: res.error };
  return { awarded: true };
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
): Promise<ProgressResult> {
  const r = await resolvePublic(admin, token, sessionToken);
  if (!r.ok) return { ok: false, reason: r.reason };

  const prog = await ensureProgress(admin, r.event.id, r.participant.id);
  if (!prog) return { ok: false, reason: "progress_failed" };

  // Already complete → idempotent (do not re-award, do not overwrite the response).
  if (prog.completed_at) return { ok: true, snapshot: await snapshotFor(admin, r.event, r.participant) };

  if (r.event.status === "closed") return { ok: false, reason: "event_closed" };
  if (!prog.video_completed_at) return { ok: false, reason: "video_not_complete" };

  const response = validateResponse(rawResponse);
  if (!response.ok) return { ok: false, reason: response.reason };

  const now = new Date().toISOString();
  const { data: updated } = await admin
    .from("foundry_event_training_progress")
    .update({ response_text: response.value, completed_at: now, updated_at: now })
    .eq("id", prog.id)
    .is("completed_at", null)
    .select(PROGRESS_COLS)
    .maybeSingle<ProgressRow>();

  const progressId = updated?.id ?? prog.id;

  // Immediate award for an authenticated participant.
  if (authUserId) {
    const award = await awardTrainingCoreXp(admin, authUserId, progressId);
    if (!("error" in award)) {
      await admin
        .from("foundry_event_training_progress")
        .update({ linked_user_id: authUserId, xp_awarded_at: new Date().toISOString() })
        .eq("id", progressId)
        .is("xp_awarded_at", null);
    }
    // On award error we still keep completion; XP stays claimable.
  }

  return { ok: true, snapshot: await snapshotFor(admin, r.event, r.participant) };
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
  if (prog.xp_awarded_at) return { ok: true, snapshot: await snapshotFor(admin, r.event, r.participant) };

  const award = await awardTrainingCoreXp(admin, authUserId, prog.id);
  if ("error" in award) return { ok: false, reason: "award_failed" };

  await admin
    .from("foundry_event_training_progress")
    .update({ linked_user_id: authUserId, xp_awarded_at: new Date().toISOString() })
    .eq("id", prog.id)
    .is("xp_awarded_at", null);

  return { ok: true, snapshot: await snapshotFor(admin, r.event, r.participant) };
}
