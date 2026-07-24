/**
 * Action Review Decision — pure input policy (Slice 3.1B-3N-5C).
 *
 * Validates the two reviewer decisions and the revision note BEFORE any I/O. No
 * authority, no DB, no side effects — the service layer resolves authority and calls
 * the canonical SECURITY DEFINER RPC. The revision note rules mirror the DB CHECK
 * (`bty_action_contracts_revision_note_check`) so the app and the database agree:
 * required, trimmed, 1..500 characters. `approve` never carries a note.
 */

export type ActionReviewDecisionKind = "approve" | "request_revision";

export const ACTION_REVIEW_REVISION_NOTE_MAX = 500;

export type ActionReviewDecisionInput = {
  decision: string;
  revisionNote?: string | null;
};

export type ActionReviewDecisionValidation =
  | { ok: true; decision: ActionReviewDecisionKind; revisionNote: string | null }
  | { ok: false; reason: "INVALID_DECISION" | "NOTE_REQUIRED" | "NOTE_TOO_LONG" };

/** Code-point length so the app bound matches Postgres `char_length` (not UTF-16 units). */
function codePointLength(value: string): number {
  return Array.from(value).length;
}

export function validateActionReviewDecisionInput(
  input: ActionReviewDecisionInput,
): ActionReviewDecisionValidation {
  const decision = typeof input.decision === "string" ? input.decision.trim() : "";
  if (decision !== "approve" && decision !== "request_revision") {
    return { ok: false, reason: "INVALID_DECISION" };
  }

  if (decision === "approve") {
    // Approve stores no note (any client-supplied note is intentionally discarded).
    return { ok: true, decision, revisionNote: null };
  }

  const note = typeof input.revisionNote === "string" ? input.revisionNote.trim() : "";
  if (codePointLength(note) < 1) {
    return { ok: false, reason: "NOTE_REQUIRED" };
  }
  if (codePointLength(note) > ACTION_REVIEW_REVISION_NOTE_MAX) {
    return { ok: false, reason: "NOTE_TOO_LONG" };
  }
  return { ok: true, decision, revisionNote: note };
}
