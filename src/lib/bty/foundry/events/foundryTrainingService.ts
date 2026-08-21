import type { SupabaseClient } from "@supabase/supabase-js";
import { isParticipantAccountCompatible, mayAttributeToAccount } from "@/domain/foundry/events/participant-account";
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
  resolveDecisionResponse,
  requiredLearnerReflection,
  resolveReflectionResponse,
} from "@/domain/foundry/events/foundry-training";
import { parseYoutubeVideoId, youtubeThumbnailUrl } from "@/domain/foundry/youtube";
import { programIdForNewRun, programErrorReason, type ProgramLineage } from "./foundryProgramService";
import { journeyActionDecision, journeyReflection, toPublicJourney, type PublicJourney, type RealityGroundedJourneyV1 } from "@/domain/foundry/module/journey";
import {
  resolveYoutubeEmbeddable,
  embedCheckAllowsCreate,
  embedCheckReason,
} from "./youtubeEmbed";
import { applyDirectCoreXp } from "@/lib/bty/arena/applyCoreXp";
import { claimAssignmentForParticipant, type AssignmentClaimResult } from "./foundryAssignmentPublishService";
import { materializeFollowupObligation } from "./foundryFollowupService";
import { materializeApplyWindow } from "./foundryApplyWindowService";
import { publishedPracticeForEvent } from "@/lib/bty/foundry/arena/foundryArenaPracticeRunService";
import { resolveUserTzContext } from "@/lib/bty/daily/userDay";
import { isFollowUpDays, type FollowUpDays } from "@/domain/foundry/followup/followUpObligation";
import { userDayStartInstant } from "@/domain/daily/userDayStartInstant";
import { participantDraftNamespace } from "./participant-draft-namespace";
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
  lineage?: ProgramLineage,
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

  // Program Run lineage (Slice 3.2C, fail-closed 3.2C-R1). Guided publish passes
  // the draft's identity (as-is, incl. null for a legacy draft — never throws);
  // Quick/direct create resolves a FRESH Program and FAILS CLOSED before any event
  // row if the canonical org is unresolvable.
  let programId: string | null;
  try {
    programId = await programIdForNewRun(admin, ownerUserId, title.value, lineage);
  } catch (e) {
    return { ok: false, reason: programErrorReason(e) };
  }
  // Only a Program THIS call minted (Quick create) is compensated on failure; a
  // Guided-publish lineage program is owned by its draft and must never be deleted.
  const createdProgram = lineage === undefined && programId != null;

  const { data: event, error: evErr } = await admin
    .from("foundry_events")
    .insert({ owner_user_id: ownerUserId, title: title.value, program_id: programId })
    .select("id")
    .single<{ id: string }>();
  if (evErr || !event) {
    if (createdProgram && programId) {
      await admin.from("foundry_programs").delete().eq("id", programId).eq("owner_user_id_snapshot", ownerUserId);
    }
    return { ok: false, reason: evErr?.message ?? "event_insert_failed" };
  }

  const { error: contentErr } = await admin.from("foundry_event_training_content").insert({
    event_id: event.id,
    youtube_video_id: videoId,
    completion_prompt: prompt.value,
    shared_question: sharedQ.value,
  });
  if (contentErr) {
    // Compensate — never leave a training event without its content (or an orphan Program).
    await admin.from("foundry_events").delete().eq("id", event.id).eq("owner_user_id", ownerUserId);
    if (createdProgram && programId) {
      await admin.from("foundry_programs").delete().eq("id", programId).eq("owner_user_id_snapshot", ownerUserId);
    }
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
  /**
   * R4-R5C4A — an opaque, non-authenticating namespace for this participant's DEVICE-LOCAL
   * draft. It names a localStorage slot and nothing else: no route reads it, no route accepts
   * it, and it reveals neither the session token nor the account. See
   * `participant-draft-namespace.ts` for why the browser needed one at all.
   */
  participant: { display_name: string; draft_ns: string } | null;
  training: {
    youtube_video_id: string;
    completion_prompt: string | null;
    /** Shared Understanding question (Slice 3.1B-3G). null = no shared question OR not yet unlocked. */
    shared_question: string | null;
  } | null;
  stage: PublicTrainingStage;
  xp_status: PublicXpStatus;
  /** Reality-Grounded Journey V1 (Slice 3.2C-B3A) — ordered participant-facing content
   *  from the immutable module snapshot. null = legacy Run (no approved Journey) → the
   *  player falls back to the existing video/PDF + completion-question experience. */
  journey?: PublicJourney | null;
  /**
   * This event asks a DISTINCT reflection question, so the learner owes an answer to it before
   * completing (Slice 3.2R-R8B). Server-derived from the frozen event — the UI renders the
   * control from this flag and never decides for itself which questions an event asks. The
   * document path carries the identical field; one contract, both content types.
   */
  reflection_required?: boolean;
  /**
   * The practice built from THIS training, when one is published (Slice 3.2M-2).
   *
   * Title and id only — the doorway, not the content. The Arena route re-authorises on
   * entry, so this can never become a way in by itself. null = no practice exists, and the
   * completion screen stays exactly as it was rather than offering a dead end.
   */
  practice?: { id: string; title: string } | null;
  /**
   * The frozen follow-up checkpoint (Slice R4-R3B1) — 7, 30, or null when the Host asked for none.
   *
   * Present so the terminal screen can tell an anonymous learner what signing in actually does.
   * NOT private, NOT Host-only, and NOT an identity field: it is the Host's published intent about
   * this training, which the Journey's own "WHAT HAPPENS NEXT" section already states in prose on
   * the trainings that carry one. Read only once a participant is resolved, exactly like `journey`.
   */
  follow_up_days?: FollowUpDays | null;
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

/**
 * The approved participant Journey for an event, from the immutable module snapshot.
 * null when the event has no Journey-enabled module (legacy Run) → the player uses
 * the existing video/PDF + completion-question fallback. Never exposes grounding,
 * confirmation status, draft/program ids, or unresolved needs_confirmation content.
 */
export async function readEventJourney(
  admin: SupabaseClient,
  eventId: string,
): Promise<RealityGroundedJourneyV1 | undefined> {
  const { data } = await admin
    .from("foundry_event_module")
    .select("module_snapshot")
    .eq("event_id", eventId)
    .maybeSingle<{ module_snapshot: { realityGroundedJourneyV1?: RealityGroundedJourneyV1 } | null }>();
  return data?.module_snapshot?.realityGroundedJourneyV1;
}

/**
 * The frozen follow-up checkpoint, as the LEARNER's terminal screen needs it (Slice R4-R3B1).
 *
 * Asks `isFollowUpDays` — the SAME predicate `materializeFollowupObligation` asks before creating
 * an obligation — so the screen can never promise a check-in the writer would not create. R4-R3A-R1
 * is the reason this is stated once and imported: the follow-up question is answered by
 * `followUpDays` and by nothing else, and a second copy of that rule is how a read drifts from a
 * write. Never inferred from the Journey.
 *
 * Returns null for 0, absent, out-of-domain, or no module row at all.
 */
export async function readEventFollowUpDays(
  admin: SupabaseClient,
  eventId: string,
): Promise<FollowUpDays | null> {
  const { data } = await admin
    .from("foundry_event_module")
    .select("module_snapshot")
    .eq("event_id", eventId)
    .maybeSingle<{ module_snapshot: { followUpDays?: unknown } | null }>();
  const raw = data?.module_snapshot?.followUpDays;
  return isFollowUpDays(raw) ? raw : null;
}

async function getEventJourney(admin: SupabaseClient, eventId: string): Promise<PublicJourney | null> {
  const { data } = await admin
    .from("foundry_event_module")
    .select("module_snapshot")
    .eq("event_id", eventId)
    .maybeSingle<{ module_snapshot: { realityGroundedJourneyV1?: RealityGroundedJourneyV1 } | null }>();
  return toPublicJourney(data?.module_snapshot?.realityGroundedJourneyV1);
}

/** Build the employee-facing snapshot from a resolved event + participant + progress. */
function buildPublicSnapshot(
  event: EventRow,
  participant: ParticipantRow | null,
  progress: ProgressRow | null,
  content: ContentRow | null,
  tokenVersionCurrent: boolean,
  xpOverride?: PublicXpStatus,
  journey?: PublicJourney | null,
  practice?: { id: string; title: string } | null,
  followUpDays?: FollowUpDays | null,
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
    participant: participant
      ? { display_name: participant.display_name, draft_ns: participantDraftNamespace(participant.event_id, participant.id) }
      : null,
    training,
    stage,
    xp_status,
    // Journey shown alongside the content (same visibility gate as the video).
    journey: showVideo ? (journey ?? null) : null,
    /*
      Derived from the SAME projection the learner is shown (Slice 3.2R-R8B): if the reflection
      block is not on their screen, no answer to it can be owed. `requiredLearnerReflection` then
      applies the distinctness rule against the questions this event actually publishes.
    */
    reflection_required: Boolean(
      showVideo &&
        requiredLearnerReflection(
          journey?.elements.find((e) => e.kind === "reflection")?.content,
          content?.completion_prompt,
          content?.shared_question,
        ),
    ),
    /*
      The doorway to this training's own practice — offered only once the training is
      finished. Before that it would be an invitation to skip the thing they came for.
    */
    practice: progress?.completed_at ? (practice ?? null) : null,
    /*
      R4-R3B1 — what signing in is FOR. Same visibility gate as the journey: a pre-join viewer
      with a stale QR never reaches this line at all, and a resolved participant is the only
      reader. `null` means the Host asked for no checkpoint, and the screen must promise nothing.
    */
    follow_up_days: followUpDays ?? null,
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
  /** R4-R5C3A1 — server-derived caller, or null when anonymous. Optional: omitting it preserves today's behaviour exactly. */
  authUserId?: string | null,
): Promise<PublicTrainingSnapshot> {
  const resolved = await resolveEventByToken(admin, token);
  if (!resolved.ok) {
    return { event: null, participant: null, training: null, stage: "inactive", xp_status: "none" };
  }
  const { event, tokenVersion } = resolved;
  const resolvedParticipant = await findParticipantBySession(admin, event.id, sessionToken);
  /*
    ACCOUNT-SWITCH CONTAINMENT (R4-R5C3A1 §5). A participant bound to a DIFFERENT account is
    treated as ABSENT for this authenticated caller — the snapshot then reports the ordinary
    pre-join state and the learner joins as themselves. Nothing about P is mutated, deleted,
    re-linked or invalidated; it simply is not this caller's session. `authUserId` is optional,
    so every anonymous request and every existing caller behaves exactly as before, and a NULL
    participant is never a mismatch (that is the anonymous learner who signed in later).
  */
  const participant = isParticipantAccountCompatible(resolvedParticipant?.user_id, authUserId)
    ? resolvedParticipant
    : null;
  const progress = participant ? await getProgress(admin, event.id, participant.id) : null;
  const content = participant ? await getContent(admin, event.id) : null;

  if (participant) {
    void admin
      .from("foundry_event_participants")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", participant.id)
      .then(() => undefined, () => undefined);
  }

  const journey = participant ? await getEventJourney(admin, event.id) : null;
  const followUpDays = participant ? await readEventFollowUpDays(admin, event.id) : null;
  const practice = await publishedPracticeForEvent(admin, event.id);
  return buildPublicSnapshot(event, participant, progress, content, tokenVersion === event.join_version, undefined, journey, practice, followUpDays);
}

async function snapshotFor(
  admin: SupabaseClient,
  event: EventRow,
  participant: ParticipantRow,
  xpOverride?: PublicXpStatus,
): Promise<PublicTrainingSnapshot> {
  const progress = await getProgress(admin, event.id, participant.id);
  const content = await getContent(admin, event.id);
  const journey = await getEventJourney(admin, event.id);
  const followUpDays = await readEventFollowUpDays(admin, event.id);
  const practice = await publishedPracticeForEvent(admin, event.id);
  return buildPublicSnapshot(event, participant, progress, content, true, xpOverride, journey, practice, followUpDays);
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
 * IDENTITY IS NOT A REWARD (Slice 3.2M-2R1).
 *
 * `linked_user_id` used to be written only inside `if (outcome === "awarded")`, bundled with
 * `xp_awarded_at`. So a legitimate authenticated learner whose completion hit the daily cap,
 * or who owns the event, completed the training and the system then did not know who they
 * were — no practice doorway, no attribution, no PRACTICED. Reward eligibility was deciding
 * identity.
 *
 * The codebase already drew this line correctly one function down: the follow-up obligation
 * materializes for an authenticated completion "regardless of the XP outcome". This brings
 * `linked_user_id` to the same rule.
 *
 * First identified learner wins: the `.is(null)` guard makes it idempotent and means a second
 * account can never take over a row that already belongs to someone.
 */
export async function linkLearnerIdentity(
  admin: SupabaseClient,
  progressId: string,
  authUserId: string | null,
): Promise<void> {
  if (!authUserId || !progressId) return;
  await admin
    .from("foundry_event_training_progress")
    .update({ linked_user_id: authUserId })
    .eq("id", progressId)
    .is("linked_user_id", null);
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
  deviceTz?: string | null,
  rawDecisionResponse?: unknown,
  rawReflectionResponse?: unknown,
): Promise<ProgressResult> {
  const r = await resolvePublic(admin, token, sessionToken);
  if (!r.ok) return { ok: false, reason: r.reason };

  const prog = await ensureProgress(admin, r.event.id, r.participant.id);
  if (!prog) return { ok: false, reason: "progress_failed" };

  // Already complete → idempotent (do not re-award, do not overwrite the response).
  if (prog.completed_at) return { ok: true, snapshot: await snapshotFor(admin, r.event, r.participant) };

  if (r.event.status === "closed") return { ok: false, reason: "event_closed" };
  if (!prog.video_completed_at) return { ok: false, reason: "video_not_complete" };

  /*
    response_text = the answer to the COMPLETION CHECK (Slice 3.2R-R8B corrected what this was
    called). Private, never Host-visible, and still required by every event — including every
    legacy one, whose completion payload is unchanged in every respect.
  */
  const response = validateResponse(rawResponse);
  if (!response.ok) return { ok: false, reason: response.reason };

  // Shared Understanding (Slice 3.1B-3G): required ONLY when the module has a shared_question.
  // Written to a SEPARATE column with a NOT_REVIEWED status; never conflated with response_text.
  const { data: content } = await admin
    .from("foundry_event_training_content")
    .select("shared_question, completion_prompt")
    .eq("event_id", r.event.id)
    .maybeSingle<{ shared_question: string | null; completion_prompt: string | null }>();
  const shared = resolveSharedResponse(content?.shared_question ?? null, rawSharedResponse);
  if (!shared.ok) return { ok: false, reason: shared.reason };

  /*
    THE LEARNER'S OWN REFLECTION (Slice 3.2R-R8B).

    Read from the FROZEN published event, exactly like the decision below it, and by the SAME
    domain gate the document path uses. REFLECTED is one learner-evidence authority, so it may
    not come to mean two things depending on whether the material was a video or a PDF.
  */
  const journey = await readEventJourney(admin, r.event.id);
  const reflectionQuestion = requiredLearnerReflection(
    journeyReflection(journey),
    content?.completion_prompt,
    content?.shared_question,
  );
  const reflection = resolveReflectionResponse(reflectionQuestion, rawReflectionResponse);
  if (!reflection.ok) return { ok: false, reason: reflection.reason };

  /*
    THE LEARNER'S OWN DECISION (Slice 3.2M-1).

    Driven by the FROZEN published journey, never by the client: if the program the learner was
    actually shown contains a grounded `action_decision`, a decision of their own is required to
    complete. A training without one behaves exactly as before.
  */
  const actionDecision = journeyActionDecision(journey);
  const decision = resolveDecisionResponse(actionDecision, rawDecisionResponse);
  if (!decision.ok) return { ok: false, reason: decision.reason };

  const now = new Date().toISOString();
  const sharedWrite = shared.value
    ? { shared_understanding_response: shared.value, shared_response_submitted_at: now, host_review_status: "NOT_REVIEWED" }
    : {};
  // Written in the SAME conditional update as completion, so a retry cannot produce a second
  // decision and a decision can never exist without the completion it belongs to.
  const decisionWrite = decision.value
    ? { decision_response_text: decision.value, decision_submitted_at: now }
    : {};
  // Same rule, same update: the reflection is part of the completion or it does not exist. A
  // refusal above returns before this line, so a failed completion leaves no partial evidence.
  const reflectionWrite = reflection.value
    ? { learner_reflection_text: reflection.value, learner_reflection_submitted_at: now }
    : {};
  const { data: updated } = await admin
    .from("foundry_event_training_progress")
    .update({ response_text: response.value, completed_at: now, updated_at: now, ...sharedWrite, ...decisionWrite, ...reflectionWrite })
    .eq("id", prog.id)
    .is("completed_at", null)
    .select(PROGRESS_COLS)
    .maybeSingle<ProgressRow>();

  const progressId = updated?.id ?? prog.id;

  // Identity FIRST, and independent of what the reward turns out to be (Slice 3.2M-2R1).
  /*
    COMPLETION SAFETY BELT (Slice R4-R5C3A1 §7) — defence in depth.

    §5's containment means an incompatible participant should never reach a completion at all:
    the snapshot reports pre-join and the learner joins as themselves. This guard exists for the
    case that containment is bypassed — a direct API call, a race across a sign-out, a future
    caller that forgets to pass `authUserId`.

    It refuses ONE thing: attributing account-level consequences to an account that does not own
    this participant. It never refuses the completion itself. The learner's own row still gets
    `completed_at` and their answers — participant-level truth is always honoured, because the
    person really did finish the training.

    What is withheld when it fires: `linked_user_id`, Core XP, the follow-up obligation, the
    apply window, and the assignment claim — exactly the set that would otherwise create
    `participant.user_id = A` alongside `progress.linked_user_id = B`, or bind user B's
    assignment to user A's participant. The completion RESULT CONTRACT is unchanged, so no UI
    and no copy has to represent this state.
  */
  const accountLinkable = mayAttributeToAccount(r.participant.user_id, authUserId);
  const linkableUserId = accountLinkable ? authUserId : null;
  await linkLearnerIdentity(admin, progressId, linkableUserId);

  // Immediate award for an authenticated participant (owner excluded, capped).
  let xpOverride: PublicXpStatus | undefined;
  if (linkableUserId) {
    const outcome = await awardTrainingCoreXp(admin, linkableUserId, r.event.id, r.event.owner_user_id, progressId);
    if (outcome === "awarded") {
      await admin
        .from("foundry_event_training_progress")
        .update({ linked_user_id: linkableUserId, xp_awarded_at: new Date().toISOString() })
        .eq("id", progressId)
        .is("xp_awarded_at", null);
    }
    xpOverride = outcomeToXpStatus(outcome);
  }

  // Follow-up Obligation (Slice 3.1B-3K): an AUTHENTICATED completion has a durable learner
  // identity (authUserId) — materialize the obligation ONCE, regardless of the XP outcome (capped /
  // owner / already-awarded still get one). Anonymous completion (authUserId null) materializes
  // nothing here — it is created later at the authenticated claim. Fail-soft: never blocks completion.
  if (linkableUserId) {
    await materializeFollowupObligation(admin, {
      eventId: r.event.id,
      progressId,
      authUserId: linkableUserId,
      completedAtIso: now,
      deviceTz,
    });
    /*
      Apply Window (Slice 3.2R-R2) — the learner's own decision becomes live in real work.

      Materialized in the SAME authenticated branch and with the SAME fail-soft contract as the
      follow-up above it: the service re-derives every precondition from the frozen journey and
      the durable row, returns `skipped` when the training asked for no decision (which is every
      training on staging today), and can never block a truthful completion. Creating this row
      establishes DECIDED-adjacent context only — never APPLIED.
    */
    await materializeApplyWindow(admin, {
      eventId: r.event.id,
      progressId,
      authUserId: linkableUserId,
      completedAtIso: now,
      deviceTz,
    });

    /*
      ASSIGNMENT TRUTH IS A CONSEQUENCE OF COMPLETION (Slice R4-R5B1).

      Measured before this line existed: an authenticated assigned learner could finish a training
      and receive EVERY other durable consequence — `linked_user_id`, Core XP, the follow-up
      obligation, the apply window — while `foundry_event_assignments.status` stayed `assigned`.
      `bty_foundry_list_my_assignments` reads `a.status` directly with no progress fallback, so
      Required Learning kept offering `Start learning` for training the learner had completed.

      The claim ran ONLY inside the three `claim*Xp` functions, and a signed-in learner never
      reaches them: completion awards XP inline, the terminal stage is `completed_awarded`, and the
      claim control only renders at `completed_claimable`. So which room the Host happened to author
      decided whether the learner's assignment ever became true — the document client compensated
      with a browser effect, the video and guidance rooms did not.

      NOTHING NEW IS INVENTED HERE. `bty_foundry_claim_assignment` already row-locks, is idempotent
      (`already_claimed`), is conflict-safe against another participant (`claim_conflict`), writes
      its own audit row, and matches ONLY on `(event_id, user_id_snapshot)` — the participant id is
      recorded, never used to identify. Both match keys are already in scope and both are
      server-derived: `authUserId` from the session, `r.event.id` from the verified join token. The
      browser supplies neither.

      PLACED LAST, AND ONLY HERE. Inside `if (authUserId)` because an anonymous completion has no
      trusted identity to match on — it keeps its existing claim-time path unchanged. After the
      materializers because it is the same class of durable consequence and must not reorder them.
      An open-link event has no participation-mode row, so the RPC answers `not_applicable` and
      writes nothing; the return value is deliberately NOT surfaced — the completion result contract
      is unchanged, so this can never falsely report a transition that did not happen.

      It cannot fail the completion: the helper is fail-soft on an error answer AND, since this
      slice, on a rejection — the same posture the two materializers above it already state.
    */
    await claimAssignmentForParticipant(admin, r.event.id, r.participant.id, linkableUserId);
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
  deviceTz?: string | null,
): Promise<ProgressResult> {
  const r = await resolvePublic(admin, token, sessionToken);
  if (!r.ok) return { ok: false, reason: r.reason };

  /*
    SAFETY BELT ON THE CLAIM PATH TOO (R4-R5C3A1 §7). The same conflict is reachable here: a
    browser holding user A's participant cookie while user B is signed in. The canonical
    anonymous claim is untouched — an anonymous participant has `user_id` NULL, which is always
    compatible — so this refuses only a proven cross-account attribution.
  */
  if (!mayAttributeToAccount(r.participant.user_id, authUserId)) {
    return { ok: false, reason: "no_session" };
  }
  const prog = await getProgress(admin, r.event.id, r.participant.id);
  if (!prog || !prog.completed_at) return { ok: false, reason: "not_completed" };

  // Slice 3.1B-3D (fix): connect the assignment on EVERY completed claim-xp call, BEFORE the
  // XP early-return. The claim is idempotent (already_claimed is a no-op), so this is safe
  // and RETRIABLE — the earlier bug attempted it only on the XP-awarding call, so if XP was
  // already awarded (e.g. a prior/auto claim) the assignment was never connected.
  const assignmentClaim = await claimAssignmentForParticipant(admin, r.event.id, r.participant.id, authUserId);

  // Follow-up Obligation (Slice 3.1B-3K): an anonymous completion FIRST gains a durable learner
  // identity here — materialize the obligation ONCE, BEFORE the XP early-return (mirrors the
  // assignment claim), using the now-known authUserId + the frozen completed_at. Idempotent
  // (unique progress_id+checkpoint), so a repeated claim / already-awarded path never duplicates.
  await materializeFollowupObligation(admin, {
    eventId: r.event.id,
    progressId: prog.id,
    authUserId,
    completedAtIso: prog.completed_at,
    deviceTz,
  });

  /*
    Apply Window at CLAIM (Slice 3.2R-R2). An anonymous completion first gains a durable identity
    here, so this is where its window is created — using the FROZEN `prog.completed_at`, never the
    claim instant. A learner who claims a week late gets the window they earned on the day they
    decided, not a fresh seven days. Idempotent (unique progress_id), so a repeated claim is a no-op.
  */
  await materializeApplyWindow(admin, {
    eventId: r.event.id,
    progressId: prog.id,
    authUserId,
    completedAtIso: prog.completed_at,
    deviceTz,
  });

  // The claim is where an anonymous completion becomes an owned one — so it is exactly where
  // identity belongs, whatever the XP outcome then is (Slice 3.2M-2R1).
  await linkLearnerIdentity(admin, prog.id, authUserId);

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
