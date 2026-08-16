import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { projectEvidenceByProgressId, listMyEvidence, listMyLearningRecordIds } from "./learnerEvidenceService";

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

/*
  DETERMINISTIC CLOCK + READER FRAME (Slice 3.2R-R3-R2). `listMyEvidence` now answers a
  "has this checkpoint arrived?" question, so every call needs a fixed instant and tz — never
  `Date.now()`. NOW is 13:00 PDT on BTY day 2026-08-15; DUE_TODAY is that day's 05:00-local start,
  which is exactly the instant `computeFollowUpDue` materializes.
*/
const TZ = "America/Los_Angeles";
const NOW = new Date("2026-08-15T20:00:00Z");
const DUE_TODAY = "2026-08-15T12:00:00Z";

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
  /** The materialized deadline. Defaults to "the checkpoint arrived today"; null = column absent. */
  followUpDueAt?: string | null;
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
            // Slice 3.2R-R3-R1 — the real column pair. `canCheckInAgain` is a question about
            // (status, outcome), and a fixture that carried only the outcome could not tell a
            // settled answer from a pending one.
            status: o.followUpOutcome ? "RESPONDED" : "PENDING",
            outcome: o.followUpOutcome ?? null,
            // Slice 3.2R-R3-R2 — the real deadline column. `openFollowUp` asks whether the
            // checkpoint has arrived, and a fixture without it could not pose that question.
            due_at: o.followUpDueAt === undefined ? DUE_TODAY : o.followUpDueAt,
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
    const items = await listMyEvidence(makeFakeAdmin(tables), USER, NOW, TZ);
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

/**
 * SLICE 3.2R-R3-R1 — the return route, on the learner's own record.
 *
 * 3.2M-3 gave the service a later check-in and no surface could reach it. `listMyEvidence` is
 * where My Learning learns that a way back exists, so what has to be proven here is that it is
 * offered on exactly the settled non-terminal rows, carries the DURABLE obligation id, and is a
 * navigation target that establishes nothing.
 */
describe("R3-R1 checkInAgain — which follow-ups can still take a later report", () => {
  const listFor = async (o: SeedOpts = {}) =>
    (await listMyEvidence(makeFakeAdmin(seed(o)), USER, NOW, TZ))[0]!;

  it("every non-terminal settled answer offers a way back, carrying the durable followup id", async () => {
    for (const outcome of ["PARTLY_APPLIED", "NOT_YET", "BLOCKED"]) {
      const item = await listFor({ followUpOutcome: outcome });
      expect(item.checkInAgain, outcome).toEqual([
        { followupId: FOLLOWUP, followUpDays: 7, outcome },
      ]);
    }
  });

  it("APPLIED is terminal — the record offers no way back", async () => {
    const item = await listFor({ followUpOutcome: "APPLIED" });
    expect(item.checkInAgain).toEqual([]);
    // ...and the rung it established is untouched by that absence.
    expect(item.evidence.established).toContain("applied");
  });

  it("a PENDING obligation is not a later check-in — the first-response path owns it", async () => {
    const item = await listFor({ followUpOutcome: null });
    expect(item.checkInAgain).toEqual([]);
  });

  it("a record with no follow-up at all offers nothing, and is not an error", async () => {
    const item = await listFor();
    expect(item.checkInAgain).toEqual([]);
    expect(item.evidence.established).toContain("exposed");
  });

  it("the target is a NAVIGATION address only — it carries no learner text", async () => {
    const item = await listFor({ followUpOutcome: "NOT_YET", decision: true, learnerReflection: true });
    const raw = JSON.stringify(item.checkInAgain);
    expect(raw).not.toContain(SECRET_COMPLETION);
    expect(raw).not.toContain(SECRET_REFLECTION);
    expect(raw).not.toContain(DECISION_TEXT);
  });

  it("two checkpoints on one record stay two distinct obligations, ordered by checkpoint", async () => {
    /*
      Identity is the whole point: a 7- and a 30-day follow-up are two different questions with
      two different answers, and matching one by event or title would open the wrong one.
    */
    const tables = seed({ followUpOutcome: "NOT_YET" });
    tables.foundry_participant_followups = [
      { id: "fu-30", progress_id: PROGRESS, event_id: EVENT, user_id_snapshot: USER, follow_up_days: 30, status: "RESPONDED", outcome: "BLOCKED", due_at: DUE_TODAY },
      { id: "fu-7", progress_id: PROGRESS, event_id: EVENT, user_id_snapshot: USER, follow_up_days: 7, status: "RESPONDED", outcome: "NOT_YET", due_at: DUE_TODAY },
    ];
    const item = (await listMyEvidence(makeFakeAdmin(tables), USER, NOW, TZ))[0]!;
    expect(item.checkInAgain).toEqual([
      { followupId: "fu-7", followUpDays: 7, outcome: "NOT_YET" },
      { followupId: "fu-30", followUpDays: 30, outcome: "BLOCKED" },
    ]);
  });

  it("an APPLIED checkpoint alongside a non-terminal one offers only the one still open", async () => {
    const tables = seed({ followUpOutcome: "APPLIED" });
    tables.foundry_participant_followups = [
      { id: "fu-7", progress_id: PROGRESS, event_id: EVENT, user_id_snapshot: USER, follow_up_days: 7, status: "RESPONDED", outcome: "APPLIED", due_at: DUE_TODAY },
      { id: "fu-30", progress_id: PROGRESS, event_id: EVENT, user_id_snapshot: USER, follow_up_days: 30, status: "RESPONDED", outcome: "NOT_YET", due_at: DUE_TODAY },
    ];
    const item = (await listMyEvidence(makeFakeAdmin(tables), USER, NOW, TZ))[0]!;
    expect(item.checkInAgain).toEqual([{ followupId: "fu-30", followUpDays: 30, outcome: "NOT_YET" }]);
    expect(item.evidence.established).toContain("applied"); // the APPLIED report still stands
  });

  it("an unreadable obligation table hides the CTA — it can never invent one", async () => {
    const admin = makeFakeAdmin(seed({ followUpOutcome: "NOT_YET" }));
    const realFrom = admin.from.bind(admin) as (t: string) => unknown;
    (admin as unknown as { from: (t: string) => unknown }).from = (t: string) => {
      if (t === "foundry_participant_followups") throw new Error("read failure");
      return realFrom(t);
    };
    const item = (await listMyEvidence(admin, USER, NOW, TZ))[0]!;
    expect(item.checkInAgain).toEqual([]);
  });
});

/**
 * SLICE 3.2R-R3-R2 — the door Today expiry must not close.
 *
 * R3-R2 bounds how long Today asks about an unanswered follow-up. On its own that bound would
 * convert "we stop asking" into "you can no longer answer" — the exact dead end 3.2M-3 spent a
 * slice removing. `openFollowUp` is the compensating route, and what has to be proven here is that
 * it survives staleness, carries the DURABLE obligation id, and can never be confused with the
 * later-check-in route that sits beside it.
 */
describe("R3-R2 openFollowUp — reaching an obligation with no answer yet", () => {
  /** Days RELATIVE to NOW's BTY day (2026-08-15), expressed as the stored 05:00-local instant. */
  const dueDaysAgo = (n: number) => {
    const [y, mo, d] = [2026, 8, 15];
    const key = new Date(Date.UTC(y, mo - 1, d) - n * 86_400_000).toISOString().slice(0, 10);
    for (const c of [`${key}T12:00:00Z`, `${key}T13:00:00Z`]) {
      const dt = new Date(c);
      const p = new Intl.DateTimeFormat("en-US", {
        timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23",
      }).formatToParts(dt);
      const g = (t: string) => p.find((x) => x.type === t)!.value;
      if (`${g("year")}-${g("month")}-${g("day")}` === key && g("hour") === "05") return dt.toISOString();
    }
    throw new Error(`no 05:00 local instant for ${key}`);
  };

  const listFor = async (o: SeedOpts = {}) =>
    (await listMyEvidence(makeFakeAdmin(seed(o)), USER, NOW, TZ))[0]!;

  it("an obligation due today is reachable, carrying the durable followup id", async () => {
    const item = await listFor({ followUpOutcome: null });
    expect(item.openFollowUp).toEqual([{ followupId: FOLLOWUP, followUpDays: 7 }]);
  });

  it("STAYS reachable once Today has stopped asking — 8, 30 and 19 days past due", async () => {
    /*
      The load-bearing assertion of the slice. 19 days is the real age of the oldest live PENDING
      obligation measured in production before R3-R2; 8 is the first day Today drops it.
    */
    for (const days of [8, 19, 30, 365]) {
      const item = await listFor({ followUpOutcome: null, followUpDueAt: dueDaysAgo(days) });
      expect(item.openFollowUp, `${days} days past due`).toEqual([{ followupId: FOLLOWUP, followUpDays: 7 }]);
    }
  });

  it("is NOT offered before the checkpoint arrives", async () => {
    const item = await listFor({ followUpOutcome: null, followUpDueAt: dueDaysAgo(-3) });
    expect(item.openFollowUp).toEqual([]);
  });

  it("is NOT offered once the obligation has been answered, at any outcome", async () => {
    for (const outcome of ["NOT_YET", "PARTLY_APPLIED", "BLOCKED", "APPLIED"]) {
      const item = await listFor({ followUpOutcome: outcome, followUpDueAt: dueDaysAgo(30) });
      expect(item.openFollowUp, outcome).toEqual([]);
    }
  });

  it("the two routes are mutually exclusive on every row this service emits", async () => {
    // Structural proof that My Learning can never render "Check in again" over an unanswered row.
    for (const outcome of [null, "NOT_YET", "PARTLY_APPLIED", "BLOCKED", "APPLIED"]) {
      for (const days of [-3, 0, 7, 8, 30]) {
        const item = await listFor({ followUpOutcome: outcome, followUpDueAt: dueDaysAgo(days) });
        const overlap = item.openFollowUp.filter((o) =>
          item.checkInAgain.some((c) => c.followupId === o.followupId),
        );
        expect(overlap, `${outcome} @ ${days}`).toEqual([]);
      }
    }
  });

  it("two checkpoints stay two distinct obligations — no identity collision", async () => {
    /*
      A record may carry a 7- and a 30-day follow-up. They are two different questions, and the
      surface must open the exact one tapped — never a match by event, title or checkpoint.
    */
    const tables = seed({ followUpOutcome: null });
    tables.foundry_participant_followups = [
      { id: "fu-30", progress_id: PROGRESS, event_id: EVENT, user_id_snapshot: USER, follow_up_days: 30, status: "PENDING", outcome: null, due_at: dueDaysAgo(30) },
      { id: "fu-7", progress_id: PROGRESS, event_id: EVENT, user_id_snapshot: USER, follow_up_days: 7, status: "PENDING", outcome: null, due_at: dueDaysAgo(9) },
    ];
    const item = (await listMyEvidence(makeFakeAdmin(tables), USER, NOW, TZ))[0]!;
    expect(item.openFollowUp).toEqual([
      { followupId: "fu-7", followUpDays: 7 },
      { followupId: "fu-30", followUpDays: 30 },
    ]);
  });

  it("one answered and one unanswered checkpoint each take their OWN route", async () => {
    const tables = seed({ followUpOutcome: null });
    tables.foundry_participant_followups = [
      { id: "fu-7", progress_id: PROGRESS, event_id: EVENT, user_id_snapshot: USER, follow_up_days: 7, status: "RESPONDED", outcome: "NOT_YET", due_at: dueDaysAgo(30) },
      { id: "fu-30", progress_id: PROGRESS, event_id: EVENT, user_id_snapshot: USER, follow_up_days: 30, status: "PENDING", outcome: null, due_at: dueDaysAgo(9) },
    ];
    const item = (await listMyEvidence(makeFakeAdmin(tables), USER, NOW, TZ))[0]!;
    expect(item.openFollowUp).toEqual([{ followupId: "fu-30", followUpDays: 30 }]);
    expect(item.checkInAgain).toEqual([{ followupId: "fu-7", followUpDays: 7, outcome: "NOT_YET" }]);
  });

  it("a record with no follow-up at all offers nothing — D3 stays untouched", async () => {
    /*
      `follow_up_days = 0` is a valid no-follow-up configuration. Nothing here may invent an
      obligation so that My Learning has something to show.
    */
    const item = await listFor();
    expect(item.openFollowUp).toEqual([]);
    expect(item.checkInAgain).toEqual([]);
    expect(item.evidence.established).toContain("exposed");
  });

  it("a row with no stored deadline is dropped, never assumed due", async () => {
    const item = await listFor({ followUpOutcome: null, followUpDueAt: null });
    expect(item.openFollowUp).toEqual([]);
  });

  it("carries NO learner text and no date — an id and a checkpoint number", async () => {
    const item = await listFor({ followUpOutcome: null, decision: true, learnerReflection: true });
    const raw = JSON.stringify(item.openFollowUp);
    expect(raw).not.toContain(SECRET_COMPLETION);
    expect(raw).not.toContain(SECRET_REFLECTION);
    expect(raw).not.toContain(DECISION_TEXT);
    for (const t of item.openFollowUp) expect(Object.keys(t).sort()).toEqual(["followUpDays", "followupId"]);
  });

  it("an unreadable obligation table hides the door — it can never invent one", async () => {
    const admin = makeFakeAdmin(seed({ followUpOutcome: null }));
    const realFrom = admin.from.bind(admin) as (t: string) => unknown;
    (admin as unknown as { from: (t: string) => unknown }).from = (t: string) => {
      if (t === "foundry_participant_followups") throw new Error("read failure");
      return realFrom(t);
    };
    const item = (await listMyEvidence(admin, USER, NOW, TZ))[0]!;
    expect(item.openFollowUp).toEqual([]);
  });

  it("reading My Learning writes nothing — the fake exposes no mutating verb", async () => {
    /*
      Same structural argument the Today projection uses: `makeFakeAdmin` offers select/eq/in/order
      only, so an insert/update/upsert/delete on this path would throw rather than pass quietly.
      Asserted for the STALE row, since that is the transition a future slice might try to record.
    */
    const tables = seed({ followUpOutcome: null, followUpDueAt: dueDaysAgo(19) });
    const before = JSON.stringify(tables.foundry_participant_followups);
    const item = (await listMyEvidence(makeFakeAdmin(tables), USER, NOW, TZ))[0]!;
    expect(item.openFollowUp).toHaveLength(1);
    // The stored row is untouched: still PENDING, still no outcome, nothing appended.
    expect(JSON.stringify(tables.foundry_participant_followups)).toBe(before);
    expect(tables.foundry_participant_followups![0]).toMatchObject({ status: "PENDING", outcome: null });
  });
});

/**
 * SLICE 3.2R-R3-R2-R1 — one reachability authority, shared with Today.
 *
 * Today may only stop asking about a stale obligation once it can PROVE the learner still has a My
 * Learning door. The one thing it must not do is invent its own identity rule — a second copy of
 * "which records are mine" would drift, and the day it drifted Today would suppress an obligation
 * My Learning does not actually show. So both consult this function, and what has to be proven here
 * is that it agrees with `listMyEvidence` by construction and grants nothing to anyone.
 */
describe("R3-R2-R1 listMyLearningRecordIds — the shared My Learning record rule", () => {
  it("returns exactly the records listMyEvidence renders — the two cannot disagree", async () => {
    /*
      Agreement is asserted, not assumed: the same fixture is put to both, across shapes that could
      plausibly separate them (linked, unlinked, someone else's, incomplete).
    */
    const tables = seed({ followUpOutcome: null });
    tables.foundry_event_training_progress!.push(
      { id: "prog-other-user", event_id: EVENT, completed_at: "2026-08-02T02:00:00Z", response_text: null, learner_reflection_text: null, decision_response_text: null, linked_user_id: "user-2" },
      { id: "prog-anon", event_id: EVENT, completed_at: "2026-08-02T02:00:00Z", response_text: null, learner_reflection_text: null, decision_response_text: null, linked_user_id: null },
      { id: "prog-incomplete", event_id: EVENT, completed_at: null, response_text: null, learner_reflection_text: null, decision_response_text: null, linked_user_id: USER },
    );
    const admin = makeFakeAdmin(tables);
    const ids = await listMyLearningRecordIds(admin, USER);
    const rendered = new Set((await listMyEvidence(makeFakeAdmin(tables), USER, NOW, TZ)).map((i) => i.entryId));
    expect([...ids].sort()).toEqual([...rendered].sort());
    expect(ids.has(PROGRESS)).toBe(true);
  });

  it("an anonymous unclaimed completion is NOT a record — the measured live gap", async () => {
    // `linked_user_id = NULL` is the shape of live progress row `1ca75ade`. It has never been in
    // My Learning, and nothing here puts it there.
    const tables = seed({ followUpOutcome: null, userId: null });
    const ids = await listMyLearningRecordIds(makeFakeAdmin(tables), USER);
    expect(ids.size).toBe(0);
    expect((await listMyEvidence(makeFakeAdmin(tables), USER, NOW, TZ)).length).toBe(0);
  });

  it("another learner's completion is not this learner's record", async () => {
    const tables = seed({ followUpOutcome: null, userId: "user-2" });
    expect((await listMyLearningRecordIds(makeFakeAdmin(tables), USER)).size).toBe(0);
  });

  it("an unreadable table yields NO proven door — never a false positive", async () => {
    /*
      The fail-safe direction. Today reads an empty set as "unreachable" and keeps asking; the
      opposite default would strand somebody on a failed read.
    */
    const admin = makeFakeAdmin(seed({ followUpOutcome: null }));
    (admin as unknown as { from: (t: string) => unknown }).from = () => {
      throw new Error("read failure");
    };
    expect((await listMyLearningRecordIds(admin, USER)).size).toBe(0);
  });

  it("an anonymous caller gets nothing, and no query is attempted", async () => {
    const admin = makeFakeAdmin(seed({ followUpOutcome: null }));
    let touched = false;
    (admin as unknown as { from: (t: string) => unknown }).from = () => {
      touched = true;
      throw new Error("should not be reached");
    };
    expect((await listMyLearningRecordIds(admin, "")).size).toBe(0);
    expect(touched).toBe(false);
  });

  it("carries IDS ONLY — no titles, no text, no follow-up data", async () => {
    const ids = await listMyLearningRecordIds(makeFakeAdmin(seed({ followUpOutcome: null, decision: true, learnerReflection: true })), USER);
    const raw = JSON.stringify([...ids]);
    for (const secret of [SECRET_COMPLETION, SECRET_REFLECTION, DECISION_TEXT]) expect(raw).not.toContain(secret);
    expect([...ids]).toEqual([PROGRESS]);
  });

  it("NO IDENTITY EXPANSION — reading it claims nothing and mutates nothing", async () => {
    /*
      Part E, asserted rather than described. The compatibility exception must not be implemented by
      quietly attaching the unclaimed completion to somebody: the fake exposes no mutating verb, and
      the row is unchanged field for field afterwards. The gap stays visibly unresolved.
    */
    const tables = seed({ followUpOutcome: null, userId: null });
    const before = JSON.stringify(tables.foundry_event_training_progress);
    await listMyLearningRecordIds(makeFakeAdmin(tables), USER);
    await listMyEvidence(makeFakeAdmin(tables), USER, NOW, TZ);
    expect(JSON.stringify(tables.foundry_event_training_progress)).toBe(before);
    expect(tables.foundry_event_training_progress![0]!.linked_user_id).toBeNull();
  });

  it("no door is never read as permission to create one", async () => {
    // An unreachable record produces an empty set on EVERY call — it does not become reachable by
    // being asked about repeatedly.
    const tables = seed({ followUpOutcome: null, userId: null });
    for (let i = 0; i < 3; i++) {
      expect((await listMyLearningRecordIds(makeFakeAdmin(tables), USER)).size).toBe(0);
    }
    expect((await listMyEvidence(makeFakeAdmin(tables), USER, NOW, TZ)).flatMap((e) => e.openFollowUp)).toEqual([]);
  });

  it("when a door DOES exist, the exact durable followup id is still what travels", async () => {
    const tables = seed({ followUpOutcome: null });
    expect((await listMyLearningRecordIds(makeFakeAdmin(tables), USER)).has(PROGRESS)).toBe(true);
    const item = (await listMyEvidence(makeFakeAdmin(tables), USER, NOW, TZ))[0]!;
    expect(item.openFollowUp).toEqual([{ followupId: FOLLOWUP, followUpDays: 7 }]);
  });
});
