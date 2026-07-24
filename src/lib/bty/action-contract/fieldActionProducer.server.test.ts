import { beforeEach, describe, expect, it, vi } from "vitest";
import { ensureFieldActionDraft, loadFieldActionContract } from "./fieldActionProducer.server";

/**
 * Field Action producer (Slice 3.1B-3N-5C.3). Verifies the NON-ARENA insert path: server-owned,
 * idempotent per (learner, progress), action_type='field_action', arena columns NULL, no arena_runs.
 */

const LEARNER = "learner-1";
const OTHER = "learner-2";
const EVENT = "event-1";
const PROGRESS = "progress-1";

type Rows = {
  progress?: Record<string, unknown> | null;
  existing?: Record<string, unknown> | null;
  eventTitle?: string;
  insertResult?: { data: Record<string, unknown> | null; error: { code?: string } | null };
};

function makeAdmin(rows: Rows) {
  const insert = vi.fn((_row: Record<string, unknown>) => ({
    select: () => ({
      single: () => Promise.resolve(rows.insertResult ?? { data: null, error: { code: "xx" } }),
    }),
  }));
  const from = vi.fn((table: string) => {
    if (table === "foundry_event_training_progress") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              not: () => ({
                order: () => ({
                  limit: () => ({ maybeSingle: () => Promise.resolve({ data: rows.progress ?? null, error: null }) }),
                }),
              }),
            }),
          }),
        }),
      };
    }
    if (table === "foundry_events") {
      return {
        select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: rows.eventTitle ? { id: EVENT, title: rows.eventTitle } : null, error: null }) }) }),
      };
    }
    // bty_action_contracts
    return {
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: rows.existing ?? null, error: null }) }) }) }),
      insert,
    };
  });
  return { admin: { from } as never, insert, from };
}

const okProgress = { id: PROGRESS, event_id: EVENT, linked_user_id: LEARNER, completed_at: "2026-07-20T00:00:00Z" };

beforeEach(() => vi.clearAllMocks());

describe("ensureFieldActionDraft", () => {
  it("creates one field_action draft from the learner's own completed progress", async () => {
    const insertedRow = {
      id: "c-new", user_id: LEARNER, status: "draft", action_type: "field_action",
      who: null, what: null, how: null, step_when: null, revision_note: null, reviewed_at: null,
      contract_description: "My Module", deadline_at: "2026-07-27T00:00:00Z", session_id: `field_action:${PROGRESS}`,
    };
    const { admin, insert } = makeAdmin({ progress: okProgress, existing: null, eventTitle: "My Module", insertResult: { data: insertedRow, error: null } });
    const r = await ensureFieldActionDraft(admin, { learnerUserId: LEARNER, eventId: EVENT, nowIso: "2026-07-20T00:00:00Z" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.created).toBe(true);
      expect(r.contract.actionType).toBe("field_action");
      expect(r.contract.moduleTitle).toBe("My Module");
    }
    // Inserted row shape: field_action, NON-arena, hybrid, session keyed on progress; NO arena_runs write.
    const row = insert.mock.calls[0][0] as Record<string, unknown>;
    expect(row.action_type).toBe("field_action");
    expect(row.verification_mode).toBe("hybrid");
    expect(row.verification_tier).toBe("mvp_open");
    expect(row.session_id).toBe(`field_action:${PROGRESS}`);
    expect(row.user_id).toBe(LEARNER);
    expect((row as { run_id?: unknown }).run_id).toBeUndefined(); // never set → column stays NULL
    expect((row as { arena_scenario_id?: unknown }).arena_scenario_id).toBeUndefined();
    expect((row as { primary_choice_id?: unknown }).primary_choice_id).toBeUndefined();
    expect((row as { pattern_family?: unknown }).pattern_family).toBeUndefined();
    // Source lineage preserved.
    expect((row.details as { source?: { kind?: string; progress_id?: string; event_id?: string } }).source).toMatchObject({
      kind: "foundry_field_action", progress_id: PROGRESS, event_id: EVENT,
    });
  });

  it("does not touch arena_runs at all", async () => {
    const { admin, from } = makeAdmin({ progress: okProgress, existing: null, eventTitle: "M", insertResult: { data: { id: "c", action_type: "field_action" }, error: null } });
    await ensureFieldActionDraft(admin, { learnerUserId: LEARNER, eventId: EVENT });
    const tables = from.mock.calls.map((c) => c[0]);
    expect(tables).not.toContain("arena_runs");
  });

  it("another learner cannot create from a progress they do not own", async () => {
    // progress query filters linked_user_id = learner, so a non-owner sees no row.
    const { admin, insert } = makeAdmin({ progress: null });
    const r = await ensureFieldActionDraft(admin, { learnerUserId: OTHER, eventId: EVENT });
    expect(r).toEqual({ ok: false, code: "progress_not_found" });
    expect(insert).not.toHaveBeenCalled();
  });

  it("is idempotent: returns the existing contract without inserting", async () => {
    const existing = { id: "c-existing", user_id: LEARNER, status: "submitted", action_type: "field_action", who: "a", what: "b", how: "c", step_when: "d", revision_note: null, reviewed_at: null, contract_description: "M", deadline_at: null, session_id: `field_action:${PROGRESS}` };
    const { admin, insert } = makeAdmin({ progress: okProgress, existing });
    const r = await ensureFieldActionDraft(admin, { learnerUserId: LEARNER, eventId: EVENT });
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.created).toBe(false); expect(r.contract.contractId).toBe("c-existing"); }
    expect(insert).not.toHaveBeenCalled();
  });

  it("23505 race → returns the row created by the concurrent producer", async () => {
    // First existing lookup empty; insert conflicts; re-fetch finds it.
    let existingCall = 0;
    const conflictRow = { id: "c-race", user_id: LEARNER, status: "draft", action_type: "field_action", contract_description: "M", session_id: `field_action:${PROGRESS}` };
    const from = vi.fn((table: string) => {
      if (table === "foundry_event_training_progress") return { select: () => ({ eq: () => ({ eq: () => ({ not: () => ({ order: () => ({ limit: () => ({ maybeSingle: () => Promise.resolve({ data: okProgress, error: null }) }) }) }) }) }) }) };
      if (table === "foundry_events") return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { id: EVENT, title: "M" }, error: null }) }) }) };
      return {
        select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => { existingCall++; return Promise.resolve({ data: existingCall === 1 ? null : conflictRow, error: null }); } }) }) }),
        insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: { code: "23505" } }) }) }),
      };
    });
    const r = await ensureFieldActionDraft({ from } as never, { learnerUserId: LEARNER, eventId: EVENT });
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.created).toBe(false); expect(r.contract.contractId).toBe("c-race"); }
  });
});

describe("loadFieldActionContract", () => {
  it("returns the learner's own field_action contract", async () => {
    const row = { id: "c1", user_id: LEARNER, status: "rejected", action_type: "field_action", who: "a", what: "b", how: "c", step_when: "d", revision_note: "fix it", reviewed_at: "2026-07-21T00:00:00Z", contract_description: "M", deadline_at: null, session_id: "s" };
    const admin = { from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: row, error: null }) }) }) }) }) } as never;
    const r = await loadFieldActionContract(admin, { learnerUserId: LEARNER, contractId: "c1" });
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.contract.revisionNote).toBe("fix it"); expect(r.contract.actionType).toBe("field_action"); }
  });

  it("rejects a non-field_action contract (never repurposes an Arena contract)", async () => {
    const row = { id: "c1", user_id: LEARNER, action_type: "arena_run_completion", contract_description: "x", session_id: "s" };
    const admin = { from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: row, error: null }) }) }) }) }) } as never;
    const r = await loadFieldActionContract(admin, { learnerUserId: LEARNER, contractId: "c1" });
    expect(r).toEqual({ ok: false, code: "not_owner" });
  });
});
