/**
 * Foundry YouTube Training — domain (pure).
 *
 * Validation for the completion prompt + response, and the two status
 * projections (manager roster + public employee stage) derived from progress
 * timestamps. No DB, no crypto, no XP writing here.
 */

import type { FoundryEventStatus, FoundryParticipantStatus, ValidationResult } from "./foundry-event";

export const FOUNDRY_COMPLETION_PROMPT_MAX = 300;
export const FOUNDRY_RESPONSE_MAX = 1000;

/** Fixed system award for one training completion (managers cannot choose XP). */
export const FOUNDRY_TRAINING_XP = 10;

function stripControlChars(raw: string): string {
  let out = "";
  for (const ch of raw) {
    const code = ch.codePointAt(0) ?? 0;
    if (code <= 0x1f || (code >= 0x7f && code <= 0x9f) || code === 0x2028 || code === 0x2029) continue;
    out += ch;
  }
  return out;
}

export function validateCompletionPrompt(raw: unknown): ValidationResult<string> {
  if (typeof raw !== "string") return { ok: false, reason: "prompt_required" };
  const cleaned = stripControlChars(raw).trim();
  if (cleaned.length < 1) return { ok: false, reason: "prompt_required" };
  if (cleaned.length > FOUNDRY_COMPLETION_PROMPT_MAX) return { ok: false, reason: "prompt_too_long" };
  return { ok: true, value: cleaned };
}

/**
 * The completion response. Newlines are allowed (it's a reflection), so we keep
 * \n and \r but still strip other control chars. Length is measured post-trim.
 */
export function validateResponse(raw: unknown): ValidationResult<string> {
  if (typeof raw !== "string") return { ok: false, reason: "response_required" };
  let out = "";
  for (const ch of raw) {
    const code = ch.codePointAt(0) ?? 0;
    const isNewline = code === 0x0a || code === 0x0d || code === 0x09;
    if (!isNewline && (code <= 0x1f || (code >= 0x7f && code <= 0x9f) || code === 0x2028 || code === 0x2029)) {
      continue;
    }
    out += ch;
  }
  const cleaned = out.trim();
  if (cleaned.length < 1) return { ok: false, reason: "response_required" };
  if (cleaned.length > FOUNDRY_RESPONSE_MAX) return { ok: false, reason: "response_too_long" };
  return { ok: true, value: cleaned };
}

/** The room's content type. YouTube is the original loop; document is the PDF room. */
export type FoundryContentType = "youtube" | "document";

/** Progress timestamps the projections read (all nullable, server-owned). */
export type TrainingProgressMarkers = {
  video_started_at: string | null;
  video_completed_at: string | null;
  completed_at: string | null;
  xp_awarded_at: string | null;
  // DOCUMENT room only (null/absent for YouTube). `read_started` is any reading
  // progress at all; `document_read_completed_at` is the reading-gate met marker.
  document_read_started?: boolean;
  document_read_completed_at?: string | null;
};

/** The evidence-completed marker for either content type (video OR reading gate). */
function engagementCompleted(progress: TrainingProgressMarkers): boolean {
  return Boolean(progress.video_completed_at) || Boolean(progress.document_read_completed_at);
}

export type ManagerRosterStatus =
  | "joined"
  | "watching"
  | "reading"
  | "response_pending"
  | "complete"
  | "removed";

/** Manager sees COMPLETION only — never the response text. Derived server-side. */
export function projectManagerRosterStatus(
  participantStatus: FoundryParticipantStatus,
  progress: TrainingProgressMarkers | null,
  contentType: FoundryContentType = "youtube",
): ManagerRosterStatus {
  if (participantStatus === "removed") return "removed";
  if (!progress) return "joined";
  if (progress.completed_at) return "complete";
  if (engagementCompleted(progress)) return "response_pending";
  if (contentType === "document") return progress.document_read_started ? "reading" : "joined";
  if (progress.video_started_at) return "watching";
  return "joined";
}

export type PublicTrainingStage =
  | "pre_join" // not yet a participant, event open + current QR
  | "watch" // joined, video not yet completed (YouTube)
  | "read" // joined, reading gate not yet met (DOCUMENT)
  | "response" // engagement completed, response not yet submitted
  | "completed_awarded" // completed + Core XP awarded/claimed
  | "completed_claimable" // completed anonymously, XP not yet claimed
  | "closed_incomplete" // event closed before this participant completed
  | "closed" // event closed, caller never joined
  | "removed" // participant removed by manager
  | "inactive"; // invalid / rotated token / missing event

/** The employee-facing stage for `/f/[token]`, derived from progress + status. */
export function projectPublicTrainingStage(args: {
  participantStatus: FoundryParticipantStatus | null;
  eventStatus: FoundryEventStatus;
  progress: TrainingProgressMarkers | null;
  hasParticipant: boolean;
  contentType?: FoundryContentType;
}): PublicTrainingStage {
  const { participantStatus, eventStatus, progress, hasParticipant, contentType = "youtube" } = args;

  if (hasParticipant && participantStatus === "removed") return "removed";

  // Completed participants keep their result regardless of event status.
  if (hasParticipant && progress?.completed_at) {
    return progress.xp_awarded_at ? "completed_awarded" : "completed_claimable";
  }

  if (!hasParticipant) {
    return eventStatus === "closed" ? "closed" : "pre_join";
  }

  // Joined but not completed.
  if (eventStatus === "closed") return "closed_incomplete";
  if (progress && engagementCompleted(progress)) return "response";
  return contentType === "document" ? "read" : "watch";
}

/**
 * The completion response may only be submitted once the engagement gate is
 * server-marked complete (video watched OR reading requirement met).
 */
export function canSubmitResponse(progress: TrainingProgressMarkers | null): boolean {
  return Boolean(progress) && engagementCompleted(progress!) && !progress?.completed_at;
}
