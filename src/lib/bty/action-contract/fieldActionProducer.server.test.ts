import { beforeEach, describe, expect, it, vi } from "vitest";
import { ensureFieldActionDraft, loadFieldActionContract } from "./fieldActionProducer.server";

/**
 * Field Action producer (Slice 3.1B-3N-5C.3, Gate-0 assignment-anchored fix). Ownership resolves
 * via the immutable `foundry_event_assignments.user_id_snapshot` → (event_id, participant_id) →
 * completed progress. `progress.linked_user_id` is NEVER required (participant-claimed completions
 * legitimately have it NULL). Non-arena insert; idempotent per (learner, progress).
 */

const LEARNER = "learner-1";
const OTHER = "learner-2";
const ASSIGNMENT = "assign-1";
const EVENT = "event-1";
const PARTICIPANT = "part-1";
const PROGRESS = "progress-1";

type Rows = {
  assignment?: Record<string, unknown> | null;
  progress?: Record<string, unknown> | null;
  existing?: Record<string, unknown> | null;
  eventTitle?: string;
  insertResult?: { data: Record<string, unknown> | null; error: { code?: string } | null };
};

function makeAdmin(rows: Rows) {
  const insert = vi.fn((_row: Record<string, unknown>) => ({
    select: () => ({ single: () => Promise.resolve(rows.insertResult ?? { data: null, error: { code: "xx" } }) }),
  }));
  const from = vi.fn((table: string) => {
    if (table === "foundry_event_assignments") {
      return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: rows.assignment ?? null, error: null }) }) }) };
    }
    if (table === "foundry_event_training_progress") {
      return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: rows.progress ?? null, error: null }) }) }) }) };
    }
    if (table === "foundry_events") {
      return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: rows.eventTitle ? { id: EVENT, title: rows.eventTitle } : null, error: null }) }) }) };
    }
    return {
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: rows.existing ?? null, error: null }) }) }) }),
      insert,
    };
  });
  return { admin: { from } as never, insert, from };
}

const ownedAssignment = { id: ASSIGNMENT, event_id: EVENT, participant_id: PARTICIPANT, status: "completed", user_id_snapshot: LEARNER };
// KEY: the progress row's linked_user_id is NULL (participant-claimed) — must NOT block.
const completedProgressNullLink = { id: PROGRESS, completed_at: "2026-07-20T00:00:00Z" };

beforeEach(() => vi.clearAllMocks());

describe("ensureFieldActionDraft — assignment-anchored", () => {
  it("creates a field_action draft from a completed learner-owned assignment (linked_user_id NULL is fine)", async () => {
    const inserted = { id: "c-new", user_id: LEARNER, status: "draft", action_type: "field_action", contract_description: "My Module", session_id: `field_action:${PROGRESS}` };
    const { admin, insert } = makeAdmin({ assignment: ownedAssignment, progress: completedProgressNullLink, existing: null, eventTitle: "My Module", insertResult: { data: inserted, error: null } });
    const r = await ensureFieldActionDraft(admin, { learnerUserId: LEARNER, assignmentId: ASSIGNMENT, nowIso: "2026-07-20T00:00:00Z" });
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.created).toBe(true); expect(r.contract.actionType).toBe("field_action"); }
    const row = insert.mock.calls[0][0] as Record<string, unknown>;
    expect(row.action_type).toBe("field_action");
    // LIVE-CHECK-COMPATIBLE values (23514 fix): pending / foundry / micro_win.
    expect(row.status).toBe("pending");
    expect(row.mode).toBe("foundry");
    expect(row.le_activation_type).toBe("micro_win");
    expect(row.verification_mode).toBe("hybrid");
    expect(row.verification_tier).toBe("mvp_open");
    expect(row.session_id).toBe(`field_action:${PROGRESS}`);
    expect(row.user_id).toBe(LEARNER);
    expect((row as { run_id?: unknown }).run_id).toBeUndefined();
    expect((row as { arena_scenario_id?: unknown }).arena_scenario_id).toBeUndefined();
    expect((row as { primary_choice_id?: unknown }).primary_choice_id).toBeUndefined();
    expect((row as { pattern_family?: unknown }).pattern_family).toBeUndefined();
    expect((row.details as { source?: Record<string, unknown> }).source).toMatchObject({
      kind: "foundry_field_action", assignment_id: ASSIGNMENT, event_id: EVENT, participant_id: PARTICIPANT, progress_id: PROGRESS,
    });
  });

  it("never touches arena_runs", async () => {
    const { admin, from } = makeAdmin({ assignment: ownedAssignment, progress: completedProgressNullLink, existing: null, eventTitle: "M", insertResult: { data: { id: "c" }, error: null } });
    await ensureFieldActionDraft(admin, { learnerUserId: LEARNER, assignmentId: ASSIGNMENT });
    expect(from.mock.calls.map((c) => c[0])).not.toContain("arena_runs");
  });

  it("rejects when the assignment belongs to another learner (user_id_snapshot mismatch)", async () => {
    const { admin, insert } = makeAdmin({ assignment: { ...ownedAssignment, user_id_snapshot: OTHER } });
    const r = await ensureFieldActionDraft(admin, { learnerUserId: LEARNER, assignmentId: ASSIGNMENT });
    expect(r).toEqual({ ok: false, code: "not_owner" });
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects an incomplete assignment", async () => {
    const { admin, insert } = makeAdmin({ assignment: { ...ownedAssignment, status: "assigned" } });
    const r = await ensureFieldActionDraft(admin, { learnerUserId: LEARNER, assignmentId: ASSIGNMENT });
    expect(r).toEqual({ ok: false, code: "not_owner" });
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects honestly when the progress is missing / not completed", async () => {
    const { admin } = makeAdmin({ assignment: ownedAssignment, progress: { id: PROGRESS, completed_at: null } });
    const r = await ensureFieldActionDraft(admin, { learnerUserId: LEARNER, assignmentId: ASSIGNMENT });
    expect(r).toEqual({ ok: false, code: "progress_not_found" });
  });

  it("is idempotent: returns the existing contract without inserting", async () => {
    const existing = { id: "c-existing", user_id: LEARNER, status: "submitted", action_type: "field_action", contract_description: "M", session_id: `field_action:${PROGRESS}` };
    const { admin, insert } = makeAdmin({ assignment: ownedAssignment, progress: completedProgressNullLink, existing });
    const r = await ensureFieldActionDraft(admin, { learnerUserId: LEARNER, assignmentId: ASSIGNMENT });
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.created).toBe(false); expect(r.contract.contractId).toBe("c-existing"); }
    expect(insert).not.toHaveBeenCalled();
  });

  it("23505 race → returns the concurrently-created row", async () => {
    let existingCall = 0;
    const conflictRow = { id: "c-race", user_id: LEARNER, action_type: "field_action", contract_description: "M", session_id: `field_action:${PROGRESS}` };
    const from = vi.fn((table: string) => {
      if (table === "foundry_event_assignments") return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: ownedAssignment, error: null }) }) }) };
      if (table === "foundry_event_training_progress") return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: completedProgressNullLink, error: null }) }) }) }) };
      if (table === "foundry_events") return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { id: EVENT, title: "M" }, error: null }) }) }) };
      return {
        select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => { existingCall++; return Promise.resolve({ data: existingCall === 1 ? null : conflictRow, error: null }); } }) }) }),
        insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: { code: "23505" } }) }) }),
      };
    });
    const r = await ensureFieldActionDraft({ from } as never, { learnerUserId: LEARNER, assignmentId: ASSIGNMENT });
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.created).toBe(false); expect(r.contract.contractId).toBe("c-race"); }
  });
});

describe("loadFieldActionContract", () => {
  it("returns the learner's own field_action contract for resubmit", async () => {
    const row = { id: "c1", user_id: LEARNER, status: "rejected", action_type: "field_action", who: "a", what: "b", how: "c", step_when: "d", revision_note: "fix it", reviewed_at: null, contract_description: "M", deadline_at: null, session_id: "s" };
    const admin = { from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: row, error: null }) }) }) }) }) } as never;
    const r = await loadFieldActionContract(admin, { learnerUserId: LEARNER, contractId: "c1" });
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.contract.revisionNote).toBe("fix it"); }
  });

  it("rejects a non-field_action contract", async () => {
    const row = { id: "c1", user_id: LEARNER, action_type: "arena_run_completion", contract_description: "x", session_id: "s" };
    const admin = { from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: row, error: null }) }) }) }) }) } as never;
    const r = await loadFieldActionContract(admin, { learnerUserId: LEARNER, contractId: "c1" });
    expect(r).toEqual({ ok: false, code: "not_owner" });
  });
});
