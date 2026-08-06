import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Slice 3.2L-R4 — the two product refusals, driven through the REAL service.
 *
 * The fifth controlled window returned a program that was structurally perfect and
 * unusable. These drive the actual generation path against a fake provider and assert the
 * two things that matter operationally:
 *
 *   1. a MEANING fault costs exactly ONE call — never a repair call, because asking again
 *      does not make a standard observable;
 *   2. the transport still carries the exact strict schema, and an unsupported provider
 *      fails CLOSED rather than downgrading to free-form JSON.
 *
 * No paid provider call is made: the LLM client is mocked entirely.
 */

const chatCreate = vi.fn();
vi.mock("@/lib/bty/llm/client", () => ({
  isLlmAvailable: () => true,
  getLlmModel: () => "fake-model",
  getLlmClient: () => ({ chat: { completions: { create: chatCreate } } }),
}));

import { generateProgram } from "./programAuthorshipService";
import type { BuilderAnswers } from "@/domain/foundry/module/module-builder";
import {
  programContext,
  PROGRAM_JSON_SCHEMA,
  PROGRAM_SCHEMA_NAME,
  PROGRAM_AUTHORSHIP_VERSION,
  programContextFingerprint,
} from "@/domain/foundry/module/program-authorship";

/** know + decide + follow-up: why_it_matters, observable_standard, action_decision, field_application, completion_check, follow_up. */
const ANSWERS: BuilderAnswers = {
  problem: "Our handoffs are inconsistent.",
  audienceType: "everyone",
  observableBehavior: "Create a shared handoff standard.",
  successEvidence: "Handoff record",
  learningNeeds: ["know", "decide"],
  materialIntent: "youtube",
  materialText: "https://youtu.be/x",
  completionPrompt: "What will you include in your handoff record?",
  arenaRecommended: false,
  followUpDays: 7,
};

const el = (kind: string, content: string, rationale = "because it fits") => ({ kind, content, rationale });

/** A contract that NAMES the shared handoff standard while defining its behavior. */
const DEFINING_CONTRACT = {
  actor: "the outgoing person",
  trigger: "At the end of every shift, before leaving the floor",
  observable_action: "follows the shared handoff standard by stating each open item aloud to the person taking over",
  completion_signal: "the person taking over repeats the open items back and confirms them",
};

const validProgram = () => ({
  program: {
    display_title: "Handing over without gaps",
    elements: [
      el("why_it_matters", "When a handoff misses a step, the next person starts without knowing what changed."),
      el("observable_standard", "The outgoing person states each open item aloud before signing off."),
      el("action_decision", "I will state every open item aloud at handoff, even when the shift ran late."),
      el("field_application", "At your next shift change, you state the open items before leaving the floor."),
      el("completion_check", "What will you say aloud at your next handoff that you did not say before?"),
      el("follow_up", "In seven days you will be asked what you actually said. That is your own account, not an observation."),
    ],
    assumptions: [],
    warnings: [],
    evidence_language: "This shows exposure and a decision. It does not show behaviour changed.",
    behavior_contract: DEFINING_CONTRACT,
    // know + decide, no practice and no Arena → this design requires no scenario.
    scenario_contract: null,
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
        const id = `${isCalls ? "call" : "attempt"}-${++seq}`;
        (isCalls ? calls : attempts).push({ id, ...row });
        const ins: Record<string, unknown> = {};
        ins.select = () => ins as never;
        ins.maybeSingle = async () => ({ data: { id }, error: null });
        return ins as never;
      };
      chain.update = (patch: Record<string, unknown>) => {
        const upd: Record<string, unknown> = {};
        upd.eq = (_c: string, v: unknown) => {
          const target = (isCalls ? calls : attempts).find((r) => r.id === v);
          if (target) Object.assign(target, patch);
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

beforeEach(() => {
  chatCreate.mockReset();
});

describe("[3.2L-R4] G11 — a semantic refusal costs exactly one call", () => {
  it("a non-observable standard is refused without a repair call", async () => {
    const p = validProgram();
    // The EXACT live meaning, expressed as a contract.
    p.program.behavior_contract = {
      actor: "team members",
      trigger: "during all relevant transitions of work",
      observable_action: "a shared handoff standard is created and utilized",
      completion_signal: "the standard is created and utilized",
    };
    chatCreate.mockResolvedValueOnce(respond(p));

    const { admin, calls, attempts } = makeAdmin();
    const r = await run(admin);

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.refusal).toBe("non_observable_standard");
    expect(chatCreate, "a meaning fault is never retried").toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ call_sequence: 1, validation_stage: "semantic", structural_retryable: false });
    expect(attempts[0]).toMatchObject({ outcome: "validation_refused", refusal_code: "non_observable_standard" });
  });

  it("G6 live — the dependency inversion is refused without a repair call", async () => {
    const p = validProgram();
    // LIVE: apply uses the standard, then the closing question asks what it should contain.
    p.program.elements[3] = el(
      "field_application",
      "During the next project handoff meeting, I will actively use the shared handoff standard to ensure all necessary information is communicated clearly.",
    );
    p.program.elements[4] = el(
      "completion_check",
      "What specific elements will you include in the shared handoff standard to ensure all team members are informed and aligned?",
    );
    chatCreate.mockResolvedValueOnce(respond(p));

    const { admin, calls, attempts } = makeAdmin();
    const r = await run(admin);

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.refusal).toBe("dependency_inversion");
    expect(chatCreate).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ validation_stage: "semantic", structural_retryable: false });
    expect(attempts[0]).toMatchObject({ refusal_code: "dependency_inversion", refusal_kind: "completion_check" });
  });

  it("a MISSING contract is structural, so it DOES get one repair call", async () => {
    // The contrast that proves the split is real: shape faults are repairable, meaning
    // faults are not.
    const p = validProgram();
    delete (p.program as { behavior_contract?: unknown }).behavior_contract;
    chatCreate.mockResolvedValueOnce(respond(p)).mockResolvedValueOnce(respond(p));

    const { admin, calls } = makeAdmin();
    await run(admin);

    expect(chatCreate).toHaveBeenCalledTimes(2);
    expect(calls).toHaveLength(2);
    for (const c of calls) {
      expect(c).toMatchObject({ validation_stage: "structural", offending_path: "program.behavior_contract", structural_retryable: true });
    }
  });

  it("a complete, coherent program still succeeds", async () => {
    chatCreate.mockResolvedValueOnce(respond(validProgram()));
    const { admin, attempts } = makeAdmin();
    const r = await run(admin);
    expect(r.ok, r.ok ? "" : `refused: ${r.refusal}`).toBe(true);
    if (r.ok) {
      // THE STANDARD is the rendered contract, not the model's sentence.
      const standard = r.value.proposal.elements.find((e) => e.kind === "observable_standard")!;
      expect(standard.content).toContain("It is complete when");
      expect(standard.content).toContain("the person taking over repeats the open items back");
      expect(r.value.proposal.behaviorContract.actor).toBe("the outgoing person");
    }
    expect(attempts[0]).toMatchObject({ outcome: "success", proposal_version: PROGRAM_AUTHORSHIP_VERSION });
  });
});

describe("[3.2L-R4] G12 — the transport carries the exact strict schema", () => {
  it("the provider receives the v2 schema, strict, with the contract required", async () => {
    chatCreate.mockResolvedValueOnce(respond(validProgram()));
    const { admin } = makeAdmin();
    await run(admin);

    const arg = chatCreate.mock.calls[0][0] as {
      response_format: { type: string; json_schema: { name: string; strict: boolean; schema: typeof PROGRAM_JSON_SCHEMA } };
    };
    expect(arg.response_format.type).toBe("json_schema");
    expect(arg.response_format.json_schema.strict).toBe(true);
    expect(arg.response_format.json_schema.name).toBe(PROGRAM_SCHEMA_NAME);
    expect(arg.response_format.json_schema.schema).toBe(PROGRAM_JSON_SCHEMA);
  });

  it("the schema is exact: no additional properties, contract required with all four fields", () => {
    const program = PROGRAM_JSON_SCHEMA.properties.program;
    expect(PROGRAM_JSON_SCHEMA.additionalProperties).toBe(false);
    expect(program.additionalProperties).toBe(false);
    expect(program.required).toContain("behavior_contract");
    expect(program.required).toContain("scenario_contract");
    // Nullable, because a know-only design needs no scenario. Strict mode requires every
    // property in `required`, so absence is expressed as null — the `rationale` pattern.
    const scenario = program.properties.scenario_contract;
    expect(scenario.type).toEqual(["object", "null"]);
    expect(scenario.additionalProperties).toBe(false);
    expect([...scenario.required]).toEqual(["pressure_or_constraint", "context_detail"]);
    const contract = program.properties.behavior_contract;
    expect(contract.additionalProperties).toBe(false);
    expect([...contract.required]).toEqual(["actor", "trigger", "observable_action", "completion_signal"]);
    for (const f of contract.required) {
      expect((contract.properties as Record<string, { type: string }>)[f].type).toBe("string");
    }
    // The version names the materially different contract rather than relabelling v1.
    expect(PROGRAM_AUTHORSHIP_VERSION).toBe("program_authorship_v3");
    expect(PROGRAM_SCHEMA_NAME).toBe("bty_guided_program_v3");
  });

  it("a provider that cannot honour the schema fails CLOSED, never downgraded", async () => {
    chatCreate.mockRejectedValueOnce(
      Object.assign(new Error("400 response_format json_schema is not supported"), { status: 400 }),
    );
    const { admin, attempts } = makeAdmin();
    const r = await run(admin);

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("provider_error");
    // One call, and no second attempt at unconstrained JSON.
    expect(chatCreate).toHaveBeenCalledTimes(1);
    expect(attempts[0]).toMatchObject({ outcome: "provider_transport_error" });
  });
});
