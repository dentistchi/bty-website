import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { projectEvidenceByProgressId, listMyEvidence } from "./learnerEvidenceService";

/**
 * SLICE 3.2R-R1 — the evidence ladder, wired.
 *
 * The rung RULES are already proven by `learnerEvidence.test.ts` (13) and
 * `sustainedEvidence.test.ts` (26). What was never proven is that real durable rows reach those
 * rules correctly, because until this slice nothing called them. So this suite drives the
 * ASSEMBLY over a fake database and asserts the rungs that come out — CASE A..J of the R1 matrix.
 *
 * It also holds the privacy proof, over the SERIALIZED object rather than over a comment: the
 * assembly reads three text columns and must be incapable of returning a character of any of them.
 */

type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;

/** Minimal PostgREST-shaped fake: the operators this service actually uses, nothing more. */
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

const EVENT = "ev-1";
const USER = "user-1";
const PROGRESS = "prog-1";
const FOLLOWUP = "fu-1";

const SECRET_COMPLETION = "SECRET COMPLETION CHECK ANSWER";
const SECRET_REFLECTION = "SECRET PRIVATE REFLECTION BODY";
const DECISION_TEXT = "Next time I will state the owner out loud before we leave the huddle.";

const STANDARD = "States the owner, the action and the deadline out loud before the huddle ends.";
const REFLECT_Q = "What usually happens when an action needs an owner after a huddle?";
const COMPLETION_Q = "What exactly will you say when you state the owner, action, and deadline?";

/** A journey whose reflection question is genuinely DISTINCT (the R8B contract is active). */
function journey(opts: { reflection?: boolean; standard?: boolean } = {}) {
  const elements: Row[] = [];
  if (opts.standard !== false) {
    elements.push({ id: "el_observable_standard", kind: "observable_standard", content: STANDARD, confirmationStatus: "grounded" });
  }
  if (opts.reflection) {
    elements.push({ id: "el_reflection", kind: "reflection", content: REFLECT_Q, confirmationStatus: "grounded" });
  }
  return { version: 1, displayTitle: "Huddle ownership", displayTitleStatus: "grounded", elements };
}

type SeedOpts = {
  completed?: boolean;
  completionResponse?: boolean;
  learnerReflection?: boolean;
  decision?: boolean;
  distinctReflectionQuestion?: boolean;
  practiceRun?: boolean;
  followUpOutcome?: string | null;
  observations?: Array<{ outcome: string; observer: string; on: string }>;
  observableStandard?: boolean;
  followUpDays?: number;
  userId?: string | null;
};

function seed(o: SeedOpts = {}): Tables {
  const completed = o.completed ?? true;
  const hasFollowup = o.followUpOutcome !== undefined || (o.observations?.length ?? 0) > 0;
  return {
    foundry_event_training_progress: [
      {
        id: PROGRESS,
        event_id: EVENT,
        completed_at: completed ? "2026-08-01T02:00:00Z" : null,
        response_text: (o.completionResponse ?? true) ? SECRET_COMPLETION : null,
        learner_reflection_text: o.learnerReflection ? SECRET_REFLECTION : null,
        decision_response_text: o.decision ? DECISION_TEXT : null,
        linked_user_id: o.userId === undefined ? USER : o.userId,
      },
    ],
    foundry_event_module: [
      {
        event_id: EVENT,
        module_snapshot: {
          realityGroundedJourneyV1: journey({
            reflection: o.distinctReflectionQuestion,
            standard: o.observableStandard ?? true,
          }),
        },
      },
    ],
    foundry_event_training_content: [
      { event_id: EVENT, completion_prompt: COMPLETION_Q, shared_question: null },
    ],
    foundry_event_document_content: [],
    foundry_participant_followups: hasFollowup
      ? [
          {
            id: FOLLOWUP,
            progress_id: PROGRESS,
            event_id: EVENT,
            user_id_snapshot: USER,
            follow_up_days: o.followUpDays ?? 7,
            outcome: o.followUpOutcome ?? null,
          },
        ]
      : [],
    foundry_behavior_observations: (o.observations ?? []).map((ob, i) => ({
      id: `obs-${i}`,
      followup_id: FOLLOWUP,
      outcome: ob.outcome,
      observer_user_id: ob.observer,
      observed_on: ob.on,
      submitted_at: `${ob.on}T09:00:00Z`,
      observed_standard_snapshot: STANDARD,
    })),
    foundry_published_arena_practices: [{ id: "pr-1", source_event_id: EVENT, status: "published" }],
    foundry_arena_practice_runs: o.practiceRun
      ? [{ id: "run-1", practice_id: "pr-1", user_id: USER, status: "completed" }]
      : [],
  };
}

async function rungsFor(o: SeedOpts = {}) {
  const map = await projectEvidenceByProgressId(makeFakeAdmin(seed(o)), [
    { progressId: PROGRESS, eventId: EVENT, userId: o.userId === undefined ? USER : o.userId },
  ]);
  return map.get(PROGRESS)!;
}

describe("R1 CASE MATRIX — rungs come only from evidence that exists", () => {
  it("CASE A — engagement + the legacy completion answer establishes EXPOSED and REFLECTED, nothing above", async () => {
    /*
      A legacy event asks ONE question, and its answer IS the honest evidence of reflection for
      every row that predates the R8B split. This is the contract `reflectionEstablished` encodes,
      and CASE A must read it under that contract rather than under today's.
    */
    const r = await rungsFor();
    expect(r.established).toEqual(["exposed", "reflected"]);
    expect(r.highestEstablished).toBe("reflected");
  });

  it("CASE A′ — an event that asks a DISTINCT reflection question establishes only EXPOSED until it is answered", async () => {
    const r = await rungsFor({ distinctReflectionQuestion: true, learnerReflection: false });
    expect(r.established).toEqual(["exposed"]);
    expect(r.highestEstablished).toBe("exposed");
  });

  it("CASE B — the distinct reflection is answered → REFLECTED", async () => {
    const r = await rungsFor({ distinctReflectionQuestion: true, learnerReflection: true });
    expect(r.established).toContain("reflected");
    expect(r.highestEstablished).toBe("reflected");
  });

  it("CASE C — the learner recorded their own decision → DECIDED", async () => {
    const r = await rungsFor({ decision: true });
    expect(r.established).toContain("decided");
    expect(r.highestEstablished).toBe("decided");
  });

  it("CASE D — a completed practice built from this training → PRACTICED", async () => {
    const r = await rungsFor({ practiceRun: true });
    expect(r.established).toContain("practiced");
    expect(r.highestEstablished).toBe("practiced");
  });

  it("CASE D′ — a published practice the learner never ran establishes nothing", async () => {
    const r = await rungsFor({ practiceRun: false });
    expect(r.established).not.toContain("practiced");
  });

  it("CASE E — a self-reported APPLIED establishes APPLIED and must NOT fabricate OBSERVED", async () => {
    const r = await rungsFor({ followUpOutcome: "APPLIED" });
    expect(r.established).toContain("applied");
    expect(r.established).not.toContain("observed");
    expect(r.established).not.toContain("sustained");
    expect(r.highestEstablished).toBe("applied");
  });

  it("CASE E′ — a non-terminal check-in is an honest answer, not a claim of application", async () => {
    for (const outcome of ["PARTLY_APPLIED", "NOT_YET", "BLOCKED"]) {
      const r = await rungsFor({ followUpOutcome: outcome });
      expect(r.established, outcome).not.toContain("applied");
    }
  });

  it("CASE F — one independent positive attestation → OBSERVED, without SUSTAINED", async () => {
    const r = await rungsFor({ observations: [{ outcome: "OBSERVED", observer: "obs-a", on: "2026-08-05" }] });
    expect(r.established).toContain("observed");
    expect(r.established).not.toContain("sustained");
    expect(r.highestEstablished).toBe("observed");
  });

  it("CASE F′ — OBSERVED does not require the learner to have reported anything", async () => {
    const r = await rungsFor({ observations: [{ outcome: "OBSERVED", observer: "obs-a", on: "2026-08-05" }] });
    expect(r.established).toContain("observed");
    expect(r.established).not.toContain("applied");
  });

  it("CASE G — two positive sightings spanning the training's own 7-day window → SUSTAINED", async () => {
    const r = await rungsFor({
      followUpDays: 7,
      observations: [
        { outcome: "OBSERVED", observer: "obs-a", on: "2026-08-01" },
        { outcome: "OBSERVED", observer: "obs-a", on: "2026-08-08" },
      ],
    });
    expect(r.established).toContain("observed");
    expect(r.established).toContain("sustained");
    expect(r.highestEstablished).toBe("sustained");
  });

  it("CASE G′ — two sightings INSIDE the window do not span it → OBSERVED only", async () => {
    const r = await rungsFor({
      followUpDays: 7,
      observations: [
        { outcome: "OBSERVED", observer: "obs-a", on: "2026-08-01" },
        { outcome: "OBSERVED", observer: "obs-a", on: "2026-08-04" },
      ],
    });
    expect(r.established).toContain("observed");
    expect(r.established).not.toContain("sustained");
  });

  it("CASE H — no observation at all → neither OBSERVED nor SUSTAINED, whatever else is true", async () => {
    const r = await rungsFor({
      decision: true,
      practiceRun: true,
      followUpOutcome: "APPLIED",
      observations: [],
    });
    expect(r.established).toContain("applied");
    expect(r.established).not.toContain("observed");
    expect(r.established).not.toContain("sustained");
  });

  it("CASE H′ — negative and uncertain reports are not confirmation", async () => {
    const r = await rungsFor({
      observations: [
        { outcome: "NOT_OBSERVED", observer: "obs-a", on: "2026-08-01" },
        { outcome: "UNABLE_TO_TELL", observer: "obs-b", on: "2026-08-09" },
      ],
    });
    expect(r.established).not.toContain("observed");
    expect(r.established).not.toContain("sustained");
  });

  it("CASE H″ — a training that published NO observable standard has no observation path", async () => {
    const r = await rungsFor({
      observableStandard: false,
      observations: [
        { outcome: "OBSERVED", observer: "obs-a", on: "2026-08-01" },
        { outcome: "OBSERVED", observer: "obs-a", on: "2026-08-08" },
      ],
    });
    expect(r.established).not.toContain("observed");
    expect(r.established).not.toContain("sustained");
  });

  it("CASE J — a journey that asked for no reflection or decision stays truthfully at EXPOSED", async () => {
    /*
      The R1 product correction, asserted: this record IS complete, and completion is not what
      this projection reports. Nothing above EXPOSED is fabricated to make the row look finished,
      and nothing marks it failed for stopping there.
    */
    const r = await rungsFor({ distinctReflectionQuestion: true, learnerReflection: false, decision: false });
    expect(r.established).toEqual(["exposed"]);
    expect(r.highestEstablished).toBe("exposed");
  });

  it("an INCOMPLETE record establishes nothing at all, however much else exists", async () => {
    const r = await rungsFor({ completed: false, decision: true, practiceRun: true, followUpOutcome: "APPLIED" });
    expect(r.established).toEqual([]);
    expect(r.highestEstablished).toBeNull();
  });

  it("an anonymous unclaimed completion cannot establish account-bound rungs", async () => {
    const r = await rungsFor({ userId: null, practiceRun: true });
    expect(r.established).not.toContain("practiced");
  });

  it("an unknown progress id yields the empty projection, never a throw", async () => {
    const map = await projectEvidenceByProgressId(makeFakeAdmin(seed()), [
      { progressId: "nope", eventId: EVENT, userId: USER },
    ]);
    expect(map.get("nope")).toEqual({ established: [], highestEstablished: null });
  });

  it("the full ladder is reachable when every fact is genuinely present", async () => {
    const r = await rungsFor({
      distinctReflectionQuestion: true,
      learnerReflection: true,
      decision: true,
      practiceRun: true,
      followUpOutcome: "APPLIED",
      followUpDays: 7,
      observations: [
        { outcome: "OBSERVED", observer: "obs-a", on: "2026-08-01" },
        { outcome: "OBSERVED", observer: "obs-a", on: "2026-08-08" },
      ],
    });
    expect(r.established).toEqual([
      "exposed", "reflected", "decided", "practiced", "applied", "observed", "sustained",
    ]);
    expect(r.highestEstablished).toBe("sustained");
  });
});

describe("R1 PRIVACY — the assembly reads private text and cannot return it", () => {
  const everythingPresent: SeedOpts = {
    distinctReflectionQuestion: true,
    learnerReflection: true,
    decision: true,
    followUpOutcome: "APPLIED",
    observations: [{ outcome: "OBSERVED", observer: "obs-a", on: "2026-08-05" }],
  };

  it("CASE I — a private reflection establishes REFLECTED while its text stays unreachable", async () => {
    const r = await rungsFor(everythingPresent);
    expect(r.established).toContain("reflected");
    const json = JSON.stringify(r);
    expect(json).not.toContain(SECRET_REFLECTION);
    expect(json).not.toContain(SECRET_COMPLETION);
    expect(json).not.toContain(DECISION_TEXT);
  });

  it("the serialized projection contains no private column KEY, at any nesting depth", async () => {
    const map = await projectEvidenceByProgressId(makeFakeAdmin(seed(everythingPresent)), [
      { progressId: PROGRESS, eventId: EVENT, userId: USER },
    ]);
    const json = JSON.stringify([...map.entries()]);
    for (const key of ["response_text", "learner_reflection_text", "decision_response_text", "reflection"]) {
      expect(json, key).not.toContain(key);
    }
  });

  it("the projection carries ONLY the two evidence keys — no field can smuggle text in later", async () => {
    const r = await rungsFor(everythingPresent);
    expect(Object.keys(r).sort()).toEqual(["established", "highestEstablished"]);
    // Every value is a rung name from the closed ladder, never free text.
    for (const v of r.established) {
      expect(["exposed", "reflected", "decided", "practiced", "applied", "observed", "sustained"]).toContain(v);
    }
  });

  it("listMyEvidence is owner-scoped and returns rung names only", async () => {
    const tables = seed(everythingPresent);
    tables.foundry_event_training_progress!.push({
      id: "prog-other",
      event_id: EVENT,
      completed_at: "2026-08-02T02:00:00Z",
      response_text: "SOMEONE ELSE'S PRIVATE ANSWER",
      learner_reflection_text: "SOMEONE ELSE'S PRIVATE REFLECTION",
      decision_response_text: null,
      linked_user_id: "user-2",
    });
    const items = await listMyEvidence(makeFakeAdmin(tables), USER);
    expect(items.map((i) => i.entryId)).toEqual([PROGRESS]); // never another learner's row
    const json = JSON.stringify(items);
    expect(json).not.toContain("SOMEONE ELSE'S PRIVATE ANSWER");
    expect(json).not.toContain(SECRET_REFLECTION);
    expect(json).not.toContain("response_text");
  });
});

describe("R1 FAIL-SOFT — a broken read removes rungs, it never invents one", () => {
  it("an unreadable observation table cannot produce OBSERVED", async () => {
    const tables = seed({ observations: [{ outcome: "OBSERVED", observer: "obs-a", on: "2026-08-05" }] });
    const admin = makeFakeAdmin(tables);
    const realFrom = admin.from.bind(admin) as (t: string) => unknown;
    (admin as unknown as { from: (t: string) => unknown }).from = (t: string) => {
      if (t === "foundry_behavior_observations") throw new Error("read failure");
      return realFrom(t);
    };
    const map = await projectEvidenceByProgressId(admin, [{ progressId: PROGRESS, eventId: EVENT, userId: USER }]);
    const r = map.get(PROGRESS)!;
    expect(r.established).not.toContain("observed");
    expect(r.established).toContain("exposed"); // the rest of the record still reads honestly
  });

  it("an unreadable progress table yields the empty projection rather than throwing", async () => {
    const admin = makeFakeAdmin(seed());
    (admin as unknown as { from: (t: string) => unknown }).from = () => {
      throw new Error("read failure");
    };
    const map = await projectEvidenceByProgressId(admin, [{ progressId: PROGRESS, eventId: EVENT, userId: USER }]);
    expect(map.get(PROGRESS)).toEqual({ established: [], highestEstablished: null });
  });
});
