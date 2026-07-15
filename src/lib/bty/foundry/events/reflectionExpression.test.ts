import { describe, it, expect } from "vitest";
import {
  renderTemplateReflection,
  REFLECTION_PROMPTS,
  CHECKPOINT_PROMPTS,
  selectReflectionPrompt,
  selectCheckpointPrompt,
} from "./reflectionExpression";
import {
  buildReflectionContext,
  validateLivingReflection,
  REFLECTION_SECTION_KEYS,
} from "@/domain/foundry/living-reflection";

describe("renderTemplateReflection (deterministic expression)", () => {
  it("produces four non-empty sections for every state × locale", () => {
    for (const locale of ["en", "ko"] as const) {
      for (const completionState of ["pass", "review", "incomplete"] as const) {
        const r = renderTemplateReflection(buildReflectionContext({ completionState, responseText: "my note", locale }));
        for (const key of REFLECTION_SECTION_KEYS) {
          expect(r[key].trim().length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("embeds the participant's words when present", () => {
    const r = renderTemplateReflection(buildReflectionContext({ completionState: "pass", responseText: "trust my team", locale: "en" }));
    expect(r.whatEmerged).toContain("trust my team");
  });

  it("every rendered template passes the domain validator", () => {
    for (const locale of ["en", "ko"] as const) {
      for (const completionState of ["pass", "review", "incomplete"] as const) {
        const r = renderTemplateReflection(buildReflectionContext({ completionState, responseText: "note", locale }));
        expect(validateLivingReflection(r).ok).toBe(true);
      }
    }
  });

  it("never leaks metrics even with a numeric response", () => {
    const r = renderTemplateReflection(buildReflectionContext({ completionState: "pass", responseText: "watched a lot", locale: "en" }));
    expect(validateLivingReflection(r).ok).toBe(true);
  });

  it("the no-response fallback passes the quality gate in both locales", () => {
    for (const locale of ["en", "ko"] as const) {
      const r = renderTemplateReflection(buildReflectionContext({ completionState: "incomplete", responseText: "", locale }));
      expect(validateLivingReflection(r).ok).toBe(true);
    }
  });

  it("the fallback never narrates watch behavior or speaks in third person", () => {
    // Fallback must not depend on watch-state interpretation: identical output
    // across states, and free of third-person / engagement / avoidance language.
    for (const has of [true, false]) {
      const text = (["pass", "review", "incomplete"] as const)
        .map((completionState) =>
          Object.values(
            renderTemplateReflection(
              buildReflectionContext({ completionState, responseText: has ? "my note" : "", locale: "en" }),
            ),
          ).join(" "),
        );
      // Watch-state does not change the fallback wording.
      expect(new Set(text).size).toBe(1);
      expect(text[0].toLowerCase()).not.toMatch(/participant|engag|avoid|skip|conscious/);
    }
  });
});

describe("anti-summary reflection prompts", () => {
  it("never asks a summary question", () => {
    const all = [...REFLECTION_PROMPTS.en, ...REFLECTION_PROMPTS.ko];
    for (const p of all) {
      expect(p.toLowerCase()).not.toContain("main point");
      expect(p.toLowerCase()).not.toContain("summar");
    }
  });

  it("selection is deterministic for a given seed", () => {
    expect(selectReflectionPrompt("event-123", "en")).toBe(selectReflectionPrompt("event-123", "en"));
    expect(selectCheckpointPrompt("event-123", 0, "ko")).toBe(selectCheckpointPrompt("event-123", 0, "ko"));
  });

  it("returns a member of the localized list", () => {
    expect(REFLECTION_PROMPTS.en).toContain(selectReflectionPrompt("x", "en"));
    expect(REFLECTION_PROMPTS.ko).toContain(selectReflectionPrompt("x", "ko"));
    expect(CHECKPOINT_PROMPTS.en).toContain(selectCheckpointPrompt("x", 1, "en"));
  });

  it("defaults non-ko locale to en", () => {
    expect(REFLECTION_PROMPTS.en).toContain(selectReflectionPrompt("x", "fr"));
    expect(REFLECTION_PROMPTS.en).toContain(selectReflectionPrompt("x", undefined));
  });

  it("checkpoint index is bounded safely", () => {
    expect(CHECKPOINT_PROMPTS.en).toContain(selectCheckpointPrompt("x", -3, "en"));
    expect(CHECKPOINT_PROMPTS.en).toContain(selectCheckpointPrompt("x", 999, "en"));
  });

  it("different seeds can vary the prompt", () => {
    const seeds = ["a", "b", "c", "d", "e", "f", "g", "h"].map((s) => selectReflectionPrompt(s, "en"));
    expect(new Set(seeds).size).toBeGreaterThan(1);
  });
});
