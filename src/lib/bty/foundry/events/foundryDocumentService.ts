import type { SupabaseClient } from "@supabase/supabase-js";
import { validateEventTitle, type FoundryEventStatus } from "@/domain/foundry/events/foundry-event";
import {
  validateCompletionPrompt,
  validateResponse,
  resolveSharedResponse,
  projectManagerRosterStatus,
  projectPublicTrainingStage,
  FOUNDRY_TRAINING_XP,
  type ManagerRosterStatus,
  type PublicTrainingStage,
  type TrainingProgressMarkers,
} from "@/domain/foundry/events/foundry-training";
import {
  validatePageCount,
  validateIntro,
  computeMinReadSeconds,
  mergeViewedPages,
  distinctViewedCount,
  isReadingRequirementMet,
  clampReadDeltaMs,
  sanitizeLastPage,
} from "@/domain/foundry/events/foundry-document";
import {
  getOwnerEventSnapshot,
  resolveEventByToken,
  findParticipantBySession,
  type EventRow,
  type ParticipantRow,
  type ServiceResult,
} from "./foundryEventService";
import {
  resolvePublic,
  awardTrainingCoreXp,
  outcomeToXpStatus,
  getOwnerTrainingSnapshot,
  type PublicXpStatus,
  type ManagerTrainingSnapshot,
} from "./foundryTrainingService";
import { deleteFoundryDocument } from "./documentStorage";
import { claimAssignmentForParticipant, type AssignmentClaimResult } from "./foundryAssignmentPublishService";
import { materializeFollowupObligation } from "./foundryFollowupService";

/**
 * Foundry PDF Study Room — service layer (the DOCUMENT content type).
 *
 * Converges on the SAME canonical spine as YouTube training: the same
 * foundry_events / foundry_event_participants rows, the same
 * foundry_event_training_progress row (document_* columns), and — crucially — the
 * SAME XP integrity path (`awardTrainingCoreXp` → bty_foundry_award_daily_capped
 * RPC → applyDirectCoreXp), attributed identically as
 * source_type='foundry_training_completion' / source_id=progress.id. No new event
 * table, no new completion table, no new XP ledger. Only the evidence gate
 * differs: reading participation (all pages + a page-aware minimum active time)
 * replaces watching. Reading progress is server-canonical; the client may report
 * but never awards completion or XP.
 */

type DocContentRow = {
  event_id: string;
  source_type: string;
  storage_bucket: string;
  storage_path: string;
  file_name: string | null;
  byte_size: number | null;
  page_count: number;
  min_read_seconds: number;
  intro: string | null;
  completion_prompt: string;
  shared_question: string | null;
};

const DOC_CONTENT_COLS =
  "event_id, source_type, storage_bucket, storage_path, file_name, byte_size, page_count, min_read_seconds, intro, completion_prompt, shared_question";

type DocProgressRow = {
  id: string;
  event_id: string;
  participant_id: string;
  video_completed_at: string | null;
  response_text: string | null;
  completed_at: string | null;
  linked_user_id: string | null;
  xp_awarded_at: string | null;
  document_last_page: number | null;
  document_pages_viewed: unknown;
  document_active_read_ms: number;
  document_read_completed_at: string | null;
};

const DOC_PROGRESS_COLS =
  "id, event_id, participant_id, video_completed_at, response_text, completed_at, linked_user_id, xp_awarded_at, document_last_page, document_pages_viewed, document_active_read_ms, document_read_completed_at";

async function getDocContent(admin: SupabaseClient, eventId: string): Promise<DocContentRow | null> {
  const { data } = await admin
    .from("foundry_event_document_content")
    .select(DOC_CONTENT_COLS)
    .eq("event_id", eventId)
    .maybeSingle<DocContentRow>();
  return data ?? null;
}

async function getDocProgress(
  admin: SupabaseClient,
  eventId: string,
  participantId: string,
): Promise<DocProgressRow | null> {
  const { data } = await admin
    .from("foundry_event_training_progress")
    .select(DOC_PROGRESS_COLS)
    .eq("event_id", eventId)
    .eq("participant_id", participantId)
    .maybeSingle<DocProgressRow>();
  return data ?? null;
}

async function ensureDocProgress(
  admin: SupabaseClient,
  eventId: string,
  participantId: string,
): Promise<DocProgressRow | null> {
  const existing = await getDocProgress(admin, eventId, participantId);
  if (existing) return existing;
  const { error } = await admin
    .from("foundry_event_training_progress")
    .insert({ event_id: eventId, participant_id: participantId });
  // On a unique-violation race the row now exists — re-read either way.
  if (error && (error as { code?: string }).code !== "23505") return null;
  return getDocProgress(admin, eventId, participantId);
}

/** Progress markers for the projections — includes the reading-gate signals. */
function docMarkers(p: DocProgressRow | null): TrainingProgressMarkers | null {
  if (!p) return null;
  const readStarted = p.document_last_page != null || (p.document_active_read_ms ?? 0) > 0;
  return {
    video_started_at: null,
    video_completed_at: null,
    completed_at: p.completed_at,
    xp_awarded_at: p.xp_awarded_at,
    document_read_started: readStarted,
    document_read_completed_at: p.document_read_completed_at,
  };
}

// ---------------------------------------------------------------------------
// Manager: create document event + control-room snapshot
// ---------------------------------------------------------------------------

export type ManagerDocumentParticipant = {
  id: string;
  display_name: string;
  joined_at: string;
  training_status: ManagerRosterStatus;
};

export type ManagerDocumentSnapshot = {
  event: {
    id: string;
    title: string;
    status: FoundryEventStatus;
    content_type: "document";
    join_token: string;
    created_at: string;
    closed_at: string | null;
    document: {
      source_type: string;
      file_name: string | null;
      page_count: number;
      min_read_seconds: number;
      intro: string | null;
      completion_prompt: string;
    } | null;
  };
  participants: ManagerDocumentParticipant[];
  joined_count: number;
  completed_count: number;
};

export type CreateDocumentInput = {
  title?: unknown;
  intro?: unknown;
  completion_prompt?: unknown;
  /**
   * Server-verified canonical document — produced by the upload route from the
   * actual bytes and carried in a signed staging ticket (verified by the route
   * before this call). NONE of these are client-authoritative.
   */
  canonical: {
    bucket: string;
    path: string;
    byteSize: number;
    pageCount: number;
    pageCountVerified: boolean;
    contentHash: string;
    fileName: string | null;
    sourceType: "uploaded_pdf" | "google_drive";
    originalFileId: string | null;
  };
};

/**
 * Delete a staged object ONLY when it is safe: it must be under this host's own
 * path prefix AND not already attached to any created event. This guarantees a
 * cleanup can never remove another host's object or a document that is live on a
 * successfully created event (e.g. a retried creation).
 */
async function deleteStagedUploadIfSafe(
  admin: SupabaseClient,
  ownerUserId: string,
  bucket: string,
  path: string,
): Promise<void> {
  if (!path.startsWith(`${ownerUserId}/`)) return; // never touch a non-own-prefix object
  const { data } = await admin
    .from("foundry_event_document_content")
    .select("event_id")
    .eq("storage_path", path)
    .maybeSingle<{ event_id: string }>();
  if (data) return; // already attached to an event → must not delete
  await deleteFoundryDocument(admin, bucket, path);
}

/**
 * Create a PDF Study Room from a SERVER-VERIFIED canonical document (the upload
 * route already inspected the bytes and signed the values). Validate the text
 * fields; if anything is invalid or the inserts fail, the orphan staged object is
 * cleaned up (only if safe) so a failed creation leaves no partial event AND no
 * stranded file — but never removes another host's or an attached object.
 */
export async function createDocumentEvent(
  admin: SupabaseClient,
  ownerUserId: string,
  input: CreateDocumentInput,
): Promise<ServiceResult<ManagerDocumentSnapshot>> {
  const c = input.canonical;

  // Defense in depth: the ticket already bound the path to this owner, but a path
  // not under this owner's prefix is rejected WITHOUT any delete (never our object).
  if (!c.path.startsWith(`${ownerUserId}/`)) {
    return { ok: false, reason: "upload_invalid" };
  }

  const cleanupUpload = () => deleteStagedUploadIfSafe(admin, ownerUserId, c.bucket, c.path);

  const title = validateEventTitle(input.title);
  if (!title.ok) {
    await cleanupUpload();
    return { ok: false, reason: title.reason };
  }
  // Canonical page count is server-derived; re-validate its bound defensively.
  const pageCount = validatePageCount(c.pageCount);
  if (!pageCount.ok) {
    await cleanupUpload();
    return { ok: false, reason: pageCount.reason };
  }
  const prompt = validateCompletionPrompt(input.completion_prompt);
  if (!prompt.ok) {
    await cleanupUpload();
    return { ok: false, reason: prompt.reason };
  }
  const intro = validateIntro(input.intro);
  if (!intro.ok) {
    await cleanupUpload();
    return { ok: false, reason: intro.reason };
  }

  const minReadSeconds = computeMinReadSeconds(pageCount.value);

  const { data: event, error: evErr } = await admin
    .from("foundry_events")
    .insert({ owner_user_id: ownerUserId, title: title.value, content_type: "document" })
    .select("id")
    .single<{ id: string }>();
  if (evErr || !event) {
    await cleanupUpload();
    return { ok: false, reason: evErr?.message ?? "event_insert_failed" };
  }

  const { error: contentErr } = await admin.from("foundry_event_document_content").insert({
    event_id: event.id,
    source_type: c.sourceType,
    original_file_id: c.originalFileId,
    content_hash: c.contentHash,
    storage_bucket: c.bucket,
    storage_path: c.path,
    file_name: c.fileName,
    byte_size: c.byteSize,
    page_count: pageCount.value,
    page_count_verified: c.pageCountVerified,
    min_read_seconds: minReadSeconds,
    intro: intro.value,
    completion_prompt: prompt.value,
  });
  if (contentErr) {
    // Compensate — never leave a document event without its content or a stranded file.
    await admin.from("foundry_events").delete().eq("id", event.id).eq("owner_user_id", ownerUserId);
    await cleanupUpload();
    return { ok: false, reason: "content_insert_failed" };
  }

  const snapshot = await getOwnerDocumentSnapshot(admin, ownerUserId, event.id);
  if (!snapshot) return { ok: false, reason: "snapshot_failed" };
  return { ok: true, value: snapshot };
}

/**
 * Content-type-aware owner control-room snapshot. Resolves the event's
 * content_type (owner-scoped) and returns the matching manager snapshot so the
 * control room (and its poll) always sees the right shape — YouTube training or
 * PDF document — both carrying event.content_type + join_token. Returns null if
 * the event is not owned by the caller (route → non-disclosing 404).
 */
export async function getOwnerRoomSnapshot(
  admin: SupabaseClient,
  ownerUserId: string,
  eventId: string,
): Promise<ManagerTrainingSnapshot | ManagerDocumentSnapshot | null> {
  const { data } = await admin
    .from("foundry_events")
    .select("content_type")
    .eq("id", eventId)
    .eq("owner_user_id", ownerUserId)
    .maybeSingle<{ content_type: string | null }>();
  if (!data) return null;
  if (data.content_type === "document") return getOwnerDocumentSnapshot(admin, ownerUserId, eventId);
  return getOwnerTrainingSnapshot(admin, ownerUserId, eventId);
}

/** Owner control-room snapshot: base event + document meta + roster + counts. */
export async function getOwnerDocumentSnapshot(
  admin: SupabaseClient,
  ownerUserId: string,
  eventId: string,
): Promise<ManagerDocumentSnapshot | null> {
  const base = await getOwnerEventSnapshot(admin, ownerUserId, eventId);
  if (!base) return null;

  const content = await getDocContent(admin, eventId);

  const { data: progress } = await admin
    .from("foundry_event_training_progress")
    .select(
      "participant_id, completed_at, xp_awarded_at, document_last_page, document_active_read_ms, document_read_completed_at",
    )
    .eq("event_id", eventId)
    .returns<
      {
        participant_id: string;
        completed_at: string | null;
        xp_awarded_at: string | null;
        document_last_page: number | null;
        document_active_read_ms: number | null;
        document_read_completed_at: string | null;
      }[]
    >();

  const byParticipant = new Map<string, TrainingProgressMarkers>();
  for (const p of progress ?? []) {
    byParticipant.set(p.participant_id, {
      video_started_at: null,
      video_completed_at: null,
      completed_at: p.completed_at,
      xp_awarded_at: p.xp_awarded_at,
      document_read_started: p.document_last_page != null || (p.document_active_read_ms ?? 0) > 0,
      document_read_completed_at: p.document_read_completed_at,
    });
  }

  let completed = 0;
  const participants: ManagerDocumentParticipant[] = base.participants.map((p) => {
    const markers = byParticipant.get(p.id) ?? null;
    if (markers?.completed_at) completed += 1;
    return {
      id: p.id,
      display_name: p.display_name,
      joined_at: p.joined_at,
      training_status: projectManagerRosterStatus("joined", markers, "document"),
    };
  });

  return {
    event: {
      id: base.event.id,
      title: base.event.title,
      status: base.event.status,
      content_type: "document",
      join_token: base.event.join_token,
      created_at: base.event.created_at,
      closed_at: base.event.closed_at,
      document: content
        ? {
            source_type: content.source_type,
            file_name: content.file_name,
            page_count: content.page_count,
            min_read_seconds: content.min_read_seconds,
            intro: content.intro,
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
// Public: participant reading progress + completion
// ---------------------------------------------------------------------------

export type PublicDocumentSnapshot = {
  content_type: "document";
  event: { title: string; status: FoundryEventStatus } | null;
  participant: { display_name: string } | null;
  document: {
    page_count: number;
    min_read_seconds: number;
    intro: string | null;
    last_page: number | null;
    distinct_pages_viewed: number;
    active_read_ms: number;
    reading_complete: boolean;
    completion_prompt: string | null;
    /** Shared Understanding question (Slice 3.1B-3G). null = none OR not yet unlocked. */
    shared_question: string | null;
  } | null;
  stage: PublicTrainingStage;
  xp_status: PublicXpStatus;
};

function buildDocumentSnapshot(
  event: EventRow,
  participant: ParticipantRow | null,
  progress: DocProgressRow | null,
  content: DocContentRow | null,
  tokenVersionCurrent: boolean,
  xpOverride?: PublicXpStatus,
): PublicDocumentSnapshot {
  const hasParticipant = Boolean(participant);
  const stage = projectPublicTrainingStage({
    participantStatus: participant?.status ?? null,
    eventStatus: event.status,
    progress: docMarkers(progress),
    hasParticipant,
    contentType: "document",
  });

  // Pre-join on a stale (rotated) QR must not reveal the event.
  if (!hasParticipant && !tokenVersionCurrent) {
    return { content_type: "document", event: null, participant: null, document: null, stage: "inactive", xp_status: "none" };
  }
  if (stage === "removed" || stage === "inactive") {
    return { content_type: "document", event: null, participant: null, document: null, stage, xp_status: "none" };
  }

  const showDoc =
    stage === "read" || stage === "response" || stage === "completed_awarded" || stage === "completed_claimable";
  const unlockedPrompt =
    stage === "response" || stage === "completed_awarded" || stage === "completed_claimable";

  const pageCount = content?.page_count ?? 0;
  const distinct = distinctViewedCount(progress?.document_pages_viewed, pageCount);

  const document =
    content && showDoc
      ? {
          page_count: content.page_count,
          min_read_seconds: content.min_read_seconds,
          intro: content.intro,
          last_page: progress?.document_last_page ?? null,
          distinct_pages_viewed: distinct,
          active_read_ms: progress?.document_active_read_ms ?? 0,
          reading_complete: Boolean(progress?.document_read_completed_at),
          completion_prompt: unlockedPrompt ? content.completion_prompt : null,
          shared_question: unlockedPrompt ? content.shared_question : null,
        }
      : null;

  const derivedXp: PublicXpStatus = progress?.xp_awarded_at
    ? "awarded"
    : progress?.completed_at
      ? "claimable"
      : "none";
  const xp_status: PublicXpStatus = xpOverride ?? derivedXp;

  return {
    content_type: "document",
    event: { title: event.title, status: event.status },
    participant: participant ? { display_name: participant.display_name } : null,
    document,
    stage,
    xp_status,
  };
}

async function docSnapshotFor(
  admin: SupabaseClient,
  event: EventRow,
  participant: ParticipantRow,
  xpOverride?: PublicXpStatus,
): Promise<PublicDocumentSnapshot> {
  const progress = await getDocProgress(admin, event.id, participant.id);
  const content = await getDocContent(admin, event.id);
  return buildDocumentSnapshot(event, participant, progress, content, true, xpOverride);
}

/** The unified public snapshot for a DOCUMENT room (pre-join and every stage). */
export async function getPublicDocumentSnapshot(
  admin: SupabaseClient,
  token: string,
  sessionToken: string | null | undefined,
): Promise<PublicDocumentSnapshot> {
  const resolved = await resolveEventByToken(admin, token);
  if (!resolved.ok) {
    return { content_type: "document", event: null, participant: null, document: null, stage: "inactive", xp_status: "none" };
  }
  const { event, tokenVersion } = resolved;
  const participant = await findParticipantBySession(admin, event.id, sessionToken);
  const progress = participant ? await getDocProgress(admin, event.id, participant.id) : null;
  const content = participant ? await getDocContent(admin, event.id) : null;

  if (participant) {
    void admin
      .from("foundry_event_participants")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", participant.id)
      .then(() => undefined, () => undefined);
  }

  return buildDocumentSnapshot(event, participant, progress, content, tokenVersion === event.join_version);
}

/** Resolve + verify the caller is a joined participant, then mint a signed read url. */
export async function resolveDocumentForRead(
  admin: SupabaseClient,
  token: string,
  sessionToken: string | null | undefined,
): Promise<{ ok: true; bucket: string; path: string } | { ok: false; reason: string }> {
  const r = await resolvePublic(admin, token, sessionToken);
  if (!r.ok) return { ok: false, reason: r.reason };
  const content = await getDocContent(admin, r.event.id);
  if (!content) return { ok: false, reason: "document_unavailable" };
  return { ok: true, bucket: content.storage_bucket, path: content.storage_path };
}

export type ReadingProgressInput = {
  last_page?: unknown;
  viewed_pages?: unknown;
  active_ms_delta?: unknown;
};

export type DocumentProgressResult =
  | { ok: true; snapshot: PublicDocumentSnapshot; assignmentClaim?: AssignmentClaimResult }
  | { ok: false; reason: string };

/**
 * Record a reading-progress heartbeat. Server-canonical: distinct viewed pages
 * are set-unioned (repeated viewing never inflates the count), active time is
 * accumulated from a per-beat CLAMPED delta (a client cannot fast-forward the
 * gate), and document_read_completed_at is set ONCE the deterministic gate is
 * met. The client reports; the server decides.
 */
export async function recordReadingProgress(
  admin: SupabaseClient,
  token: string,
  sessionToken: string | null | undefined,
  input: ReadingProgressInput,
): Promise<DocumentProgressResult> {
  const r = await resolvePublic(admin, token, sessionToken);
  if (!r.ok) return { ok: false, reason: r.reason };

  const content = await getDocContent(admin, r.event.id);
  if (!content) return { ok: false, reason: "document_unavailable" };

  const prog = await ensureDocProgress(admin, r.event.id, r.participant.id);
  if (!prog) return { ok: false, reason: "progress_failed" };

  // Already complete → do not churn reading state.
  if (prog.completed_at) return { ok: true, snapshot: await docSnapshotFor(admin, r.event, r.participant) };

  const pageCount = content.page_count;
  const mergedViewed = mergeViewedPages(prog.document_pages_viewed, input.viewed_pages, pageCount);
  const nextActiveMs = (prog.document_active_read_ms ?? 0) + clampReadDeltaMs(input.active_ms_delta);
  const nextLastPage = sanitizeLastPage(input.last_page, pageCount) ?? prog.document_last_page;

  const distinct = distinctViewedCount(mergedViewed, pageCount);
  const readMet = isReadingRequirementMet({
    pageCount,
    distinctViewed: distinct,
    activeReadMs: nextActiveMs,
    minReadSeconds: content.min_read_seconds,
  });
  const now = new Date().toISOString();
  const readCompletedAt = prog.document_read_completed_at ?? (readMet ? now : null);

  await admin
    .from("foundry_event_training_progress")
    .update({
      document_pages_viewed: mergedViewed,
      document_active_read_ms: nextActiveMs,
      document_last_page: nextLastPage,
      document_read_completed_at: readCompletedAt,
      updated_at: now,
    })
    .eq("id", prog.id);

  return { ok: true, snapshot: await docSnapshotFor(admin, r.event, r.participant) };
}

/**
 * Submit the reflection response and complete the room. Server-gated: requires
 * the reading requirement to be server-marked met; rejects a closed event;
 * idempotent (a second submit returns the existing result without re-award). If
 * authenticated, Core XP is awarded immediately through the shared canonical
 * path; otherwise completion is recorded and XP left claimable.
 */
export async function completeDocumentTraining(
  admin: SupabaseClient,
  token: string,
  sessionToken: string | null | undefined,
  rawResponse: unknown,
  authUserId: string | null,
  rawSharedResponse?: unknown,
  deviceTz?: string | null,
): Promise<DocumentProgressResult> {
  const r = await resolvePublic(admin, token, sessionToken);
  if (!r.ok) return { ok: false, reason: r.reason };

  const prog = await ensureDocProgress(admin, r.event.id, r.participant.id);
  if (!prog) return { ok: false, reason: "progress_failed" };

  // Already complete → idempotent (do not re-award, do not overwrite the response).
  if (prog.completed_at) return { ok: true, snapshot: await docSnapshotFor(admin, r.event, r.participant) };

  if (r.event.status === "closed") return { ok: false, reason: "event_closed" };
  if (!prog.document_read_completed_at) return { ok: false, reason: "reading_not_complete" };

  // response_text = PRIVATE Reflection (unchanged, never Host-visible). Still required today.
  const response = validateResponse(rawResponse);
  if (!response.ok) return { ok: false, reason: response.reason };

  // Shared Understanding (Slice 3.1B-3G): required ONLY when the module has a shared_question —
  // equivalent to the YouTube path. Separate column + NOT_REVIEWED status; response_text untouched.
  const { data: content } = await admin
    .from("foundry_event_document_content")
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
    .select(DOC_PROGRESS_COLS)
    .maybeSingle<DocProgressRow>();

  const progressId = updated?.id ?? prog.id;

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

  // Follow-up Obligation (Slice 3.1B-3K): materialize ONCE on an AUTHENTICATED document completion
  // (mirrors the YouTube path), regardless of XP outcome. Anonymous completion → nothing here.
  if (authUserId) {
    await materializeFollowupObligation(admin, {
      eventId: r.event.id,
      progressId,
      authUserId,
      completedAtIso: now,
      deviceTz,
    });
  }

  return { ok: true, snapshot: await docSnapshotFor(admin, r.event, r.participant, xpOverride) };
}

/** Claim XP after an anonymous document completion, once the participant authenticates. */
export async function claimDocumentXp(
  admin: SupabaseClient,
  token: string,
  sessionToken: string | null | undefined,
  authUserId: string,
  deviceTz?: string | null,
): Promise<DocumentProgressResult> {
  const r = await resolvePublic(admin, token, sessionToken);
  if (!r.ok) return { ok: false, reason: r.reason };

  const prog = await getDocProgress(admin, r.event.id, r.participant.id);
  if (!prog || !prog.completed_at) return { ok: false, reason: "not_completed" };

  // Slice 3.1B-3D (fix): connect the assignment on EVERY completed claim call, idempotently,
  // BEFORE the XP early-return — so a previously-awarded session still gets connected.
  const assignmentClaim = await claimAssignmentForParticipant(admin, r.event.id, r.participant.id, authUserId);

  // Follow-up Obligation (Slice 3.1B-3K): materialize ONCE at the authenticated claim (mirrors the
  // YouTube claim), BEFORE the XP early-return, idempotently. This is the anonymous→owned path.
  await materializeFollowupObligation(admin, {
    eventId: r.event.id,
    progressId: prog.id,
    authUserId,
    completedAtIso: prog.completed_at,
    deviceTz,
  });

  if (prog.xp_awarded_at) {
    return { ok: true, snapshot: await docSnapshotFor(admin, r.event, r.participant, "awarded"), assignmentClaim };
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
    snapshot: await docSnapshotFor(admin, r.event, r.participant, outcomeToXpStatus(outcome)),
    assignmentClaim,
  };
}
