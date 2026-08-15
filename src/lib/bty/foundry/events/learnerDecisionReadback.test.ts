import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { listUserFoundryHistory } from "./foundryHistoryService";
import { getSharedUnderstandingForOwner } from "./foundrySharedReviewService";

/**
 * SLICE 3.2R-R1.1 — the DECIDED chip can now be opened.
 *
 * R1 shipped a DECIDED rung with no way for the learner to see WHAT they decided — the identical
 * shape of gap R8D-R1 closed for `learner_reflection_text`, which R8B wrote and nothing read. A
 * rung the learner cannot open is a claim, not a record.
 *
 * `decision_response_text` is already Host-visible by settled 3.2M-1 design, so adding it to the
 * OWNER-SCOPED learner read widens nothing. The half of that sentence worth proving is the other
 * half: that this change did not touch the Host projection, and that the two genuinely private
 * columns are still unreachable from it.
 */

type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;

function makeFakeAdmin(tables: Tables): SupabaseClient {
  function from(table: string) {
    const q: Record<string, unknown> = {
      _rows: (tables[table] ?? []).slice(),
      select() { return this; },
      returns() { return this; },
      order() { return this; },
      eq(this: { _rows: Row[] }, c: string, v: unknown) { this._rows = this._rows.filter((r) => r[c] === v); return this; },
      in(this: { _rows: Row[] }, c: string, vs: unknown[]) { this._rows = this._rows.filter((r) => vs.includes(r[c])); return this; },
      not(this: { _rows: Row[] }, c: string) { this._rows = this._rows.filter((r) => r[c] !== null && r[c] !== undefined); return this; },
      maybeSingle(this: { _rows: Row[] }) { return Promise.resolve({ data: this._rows[0] ?? null, error: null }); },
      then(this: { _rows: Row[] }, onF: (v: { data: Row[]; error: null }) => unknown) {
        return Promise.resolve({ data: this._rows, error: null }).then(onF);
      },
    };
    return q;
  }
  return { from } as unknown as SupabaseClient;
}

const HOST = "host-1";
const OWNER = "user-1";
const STRANGER = "user-2";
const EVENT = "ev-1";

const DECISION = "Next time I will say the owner's name out loud before we break.";
const PRIVATE_COMPLETION = "SECRET COMPLETION CHECK ANSWER";
const PRIVATE_REFLECTION = "SECRET PRIVATE REFLECTION BODY";
const SHARED = "Confirm the owner before we leave the huddle.";

function seed(): Tables {
  return {
    foundry_events: [{ id: EVENT, owner_user_id: HOST, title: "Huddle ownership", content_type: "youtube" }],
    foundry_event_training_content: [{ event_id: EVENT, completion_prompt: "What will you say?", shared_question: "Explain it." }],
    foundry_event_document_content: [],
    foundry_event_participants: [{ id: "p1", event_id: EVENT, display_name: "Hanbit" }],
    foundry_event_module: [],
    foundry_participant_followups: [],
    foundry_behavior_observations: [],
    foundry_published_arena_practices: [],
    foundry_arena_practice_runs: [],
    foundry_event_training_progress: [
      {
        id: "prog-1",
        event_id: EVENT,
        participant_id: "p1",
        completed_at: "2026-08-01T02:00:00Z",
        response_text: PRIVATE_COMPLETION,
        learner_reflection_text: PRIVATE_REFLECTION,
        decision_response_text: DECISION,
        decision_submitted_at: "2026-08-01T02:00:00Z",
        shared_understanding_response: SHARED,
        shared_response_submitted_at: "2026-08-01T02:00:00Z",
        host_review_status: "NOT_REVIEWED",
        host_review_note: null,
        host_reviewed_at: null,
        reflection: null,
        completion_state: "pass",
        linked_user_id: OWNER,
      },
    ],
  };
}

describe("learner reads their own decision (R1.1)", () => {
  it("the owner's history carries decisionResponse", async () => {
    const items = await listUserFoundryHistory(makeFakeAdmin(seed()), OWNER);
    expect(items).toHaveLength(1);
    expect(items[0]!.decisionResponse).toBe(DECISION);
  });

  it("a training with no recorded decision returns null, never an empty string", async () => {
    /*
      The UI gates the section on truthiness, so `""` would render an empty heading — the exact
      "there used to be a box there" failure R1.1 exists to remove.
    */
    const t = seed();
    (t.foundry_event_training_progress![0] as Row).decision_response_text = "   ";
    const items = await listUserFoundryHistory(makeFakeAdmin(t), OWNER);
    expect(items[0]!.decisionResponse).toBeNull();
  });

  it("still owner-scoped — a stranger reads nothing", async () => {
    const items = await listUserFoundryHistory(makeFakeAdmin(seed()), STRANGER);
    expect(items).toEqual([]);
  });

  it("the learner's own private writing is still returned to THEM (unchanged by R1.1)", async () => {
    const items = await listUserFoundryHistory(makeFakeAdmin(seed()), OWNER);
    expect(items[0]!.responseText).toBe(PRIVATE_COMPLETION);
    expect(items[0]!.learnerReflection).toBe(PRIVATE_REFLECTION);
  });
});

describe("the Host projection is untouched by R1.1", () => {
  it("Host still cannot reach response_text or learner_reflection_text", async () => {
    const view = await getSharedUnderstandingForOwner(makeFakeAdmin(seed()), HOST, EVENT);
    const json = JSON.stringify(view);
    expect(json).not.toContain(PRIVATE_COMPLETION);
    expect(json).not.toContain(PRIVATE_REFLECTION);
    for (const key of ["response_text", "learner_reflection_text", "learnerReflection"]) {
      expect(json, key).not.toContain(key);
    }
  });

  it("Host still sees the decision it was always allowed to see (3.2M-1), and the evidence rungs", async () => {
    const view = await getSharedUnderstandingForOwner(makeFakeAdmin(seed()), HOST, EVENT);
    const row = view!.responses[0]!;
    expect(row.decisionResponse).toBe(DECISION);
    expect(row.evidence.established).toContain("decided");
  });

  it("an unrelated owner still resolves nothing", async () => {
    expect(await getSharedUnderstandingForOwner(makeFakeAdmin(seed()), "host-2", EVENT)).toBeNull();
  });
});
