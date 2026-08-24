import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Slice 3.2L-R7 — the prompt must AUTHORISE what the validator requires.
 *
 * The first v4 window refused `non_observable_standard`. The prompt had handed the Host's
 * "Create a shared handoff standard" over as "the behavior expected afterwards", told the
 * model to describe creating the construct, then forbidden a standard about creating a
 * construct — and never once said that designing a future behaviour is allowed at all.
 *
 * These drive the REAL prompt builder and assert the contradiction is gone. No paid call.
 */

const chatCreate = vi.fn();
vi.mock("@/lib/bty/llm/client", () => ({
  isLlmAvailable: () => true,
  getLlmModel: () => "fake-model",
  getLlmClient: () => ({ chat: { completions: { create: chatCreate } } }),
}));

import { generateProgram } from "./programAuthorshipService";
import { CONTRACT_FIELD_STORAGE } from "@/domain/foundry/module/program-coherence";
import { programContext, programContextFingerprint, PROGRAM_AUTHORSHIP_VERSION, programAuthorshipVersionNumber } from "@/domain/foundry/module/program-authorship";
import type { BuilderAnswers } from "@/domain/foundry/module/module-builder";

/** The EXACT canonical draft answers that produced parent 604d09e5. */
const ANSWERS: BuilderAnswers = {
  problem: "Our handoffs are inconsistent.",
  audienceType: "everyone",
  recurringMoment: "at each handoff point",
  observableBehavior: "Create a shared handoff standard.",
  successEvidence: "Handoff record",
  learningNeeds: ["know", "decide", "practice"],
  materialIntent: "youtube",
  materialText: "https://youtu.be/x",
  completionPrompt: "What specific elements will you include in your handoff record?",
  arenaRecommended: true,
  followUpDays: 7,
};

const el = (kind: string, content: string, rationale = "because it fits") => ({ kind, content, rationale });

/** A program whose behaviour contract is exactly the G3 middle ground. */
const middleGround = () => ({
  program: {
    display_title: "Handing over without gaps",
    elements: [
      el("why_it_matters", "When a handoff misses a step, the next person starts without knowing what changed."),
      // Derived kinds still need a well-formed string: the element checks run on every
      // kind, and only the DISPLAYED text is replaced by the rendered contract.
      el("observable_standard", "The outgoing member states each unfinished item at shift change."),
      el("scenario", "The shift ran late and two people are already waiting to ask you something."),
      el("action_decision", "I will state each unfinished item at my next shift change."),
      el("field_application", "At your next shift change you state each unfinished item aloud."),
      el("completion_check", "What will you say at your next handover that you did not say before?"),
      el("follow_up", "In seven days you will be asked what you actually said at handover."),
    ],
    assumptions: [],
    warnings: [],
    behavior_contract: {
      actor: "the outgoing team member",
      trigger: "at shift change, before leaving the floor",
      action_verb: "state",
      action_detail: "each unfinished item and identify its next owner",
      completion: { confirmed_by: "the person taking over", confirmation_action: "repeat the open items back" },
    },
    scenario_contract: { pressure_frame: "time_is_short" },
    completion_contract: { verification_target: "the_behaviour", response_mode: "name_the_moment" },
    follow_up_contract: { review_focus: "what_you_said", confirmer: "self_report" },
  },
});

const respond = (body: unknown) => ({
  choices: [{ message: { content: JSON.stringify(body) }, finish_reason: "stop" }],
  usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
});

function makeAdmin() {
  const calls: Record<string, unknown>[] = [];
  const attempts: Record<string, unknown>[] = [];
  let seq = 0;
  const admin = {
    from(table: string) {
      const isCalls = table === "foundry_program_generation_attempt_calls";
      const chain: Record<string, unknown> = {};
      const self = () => chain as never;
      chain.select = () => self();
      chain.eq = () => self();
      chain.is = () => self();
      chain.insert = (row: Record<string, unknown>) => {
        /*
          Slice 3.2P-W1-R1: these ids stand in for `uuid` primary keys, and the generation
          service now refuses to spend on an attempt id it could never query back. A fake that
          hands out "attempt-1" is not imitating the database it replaces. Deterministic, so
          every assertion below stays stable.
        */
        const n = ++seq;
        const id = `${isCalls ? "ca11" : "a77e"}${String(n).padStart(4, "0")}-0000-4000-8000-000000000000`;
        (isCalls ? calls : attempts).push({ id, ...row });
        const ins: Record<string, unknown> = {};
        ins.select = () => ins as never;
        ins.maybeSingle = async () => ({ data: { id }, error: null });
        return ins as never;
      };
      chain.update = (patch: Record<string, unknown>) => {
        const upd: Record<string, unknown> = {};
        upd.eq = (_c: string, v: unknown) => {
          const t = (isCalls ? calls : attempts).find((r) => r.id === v);
          if (t) Object.assign(t, patch);
          return upd as never;
        };
        return upd as never;
      };
      chain.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(res);
      return chain as never;
    },
  };
  return { admin: admin as never, calls, attempts };
}

const run = (admin: never) =>
  generateProgram(admin, {
    draftId: "093b0361-7cc8-4688-9f93-396d60582501",
    ownerUserId: "owner-1",
    submissionIntentId: "11111111-1111-1111-1111-111111111111",
    answers: ANSWERS,
    ctx: programContext(ANSWERS)!,
    locale: "en",
    deployVersion: "a".repeat(40),
    correlationId: "22222222-2222-2222-2222-222222222222",
    reloadDraftState: async () => ({
      draftId: "093b0361-7cc8-4688-9f93-396d60582501",
      ownerUserId: "owner-1",
      status: "draft" as const,
      fingerprint: programContextFingerprint(programContext(ANSWERS)!),
    }),
  });

/** The exact prompt pair the provider received. */
async function capturePrompt() {
  chatCreate.mockResolvedValueOnce(respond(middleGround()));
  const { admin } = makeAdmin();
  await run(admin);
  const msgs = (chatCreate.mock.calls[0][0] as { messages: { role: string; content: string }[] }).messages;
  return {
    system: msgs.find((m) => m.role === "system")!.content,
    user: msgs.find((m) => m.role === "user")!.content,
  };
}

beforeEach(() => chatCreate.mockReset());

describe("[3.2L-R7] G1/G2 — the model is told what it may design", () => {
  it("G1: the Host's design intent is NOT labelled as an expected behaviour", async () => {
    const { user } = await capturePrompt();
    expect(user).toContain("The change the host wants: Create a shared handoff standard.");
    // The exact mislabel that produced parent 604d09e5.
    expect(user).not.toContain("The behavior expected afterwards");
  });

  it("G2: the proposed construct and its authority mode reach the model", async () => {
    const { user, system } = await capturePrompt();
    expect(user).toContain("shared handoff standard");
    expect(user).toContain("PROPOSED. It does not exist yet");
    expect(system).toContain("DESIGNING A FUTURE BEHAVIOR IS NOT INVENTING A FACT");
    expect(system).toMatch(/ALLOWED \(designing future behavior\)/);
    expect(system).toMatch(/FORBIDDEN \(claiming today's reality\)/);
  });

  it("G8: no surviving instruction both demands and forbids creation as the behaviour", async () => {
    const { system } = await capturePrompt();
    // The v4 collision: "You MAY propose a new standard … Describe CREATING it."
    expect(system).not.toContain("Describe CREATING it.");
    // Creation language survives only where it is scoped to narrative.
    expect(system).toContain("This applies to NARRATIVE sections only, never to behavior_contract.");
    expect(system).toContain("the proposed thing is NEVER the trained behavior");
  });

  it("the middle ground is shown, and marked as illustration rather than a menu", async () => {
    const { system } = await capturePrompt();
    expect(system).toContain("states each unfinished item aloud");
    expect(system).toContain("identifies who owns the next action");
    expect(system).toContain("not a menu");
  });
});

describe("[3.2L-R7] G3/G7 — the canonical input can now reach an accepted contract", () => {
  it("G3/G7: the middle-ground contract is accepted, with no new Builder question", async () => {
    chatCreate.mockResolvedValueOnce(respond(middleGround()));
    const { admin, attempts } = makeAdmin();
    const r = await run(admin);
    expect(r.ok, r.ok ? "" : `code=${r.code} refusal=${r.refusal}`).toBe(true);
    if (r.ok) {
      const standard = r.value.proposal.elements.find((e) => e.kind === "observable_standard")!;
      /*
        BOTH PROPERTIES, AT THEIR NEW SEAMS (Slice R4-R5C14A). The compound action still composes
        with both verbs in base form (R7) — asserted on the CONTRACT, which is what R7 was ever
        about. The Host's criterion still reaches the learner whole — asserted on WHAT SUCCESS
        LOOKS LIKE, its own section, instead of as a tail on THE STANDARD.
      */
      expect(r.value.proposal.behaviorContract!.observableAction)
        .toBe("state each unfinished item and identify its next owner");
      expect(standard.content).not.toContain("Completion evidence:");
      expect(r.value.proposal.elements.find((e) => e.kind === "evidence")!.content).toBe("Handoff record");
    }
    expect(attempts[0]).toMatchObject({ outcome: "success", proposal_version: PROGRAM_AUTHORSHIP_VERSION });
  });

  it("G4: a meta behaviour is still refused, and now says WHICH role failed and why", async () => {
    const p = middleGround();
    p.program.behavior_contract.action_verb = "create";
    p.program.behavior_contract.action_detail = "a shared handoff standard";
    chatCreate.mockResolvedValueOnce(respond(p));
    const { admin, calls, attempts } = makeAdmin();
    const r = await run(admin);

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.refusal).toBe("non_observable_standard");
    expect(chatCreate, "a meaning fault is never retried").toHaveBeenCalledTimes(1);
    expect(attempts[0]).toMatchObject({ refusal_code: "non_observable_standard", refusal_kind: "observable_standard" });
    expect(calls[0]).toMatchObject({ validation_stage: "semantic", structural_retryable: false });
  });

  it("G10/G11: each role and each reason is independently diagnosable", async () => {
    /*
      ONE ROLE LEFT TO DIAGNOSE (Slice 3.2P-R3.6-R1). The completion cases went at v11 with the
      field; the actor and trigger cases went at v13 with theirs. `not_a_role`, `no_moment`,
      `no_confirmation` and the rest stay in the ledger vocabulary for the rows that hold them —
      what is gone is any current path that can produce them, because the model no longer writes
      the fields they judged.
    */
    const cases: [Record<string, unknown>, string, string][] = [
      /*
        An empty detail is LEGAL since 3.2P-R3.7-R2 — some actions are intransitive and forcing a
        fake object would be worse. What is still missing is a composed action too short to be
        one: "do" on its own.
      */
      [{ action_verb: "do", action_detail: "" }, "observable_action", "missing"],
      [{ action_verb: "create", action_detail: "a shared handoff standard" }, "observable_action", "meta_only"],
      [{ action_verb: "state", action_detail: "x".repeat(400) }, "observable_action", "too_long"],
    ];
    for (const [patch, field, reason] of cases) {
      const p = middleGround();
      Object.assign(p.program.behavior_contract, patch);
      chatCreate.mockReset();
      chatCreate.mockResolvedValueOnce(respond(p));
      const { admin } = makeAdmin();
      const r = await run(admin);
      expect(r.ok, JSON.stringify(patch)).toBe(false);
      if (!r.ok) expect(r.refusal, JSON.stringify(patch)).toBe("non_observable_standard");
      // The domain surfaces the closed-vocabulary pair the recorder will persist.
      expect(Object.values(CONTRACT_FIELD_STORAGE)).toContain(field);
      expect(["missing", "too_long", "meta_only", "not_a_role", "no_moment", "no_confirmation"]).toContain(reason);
    }
  });

  it("Q: a completion the model sends anyway is inert — it cannot reach the participant", async () => {
    const p = middleGround();
    Object.assign(p.program.behavior_contract, {
      completion: { confirmed_by: "the records manager", confirmation_action: "file the huddle note" },
    });
    chatCreate.mockReset();
    chatCreate.mockResolvedValueOnce(respond(p));
    const { admin } = makeAdmin();
    const r = await run(admin);
    /*
      Strict mode would refuse this at the provider; a non-strict path or a hand-built payload
      could still carry it. It is IGNORED rather than validated, so the generation succeeds and
      the invented role reaches no sentence — which is the W4 failure made structural.
    */
    expect(r.ok, r.ok ? "" : `code=${r.code}`).toBe(true);
    if (r.ok) {
      const text = r.value.proposal.elements.map((e) => e.content).join(" ");
      expect(text).not.toContain("records manager");
      // The Host's criterion reaches the learner in its own section now (Slice R4-R5C14A).
      expect(r.value.proposal.elements.find((e) => e.kind === "evidence")!.content).toBe("Handoff record");
      expect(r.value.proposal.behaviorContract!.completion).toEqual({ criterion: "Handoff record" });
    }
  });

  it("G5/G6: existing-state and content fabrication still refuse", async () => {
    const p = middleGround();
    p.program.elements[0] = el("why_it_matters", "Use the approved handoff record template, which the team already has.");
    // R11.4I: an honesty fault now gets ONE bounded repair under the same parent. Refusing
    // the repair too must still be terminal, so both calls return the same bad proposal.
    chatCreate.mockResolvedValueOnce(respond(p)).mockResolvedValueOnce(respond(p));
    const { admin } = makeAdmin();
    const r = await run(admin);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.refusal).toBe("material_fabrication");
    expect(chatCreate, "one repair, never a loop").toHaveBeenCalledTimes(2);
  });

  it("G9: the strict schema authority is unchanged", async () => {
    chatCreate.mockResolvedValueOnce(respond(middleGround()));
    const { admin } = makeAdmin();
    await run(admin);
    const arg = chatCreate.mock.calls[0][0] as { response_format: { type: string; json_schema: { strict: boolean; name: string } } };
    expect(arg.response_format.type).toBe("json_schema");
    expect(arg.response_format.json_schema.strict).toBe(true);
    expect(arg.response_format.json_schema.name).toBe("bty_guided_program_v12");
        /*
      NOT RE-PINNED (Slice R4-R5C14A-R1). This literal was v24, and before that v23, v17, v11 —
      fourteen files edited on every composition change for an assertion that was never about the
      number. What it defends is the SPLIT: acceptance moved, so the authority version moved; the
      wire shape did not, so the schema name did not. v25 is R4-R5C14A, where THE STANDARD became
      the Host's own behaviour sentence and WHAT SUCCESS LOOKS LIKE became their own evidence.
    */
    expect(PROGRAM_AUTHORSHIP_VERSION).toMatch(/^program_authorship_v\d+$/);
    expect(programAuthorshipVersionNumber()).toBeGreaterThanOrEqual(25);
  });
});
