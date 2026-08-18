import type { SupabaseClient } from "@supabase/supabase-js";
import { readContentType, isGuidanceContentType, type FoundryContentType, type GuidanceContentType } from "@/domain/foundry/events/content-type";
import { readGuidanceContent } from "./foundryGuidanceService";
import {
  projectManagerRosterStatus,
  type ManagerRosterStatus,
  type TrainingProgressMarkers,
} from "@/domain/foundry/events/foundry-training";
import {
  isHistoricalEventStatus,
  compareHistoryRecency,
} from "@/domain/foundry/events/foundry-history";

/**
 * Foundry Event History Archive — service layer (HOST-facing, read-only).
 *
 * A trustworthy factual record of *executed* Foundry Events, so an authorized
 * host can locate and review what actually happened. Distinct from the
 * participant-facing `foundryHistoryService` (a person's own completed trainings)
 * — this reads the events a HOST OWNS.
 *
 * Authorization: every function takes `ownerUserId` and scopes the query by
 * `owner_user_id`, so a guessed foreign event id can never disclose another
 * host's event (missing row => null => the route returns a non-disclosing 404).
 * All access is service-role (`admin`); the Host gate lives at the route.
 *
 * Qualification: only TERMINAL (`closed`) events are historical — the domain
 * (`foundry-history`) owns that rule; open events are current work and never
 * appear here.
 *
 * PRIVACY (non-negotiable): the view models NEVER carry individual reflection
 * bodies (`response_text` / `reflection`), participant session hashes, join
 * tokens, or storage object paths. The host sees COMPLETION status and factual
 * aggregate counts only — never a participant's private free-text, and never a
 * reusable credential. Every SELECT below lists only the safe columns.
 */

// ---------------------------------------------------------------------------
// Shapes (normalized view models — never raw rows)
// ---------------------------------------------------------------------------

/**
 * R4-R2G: the Host's history speaks the canonical four-type vocabulary, and `null` means the
 * stored discriminator is one this build does not know. It is NOT rendered as YouTube.
 */
export type HostHistoryContentType = FoundryContentType;

export type HostHistoryListItem = {
  eventId: string;
  title: string;
  /** Terminal status — `closed` in V1. */
  status: "closed";
  /** null = unrecognised stored discriminator (fail closed — never silently YouTube). */
  contentType: HostHistoryContentType | null;
  createdAt: string;
  /** The ended (terminal) timestamp — `closed_at`. Null only on legacy rows. */
  endedAt: string | null;
  /** Joined participants (canonical: participants.status = 'joined'). */
  participantCount: number;
  /** Completions (canonical: training_progress.completed_at IS NOT NULL). */
  completionCount: number;
};

export type HostHistoryParticipant = {
  id: string;
  displayName: string;
  joinedAt: string;
  /** Completion-only status — never response text. */
  status: ManagerRosterStatus;
};

export type HostHistoryMaterial =
  | { kind: "youtube"; title: string | null; videoId: string; completionPrompt: string }
  | {
      kind: "document";
      fileName: string | null;
      pageCount: number;
      sourceType: string;
      completionPrompt: string;
    }
  /** R4-R2G — the Host's own text, read from the immutable module snapshot (no content table). */
  | { kind: "written_guidance"; guidance: string; completionPrompt: string }
  | { kind: "live_discussion"; discussion: string; completionPrompt: string }
  /** The stored discriminator is not one this build knows. Never rendered as another type. */
  | { kind: "unknown" }
  | { kind: "none" };

export type HostHistoryDetail = {
  eventId: string;
  title: string;
  status: "closed";
  /** null = unrecognised stored discriminator (fail closed — never silently YouTube). */
  contentType: HostHistoryContentType | null;
  createdAt: string;
  endedAt: string | null;
  participantCount: number;
  completionCount: number;
  material: HostHistoryMaterial;
  participants: HostHistoryParticipant[];
};

// ---------------------------------------------------------------------------
// Row shapes (internal — never leaked to the client)
// ---------------------------------------------------------------------------

type HistoryEventRow = {
  id: string;
  title: string;
  status: string;
  content_type: string | null;
  created_at: string;
  closed_at: string | null;
};

// Only the columns needed to project completion — NO response_text, NO reflection.
type ProgressMarkerRow = {
  participant_id: string;
  video_started_at: string | null;
  video_completed_at: string | null;
  completed_at: string | null;
  xp_awarded_at: string | null;
  document_last_page: number | null;
  document_active_read_ms: number | null;
  document_read_completed_at: string | null;
  /** R4-R2G — the two learner-declared exposure stamps. */
  written_guidance_read_at: string | null;
  discussion_self_reported_at: string | null;
};

const HISTORY_EVENT_COLS = "id, title, status, content_type, created_at, closed_at";
const PROGRESS_MARKER_COLS =
  "participant_id, video_started_at, video_completed_at, completed_at, xp_awarded_at, document_last_page, document_active_read_ms, document_read_completed_at, written_guidance_read_at, discussion_self_reported_at";

/**
 * R4-R2G — was `raw === "document" ? "document" : "youtube"`, which turned every value it did
 * not recognise into YouTube. The authority distinguishes an absent FIELD (legacy read shape →
 * the column default) from an unrecognised VALUE (→ null, fail closed).
 */
function normalizeContentType(raw: string | null | undefined): HostHistoryContentType | null {
  return readContentType(raw);
}

function toMarkers(row: ProgressMarkerRow): TrainingProgressMarkers {
  return {
    video_started_at: row.video_started_at,
    video_completed_at: row.video_completed_at,
    completed_at: row.completed_at,
    xp_awarded_at: row.xp_awarded_at,
    document_read_started:
      row.document_last_page != null || (row.document_active_read_ms ?? 0) > 0,
    written_guidance_read_at: row.written_guidance_read_at,
    discussion_self_reported_at: row.discussion_self_reported_at,
    document_read_completed_at: row.document_read_completed_at,
  };
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

/**
 * The host's historical (terminal) events, most-recently-ended first. Owner-
 * scoped and status-filtered to terminal in the query; the in-memory sort applies
 * the canonical deterministic recency order (ended desc → created desc → id asc).
 * Counts come from the canonical participant/progress tables. Returns [] when the
 * host has none or the admin client is unavailable.
 */
export async function listHostHistory(
  admin: SupabaseClient,
  ownerUserId: string,
): Promise<HostHistoryListItem[]> {
  if (!ownerUserId) return [];

  const { data: events } = await admin
    .from("foundry_events")
    .select(HISTORY_EVENT_COLS)
    .eq("owner_user_id", ownerUserId)
    .eq("status", "closed")
    .order("closed_at", { ascending: false, nullsFirst: false })
    .returns<HistoryEventRow[]>();

  const historical = (events ?? []).filter((e) => isHistoricalEventStatus(e.status));
  if (historical.length === 0) return [];

  const ids = historical.map((e) => e.id);

  // Joined participant counts (canonical) — count only, no PII selected.
  const { data: parts } = await admin
    .from("foundry_event_participants")
    .select("event_id, status")
    .in("event_id", ids)
    .eq("status", "joined")
    .returns<{ event_id: string; status: string }[]>();

  const joinedCounts = new Map<string, number>();
  for (const p of parts ?? []) joinedCounts.set(p.event_id, (joinedCounts.get(p.event_id) ?? 0) + 1);

  // Completion counts (canonical) — only event_id + completed_at, never response text.
  const { data: progress } = await admin
    .from("foundry_event_training_progress")
    .select("event_id, completed_at")
    .in("event_id", ids)
    .not("completed_at", "is", null)
    .returns<{ event_id: string; completed_at: string | null }[]>();

  const completionCounts = new Map<string, number>();
  for (const p of progress ?? [])
    completionCounts.set(p.event_id, (completionCounts.get(p.event_id) ?? 0) + 1);

  const items: HostHistoryListItem[] = historical.map((e) => ({
    eventId: e.id,
    title: e.title,
    status: "closed",
    contentType: normalizeContentType(e.content_type),
    createdAt: e.created_at,
    endedAt: e.closed_at,
    participantCount: joinedCounts.get(e.id) ?? 0,
    completionCount: completionCounts.get(e.id) ?? 0,
  }));

  // Canonical deterministic order (the DB order is best-effort; this makes the
  // fallback + tie-break explicit and stable regardless of null closed_at rows).
  items.sort((a, b) =>
    compareHistoryRecency(
      { endedAt: a.endedAt, createdAt: a.createdAt, eventId: a.eventId },
      { endedAt: b.endedAt, createdAt: b.createdAt, eventId: b.eventId },
    ),
  );

  return items;
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

/**
 * R4-R2G — a guidance event's material is the Host's own text, read from the immutable module
 * snapshot. There is no content table to query, by design.
 */
async function loadGuidanceMaterial(
  admin: SupabaseClient,
  eventId: string,
  contentType: GuidanceContentType,
): Promise<HostHistoryMaterial> {
  const content = await readGuidanceContent(admin, eventId);
  if (!content || content.contentType !== contentType) return { kind: "none" };
  return contentType === "written_guidance"
    ? { kind: "written_guidance", guidance: content.materialText, completionPrompt: content.completionPrompt }
    : { kind: "live_discussion", discussion: content.materialText, completionPrompt: content.completionPrompt };
}

async function loadMaterial(
  admin: SupabaseClient,
  eventId: string,
  contentType: HostHistoryContentType | null,
): Promise<HostHistoryMaterial> {
  /*
    R4-R2G — EXHAUSTIVE, and the unknown case is first. This function used to end with an
    unguarded YouTube read, so any non-`document` value fetched the video content table and
    reported `kind: "youtube"` for a training that has no video.
  */
  if (contentType === null) return { kind: "unknown" };
  if (isGuidanceContentType(contentType)) return loadGuidanceMaterial(admin, eventId, contentType);
  if (contentType === "document") {
    const { data } = await admin
      .from("foundry_event_document_content")
      .select("file_name, page_count, source_type, completion_prompt")
      .eq("event_id", eventId)
      .maybeSingle<{
        file_name: string | null;
        page_count: number;
        source_type: string;
        completion_prompt: string;
      }>();
    if (!data) return { kind: "none" };
    return {
      kind: "document",
      fileName: data.file_name,
      pageCount: data.page_count,
      sourceType: data.source_type,
      completionPrompt: data.completion_prompt,
    };
  }

  const { data } = await admin
    .from("foundry_event_training_content")
    .select("youtube_video_id, youtube_title, completion_prompt")
    .eq("event_id", eventId)
    .maybeSingle<{
      youtube_video_id: string;
      youtube_title: string | null;
      completion_prompt: string;
    }>();
  if (!data) return { kind: "none" };
  return {
    kind: "youtube",
    videoId: data.youtube_video_id,
    title: data.youtube_title,
    completionPrompt: data.completion_prompt,
  };
}

/**
 * A read-only snapshot of one historical event the caller owns. Returns null
 * unless the event exists, is owned by `ownerUserId`, AND is terminal (`closed`)
 * — so a foreign id or a still-open (current) event both yield a non-disclosing
 * 404 at the route. Carries factual counts, a material summary, and a completion-
 * only roster; NEVER a reflection body, session token, join token, or storage path.
 */
export async function getHostHistoryDetail(
  admin: SupabaseClient,
  ownerUserId: string,
  eventId: string,
): Promise<HostHistoryDetail | null> {
  if (!ownerUserId || !eventId) return null;

  const { data: event } = await admin
    .from("foundry_events")
    .select(HISTORY_EVENT_COLS)
    .eq("id", eventId)
    .eq("owner_user_id", ownerUserId)
    .maybeSingle<HistoryEventRow>();

  if (!event) return null;
  // Only terminal events are historical — an open event is current, not archive.
  if (!isHistoricalEventStatus(event.status)) return null;

  const contentType = normalizeContentType(event.content_type);

  // Roster (joined only) — display name + joined time; never session hashes.
  const { data: rosterRows } = await admin
    .from("foundry_event_participants")
    .select("id, display_name, status, joined_at")
    .eq("event_id", eventId)
    .eq("status", "joined")
    .order("joined_at", { ascending: true })
    .returns<{ id: string; display_name: string; status: string; joined_at: string }[]>();

  const roster = rosterRows ?? [];

  // Completion markers — no response text, no reflection.
  const { data: progressRows } = await admin
    .from("foundry_event_training_progress")
    .select(PROGRESS_MARKER_COLS)
    .eq("event_id", eventId)
    .returns<ProgressMarkerRow[]>();

  const markersByParticipant = new Map<string, TrainingProgressMarkers>();
  for (const row of progressRows ?? []) markersByParticipant.set(row.participant_id, toMarkers(row));

  let completionCount = 0;
  const participants: HostHistoryParticipant[] = roster.map((p) => {
    const markers = markersByParticipant.get(p.id) ?? null;
    if (markers?.completed_at) completionCount += 1;
    return {
      id: p.id,
      displayName: p.display_name,
      joinedAt: p.joined_at,
      status: projectManagerRosterStatus("joined", markers, contentType),
    };
  });

  const material = await loadMaterial(admin, eventId, contentType);

  return {
    eventId: event.id,
    title: event.title,
    status: "closed",
    contentType,
    createdAt: event.created_at,
    endedAt: event.closed_at,
    participantCount: participants.length,
    completionCount,
    material,
    participants,
  };
}
