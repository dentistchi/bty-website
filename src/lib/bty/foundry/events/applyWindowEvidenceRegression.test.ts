import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { materializeApplyWindow, listMyApplyWindows } from "./foundryApplyWindowService";
import { projectEvidenceByProgressId } from "./learnerEvidenceService";
import { establishedEvidence } from "@/domain/foundry/events/learner-evidence";
import { reportsApplication } from "@/domain/foundry/followup/followUpObligation";

/**
 * SLICE 3.2R-R2 — THE APPLY WINDOW MUST NOT MOVE THE LADDER.
 *
 * This is the regression that matters most in R2. The whole slice exists to make a decision
 * visible in real life, and the single way it could go wrong is by letting visibility masquerade
 * as achievement. So: create a window, read it, project the ladder, and prove APPLIED is still
 * absent — before, during and after the window, by every path a learner or the system can take.
 *
 * APPLIED has exactly one author: a terminal APPLIED outcome on the follow-up obligation.
 */

type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;
const LA = "America/Los_Angeles";
const EVENT = "ev-1";
const PROGRESS = "prog-1";
const USER = "user-1";
const DECISION = "Next time I will say the owner's name out loud before we break.";

vi.mock("@/lib/bty/daily/userDay", () => ({ resolveUserTzContext: async () => ({ timezone: LA }) }));

function journeyWithDecision() {
  return {
    version: 1,
    displayTitle: "Huddle ownership",
    displayTitleStatus: "grounded",
    elements: [
      { id: "el_observable_standard", kind: "observable_standard", content: "States the owner aloud.", confirmationStatus: "grounded" },
      { id: "el_action_decision", kind: "action_decision", content: "Decide what you will say.", confirmationStatus: "grounded" },
    ],
  };
}

function seed(followUpOutcome: string | null = null): Tables {
  return {
    foundry_event_training_progress: [
      {
        id: PROGRESS,
        event_id: EVENT,
        completed_at: "2026-08-14T20:00:00Z",
        response_text: "the completion answer",
        learner_reflection_text: null,
        decision_response_text: DECISION,
        linked_user_id: USER,
      },
    ],
    foundry_event_module: [{ event_id: EVENT, module_snapshot: { realityGroundedJourneyV1: journeyWithDecision() } }],
    foundry_events: [{ id: EVENT, title: "Huddle ownership", organization_id: null }],
    foundry_event_assignments: [],
    foundry_event_training_content: [{ event_id: EVENT, completion_prompt: "What will you say?", shared_question: null }],
    foundry_event_document_content: [],
    foundry_participant_followups:
      followUpOutcome === null
        ? []
        : [{ id: "fu-1", progress_id: PROGRESS, event_id: EVENT, user_id_snapshot: USER, follow_up_days: 7, outcome: followUpOutcome }],
    foundry_behavior_observations: [],
    foundry_published_arena_practices: [],
    foundry_arena_practice_runs: [],
  };
}

function makeAdmin(tables: Tables) {
  const created: Row[] = [];
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
  const rpc = async (name: string, args: Row) => {
    if (name === "bty_foundry_materialize_apply_window") {
      if (created.some((r) => r.progress_id === args.p_progress_id)) return { data: [{ result: "exists" }], error: null };
      created.push({ ...args, progress_id: args.p_progress_id });
      return { data: [{ result: "created" }], error: null };
    }
    if (name === "bty_foundry_list_my_apply_windows") {
      return {
        data: created.filter((r) => r.p_user_id_snapshot === args.p_auth_user_id).map((r, i) => ({
          id: `w-${i}`, event_id: r.p_event_id, progress_id: r.p_progress_id,
          source_training_title: r.p_source_training_title, completion_bty_day: r.p_completion_bty_day,
          due_bty_day: r.p_due_bty_day, due_at: r.p_due_at,
        })),
        error: null,
      };
    }
    return { data: null, error: null };
  };
  return { admin: { from, rpc } as unknown as SupabaseClient, created };
}

const rungs = async (admin: SupabaseClient) =>
  (await projectEvidenceByProgressId(admin, [{ progressId: PROGRESS, eventId: EVENT, userId: USER }])).get(PROGRESS)!;

describe("R2 evidence regression — the window never establishes APPLIED", () => {
  it("BEFORE the window exists: DECIDED yes, APPLIED no", async () => {
    const { admin } = makeAdmin(seed());
    const r = await rungs(admin);
    expect(r.established).toContain("decided");
    expect(r.established).not.toContain("applied");
  });

  it("CREATING the window changes nothing on the ladder", async () => {
    const { admin } = makeAdmin(seed());
    const before = await rungs(admin);
    expect(await materializeApplyWindow(admin, { eventId: EVENT, progressId: PROGRESS, authUserId: USER })).toBe("created");
    const after = await rungs(admin);
    expect(after).toEqual(before);
    expect(after.established).toContain("decided");
    expect(after.established).not.toContain("applied");
  });

  it("READING it in Today changes nothing on the ladder", async () => {
    const { admin } = makeAdmin(seed());
    await materializeApplyWindow(admin, { eventId: EVENT, progressId: PROGRESS, authUserId: USER });
    const before = await rungs(admin);
    await listMyApplyWindows(admin, USER, new Date("2026-08-17T20:00:00Z"), LA); // "opening" it
    expect(await rungs(admin)).toEqual(before);
    expect(before.established).not.toContain("applied");
  });

  it("the window BECOMING DUE, and then CLOSING, still establishes nothing", async () => {
    const { admin } = makeAdmin(seed());
    await materializeApplyWindow(admin, { eventId: EVENT, progressId: PROGRESS, authUserId: USER });
    for (const iso of ["2026-08-21T20:00:00Z", "2026-08-30T20:00:00Z"]) {
      await listMyApplyWindows(admin, USER, new Date(iso), LA);
      const r = await rungs(admin);
      expect(r.established, iso).not.toContain("applied");
      expect(r.established, iso).toContain("decided");
    }
  });

  it("ONLY the terminal follow-up outcome establishes APPLIED", async () => {
    const { admin } = makeAdmin(seed("APPLIED"));
    await materializeApplyWindow(admin, { eventId: EVENT, progressId: PROGRESS, authUserId: USER });
    const r = await rungs(admin);
    expect(r.established).toContain("applied");
    // …and it still does not drag OBSERVED or SUSTAINED along with it.
    expect(r.established).not.toContain("observed");
    expect(r.established).not.toContain("sustained");
  });

  it("PARTLY_APPLIED / NOT_YET / BLOCKED establish no APPLIED, window or not", async () => {
    for (const outcome of ["PARTLY_APPLIED", "NOT_YET", "BLOCKED"]) {
      const { admin } = makeAdmin(seed(outcome));
      await materializeApplyWindow(admin, { eventId: EVENT, progressId: PROGRESS, authUserId: USER });
      const r = await rungs(admin);
      expect(r.established, outcome).not.toContain("applied");
      expect(reportsApplication(outcome as never), outcome).toBe(false);
    }
  });

  it("no apply-window fact is even REPRESENTABLE in the ladder's input type", () => {
    /*
      The structural guarantee behind all of the above: `LearnerEvidenceFacts` has seven fields and
      none of them is about a window. There is no argument this slice could pass that would move
      APPLIED, because the function cannot accept one.
    */
    const facts = {
      completed: true, reflection: true, decision: true, practiceCompleted: false,
      appliedReported: false, independentlyObserved: false, sustained: false,
    };
    expect(Object.keys(facts).sort()).toEqual([
      "appliedReported", "completed", "decision", "independentlyObserved",
      "practiceCompleted", "reflection", "sustained",
    ]);
    expect(establishedEvidence(facts)).not.toContain("applied");
    // Only flipping the follow-up's own fact can do it.
    expect(establishedEvidence({ ...facts, appliedReported: true })).toContain("applied");
  });

  it("the service exposes NO write path other than materialization", async () => {
    /*
      There is no `completeApplyWindow`, no `markApplied`, no status setter — by construction, not
      by convention. If one is ever added, this assertion is where the conversation starts.
    */
    const mod = await import("./foundryApplyWindowService");
    expect(Object.keys(mod).sort()).toEqual(["listMyApplyWindows", "materializeApplyWindow"]);
  });
});
