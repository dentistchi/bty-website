import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * SLICE 3.2P-R0.3 — DID THE REPAIR STAY INSIDE ITS ENVELOPE?
 *
 * W2 (parent 9c2bf359) wrote two child calls carrying the SAME refusal:
 * `scenario_without_pressure` on `elements.scenario`, twice. The licensed retry definitely
 * ran. What the ledger could not say is which of these happened:
 *
 *   A  the retry edited only the two pressure fields it was licensed to edit, and the
 *      validator still found no real pressure;
 *   B  the retry rewrote something outside its licence, the freeze discarded it, and the
 *      service replaced the result with call 1's ORIGINAL refusal.
 *
 * Both write byte-identical rows, because the freeze overwrites `validated` BEFORE the child
 * is finalized. The difference existed only in a `console.info` on a Worker that keeps no logs.
 *
 * One nullable boolean closes it. NULL stays UNKNOWN — never "it held".
 */
const chatCreate = vi.fn();
vi.mock("@/lib/bty/llm/client", () => ({
  isLlmAvailable: () => true,
  getLlmModel: () => "test-model",
  getLlmClient: () => ({ chat: { completions: { create: chatCreate } } }),
}));

const spies = vi.hoisted(() => ({
  startProgramAttempt: vi.fn(async () => ({ ok: true as const, attemptId: "a77e0001-0000-4000-8000-000000000000" })),
  finalizeProgramAttempt: vi.fn(async () => undefined),
  startProgramCall: vi.fn(async () => ({ ok: true as const, callId: "ca110001-0000-4000-8000-000000000000" })),
  finalizeProgramCall: vi.fn(async () => undefined),
}));
vi.mock("./programGenerationRecorder", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./programGenerationRecorder")>()),
  ...spies,
}));

import { generateProgram } from "./programAuthorshipService";
import { REPAIR_FREEZE_VERDICT_ENABLED } from "./programGenerationRecorder";
import { programContext, programContextFingerprint, requiredProgramKinds } from "@/domain/foundry/module/program-authorship";
import type { BuilderAnswers } from "@/domain/foundry/module/module-builder";

/** Split a whole action phrase into the v15 wire fields (Slice 3.2P-R3.7-R2). */
const splitAction = (action: string) => {
  const [verb, ...rest] = action.trim().split(/\s+/);
  return { action_verb: verb ?? "", action_detail: rest.join(" ") };
};

/** The live pilot's Host intent — the exact source W2 ran against. */
const ANSWERS = {
  problem: "During morning huddles, team members report problems but leave without naming who will act.",
  audienceType: "leaders",
  evidenceType: "confirmed",
  followUpDays: 7,
  learningNeeds: ["shared_standard", "practice"],
  materialIntent: "pdf",
  sharedQuestion: "In your own words, what is the most important standard from this training?",
  successEvidence: "The huddle note records one owner and one deadline for every agreed action.",
  arenaRecommended: true,
  completionPrompt: "What specific phrases will you use in the next huddle?",
  recurringMoment: "During morning huddles",
  observableBehavior: "At the next huddle, what exact words will you use to confirm the owner, action, and deadline?",
  capabilityCandidate: "Accountability",
} as unknown as BuilderAnswers;

const KINDS = requiredProgramKinds(ANSWERS);
const CONTENT: Record<string, string> = {
  why_it_matters: "When a huddle ends without a named owner and a deadline, the problem that was raised stays exactly where it was.",
  observable_standard: "The huddle leader names one owner and one deadline for every agreed action before the group leaves.",
  scenario: "The huddle is running late and people are already standing to leave.",
  reflection: "In your own words, what is the most important standard from this training?",
  field_application: "At the next morning huddle, name one owner and one deadline for every agreed action and write them in the huddle note.",
  completion_check: "What exactly will you say at the next morning huddle to name the owner and the deadline?",
  follow_up: "In seven days you will be asked what you actually said at the huddle.",
};
const CONTRACT = {
  actor: "the huddle leader",
  trigger: "at each morning huddle, before the group leaves",
  action_verb: "name", action_detail: "one owner and one deadline for every agreed action and writes them in the huddle note",
  completion: { confirmed_by: "the named owner", confirmation_action: "repeat back the action and the deadline" },
};

const program = (over: Record<string, unknown> = {}, content = CONTENT) => ({
  program: {
    display_title: "End every huddle with an owner and a deadline",
    elements: KINDS.map((k) => ({ kind: k, content: content[k], rationale: "grounded in the host's own answers" })),
    assumptions: ["the team holds a morning huddle"],
    warnings: ["a huddle nobody attends is an attendance problem, not a training one"],
    behavior_contract: CONTRACT,
    scenario_contract: { pressure_condition: "the huddle is running late and people are already standing to leave", pressure_detail: null },
    completion_contract: { verification_target: "the_behaviour", response_mode: "state_what_you_will_say" },
    follow_up_contract: { review_focus: "what_you_said", confirmer: "self_report" },
    ...over,
  },
});

const respond = (body: unknown) => ({
  choices: [{ message: { content: JSON.stringify(body) }, finish_reason: "stop" }],
  usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
});

/** W2's exact first refusal: a scenario naming nothing the floor recognises. */
const NO_PRESSURE = program({
  scenario_contract: { pressure_condition: "the team works hard every day", pressure_detail: null },
});
/**
 * SINCE 3.2P-A1-R3 A REPAIR RETURNS ITS LICENCE, NOT A PROGRAM.
 *
 * A1 proved the whole-program retry unwinnable: the model was told to preserve content it was
 * never shown, and judged on exact serialisation. The retry now answers a patch schema — here,
 * the two scenario-pressure fields — and the server merges it into a baseline it kept.
 */
const pressurePatch = (pressure_condition: string, pressure_detail: string | null = null) => ({
  pressure_condition, pressure_detail,
});
/**
 * A patch carrying a field its licence does not name. The schema makes this impossible at the
 * provider; the merge refuses it anyway, so a server-side mistake cannot slip through.
 */
const OUT_OF_LICENCE = { ...pressurePatch("a queue is building at the desk"), elements: [] };
/** A patch that stays inside its licence and still names no real pressure. */
const STILL_NO_PRESSURE = pressurePatch("the team is focused and everything moves along");
/** A patch that fixes exactly the licensed field. */
const REPAIRED = pressurePatch("a queue is building at the desk and two people are waiting");
/** A whole valid program — what the FIRST call answers, and only the first. */
const VALID_PROGRAM = program();

const admin = { from: () => ({}), rpc: async () => ({ data: null, error: null }) } as unknown as SupabaseClient;

async function run() {
  return generateProgram(admin, {
    draftId: "3e079b1b-0077-48e6-80f7-fb7869b7eef1",
    ownerUserId: "ee9d2075-f4ae-4949-9392-38865c2cab22",
    submissionIntentId: "11111111-2222-4333-8444-555555555555",
    answers: ANSWERS,
    ctx: programContext(ANSWERS)!,
    locale: "en",
    deployVersion: "test",
    correlationId: "66666666-7777-4888-8999-aaaaaaaaaaaa",
    verifiedArtifacts: ["education.pdf"],
    reloadDraftState: async () => ({
      draftId: "3e079b1b-0077-48e6-80f7-fb7869b7eef1",
      ownerUserId: "ee9d2075-f4ae-4949-9392-38865c2cab22",
      status: "draft",
      fingerprint: programContextFingerprint(programContext(ANSWERS)!),
    }),
  });
}

type Finalize = import("./programGenerationRecorder").FinalizeProgramCallInput;
const calls = (): Finalize[] =>
  (spies.finalizeProgramCall.mock.calls as unknown as unknown[][]).map((c) => c[1] as Finalize);

beforeEach(() => {
  chatCreate.mockReset();
  spies.finalizeProgramCall.mockClear();
  spies.startProgramCall.mockClear();
  spies.finalizeProgramAttempt.mockClear();
});

describe("[3.2P-R0.3] the freeze verdict is durable, and three-valued", () => {
  it("A — the initial authorship call is never evaluated, so it stores NULL", async () => {
    chatCreate.mockResolvedValueOnce(respond(VALID_PROGRAM));
    await run();
    expect(calls()).toHaveLength(1);
    expect(calls()[0].repairFreezeViolated, "not evaluated ⇒ NULL, never false").toBeNull();
  });

  it("B — a licensed retry that stays inside its envelope stores FALSE", async () => {
    chatCreate.mockResolvedValueOnce(respond(NO_PRESSURE)).mockResolvedValueOnce(respond(STILL_NO_PRESSURE));
    const r = await run();
    expect(r.ok).toBe(false);
    const c = calls();
    expect(c).toHaveLength(2);
    expect(c[0].repairFreezeViolated).toBeNull();
    expect(c[1].repairFreezeViolated, "evaluated and held").toBe(false);
    // …and it failed on its own merits, which is now distinguishable from a discard.
    expect(c[1].refusal?.code).toBe("scenario_without_pressure");
  });

  it("C — a retry that leaves its envelope stores TRUE", async () => {
    chatCreate.mockResolvedValueOnce(respond(NO_PRESSURE)).mockResolvedValueOnce(respond(OUT_OF_LICENCE));
    await run();
    const c = calls();
    expect(c).toHaveLength(2);
    expect(c[1].repairFreezeViolated, "evaluated and violated").toBe(true);
  });

  it("D — a violation still preserves the ORIGINAL refusal on the row", async () => {
    chatCreate.mockResolvedValueOnce(respond(NO_PRESSURE)).mockResolvedValueOnce(respond(OUT_OF_LICENCE));
    await run();
    const c = calls();
    // The discarded repair's own fault would have been `missing_required_kind/follow_up`.
    // What is stored is call 1's refusal — truth preservation, unchanged by this slice.
    expect(c[1].refusal).toEqual({ code: "scenario_without_pressure", kind: "scenario" });
    expect(c[1].refusal?.code).not.toBe("missing_required_kind");
    // Which is exactly why the boolean has to exist: the codes alone cannot tell B from C.
    expect(c[1].refusal).toEqual(c[0].refusal);
    expect(c[1].repairFreezeViolated).not.toBe(c[0].repairFreezeViolated);
  });

  it("E — a violation stays bounded: no child 3", async () => {
    chatCreate.mockResolvedValueOnce(respond(NO_PRESSURE)).mockResolvedValueOnce(respond(OUT_OF_LICENCE));
    await run();
    expect(chatCreate).toHaveBeenCalledTimes(2);
    expect(spies.startProgramCall).toHaveBeenCalledTimes(2);
    expect(calls()).toHaveLength(2);
  });

  it("G — a SUCCESSFUL licensed repair stores FALSE and still succeeds", async () => {
    chatCreate.mockResolvedValueOnce(respond(NO_PRESSURE)).mockResolvedValueOnce(respond(REPAIRED));
    const r = await run();
    expect(r.ok, "the repair is accepted").toBe(true);
    const c = calls();
    expect(c[1].repairFreezeViolated).toBe(false);
    expect(c[1].outcome).toBe("success");
    expect(c[1].refusal ?? null).toBeNull();
  });

  it("H — a NON-repairable refusal is never evaluated: one call, NULL", async () => {
    // A question-shaped observable_action is `non_observable_standard`, which is terminal.
    chatCreate.mockResolvedValueOnce(
      respond(program({ behavior_contract: { ...CONTRACT, ...splitAction(ANSWERS.observableBehavior as string) } })),
    );
    await run();
    const c = calls();
    expect(c).toHaveLength(1);
    expect(chatCreate, "no retry for a terminal refusal").toHaveBeenCalledTimes(1);
    expect(c[0].repairFreezeViolated).toBeNull();
    expect(c[0].refusal?.code).toBe("non_observable_standard");
  });
});

describe("[3.2P-R0.3] historical compatibility", () => {
  it("F — the column is live, so the verdict is written; historical rows keep their own NULL", async () => {
    /*
      Gated FALSE while 20260817000000 was held, so the payload stayed byte-identical to the
      pre-migration one and a generation could not fail on a column that did not exist. The
      Founder has applied it and the live column was verified before this flipped, so the
      verdict is now persisted. Historical rows are untouched by that: they hold NULL, which
      means UNKNOWN, and nothing backfills them.
    */
    expect(REPAIR_FREEZE_VERDICT_ENABLED).toBe(true);

    const writes: Record<string, unknown>[] = [];
    const capturing = {
      from() {
        let captured: Record<string, unknown> = {};
        const b: Record<string, unknown> = {
          update(p: Record<string, unknown>) { captured = p; return b; },
          eq() { writes.push(captured); return Promise.resolve({ data: null, error: null }); },
        };
        return b;
      },
    } as unknown as SupabaseClient;

    /*
      The module is mocked for the fixtures above, so the REAL writer is imported here rather
      than through that mock — otherwise this would be asserting on a spy.
    */
    const actual = await vi.importActual<typeof import("./programGenerationRecorder")>("./programGenerationRecorder");
    await actual.finalizeProgramCall(capturing, {
      callId: "ca110001-0000-4000-8000-000000000000",
      outcome: "schema_invalid",
      durationMs: 1000,
      refusal: { code: "scenario_without_pressure", kind: "scenario" },
      repairFreezeViolated: true,
    });
    expect(Object.keys(writes[0]), "the verdict now reaches the row")
      .toContain("repair_freeze_violated");
    expect(writes[0].repair_freeze_violated).toBe(true);
    // Every other diagnostic still goes out, so nothing is lost by the gate.
    expect(writes[0]).toMatchObject({ outcome: "schema_invalid", refusal_code: "scenario_without_pressure" });
  });
});
