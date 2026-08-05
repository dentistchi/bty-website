import { describe, it, expect } from "vitest";
import {
  classifyAttempt,
  isAttemptActive,
  blockingAttempt,
  msUntilExpiry,
  staleReason,
  isStale,
  PROGRAM_LEASE_MS,
  PROGRAM_PROVIDER_TIMEOUT_MS,
  type LeaseAttempt,
  type DraftAuthorshipState,
} from "./program-generation-lease";

/**
 * Slice 3.2L-R1 — the two rules that close the live-proven race.
 *
 * Measured: a draft was published 4s after a generation was admitted against it, and the
 * generation recorded success 6s after the publication. These rules make that
 * impossible from both directions — publication yields while a generation is genuinely
 * active, and a generation that finds the draft changed refuses instead of succeeding.
 */

const T0 = new Date("2026-08-05T22:08:24.000Z");
const at = (ms: number) => new Date(T0.getTime() + ms);

const attempt = (over: Partial<LeaseAttempt> = {}): LeaseAttempt => ({
  id: "a1",
  draft_id: "draft-A",
  lifecycle_state: "started",
  started_at: T0.toISOString(),
  finished_at: null,
  ...over,
});

describe("[3.2L-R1] an active generation holds its draft", () => {
  it("is active the instant it starts", () => {
    expect(classifyAttempt(attempt(), T0)).toBe("active");
    expect(isAttemptActive(attempt(), T0)).toBe(true);
  });

  it("is STILL active across the whole real provider window", () => {
    // The measured incident published 4s in. That must be refused.
    expect(isAttemptActive(attempt(), at(4_000))).toBe(true);
    // A first call that runs to its deadline, then a bounded retry that does the same.
    expect(isAttemptActive(attempt(), at(PROGRAM_PROVIDER_TIMEOUT_MS))).toBe(true);
    expect(isAttemptActive(attempt(), at(PROGRAM_PROVIDER_TIMEOUT_MS * 2))).toBe(true);
    expect(isAttemptActive(attempt(), at(PROGRAM_LEASE_MS - 1))).toBe(true);
  });

  it("stops blocking once the lease expires — a crash cannot wedge a draft forever", () => {
    expect(classifyAttempt(attempt(), at(PROGRAM_LEASE_MS))).toBe("expired");
    expect(isAttemptActive(attempt(), at(PROGRAM_LEASE_MS))).toBe(false);
    expect(isAttemptActive(attempt(), at(PROGRAM_LEASE_MS + 60_000))).toBe(false);
  });

  it("never blocks once it reached a terminal state", () => {
    expect(isAttemptActive(attempt({ lifecycle_state: "completed", finished_at: T0.toISOString() }), at(1_000))).toBe(false);
    // finished_at set but state not yet flipped — still terminal, still not blocking
    expect(isAttemptActive(attempt({ finished_at: T0.toISOString() }), at(1_000))).toBe(false);
  });

  it("a malformed timestamp does not block — a bad row must not wedge a draft", () => {
    expect(classifyAttempt(attempt({ started_at: "not-a-date" }), T0)).toBe("malformed");
    expect(isAttemptActive(attempt({ started_at: "not-a-date" }), T0)).toBe(false);
  });

  it("reports the remaining wait, and zero once it no longer blocks", () => {
    expect(msUntilExpiry(attempt(), at(0))).toBe(PROGRAM_LEASE_MS);
    expect(msUntilExpiry(attempt(), at(1_000))).toBe(PROGRAM_LEASE_MS - 1_000);
    expect(msUntilExpiry(attempt(), at(PROGRAM_LEASE_MS))).toBe(0);
  });
});

describe("[3.2L-R1] the lease is scoped to ONE draft", () => {
  it("G5 — a generation on draft A never blocks draft B", () => {
    const attempts = [attempt({ draft_id: "draft-A" })];
    expect(blockingAttempt(attempts, "draft-A", at(1_000))?.id).toBe("a1");
    expect(blockingAttempt(attempts, "draft-B", at(1_000))).toBeNull();
  });

  it("ignores a foreign-draft row even if the query is widened", () => {
    // Defence in depth: if the caller's filter ever regressed to a table scan, this rule
    // still refuses to become a global lock.
    const attempts = [attempt({ id: "other", draft_id: "draft-Z" })];
    expect(blockingAttempt(attempts, "draft-A", at(1_000))).toBeNull();
  });

  it("picks an active row out of a mixed set", () => {
    const attempts = [
      attempt({ id: "done", lifecycle_state: "completed", finished_at: T0.toISOString() }),
      attempt({ id: "old", started_at: at(-PROGRAM_LEASE_MS - 1_000).toISOString() }),
      attempt({ id: "live" }),
    ];
    expect(blockingAttempt(attempts, "draft-A", at(1_000))?.id).toBe("live");
  });

  it("returns null when nothing is active", () => {
    expect(blockingAttempt([], "draft-A", T0)).toBeNull();
    expect(blockingAttempt([attempt({ lifecycle_state: "completed", finished_at: T0.toISOString() })], "draft-A", T0)).toBeNull();
  });
});

describe("[3.2L-R1] a generation refuses when the draft moved underneath it", () => {
  const admitted: DraftAuthorshipState = {
    draftId: "draft-A",
    ownerUserId: "owner-1",
    status: "draft",
    fingerprint: "fp-1",
  };

  it("accepts an unchanged draft", () => {
    expect(staleReason(admitted, { ...admitted })).toBeNull();
    expect(isStale(admitted, { ...admitted })).toBe(false);
  });

  it("G3 — the measured incident: published mid-flight is REFUSED, not success", () => {
    expect(staleReason(admitted, { ...admitted, status: "published" })).toBe("status_no_longer_draft");
    expect(staleReason(admitted, { ...admitted, status: "approved" })).toBe("status_no_longer_draft");
  });

  it("G4 — an authorship input changing invalidates the proposal", () => {
    expect(staleReason(admitted, { ...admitted, fingerprint: "fp-2" })).toBe("inputs_changed");
  });

  it("refuses a vanished draft", () => {
    expect(staleReason(admitted, null)).toBe("draft_missing");
  });

  it("refuses a changed draft identity or owner", () => {
    expect(staleReason(admitted, { ...admitted, draftId: "draft-B" })).toBe("draft_identity_changed");
    expect(staleReason(admitted, { ...admitted, ownerUserId: "owner-2" })).toBe("owner_changed");
  });

  it("checks identity BEFORE status, so a wrong-draft answer is never mislabelled", () => {
    const wrongAndPublished = { ...admitted, draftId: "draft-B", status: "published" };
    expect(staleReason(admitted, wrongAndPublished)).toBe("draft_identity_changed");
  });
});
