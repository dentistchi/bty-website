import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * SLICE 3.2P-W1-R1 — NO DURABLE RECORD, NO SPEND.
 *
 * A governed window was executed by calling this service directly with a hand-built
 * `submission_intent_id` that was not a uuid. The HTTP route validates that field and would
 * have refused it; the direct call did not go through the route. The ledger insert failed on
 * the uuid column, `startProgramAttempt` returned `{ok:false, duplicate:false}`, `attemptId`
 * became null — and the paid provider call ran anyway. Nothing was recorded: no attempt, no
 * child call, no refusal reason. The fine-grained diagnosis of that refusal is permanently
 * unknown, which is exactly the gap four slices of diagnostics work existed to close.
 *
 * Attempt recording is not observability on this path. It is the authority to spend. These
 * fixtures assert the ONE thing that matters: the provider is not reached without it.
 */
const chatCreate = vi.fn();
vi.mock("@/lib/bty/llm/client", () => ({
  isLlmAvailable: () => true,
  getLlmModel: () => "test-model",
  getLlmClient: () => ({ chat: { completions: { create: chatCreate } } }),
}));

const spies = vi.hoisted(() => ({
  startProgramAttempt: vi.fn(),
  finalizeProgramAttempt: vi.fn(async () => undefined),
  startProgramCall: vi.fn(async () => ({ ok: true as const, callId: "call-1" })),
  finalizeProgramCall: vi.fn(async () => undefined),
}));
vi.mock("./programGenerationRecorder", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./programGenerationRecorder")>()),
  ...spies,
}));
const { startProgramAttempt, finalizeProgramAttempt, startProgramCall, finalizeProgramCall } = spies;

import { generateProgram } from "./programAuthorshipService";
import { programContext, requiredProgramKinds } from "@/domain/foundry/module/program-authorship";
import { isGenerationUuid } from "@/domain/foundry/module/program-generation-lease";
import type { BuilderAnswers } from "@/domain/foundry/module/module-builder";

/** The live pilot's Host intent. Seven required kinds, no `decide`. */
const ANSWERS = {
  problem: "During morning huddles, team members report problems but leave without naming who will act.",
  audienceType: "leaders",
  evidenceType: "confirmed",
  followUpDays: 7,
  learningNeeds: ["shared_standard", "practice"],
  materialIntent: "pdf",
  /*
    A HOST-AUTHORED question, not BTY's prefill (Slice R4-R5C12A). This fixture carried
    "In your own words, what is the most important standard from this training?" — BTY's own
    suggested sentence, which no longer requires or grounds a REFLECT section precisely because
    nobody wrote it. The fixture means "this Host asked for a reflection", so it now says so in a
    sentence a Host could have written.
  */
  sharedQuestion: "What usually happens at the huddle when nobody is named?",
  successEvidence: "The huddle note records one owner and one deadline for every agreed action.",
  arenaRecommended: true,
  completionPrompt: "What specific phrases will you use in the next huddle?",
  recurringMoment: "During morning huddles",
  observableBehavior: "At the next huddle, what exact words will you use to confirm the owner, action, and deadline?",
  capabilityCandidate: "Accountability",
} as unknown as BuilderAnswers;

const GOOD_INTENT = "11111111-2222-4333-8444-555555555555";
const GOOD_CORRELATION = "66666666-7777-4888-8999-aaaaaaaaaaaa";
const GOOD_ATTEMPT = "abcdefab-cdef-4abc-8def-abcdefabcdef";
/** The exact value that spent a window without recording it. */
const W1_INTENT = "w1-91a89434563a2bbf88c3d309";

const admin = { from: () => ({}), rpc: async () => ({ data: null, error: null }) } as unknown as SupabaseClient;

async function run(over: { submissionIntentId?: string; correlationId?: string } = {}) {
  const ctx = programContext(ANSWERS)!;
  return generateProgram(admin, {
    draftId: "3e079b1b-0077-48e6-80f7-fb7869b7eef1",
    ownerUserId: "ee9d2075-f4ae-4949-9392-38865c2cab22",
    submissionIntentId: over.submissionIntentId ?? GOOD_INTENT,
    answers: ANSWERS,
    ctx,
    locale: "en",
    deployVersion: "test-deploy",
    correlationId: over.correlationId ?? GOOD_CORRELATION,
    verifiedArtifacts: ["education.pdf"],
    reloadDraftState: async () => ({
      draftId: "3e079b1b-0077-48e6-80f7-fb7869b7eef1",
      ownerUserId: "ee9d2075-f4ae-4949-9392-38865c2cab22",
      status: "draft",
      fingerprint: "",
    }),
  });
}

beforeEach(() => {
  chatCreate.mockReset();
  startProgramAttempt.mockReset();
  finalizeProgramAttempt.mockReset();
  startProgramCall.mockReset();
  finalizeProgramCall.mockReset();
  startProgramCall.mockResolvedValue({ ok: true, callId: "call-1" });
});

describe("[3.2P-W1-R1] the provider is unreachable without a durable attempt", () => {
  it("2 — a malformed submission intent spends nothing, and never even asks the ledger", async () => {
    const r = await run({ submissionIntentId: W1_INTENT });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("attempt_recording_failed");
    expect(chatCreate, "PROVIDER MUST NOT BE CALLED").not.toHaveBeenCalled();
    expect(startProgramAttempt, "an unrecordable id never reaches the insert").not.toHaveBeenCalled();
  });

  it("3 — a malformed correlation id likewise", async () => {
    const r = await run({ correlationId: "not-a-uuid" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("attempt_recording_failed");
    expect(chatCreate).not.toHaveBeenCalled();
  });

  it("4 — a non-duplicate insert failure spends nothing", async () => {
    startProgramAttempt.mockResolvedValue({ ok: false, duplicate: false });
    const r = await run();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("attempt_recording_failed");
    expect(chatCreate, "the exact W1 branch").not.toHaveBeenCalled();
    expect(finalizeProgramAttempt, "nothing was opened, so nothing is closed").not.toHaveBeenCalled();
  });

  it("5 — a thrown ledger request spends nothing", async () => {
    startProgramAttempt.mockRejectedValue(new Error("connection reset"));
    await expect(run()).rejects.toThrow();
    expect(chatCreate).not.toHaveBeenCalled();
  });

  it("7 — ok:true carrying an unusable attempt id spends nothing", async () => {
    for (const bad of ["", "undefined", "null", "w1-91a89434563a2bbf88c3d309"]) {
      chatCreate.mockReset();
      startProgramAttempt.mockResolvedValue({ ok: true, attemptId: bad });
      const r = await run();
      expect(r.ok, bad).toBe(false);
      if (!r.ok) expect(r.code, bad).toBe("attempt_recording_failed");
      expect(chatCreate, bad).not.toHaveBeenCalled();
    }
  });

  it("6 — a duplicate intent keeps its existing idempotent semantics and spends nothing", async () => {
    startProgramAttempt.mockResolvedValue({ ok: false, duplicate: true });
    const r = await run();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("duplicate_intent");
    expect(chatCreate, "a re-delivered instruction must not buy a second generation").not.toHaveBeenCalled();
  });

  it("1 — a valid uuid and a durable id: the provider is called exactly once", async () => {
    startProgramAttempt.mockResolvedValue({ ok: true, attemptId: GOOD_ATTEMPT });
    chatCreate.mockRejectedValue(new Error("stop after the call — this fixture measures reachability"));
    const r = await run();
    expect(r.ok).toBe(false); // the transport error, not the gate
    expect(chatCreate).toHaveBeenCalledTimes(1);
    expect(startProgramAttempt).toHaveBeenCalledTimes(1);
  });
});

describe("[3.2P-W1-R1] ordering, stated as ordering — there is no cross-system atomicity", () => {
  it("the attempt insert precedes the provider call, always", async () => {
    const order: string[] = [];
    startProgramAttempt.mockImplementation(async () => {
      order.push("attempt");
      return { ok: true, attemptId: GOOD_ATTEMPT };
    });
    chatCreate.mockImplementation(async () => {
      order.push("provider");
      throw new Error("stop");
    });
    await run();
    expect(order).toEqual(["attempt", "provider"]);
  });

  it("8 — after a valid attempt, child recording still runs (diagnostics unaffected)", async () => {
    startProgramAttempt.mockResolvedValue({ ok: true, attemptId: GOOD_ATTEMPT });
    chatCreate.mockResolvedValue({
      choices: [{ message: { content: "{ not a program }" }, finish_reason: "stop" }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    });
    await run();
    expect(startProgramCall.mock.calls.length).toBeGreaterThan(0);
    expect(finalizeProgramCall.mock.calls.length).toBeGreaterThan(0);
    expect(finalizeProgramAttempt).toHaveBeenCalled();
  });
});

describe("[3.2P-W1-R1] one uuid shape, shared by the route and the service", () => {
  it("accepts what crypto.randomUUID produces", () => {
    for (let i = 0; i < 20; i++) expect(isGenerationUuid(crypto.randomUUID())).toBe(true);
  });

  it("refuses the W1 identifier and the shapes the old loose route regex let through", () => {
    for (const bad of [
      W1_INTENT,
      "------------------------------------",          // 36 chars of [0-9a-f-]
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",          // 36 hex, no dashes
      "11111111-2222-4333-8444-55555555555",           // one short
      "", "  ", "null", "undefined",
    ]) {
      expect(isGenerationUuid(bad), bad).toBe(false);
    }
  });

  it("required kinds for this pilot are unchanged by any of it", () => {
    expect(requiredProgramKinds(ANSWERS)).toHaveLength(8);
    expect(requiredProgramKinds(ANSWERS)).not.toContain("action_decision");
  });
});
