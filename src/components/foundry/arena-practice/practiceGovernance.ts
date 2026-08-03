/**
 * HOW THE HOST SEES SERVER GOVERNANCE (Slice 3.2I-R5B2-R5C-4B).
 *
 * The server already decides whether a generation may start. This module decides only how to SAY
 * it — it derives nothing. There is deliberately no client-side refusal counting, no local retry
 * budget and no inference from request history: R5C-4A2 measured that the previous screen kept the
 * action available because retriability was unknown to it, and the repair was to move the decision
 * to the server. Re-deriving it here would put it back.
 *
 * PURE: a function of the server's last response. Same input, same screen.
 */

export const GOVERNANCE_STATES = ["ready", "confirm_second_attempt", "revision_required", "in_progress"] as const;
export type GovernanceState = (typeof GOVERNANCE_STATES)[number];

export type Governance = {
  generationInputRevision: number;
  generationLocale: "en" | "ko";
  /** Bounded by the server to 0, 1 or 2, where 2 means "two or more". */
  refusalCount: number;
  state: GovernanceState | "input_revision_stale";
  canStartGeneration: boolean;
  requiresExplicitConfirmation: boolean;
  reviewSetupRecommended: boolean;
};

/** What the screen may offer. `confirm` never submits — it opens the confirmation surface. */
export type GovernanceView = {
  state: GovernanceState;
  /** The one emphasised action. */
  primary: "create" | "review_setup" | "none";
  /** Offered alongside, never instead of, the primary action. */
  secondary: "review_setup" | "confirm_second_attempt" | "none";
  createEnabled: boolean;
  /** True only at `confirm_second_attempt`; a same-input retry is never offered otherwise. */
  showsRetryAction: boolean;
  /** Suppressed entirely at zero refusals — no warning about a refusal that never happened. */
  showsRefusalNotice: boolean;
  refusalCount: 0 | 1 | 2;
  /** Sent with the next submission. `false` for an ordinary ready submission. */
  acknowledgementRequired: boolean;
};

const BLOCKED: Omit<GovernanceView, "state" | "refusalCount"> = {
  primary: "review_setup",
  secondary: "none",
  createEnabled: false,
  showsRetryAction: false,
  showsRefusalNotice: true,
  acknowledgementRequired: false,
};

/**
 * The screen for one governance reading.
 *
 * A governance value the client cannot interpret — absent, or a state it does not know — resolves
 * to the SAFEST reading rather than an optimistic one: an unreadable server answer must never
 * become an enabled Create button.
 */
export function resolveGovernanceView(governance: Governance | null | undefined): GovernanceView {
  if (!governance || !(GOVERNANCE_STATES as readonly string[]).includes(governance.state)) {
    return { ...BLOCKED, state: "in_progress", primary: "none", showsRefusalNotice: false, refusalCount: 0 };
  }
  const count = Math.min(2, Math.max(0, Math.trunc(governance.refusalCount))) as 0 | 1 | 2;

  switch (governance.state as GovernanceState) {
    case "ready":
      return {
        state: "ready",
        primary: "create",
        secondary: "review_setup",
        createEnabled: true,
        showsRetryAction: false,
        // Nothing has been refused under this input; saying otherwise would invent a history.
        showsRefusalNotice: false,
        refusalCount: 0,
        acknowledgementRequired: false,
      };
    case "confirm_second_attempt":
      return {
        state: "confirm_second_attempt",
        // Reviewing the setup is the recommended path; trying again is offered, not urged.
        primary: "review_setup",
        secondary: "confirm_second_attempt",
        createEnabled: false,
        showsRetryAction: true,
        showsRefusalNotice: true,
        refusalCount: count,
        acknowledgementRequired: true,
      };
    case "revision_required":
      // No same-input retry control exists here at all — not disabled, absent.
      return { ...BLOCKED, state: "revision_required", refusalCount: count };
    case "in_progress":
      return {
        state: "in_progress",
        primary: "none",
        secondary: "none",
        createEnabled: false,
        showsRetryAction: false,
        showsRefusalNotice: false,
        refusalCount: count,
        acknowledgementRequired: false,
      };
  }
}

/**
 * Is a pending confirmation still about the thing the Host confirmed?
 *
 * A confirmation is bound to one epoch and one locale. Reload drops it because it is never
 * persisted; an epoch or locale move drops it because it would otherwise authorize a submission
 * the Host never agreed to.
 */
export function confirmationStillValid(
  pending: { generationInputRevision: number; locale: "en" | "ko" } | null,
  current: { generationInputRevision: number; locale: "en" | "ko" },
): boolean {
  if (!pending) return false;
  return pending.generationInputRevision === current.generationInputRevision && pending.locale === current.locale;
}

/** The stable server codes this screen must understand rather than treat as a generic failure. */
export const GOVERNANCE_CODES = [
  "generation_retry_confirmation_required",
  "generation_revision_required",
  "generation_already_in_progress",
  "generation_input_revision_stale",
  "generation_locale_invalid",
] as const;
export type GovernanceCode = (typeof GOVERNANCE_CODES)[number];

export const isGovernanceCode = (code: unknown): code is GovernanceCode =>
  typeof code === "string" && (GOVERNANCE_CODES as readonly string[]).includes(code);

/** What the client does with a stable governance response. Never an automatic retry. */
export function reactionToCode(code: GovernanceCode): {
  refreshDraft: boolean;
  clearPendingConfirmation: boolean;
  automaticRetry: false;
} {
  switch (code) {
    case "generation_input_revision_stale":
      // The screen is describing an epoch that no longer exists; re-read before anything else.
      return { refreshDraft: true, clearPendingConfirmation: true, automaticRetry: false };
    case "generation_revision_required":
    case "generation_already_in_progress":
      return { refreshDraft: true, clearPendingConfirmation: true, automaticRetry: false };
    case "generation_retry_confirmation_required":
      // Not a failure: the server is asking for the acknowledgement the Host has not yet given.
      return { refreshDraft: false, clearPendingConfirmation: false, automaticRetry: false };
    case "generation_locale_invalid":
      // Never silently switch to English — that is the coercion R5C-4A2 removed.
      return { refreshDraft: false, clearPendingConfirmation: true, automaticRetry: false };
  }
}
