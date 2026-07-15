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
    const r = renderTemplateReflection(buildReflectionContext({ completionState: "pass", responseText: "I learned 3 things today", locale: "en" }));
    expect(validateLivingReflection(r).ok).toBe(true);
  });

  describe("evidence-grounded fallback (recovery)", () => {
    const LONG =
      "I have delayed a direct conversation with my office manager because I expect her to become defensive. " +
      "I told myself I was giving her time, but the rest of the team is now working with unclear expectations.";
    const QUESTION =
      "What difficult conversation are you postponing, and what is the delay costing the people around you?";
    const render = () =>
      renderTemplateReflection(
        buildReflectionContext({ completionState: "pass", responseText: LONG, questionText: QUESTION, locale: "en" }),
      );

    it("does not paste the whole response and never shows a visible ellipsis", () => {
      const r = render();
      const joined = Object.values(r).join(" ");
      expect(joined).not.toContain("…");
      expect(joined).not.toContain("...");
      // whatEmerged mirrors ONE clause, not the whole response.
      expect(r.whatEmerged.length).toBeLessThan(LONG.length);
      expect(r.whatEmerged).not.toContain("defensive"); // that clause is the living line, not here
    });

    it("selects a complete, meaningful clause (6–18 words) as the living line, exact from the response", () => {
      const r = render();
      expect(LONG).toContain(r.livingSentence); // exact substring — no paraphrase, no truncation
      const words = r.livingSentence.split(/\s+/).filter(Boolean).length;
      expect(words).toBeGreaterThanOrEqual(6);
      expect(words).toBeLessThanOrEqual(18);
      expect(r.livingSentence).not.toContain("…");
    });

    it("grounds in concrete response evidence and each section is distinct + gate-passing", () => {
      const r = render();
      expect(r.whatEmerged).toContain("unclear expectations"); // real words from the response
      expect(new Set(Object.values(r)).size).toBe(4); // four distinct sections
      expect(validateLivingReflection(r).ok).toBe(true);
    });

    it("never emits banned filler, unsupported recurrence, or delay-permitting patience phrases", () => {
      const joined = Object.values(render()).join(" ").toLowerCase();
      for (const banned of [
        "you put language to",
        "where your leadership begins",
        "what the question asked of you",
        "let this stay with you",
        "carry this forward",
        "isn't simple",
        "you keep returning",
        "yours to carry",
        "in your own time",
      ]) {
        expect(joined).not.toContain(banned);
      }
    });
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
