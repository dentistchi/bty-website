import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { classifyLearnerQuestion } from "@/domain/foundry/module/learnerQuestionRole";

/**
 * SLICE R4-R5C12A · T10/T18 — what the copilot is allowed to ask a learner for.
 *
 * The instruction used to read "It MUST be specific to the approved observable behavior". Read as
 * written by a model, "specific to the behavior" is satisfied by restating the behavior, and the
 * corpus shows it was: 22 of 37 live completion questions carry the standard's own vocabulary at
 * 0.50 or more. The contract now separates RELEVANT TO from ANSWERED BY.
 *
 * `systemPrompt` is private to the service, so the contract is asserted on the file. That is the
 * same bind `reflectionNeutrality` records — a rule that lives only in a string literal is one
 * refactor from silently covering nothing — and the assertions below are on the shipped text.
 */
const SERVICE = join(process.cwd(), "src/lib/bty/foundry/events/moduleDraftCopilotService.ts");
const src = readFileSync(SERVICE, "utf8");
const completionLine = src.split("\n").find((l) => l.includes("- completion_question:")) ?? "";

describe("[R4-R5C12A · T10] the copilot may not ask for the standard back", () => {
  it("still requires relevance to the approved behavior", () => {
    expect(completionLine).toBeTruthy();
    expect(completionLine).toMatch(/RELEVANT to the approved observable behavior/);
  });

  it("prohibits quoting or paraphrasing the behavior as the answer", () => {
    expect(completionLine).toMatch(/must NOT quote or paraphrase it as the answer/);
    expect(completionLine).toMatch(/still have to supply something of their own/);
  });

  it("names the job positively and shows both sides", () => {
    expect(completionLine).toMatch(/THEIR decision or THEIR concrete application/);
    expect(completionLine).toMatch(/what will you do differently the next time this happens\?/);
    expect(completionLine).toMatch(/never for the behavior back/);
    expect(completionLine).toMatch(/describe how you will follow the standard/);
  });

  it("keeps every guarantee the old contract carried", () => {
    for (const kept of [
      "ONE question a participant answers after the material",
      "NOT a generic template",
      "a yes/no question",
      "a feelings prompt",
      "a summary request",
      "Never claim the behavior is already competent",
    ]) {
      expect(completionLine, kept).toContain(kept);
    }
  });

  it("the two examples it now carries classify the way the contract claims", () => {
    const standard = "Employees make a confirmation call and follow a checklist of required questions and information.";
    const good = classifyLearnerQuestion("what will you do differently the next time this happens?", standard);
    const bad = classifyLearnerQuestion("describe how you will follow the standard", standard);
    expect(good.applicationLike).toBe(true);
    expect(good.recallLike).toBe(false);
    expect(bad.recallLike).toBe(true);
    expect(bad.applicationLike).toBe(false);
  });
});

describe("[R4-R5C12A · T18] no new provider work", () => {
  it("one call site and one bounded retry, unchanged", () => {
    // The whole change is a string. If this slice had added a call, a model or a second pass,
    // it would show up here rather than in a review comment.
    expect(src.match(/client\.chat\.completions\.create/g)?.length).toBe(1);
    expect(src.match(/attempt|retry/gi)?.length).toBeGreaterThan(0);
    expect(completionLine).not.toMatch(/second (?:call|pass)|call again|re-?generate/i);
  });
});
