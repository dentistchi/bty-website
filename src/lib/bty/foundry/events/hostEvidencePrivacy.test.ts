import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSharedUnderstandingForOwner } from "./foundrySharedReviewService";

/**
 * SLICE 3.2R-R1 — the Host gains evidence rungs and gains NOTHING ELSE.
 *
 * `foundrySharedReviewService.test.ts` already proves the pre-R1 allow-list. This file proves the
 * specific risk R1 introduces: the evidence assembly reads `response_text`,
 * `learner_reflection_text` and `decision_response_text` in order to answer "did a reflection
 * happen?", and it runs inside a HOST-authorized read. If that assembly ever returned what it
 * read, the private-reflection boundary would fall through a surface nobody was watching.
 *
 * So the assertions here are over the SERIALIZED Host payload, by value and by key, at depth.
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
const OTHER = "host-2";
const EVENT = "ev-1";
const LEARNER = "user-1";

const SECRET_COMPLETION = "SECRET COMPLETION CHECK ANSWER";
const SECRET_REFLECTION = "SECRET PRIVATE REFLECTION BODY";
const SECRET_AI = "SECRET AI LIVING REFLECTION";
const SHARED = "Always confirm the owner before the huddle ends.";
const DECISION = "Next time I will name the owner out loud.";

const STANDARD = "States the owner, the action and the deadline out loud before the huddle ends.";
const REFLECT_Q = "What usually happens when an action needs an owner after a huddle?";
const COMPLETION_Q = "What exactly will you say when you state the owner, action, and deadline?";

function seed(): Tables {
  return {
    foundry_events: [{ id: EVENT, owner_user_id: HOST, content_type: "youtube" }],
    foundry_event_training_content: [
      { event_id: EVENT, completion_prompt: COMPLETION_Q, shared_question: "Explain the standard in your own words." },
    ],
    foundry_event_document_content: [],
    foundry_event_participants: [{ id: "p1", event_id: EVENT, display_name: "Hanbit" }],
    foundry_event_training_progress: [
      {
        id: "prog-1",
        event_id: EVENT,
        participant_id: "p1",
        completed_at: "2026-08-01T02:00:00Z",
        // Private, and present — the assembly must READ these and return none of them.
        response_text: SECRET_COMPLETION,
        learner_reflection_text: SECRET_REFLECTION,
        reflection: SECRET_AI,
        decision_response_text: DECISION,
        decision_submitted_at: "2026-08-01T02:00:00Z",
        shared_understanding_response: SHARED,
        shared_response_submitted_at: "2026-08-01T02:00:00Z",
        host_review_status: "NOT_REVIEWED",
        host_review_note: null,
        host_reviewed_at: null,
        linked_user_id: LEARNER,
      },
    ],
    foundry_event_module: [
      {
        event_id: EVENT,
        module_snapshot: {
          realityGroundedJourneyV1: {
            version: 1,
            displayTitle: "Huddle ownership",
            displayTitleStatus: "grounded",
            elements: [
              { id: "el_observable_standard", kind: "observable_standard", content: STANDARD, confirmationStatus: "grounded" },
              { id: "el_reflection", kind: "reflection", content: REFLECT_Q, confirmationStatus: "grounded" },
            ],
          },
        },
      },
    ],
    foundry_participant_followups: [
      { id: "fu-1", progress_id: "prog-1", event_id: EVENT, user_id_snapshot: LEARNER, follow_up_days: 7, outcome: "APPLIED" },
    ],
    foundry_behavior_observations: [],
    foundry_published_arena_practices: [],
    foundry_arena_practice_runs: [],
  };
}

describe("Host participant review — evidence rungs are visible, private text is not", () => {
  it("CASE I — the Host sees REFLECTED while the reflection body stays unreachable", async () => {
    const view = await getSharedUnderstandingForOwner(makeFakeAdmin(seed()), HOST, EVENT);
    const row = view!.responses[0]!;
    expect(row.evidence.established).toContain("reflected");
    expect(row.evidence.established).toContain("decided");
    expect(row.evidence.established).toContain("applied");
    expect(row.evidence.highestEstablished).toBe("applied");

    const json = JSON.stringify(view);
    expect(json).not.toContain(SECRET_REFLECTION);
    expect(json).not.toContain(SECRET_COMPLETION);
    expect(json).not.toContain(SECRET_AI);
  });

  it("no private column KEY appears anywhere in the serialized Host payload", async () => {
    const view = await getSharedUnderstandingForOwner(makeFakeAdmin(seed()), HOST, EVENT);
    const json = JSON.stringify(view);
    for (const key of ["response_text", "learner_reflection_text", "learnerReflection", "aiReflection"]) {
      expect(json, key).not.toContain(key);
    }
  });

  it("the evidence field is a closed shape — two keys, rung names only", async () => {
    const view = await getSharedUnderstandingForOwner(makeFakeAdmin(seed()), HOST, EVENT);
    const evidence = view!.responses[0]!.evidence;
    expect(Object.keys(evidence).sort()).toEqual(["established", "highestEstablished"]);
    const LADDER = ["exposed", "reflected", "decided", "practiced", "applied", "observed", "sustained"];
    for (const v of evidence.established) expect(LADDER).toContain(v);
  });

  it("evidence carries NO score, count, percentage or comparison between learners", async () => {
    const view = await getSharedUnderstandingForOwner(makeFakeAdmin(seed()), HOST, EVENT);
    const evidence = view!.responses[0]!.evidence as unknown as Record<string, unknown>;
    for (const banned of ["score", "total", "percent", "percentage", "rank", "rating", "level", "count"]) {
      expect(evidence[banned], banned).toBeUndefined();
    }
  });

  it("OBSERVED is absent on a self-report alone — the Host is not shown a rung nobody earned", async () => {
    const view = await getSharedUnderstandingForOwner(makeFakeAdmin(seed()), HOST, EVENT);
    const evidence = view!.responses[0]!.evidence;
    expect(evidence.established).not.toContain("observed");
    expect(evidence.established).not.toContain("sustained");
  });

  it("an unrelated owner still resolves nothing — evidence does not widen authorization", async () => {
    const view = await getSharedUnderstandingForOwner(makeFakeAdmin(seed()), OTHER, EVENT);
    expect(view).toBeNull();
  });

  it("training completion remains its own separate fact, unchanged by the rungs", async () => {
    /*
      The R1 product correction. `completed` is true here and stays true; the record establishing
      only some rungs is not a reason to call the training incomplete, and nothing in the payload
      re-derives completion from evidence.
    */
    const view = await getSharedUnderstandingForOwner(makeFakeAdmin(seed()), HOST, EVENT);
    const row = view!.responses[0]!;
    expect(row.completed).toBe(true);
    expect(row.evidence.established).not.toContain("sustained");
  });
});
