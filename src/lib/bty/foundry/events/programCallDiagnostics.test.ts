import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Slice 3.2L-R3 — each provider call keeps its OWN structural diagnosis.
 *
 * The fourth controlled window burned both authorized calls on the same fault, and the
 * ledger could say only `field_type / why_it_matters`. Two paths in one element emit that
 * code, so the failure was undiagnosable and the repair call was handed a code name with
 * no path.
 *
 * A structural fault belongs to ONE CALL. An attempt makes up to two, and they can fail
 * differently — so these tests drive the REAL service against a fake provider and assert
 * that call 2 can never overwrite what call 1 proved.
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
import { programContext, programContextFingerprint } from "@/domain/foundry/module/program-authorship";

const ANSWERS: BuilderAnswers = {
  problem: "Our handoffs are inconsistent.",
  audienceType: "everyone",
  observableBehavior: "Create a shared handoff standard.",
  successEvidence: "Handoff record",
  learningNeeds: ["know"],
  materialIntent: "youtube",
  materialText: "https://youtu.be/x",
  completionPrompt: "What will you include in your handoff record?",
  arenaRecommended: false,
  followUpDays: 0,
};

/** know-only, no arena, no follow-up → why_it_matters, observable_standard, completion_check. */
const el = (kind: string, content: unknown, rationale: unknown = "because it fits") => ({ kind, content, rationale });
const validProgram = () => ({
  program: {
    display_title: "Handing over without gaps",
    elements: [
      el("why_it_matters", "When a handoff misses a step, the next person starts without knowing what changed."),
      el("observable_standard", "The outgoing person states each open item aloud before signing off."),
      el("completion_check", "Which open item will you state aloud that you did not before?"),
    ],
    assumptions: [],
    warnings: [],
    // R4: THE STANDARD is rendered from this contract, so every valid program carries one.
    behavior_contract: {
      actor: "the outgoing person",
      trigger: "At the end of every shift, before signing off",
      observable_action: "states each open item aloud to the person taking over",
      completion: { confirmed_by: "the person taking over", confirmation_action: "repeat the open items back" },
    },
    // R5/R6: know-only design — no scenario, decision, application or follow-up required.
    scenario_contract: null,
    completion_contract: { verification_target: "the_behaviour", response_mode: "name_the_moment" },
    follow_up_contract: null,
  },
});

const respond = (body: unknown) => ({
  choices: [{ message: { content: JSON.stringify(body) }, finish_reason: "stop" }],
  usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
});

/** Records every recorder write in order, so overwrites are detectable. */
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
      chain.eq = (_c: string, v: unknown) => {
        (chain as { _id?: unknown })._id = v;
        return self();
      };
      chain.is = () => self();
      chain.insert = (row: Record<string, unknown>) => {
        const id = `${isCalls ? "call" : "attempt"}-${++seq}`;
        const stored = { id, ...row };
        (isCalls ? calls : attempts).push(stored);
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
    // The draft has not moved during the call, so post-provider revalidation passes and
    // the structural path is what these tests actually exercise.
    reloadDraftState: async () => ({
      draftId: "093b0361-7cc8-4688-9f93-396d60582501",
      ownerUserId: "owner-1",
      status: "draft",
      fingerprint: programContextFingerprint(programContext(ANSWERS)!),
    }),
  });

beforeEach(() => {
  chatCreate.mockReset();
  vi.spyOn(console, "info").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("[3.2L-R3] each provider call keeps its own diagnosis", () => {
  it("G1 — call 1 fails structurally, the targeted repair succeeds, and call 1's evidence survives", async () => {
    const broken = validProgram();
    (broken.program.elements[0] as { content: unknown }).content = { text: "why" };
    chatCreate.mockResolvedValueOnce(respond(broken)).mockResolvedValueOnce(respond(validProgram()));

    const { admin, calls, attempts } = makeAdmin();
    const r = await run(admin);

    expect(r.ok, r.ok ? "" : `${r.code} ${r.refusal ?? ""}`).toBe(true);
    expect(attempts, "exactly one parent").toHaveLength(1);
    expect(calls, "exactly two child calls").toHaveLength(2);

    // Call 1 retains its own structural diagnosis…
    expect(calls[0]).toMatchObject({
      call_sequence: 1,
      call_kind: "authorship",
      outcome: "schema_invalid",
      validation_stage: "structural",
      offending_path: "elements[0].content",
      actual_type: "object",
      structural_retryable: true,
    });
    // …and call 2's success never overwrote it.
    expect(calls[1]).toMatchObject({ call_sequence: 2, call_kind: "authorship_retry", outcome: "success" });
    expect(calls[1].validation_stage ?? null).toBeNull();
    expect(calls[1].offending_path ?? null).toBeNull();
    expect(attempts[0]).toMatchObject({ outcome: "success" });
  });

  it("G1b — the repair call is told the exact path and type, not a code name", async () => {
    const broken = validProgram();
    (broken.program.elements[0] as { content: unknown }).content = { text: "why" };
    chatCreate.mockResolvedValueOnce(respond(broken)).mockResolvedValueOnce(respond(validProgram()));

    const { admin } = makeAdmin();
    await run(admin);

    const repairMessages = chatCreate.mock.calls[1][0].messages as { role: string; content: string }[];
    const repair = repairMessages[repairMessages.length - 1].content;
    expect(repair).toContain("elements[0].content");
    expect(repair).toContain("object");
    // Shape only — the model's own words are never echoed back into the request.
    expect(repair).not.toContain("why");
  });

  it("G2 — both calls fail DIFFERENTLY and each keeps its own path and type", async () => {
    const first = validProgram();
    (first.program.elements[0] as { content: unknown }).content = { text: "why" };
    const second = validProgram();
    (second.program.elements[0] as { rationale: unknown }).rationale = ["a", "b"];
    chatCreate.mockResolvedValueOnce(respond(first)).mockResolvedValueOnce(respond(second));

    const { admin, calls, attempts } = makeAdmin();
    const r = await run(admin);

    expect(r.ok).toBe(false);
    expect(attempts).toHaveLength(1);
    expect(calls, "never a third call").toHaveLength(2);
    expect(calls[0]).toMatchObject({ call_sequence: 1, offending_path: "elements[0].content", actual_type: "object" });
    expect(calls[1]).toMatchObject({ call_sequence: 2, offending_path: "elements[0].rationale", actual_type: "array" });
    // Two distinct faults, two distinct records — not one summary pretending to cover both.
    expect(calls[0].offending_path).not.toBe(calls[1].offending_path);
    expect(attempts[0]).toMatchObject({ outcome: "validation_refused" });
  });

  it("G3 — the same failure twice still yields two independent records", async () => {
    const broken = () => {
      const p = validProgram();
      (p.program.elements[0] as { content: unknown }).content = { text: "why" };
      return p;
    };
    chatCreate.mockResolvedValueOnce(respond(broken())).mockResolvedValueOnce(respond(broken()));

    const { admin, calls } = makeAdmin();
    await run(admin);
    expect(calls).toHaveLength(2);
    for (const c of calls) expect(c).toMatchObject({ validation_stage: "structural", offending_path: "elements[0].content" });
    expect(calls[0].id).not.toBe(calls[1].id);
    expect([calls[0].call_sequence, calls[1].call_sequence]).toEqual([1, 2]);
  });

  it("G4 — a semantic refusal is recorded as semantic on ONE call, with no retry", async () => {
    const fabricated = validProgram();
    (fabricated.program.elements[1] as { content: unknown }).content =
      "Complete the handoff record template before signing off at every shift change.";
    chatCreate.mockResolvedValueOnce(respond(fabricated));

    const { admin, calls, attempts } = makeAdmin();
    const r = await run(admin);

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.refusal).toBe("material_fabrication");
    expect(chatCreate, "a meaning fault is never retried").toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ call_sequence: 1, validation_stage: "semantic", structural_retryable: false });
    expect(attempts[0]).toMatchObject({ outcome: "validation_refused", refusal_code: "material_fabrication" });
  });

  it("G5 — every persisted diagnostic field is shape metadata; no generated prose is stored", async () => {
    const broken = validProgram();
    (broken.program.elements[0] as { content: unknown }).content = { secret: "THE MODELS ACTUAL WORDS" };
    chatCreate.mockResolvedValueOnce(respond(broken)).mockResolvedValueOnce(respond(validProgram()));

    const { admin, calls, attempts } = makeAdmin();
    await run(admin);

    const persisted = JSON.stringify([...calls, ...attempts]);
    expect(persisted).not.toContain("THE MODELS ACTUAL WORDS");
    expect(persisted).not.toContain("When a handoff misses a step");
    expect(persisted).not.toContain("Handing over without gaps");
    expect(persisted).not.toContain("because it fits");
    // What IS stored: shape only.
    expect(persisted).toContain("elements[0].content");
    expect(persisted).toContain("object");
  });

  it("G4(transport) — a provider HTTP failure stays transport-only and is never called structural", async () => {
    // A 500 from the provider says nothing about the SHAPE of the program — no program was
    // returned at all. Recording it as a structural fault would invent a diagnosis, and would
    // pollute the very index built to answer "which shape faults keep recurring".
    const boom = Object.assign(new Error("upstream exploded"), { status: 500 });
    chatCreate.mockRejectedValueOnce(boom);

    const { admin, calls, attempts } = makeAdmin();
    const r = await run(admin);

    expect(r.ok).toBe(false);
    expect(calls, "a transport failure is not retried into a second call").toHaveLength(1);
    expect(calls[0]).toMatchObject({
      call_sequence: 1,
      outcome: "http_error",
      provider_http_status: 500,
      provider_error_category: "server_error",
    });
    for (const key of ["validation_stage", "offending_path", "expected_type", "actual_type", "structural_retryable"]) {
      expect(calls[0][key] ?? null, `${key} must stay NULL on a transport failure`).toBeNull();
    }
    expect(attempts[0]).toMatchObject({ outcome: "provider_transport_error" });
    expect(attempts[0].refusal_code ?? null, "a transport error is not a refusal").toBeNull();
  });

  it("G4(transport) — a provider timeout is likewise transport-only", async () => {
    // The service aborts on its own timer; an abort surfaces as code "timeout".
    chatCreate.mockImplementationOnce((_body: unknown, opts: { signal?: AbortSignal }) => {
      return new Promise((_resolve, reject) => {
        const signal = opts?.signal;
        const fail = () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
        if (signal?.aborted) fail();
        else signal?.addEventListener("abort", fail);
        // Never resolves otherwise — the service's own abort is what ends this call.
      });
    });

    const { admin, calls, attempts } = makeAdmin();
    const r = await run(admin);

    expect(r.ok).toBe(false);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ outcome: "timeout", provider_error_category: "aborted" });
    for (const key of ["validation_stage", "offending_path", "actual_type"]) {
      expect(calls[0][key] ?? null, `${key} must stay NULL on a timeout`).toBeNull();
    }
    expect(attempts[0]).toMatchObject({ outcome: "provider_timeout" });
  }, 120_000);

  it("never writes structural diagnostics to the parent attempt", async () => {
    const broken = validProgram();
    (broken.program.elements[0] as { content: unknown }).content = 7;
    chatCreate.mockResolvedValueOnce(respond(broken)).mockResolvedValueOnce(respond(broken));

    const { admin, attempts } = makeAdmin();
    await run(admin);
    for (const key of ["validation_stage", "offending_path", "expected_type", "actual_type", "structural_retryable", "failed_call_sequence"]) {
      expect(attempts[0][key], `parent must not carry ${key}`).toBeUndefined();
    }
  });
});
