/**
 * TEST FIXTURE — a faithful in-memory simulation of `bty_foundry_claim_assignment`.
 *
 * Not production code and not imported by any production module. It exists because R4-R5B1's
 * invariant is about TRUTH, not about invocation: "the assignment reaches `completed`". A mock that
 * answers a canned `{ result: "claimed" }` proves only that a function was called, and would keep
 * passing if the RPC's real branch logic changed underneath it.
 *
 * Every branch below is transcribed from the shipped SQL
 * (`supabase/migrations/20260724000000_foundry_assignment_claim_v2.sql`):
 *
 *   · match ONLY on (event_id, user_id_snapshot), excluding `revoked` — the participant id is
 *     RECORDED on the row, never used to identify it
 *   · no match → `no_matching_assignment` when the event has an assigned_overlay participation
 *     mode row, else `not_applicable` (an ordinary open-link room)
 *   · already claimed by THIS participant → `already_claimed` (idempotent, no write)
 *   · claimed by a DIFFERENT participant → `claim_conflict` (no write, no overwrite)
 *   · otherwise → set participant_id/claimed_at/completed_at, status `completed`, → `claimed`
 *
 * Deliberately NOT simulated: the row lock and the audit-row insert. Both are single-connection
 * concerns with no observable effect on the outcomes these tests assert.
 */

export type SimTables = Record<string, Array<Record<string, unknown>>>;

export type ClaimAssignmentParams = {
  p_event_id?: unknown;
  p_participant_id?: unknown;
  p_auth_user_id?: unknown;
};

export type ClaimSimResponse = {
  data: Array<{ result: string; assignment_id: string | null }> | null;
  error: { message: string } | null;
};

/** One RPC answer, shaped exactly as supabase-js returns it. */
function answer(result: string, assignmentId: string | null = null): ClaimSimResponse {
  return { data: [{ result, assignment_id: assignmentId }], error: null };
}

/**
 * Run the simulated RPC against a harness `tables` object, MUTATING
 * `tables.foundry_event_assignments` exactly as the SQL would.
 */
export function simulateClaimAssignment(
  tables: SimTables,
  p: Record<string, unknown> | ClaimAssignmentParams,
): ClaimSimResponse {
  /*
    FAULT INJECTION (test control, not part of the SQL). `tables.__claim_fault` lets a test prove
    R4-R5B1's containment guarantee: an assignment reconciliation that errors — or never answers at
    all — must not fail a truthful training completion, and must not report a transition. Absent by
    default, so every other test exercises the faithful path.
  */
  const fault = (tables.__claim_fault ?? [])[0]?.mode;
  if (fault === "throw") throw new Error("simulated rpc transport failure");
  if (fault === "error") return { data: null, error: { message: "simulated rpc error" } };

  const params = p as ClaimAssignmentParams;
  const eventId = params.p_event_id;
  const participantId = params.p_participant_id;
  const authUserId = params.p_auth_user_id;

  const assignments = (tables.foundry_event_assignments ??= []);
  const row = assignments.find(
    (a) => a.event_id === eventId && a.user_id_snapshot === authUserId && a.status !== "revoked",
  );

  if (!row) {
    const modes = (tables.foundry_event_participation_mode ??= []);
    const isAssigned = modes.some((m) => m.event_id === eventId && m.mode === "assigned_overlay");
    return answer(isAssigned ? "no_matching_assignment" : "not_applicable");
  }

  if (row.participant_id != null) {
    return row.participant_id === participantId
      ? answer("already_claimed", String(row.id))
      : answer("claim_conflict", String(row.id));
  }

  const now = new Date().toISOString();
  row.participant_id = participantId;
  row.claimed_at = now;
  row.completed_at = now;
  row.status = "completed";
  row.updated_at = now;
  return answer("claimed", String(row.id));
}

/**
 * Seed an ASSIGNED-OVERLAY event with one assignment for `userId`, mirroring what a Host publish
 * commits: the participation-mode row plus an assignment carrying the immutable publish-time
 * `user_id_snapshot`. Returns the assignment row so a test can read its status afterwards.
 */
export function seedAssignment(
  tables: SimTables,
  eventId: string,
  userId: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  (tables.foundry_event_participation_mode ??= []).push({
    event_id: eventId,
    mode: "assigned_overlay",
  });
  const row: Record<string, unknown> = {
    id: `assign-${(tables.foundry_event_assignments ??= []).length + 1}`,
    event_id: eventId,
    user_id_snapshot: userId,
    status: "assigned",
    participant_id: null,
    claimed_at: null,
    completed_at: null,
    ...overrides,
  };
  (tables.foundry_event_assignments ??= []).push(row);
  return row;
}

/** The assignment row for (event, user), or undefined. Read-only convenience for assertions. */
export function readAssignment(
  tables: SimTables,
  eventId: string,
  userId: string,
): Record<string, unknown> | undefined {
  return (tables.foundry_event_assignments ?? []).find(
    (a) => a.event_id === eventId && a.user_id_snapshot === userId,
  );
}
