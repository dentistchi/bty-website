import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Module-draft generation service — fail-closed, bounded single retry, returns only
 * validated output. Provider client mocked; the real domain validator runs.
 */
const create = vi.fn();
const llmAvailable = vi.fn<() => boolean>();

vi.mock("@/lib/bty/llm/client", () => ({
  isLlmAvailable: () => llmAvailable(),
  getLlmClient: () => ({ chat: { completions: { create: (...a: unknown[]) => create(...a) } } }),
  getLlmModel: () => "test-model",
}));

import { generateModuleDraft } from "./moduleDraftCopilotService";
import type { ModuleDraftContext } from "@/domain/foundry/module/module-draft-copilot";

const CTX: ModuleDraftContext = {
  problemStatement: "Handoffs skip the double-check.",
  audienceType: "everyone",
  audienceDetail: null,
  capabilityCandidate: "Accurate handoff",
  observableBehavior: "The charge nurse reads the dosage back before sign-off.",
  successEvidence: "Sign-offs include a witnessed read-back.",
};

const VALID = {
  module_draft: {
    learning_approach: ["practice", "shared_standard"],
    learning_approach_rationale: "A repeatable standard practiced under time pressure.",
    completion_question:
      "Before the next sign-off, what exact phrase will you use to read the dosage back and confirm it with the receiving nurse?",
    arena_recommended: true,
    arena_rationale: "The read-back must hold when the unit is busy.",
    follow_up_days: 7,
    follow_up_guidance: "Ask whether the read-back was used and what made it difficult.",
    material_guidance: { recommended_types: ["written", "live_discussion"], suggestion: "A short checklist and one example handoff may help; the host supplies it." },
  },
  assumptions: ["Staff can hear each other at handoff."],
  warnings: [],
};

const completionWith = (content: unknown) => ({
  choices: [{ message: { content: typeof content === "string" ? content : JSON.stringify(content) } }],
});

beforeEach(() => {
  create.mockReset();
  llmAvailable.mockReset();
  llmAvailable.mockReturnValue(true);
});

describe("generateModuleDraft", () => {
  it("returns provider_unavailable without calling the provider", async () => {
    llmAvailable.mockReturnValue(false);
    const r = await generateModuleDraft(CTX, "en");
    expect(r).toEqual({ ok: false, code: "provider_unavailable" });
    expect(create).not.toHaveBeenCalled();
  });

  it("returns a validated draft on a valid first attempt (no retry)", async () => {
    create.mockResolvedValue(completionWith(VALID));
    const r = await generateModuleDraft(CTX, "en");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.version).toBe("module_draft_copilot_v1");
    expect(r.value.module_draft.follow_up_days).toBe(7);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("retries ONCE on invalid output, then succeeds", async () => {
    create.mockResolvedValueOnce(completionWith("not json")).mockResolvedValueOnce(completionWith(VALID));
    const r = await generateModuleDraft(CTX, "en");
    expect(r.ok).toBe(true);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("fails closed after the bounded retry when output stays invalid", async () => {
    create.mockResolvedValue(completionWith("still not json"));
    const r = await generateModuleDraft(CTX, "en");
    expect(r).toEqual({ ok: false, code: "invalid_output" });
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("does not retry on a provider error", async () => {
    create.mockRejectedValue(new Error("boom"));
    const r = await generateModuleDraft(CTX, "en");
    expect(r).toEqual({ ok: false, code: "provider_error" });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("rejects a well-formed-but-invalid draft fail-closed (generic completion question)", async () => {
    const bad = JSON.parse(JSON.stringify(VALID));
    bad.module_draft.completion_question = "What is one thing you will apply this week?";
    create.mockResolvedValue(completionWith(bad));
    const r = await generateModuleDraft(CTX, "en");
    expect(r).toEqual({ ok: false, code: "invalid_output" });
  });
});
