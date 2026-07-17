import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Direction generation service — proves fail-closed behavior, the bounded single
 * retry, and that only validated (never raw) output is returned. The provider client
 * is mocked; the real domain validator runs.
 */
const create = vi.fn();
const llmAvailable = vi.fn<() => boolean>();

vi.mock("@/lib/bty/llm/client", () => ({
  isLlmAvailable: () => llmAvailable(),
  getLlmClient: () => ({ chat: { completions: { create: (...a: unknown[]) => create(...a) } } }),
  getLlmModel: () => "test-model",
}));

import { generateDirections } from "./directionCopilotService";

const VALID_PAYLOAD = {
  suggestions: [
    { title: "Accurate shift handoff", capability_candidate: "Shift Handoff", rationale: "How information moves between roles.", observable_behavior: "At shift handoff, the nurse names the unresolved issue, the owner, and the next check time.", success_evidence_hint: "The handoff record lists the issue, owner, and follow-up time.", important_assumption: "Assumes a shared record exists." },
    { title: "Read-back on orders", capability_candidate: "Order Verification", rationale: "The moment an order could be misheard.", observable_behavior: "Before acting on a verbal order, the staff member repeats the dose back and writes it on the chart.", success_evidence_hint: "The chart shows a written confirmation entry.", important_assumption: null },
    { title: "Escalation when unsure", capability_candidate: "Escalation Judgment", rationale: "Whether concerns are raised in time.", observable_behavior: "When unsure, the employee flags it to the supervisor and records the time it was raised.", success_evidence_hint: "A supervisor confirms the concern was raised.", important_assumption: null },
  ],
};

const completionWith = (content: unknown) => ({
  choices: [{ message: { content: typeof content === "string" ? content : JSON.stringify(content) } }],
});

beforeEach(() => {
  create.mockReset();
  llmAvailable.mockReset();
  llmAvailable.mockReturnValue(true);
});

describe("generateDirections", () => {
  it("returns provider_unavailable without calling the provider when no key/endpoint", async () => {
    llmAvailable.mockReturnValue(false);
    const r = await generateDirections({ problemStatement: "p", locale: "en" });
    expect(r).toEqual({ ok: false, code: "provider_unavailable" });
    expect(create).not.toHaveBeenCalled();
  });

  it("returns three validated suggestions on a valid first attempt (no retry)", async () => {
    create.mockResolvedValue(completionWith(VALID_PAYLOAD));
    const r = await generateDirections({ problemStatement: "p", locale: "en" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.suggestions).toHaveLength(3);
    expect(r.version).toBe("direction_copilot_v1");
    expect(r.suggestions[0].id).toBe("direction_1");
    // Only validated, client-safe fields — never raw provider echoes.
    expect(Object.keys(r.suggestions[0]).sort()).toEqual(
      ["capability_candidate", "id", "important_assumption", "observable_behavior", "rationale", "success_evidence_hint", "title"],
    );
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("retries ONCE on invalid output, then succeeds", async () => {
    create
      .mockResolvedValueOnce(completionWith("not json at all"))
      .mockResolvedValueOnce(completionWith(VALID_PAYLOAD));
    const r = await generateDirections({ problemStatement: "p", locale: "en" });
    expect(r.ok).toBe(true);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("fails closed after the bounded retry when output stays invalid", async () => {
    create.mockResolvedValue(completionWith("still not json"));
    const r = await generateDirections({ problemStatement: "p", locale: "en" });
    expect(r).toEqual({ ok: false, code: "invalid_output" });
    expect(create).toHaveBeenCalledTimes(2); // MAX_ATTEMPTS — no unbounded loop
  });

  it("does not retry on a provider error", async () => {
    create.mockRejectedValue(new Error("boom"));
    const r = await generateDirections({ problemStatement: "p", locale: "en" });
    expect(r).toEqual({ ok: false, code: "provider_error" });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("rejects a well-formed-but-invalid batch (e.g. wrong count) fail-closed", async () => {
    create.mockResolvedValue(completionWith({ suggestions: VALID_PAYLOAD.suggestions.slice(0, 2) }));
    const r = await generateDirections({ problemStatement: "p", locale: "en" });
    expect(r).toEqual({ ok: false, code: "invalid_output" });
  });
});
