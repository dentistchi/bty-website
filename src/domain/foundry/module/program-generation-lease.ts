/**
 * Program generation lease — domain (pure, Slice 3.2L-R1).
 *
 * THE LIVE-PROVEN DEFECT. During the first controlled authorship window a draft was
 * published 4 seconds after a program generation was admitted against it, and the
 * generation went on to record `success` 6 seconds after the publication. Draft status
 * was checked only at admission, so publication could land while the provider call was
 * in flight. Nothing was applied — the Apply path would have refused with 409 — but the
 * provider spend had already happened and a proposal was returned as usable for a draft
 * that was no longer editable.
 *
 * The repair has two halves, and both live here as pure rules:
 *
 *   1. While a generation is ACTIVE, publication of that same draft is refused.
 *   2. An active generation is BOUNDED, so a crashed or lost attempt cannot wedge a
 *      draft forever.
 *
 * The lease is derived entirely from columns the attempt row already carries —
 * `lifecycle_state`, `started_at`, `finished_at` — so this needs no schema change and no
 * background reaper. An expired attempt stops blocking, but its row is never rewritten
 * or deleted: an unfinished attempt is evidence that a generation was lost, and that is
 * worth keeping.
 *
 * No DB, no I/O, no clock of its own — `now` is always passed in so every rule is
 * deterministic and testable.
 */

/** The provider deadline the authorship service enforces (`LLM_TIMEOUT_MS`). */
export const PROGRAM_PROVIDER_TIMEOUT_MS = 45_000;

/**
 * Operational grace beyond the provider deadline. It must cover the work that happens
 * AFTER the provider returns but BEFORE the attempt is terminalized — validation, the
 * bounded retry, the post-provider revalidation reads and the terminal write.
 *
 * The retry is what makes this generous: a first response that fails validation is
 * followed by a second provider call, so a genuinely active attempt can legitimately
 * span two full deadlines. The window must never expire while a real call is running,
 * because that would let publication proceed underneath it — the exact defect being
 * repaired. Erring long costs a bounded wait; erring short reopens the race.
 */
export const PROGRAM_LEASE_GRACE_MS = 30_000;

/**
 * How long an unfinished attempt keeps blocking publication.
 *
 * Two provider deadlines (initial + bounded retry) plus grace. After this the attempt is
 * treated as lost: it no longer blocks, and the Host is never stuck.
 */
export const PROGRAM_LEASE_MS = PROGRAM_PROVIDER_TIMEOUT_MS * 2 + PROGRAM_LEASE_GRACE_MS; // 120_000

/** The minimum an attempt row must expose for the lease rule to decide. */
export type LeaseAttempt = {
  id: string;
  draft_id: string;
  lifecycle_state: string;
  started_at: string;
  finished_at: string | null;
};

export type LeaseState = "active" | "finished" | "expired" | "malformed";

/**
 * Classify one attempt against the clock.
 *
 * `finished` — it reached a terminal state; it never blocks.
 * `active`   — still running inside its lease; it blocks publication.
 * `expired`  — unfinished past the lease; treated as lost, no longer blocks, row kept.
 * `malformed` — an unparseable timestamp. Deliberately NOT treated as active: a bad row
 *               must not be able to wedge a draft permanently.
 */
export function classifyAttempt(attempt: LeaseAttempt, now: Date): LeaseState {
  if (attempt.lifecycle_state !== "started" || attempt.finished_at !== null) return "finished";
  const started = Date.parse(attempt.started_at);
  if (!Number.isFinite(started)) return "malformed";
  return now.getTime() - started < PROGRAM_LEASE_MS ? "active" : "expired";
}

/** True only while an attempt genuinely holds the draft. */
export function isAttemptActive(attempt: LeaseAttempt, now: Date): boolean {
  return classifyAttempt(attempt, now) === "active";
}

/**
 * The attempt currently blocking publication of `draftId`, or null.
 *
 * Scoped to ONE draft on purpose: a generation on draft A must never block draft B
 * (Invariant D). The caller queries by draft, and this re-asserts it so a widened query
 * can never silently become a global lock.
 */
export function blockingAttempt(
  attempts: readonly LeaseAttempt[],
  draftId: string,
  now: Date,
): LeaseAttempt | null {
  for (const a of attempts) {
    if (a.draft_id !== draftId) continue;
    if (isAttemptActive(a, now)) return a;
  }
  return null;
}

/** Milliseconds until an active attempt expires; 0 once it no longer blocks. */
export function msUntilExpiry(attempt: LeaseAttempt, now: Date): number {
  if (classifyAttempt(attempt, now) !== "active") return 0;
  return Math.max(0, Date.parse(attempt.started_at) + PROGRAM_LEASE_MS - now.getTime());
}

// ---------------------------------------------------------------------------
// Post-provider revalidation
// ---------------------------------------------------------------------------

/**
 * What the draft looked like when generation was ADMITTED, and what it looks like now.
 *
 * `fingerprint` is the authorship-input revision. `foundry_module_drafts` has no
 * revision column, and `updated_at` is the wrong signal — it moves on every autosave,
 * including edits to fields the program was never authored from. The context fingerprint
 * changes exactly when an input the proposal depends on changes, which is the question
 * actually being asked.
 */
export type DraftAuthorshipState = {
  draftId: string;
  ownerUserId: string;
  status: string;
  fingerprint: string;
};

export type StaleReason =
  | "draft_missing"
  | "draft_identity_changed"
  | "owner_changed"
  | "status_no_longer_draft"
  | "inputs_changed";

/**
 * Why a completed generation may no longer be applied, or null when it is still valid.
 *
 * Called AFTER the provider returns, against a freshly reloaded draft. This is what
 * turns the live race from "success on a published draft" into an honest refusal.
 */
export function staleReason(
  admitted: DraftAuthorshipState,
  current: DraftAuthorshipState | null,
): StaleReason | null {
  if (current === null) return "draft_missing";
  if (current.draftId !== admitted.draftId) return "draft_identity_changed";
  if (current.ownerUserId !== admitted.ownerUserId) return "owner_changed";
  if (current.status !== "draft") return "status_no_longer_draft";
  if (current.fingerprint !== admitted.fingerprint) return "inputs_changed";
  return null;
}

export function isStale(admitted: DraftAuthorshipState, current: DraftAuthorshipState | null): boolean {
  return staleReason(admitted, current) !== null;
}
