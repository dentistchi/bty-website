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
 * The module's Shared Understanding question (Slice 3.1B-3G) — OPTIONAL. null / blank ⇒ the module
 * has no shared question (value null). A present question is bounded exactly like the completion
 * prompt (1..MAX). Distinct from the private Reflection prompt.
 */
export function validateSharedQuestionOptional(raw: unknown): ValidationResult<string | null> {
  if (raw === null || raw === undefined) return { ok: true, value: null };
  if (typeof raw !== "string") return { ok: false, reason: "shared_question_invalid" };
  const cleaned = stripControlChars(raw).trim();
  if (cleaned.length < 1) return { ok: true, value: null };
  if (cleaned.length > FOUNDRY_COMPLETION_PROMPT_MAX) return { ok: false, reason: "shared_question_too_long" };
  return { ok: true, value: cleaned };
}

/**
 * The learner's Shared Understanding response (Slice 3.1B-3G) — required ONLY when the module has a
 * shared question. Same shape as validateResponse (newlines allowed, control chars stripped, 1..1000)
 * but a distinct reason namespace so the learner UI can message the shared field independently.
 */
export function validateSharedResponse(raw: unknown): ValidationResult<string> {
  const base = validateResponse(raw);
  if (base.ok) return base;
  return { ok: false, reason: base.reason === "response_required" ? "shared_response_required" : base.reason };
}

/**
 * Resolve the Shared Understanding response at completion (Slice 3.1B-3G). Pure gate:
 *   - no shared question configured  → value null (shared response NOT stored; input ignored).
 *   - shared question configured     → a non-empty valid response is REQUIRED.
 * The service persists `value` into shared_understanding_response ONLY (never response_text), and
 * sets host_review_status = NOT_REVIEWED when value is non-null.
 */
export function resolveSharedResponse(
  sharedQuestion: string | null | undefined,
  raw: unknown,
): ValidationResult<string | null> {
  if (!sharedQuestion || sharedQuestion.trim().length < 1) return { ok: true, value: null };
  return validateSharedResponse(raw);
}

/**
 * The learner's own decision (Slice 3.2M-1).
 *
 * A published program can contain an `action_decision` section — BTY's proposal for what a
 * person might commit to. Until now the learner READ it and completed, and the durable record
 * supported exposure and reflection only. Reading someone else's sentence is not a decision,
 * so nothing could honestly say DECIDED.
 *
 * This is the same shape as the Shared Understanding gate, deliberately: a separate column, a
 * separate timestamp, required only when the training actually asks for it, and never
 * conflated with the private reflection in `response_text`.
 */
export function validateDecisionResponse(raw: unknown): ValidationResult<string> {
  const base = validateResponse(raw);
  if (base.ok) return base;
  return { ok: false, reason: base.reason === "response_required" ? "decision_required" : base.reason };
}

/**
 * Resolve the decision at completion. Pure gate:
 *   - the published program has no action_decision → value null (nothing stored, input ignored).
 *   - it has one                                   → a non-empty decision is REQUIRED.
 *
 * `actionDecision` is the CONTENT of the frozen journey's action_decision element, so the gate
 * is driven by what was actually published, never by what a client claims.
 */
export function resolveDecisionResponse(
  actionDecision: string | null | undefined,
  raw: unknown,
): ValidationResult<string | null> {
  if (!actionDecision || actionDecision.trim().length < 1) return { ok: true, value: null };
  return validateDecisionResponse(raw);
}

/**
 * THE LEARNER'S OWN REFLECTION, AND WHICH PUBLISHED EVENTS ASK FOR ONE (Slice 3.2R-R8B).
 *
 * A published journey's `reflection` element asks the learner to examine what ALREADY happens
 * ("What usually happens when an action needs an owner after a huddle?"). Its `completion_check`
 * asks what they WILL say. Since 3.2R-R8A the first question is delivered and visible, and until
 * now the only answer a learner could give was the second one — stored in `response_text` under
 * a label that said REFLECTION. One answer cannot mean both acts, and REFLECTED was being
 * established by a commitment.
 *
 * THE ACTIVATION AUTHORITY IS DISTINCTNESS, MEASURED FROM THE FROZEN EVENT.
 *
 * The obvious rule — "the journey has a reflection ⇒ require an answer" — is wrong, and the live
 * data says so. Of the three published journey events on staging, v1 (`07c9623e`) froze a
 * reflection element whose content is EXACTLY its shared question. Under the naive rule that
 * event would acquire a second control asking a question the learner is already answering, and
 * its one completed participant would sit under a contract it never met. Under this rule it
 * simply does not qualify.
 *
 * So the question is only asked when it is genuinely a THIRD question: a grounded frozen
 * reflection whose content differs from both the completion prompt and the shared question the
 * event actually publishes. Every input is frozen at publish, so an event's contract is a
 * property of what was published to it — never of an id, a title, a program, or a date.
 *
 * Comparison is on trimmed, case-folded, whitespace-collapsed text. Two questions that differ
 * only by a stray space are the same question to the person reading them.
 */
function sameQuestion(a: string, b: string | null | undefined): boolean {
  return a.toLowerCase().replace(/\s+/g, " ") === (b ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function requiredLearnerReflection(
  journeyReflection: string | null | undefined,
  completionPrompt: string | null | undefined,
  sharedQuestion: string | null | undefined,
): string | null {
  const q = (journeyReflection ?? "").trim();
  if (q.length < 1) return null;
  if (sameQuestion(q, completionPrompt)) return null;
  if (sameQuestion(q, sharedQuestion)) return null;
  return q;
}

/** The learner's reflection answer. Same shape as the others, its own reason namespace. */
export function validateReflectionResponse(raw: unknown): ValidationResult<string> {
  const base = validateResponse(raw);
  if (base.ok) return base;
  return { ok: false, reason: base.reason === "response_required" ? "reflection_required" : base.reason };
}

/**
 * Resolve the reflection at completion. Pure gate:
 *   - the event does not ask a distinct reflection → value null (nothing stored, input ignored).
 *   - it does                                      → a non-empty reflection is REQUIRED.
 *
 * `reflectionQuestion` is the output of `requiredLearnerReflection` over the FROZEN event, so a
 * legacy event keeps its exact old completion payload contract and no client can opt in or out.
 */
export function resolveReflectionResponse(
  reflectionQuestion: string | null | undefined,
  raw: unknown,
): ValidationResult<string | null> {
  if (!reflectionQuestion || reflectionQuestion.trim().length < 1) return { ok: true, value: null };
  return validateReflectionResponse(raw);
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

/**
 * The room's content type.
 *
 * R4-R2G — THIS USED TO BE A SECOND, NARROWER DEFINITION of the same concept, listing only
 * `youtube | document` while the discriminator column and nine call sites carried their own
 * ideas of the same thing. It is now a re-export of the single authority in `./content-type`,
 * so widening the set can never leave one of the two definitions behind.
 */
export type { FoundryContentType } from "./content-type";
import type { FoundryContentType } from "./content-type";

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
  /*
    R4-R2G — the two guidance stamps. Both are LEARNER-DECLARED, and the names say so.

    `written_guidance_read_at` is set when the learner acknowledges having read the guidance
    that was on their screen: exposure/read evidence, never understanding.

    `discussion_self_reported_at` is set when the learner says they took part in the discussion.
    It is participant-reported and nothing else — not attendance, not verification, not
    observation. No Host or device input reaches it.
  */
  written_guidance_read_at?: string | null;
  discussion_self_reported_at?: string | null;
};

/**
 * The evidence-completed marker for ANY content type — the one place that answers "has this
 * participant engaged the content?" (Slice R4-R2G extended it from two shapes to four).
 *
 * EXPOSURE ONLY, for all four. A video reaching its end, a document's pages being visited, a
 * learner saying they read the guidance and a learner saying they joined the discussion are all
 * the SAME rung of the evidence ladder — access/exposure. None of them is understanding, and
 * none of them is applied behaviour. This function is what unlocks the response step; it is not
 * a claim about what the participant learned or did.
 */
function engagementCompleted(progress: TrainingProgressMarkers): boolean {
  return (
    Boolean(progress.video_completed_at) ||
    Boolean(progress.document_read_completed_at) ||
    Boolean(progress.written_guidance_read_at) ||
    Boolean(progress.discussion_self_reported_at)
  );
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
  /**
   * R4-R2G — `null` means the stored discriminator is one this build does not know. It is NOT
   * treated as YouTube: an unknown room reports the type-agnostic states only (complete /
   * response_pending / joined) and never claims the participant is watching or reading.
   */
  contentType: FoundryContentType | null = "youtube",
): ManagerRosterStatus {
  if (participantStatus === "removed") return "removed";
  if (!progress) return "joined";
  if (progress.completed_at) return "complete";
  if (engagementCompleted(progress)) return "response_pending";
  if (contentType === "document") return progress.document_read_started ? "reading" : "joined";
  /*
    R4-R2G — a guidance room has no mid-progress signal to report, and inventing one would be
    the dishonest move. There is no "is reading" for a block of text and emphatically no "is
    attending" for a discussion BTY cannot see. The Host's roster therefore shows `joined` until
    the learner declares, and `response_pending` the moment they do.
  */
  if (contentType === "written_guidance" || contentType === "live_discussion") return "joined";
  if (contentType === null) return "joined";
  if (progress.video_started_at) return "watching";
  return "joined";
}

export type PublicTrainingStage =
  | "pre_join" // not yet a participant, event open + current QR
  | "watch" // joined, video not yet completed (YouTube)
  | "read" // joined, reading gate not yet met (DOCUMENT)
  /**
   * R4-R2G — joined, the learner has not yet declared their exposure. Covers BOTH guidance
   * types: the guidance has not been acknowledged, or the discussion has not been self-reported.
   * Named for what the learner still owes (a declaration), not for what BTY thinks they did.
   */
  | "declare"
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
  /** R4-R2G — `null` = unknown stored discriminator. Never resolved to a known type. */
  contentType?: FoundryContentType | null;
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
  /*
    R4-R2G — EXHAUSTIVE, and the old form was `contentType === "document" ? "read" : "watch"`,
    where `watch` was the fallback for everything. A guidance learner would have been told to
    watch a video that does not exist.
  */
  if (contentType === "document") return "read";
  if (contentType === "written_guidance" || contentType === "live_discussion") return "declare";
  /*
    An unknown discriminator has no learner experience this build can render. `inactive` is the
    existing "this room cannot be opened" state, and it is the honest answer — far better than
    handing the learner the video room, which is what the old `: "watch"` fallback did.
  */
  if (contentType === null) return "inactive";
  return "watch";
}

/**
 * The completion response may only be submitted once the engagement gate is
 * server-marked complete (video watched OR reading requirement met).
 */
export function canSubmitResponse(progress: TrainingProgressMarkers | null): boolean {
  return Boolean(progress) && engagementCompleted(progress!) && !progress?.completed_at;
}
