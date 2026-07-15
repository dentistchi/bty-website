import { describe, it, expect } from "vitest";
import {
  buildReflectionContext,
  validateLivingReflection,
  normalizeReflectionLocale,
  REFLECTION_VERSION,
  type LivingReflection,
} from "./living-reflection";

const VALID: LivingReflection = {
  whatEmerged: "You stayed with the whole of it.",
  whereYouStretched: "You didn't look away.",
  livingSentence: "Presence is the first act of leadership.",
  nextInvitation: "Tomorrow, bring this to one conversation.",
};

describe("buildReflectionContext (rule engine)", () => {
  it("grounds in the participant's own words", () => {
    const ctx = buildReflectionContext({ completionState: "pass", responseText: "  I saw my team  ", locale: "en" });
    expect(ctx.hasResponse).toBe(true);
    expect(ctx.responseExcerpt).toBe("I saw my team");
    expect(ctx.completionState).toBe("pass");
  });

  it("marks empty response as no-response and defaults locale to en", () => {
    const ctx = buildReflectionContext({ completionState: "incomplete", responseText: "   " });
    expect(ctx.hasResponse).toBe(false);
    expect(ctx.responseExcerpt).toBe("");
    expect(ctx.locale).toBe("en");
  });

  it("truncates a very long excerpt", () => {
    const long = "a".repeat(500);
    const ctx = buildReflectionContext({ completionState: "review", responseText: long, locale: "ko" });
    expect(ctx.responseExcerpt.length).toBeLessThanOrEqual(161);
    expect(ctx.responseExcerpt.endsWith("…")).toBe(true);
    expect(ctx.locale).toBe("ko");
  });

  it("grounds in the host's completion question when present", () => {
    const ctx = buildReflectionContext({
      completionState: "pass",
      responseText: "I saw my team",
      questionText: "  What will you do differently tomorrow?  ",
      locale: "en",
    });
    expect(ctx.hasQuestion).toBe(true);
    expect(ctx.questionExcerpt).toBe("What will you do differently tomorrow?");
  });

  it("marks a missing/empty host question as no-question", () => {
    const noArg = buildReflectionContext({ completionState: "pass", responseText: "x" });
    expect(noArg.hasQuestion).toBe(false);
    expect(noArg.questionExcerpt).toBe("");

    const blank = buildReflectionContext({ completionState: "pass", responseText: "x", questionText: "   " });
    expect(blank.hasQuestion).toBe(false);
  });

  it("truncates a very long host question", () => {
    const long = "q".repeat(500);
    const ctx = buildReflectionContext({ completionState: "pass", responseText: "x", questionText: long });
    expect(ctx.questionExcerpt.length).toBeLessThanOrEqual(201);
    expect(ctx.questionExcerpt.endsWith("…")).toBe(true);
  });

  it("normalizeReflectionLocale only accepts ko", () => {
    expect(normalizeReflectionLocale("ko")).toBe("ko");
    expect(normalizeReflectionLocale("en")).toBe("en");
    expect(normalizeReflectionLocale("fr")).toBe("en");
    expect(normalizeReflectionLocale(undefined)).toBe("en");
  });
});

describe("validateLivingReflection (the gate)", () => {
  it("accepts a well-formed reflection", () => {
    const res = validateLivingReflection(VALID);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.livingSentence).toBe(VALID.livingSentence);
  });

  it("trims section whitespace", () => {
    const res = validateLivingReflection({ ...VALID, whatEmerged: "  padded  " });
    expect(res.ok && res.value.whatEmerged).toBe("padded");
  });

  it("rejects a missing section", () => {
    const { whatEmerged, ...rest } = VALID;
    void whatEmerged;
    const res = validateLivingReflection(rest);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("missing_whatEmerged");
  });

  it("rejects an empty section", () => {
    expect(validateLivingReflection({ ...VALID, nextInvitation: "   " }).ok).toBe(false);
  });

  it("rejects a non-object", () => {
    expect(validateLivingReflection(null).ok).toBe(false);
    expect(validateLivingReflection("nope").ok).toBe(false);
  });

  it("rejects leaked raw metrics (percentage)", () => {
    expect(validateLivingReflection({ ...VALID, whatEmerged: "You watched 82% of it." }).ok).toBe(false);
  });

  it("rejects telemetry vocabulary", () => {
    expect(validateLivingReflection({ ...VALID, whereYouStretched: "Your coverage was high." }).ok).toBe(false);
    expect(validateLivingReflection({ ...VALID, whatEmerged: "You did a forward seek." }).ok).toBe(false);
  });

  it("rejects score / grade / homework framing", () => {
    expect(validateLivingReflection({ ...VALID, livingSentence: "Your score is strong." }).ok).toBe(false);
    expect(validateLivingReflection({ ...VALID, nextInvitation: "Your homework is to rewatch." }).ok).toBe(false);
  });

  it("rejects an over-long section", () => {
    expect(validateLivingReflection({ ...VALID, whatEmerged: "x".repeat(601) }).ok).toBe(false);
  });
});

describe("validateLivingReflection — quality guard (V1, live-failure regression)", () => {
  it("rejects third-person reporting ('the participant')", () => {
    expect(validateLivingReflection({ ...VALID, whatEmerged: "The participant noted a shift." }).ok).toBe(false);
    expect(validateLivingReflection({ ...VALID, whatEmerged: "Participant's response was clear." }).ok).toBe(false);
  });

  it("rejects other third-person employee references", () => {
    expect(validateLivingReflection({ ...VALID, whatEmerged: "The employee described a tension." }).ok).toBe(false);
    expect(validateLivingReflection({ ...VALID, whereYouStretched: "The user hesitated here." }).ok).toBe(false);
  });

  it("rejects watch-behavior read as intention ('conscious choice to limit engagement')", () => {
    expect(
      validateLivingReflection({
        ...VALID,
        whatEmerged: "Today involved a conscious choice to limit engagement with the video.",
      }).ok,
    ).toBe(false);
  });

  it("rejects inferred disengagement / attention / avoidance from watch data", () => {
    expect(validateLivingReflection({ ...VALID, whereYouStretched: "You were not fully engaged." }).ok).toBe(false);
    expect(validateLivingReflection({ ...VALID, whereYouStretched: "You avoided parts of the video." }).ok).toBe(false);
    expect(validateLivingReflection({ ...VALID, whereYouStretched: "You skipped ahead often." }).ok).toBe(false);
    expect(validateLivingReflection({ ...VALID, whereYouStretched: "You lacked attention here." }).ok).toBe(false);
    expect(validateLivingReflection({ ...VALID, whereYouStretched: "You watched less than before." }).ok).toBe(false);
  });

  it("rejects generic praise", () => {
    expect(validateLivingReflection({ ...VALID, whatEmerged: "Great job on this one." }).ok).toBe(false);
    expect(validateLivingReflection({ ...VALID, whatEmerged: "This shows you are a strong leader." }).ok).toBe(false);
  });

  it("rejects 'correct answer' framing and character claims", () => {
    expect(validateLivingReflection({ ...VALID, nextInvitation: "The correct answer is empathy." }).ok).toBe(false);
    expect(validateLivingReflection({ ...VALID, whatEmerged: "This shows that you avoid conflict." }).ok).toBe(false);
    expect(validateLivingReflection({ ...VALID, whatEmerged: "Based on your personality, you lead well." }).ok).toBe(false);
  });

  it("rejects generic coaching that would fit anyone", () => {
    expect(
      validateLivingReflection({ ...VALID, nextInvitation: "Consider how clear communication could help your team." }).ok,
    ).toBe(false);
    expect(validateLivingReflection({ ...VALID, nextInvitation: "You should think about how to improve." }).ok).toBe(false);
  });

  it("rejects a meaningless quotation fragment as the living sentence", () => {
    expect(validateLivingReflection({ ...VALID, livingSentence: "Less observation." }).ok).toBe(false);
    expect(validateLivingReflection({ ...VALID, livingSentence: "More clarity." }).ok).toBe(false);
  });

  it("rejects four sections that restate one idea", () => {
    const same = "You keep returning to the same steady question.";
    expect(
      validateLivingReflection({
        whatEmerged: same,
        whereYouStretched: same,
        livingSentence: same,
        nextInvitation: same,
      }).ok,
    ).toBe(false);
  });

  it("rejects the host question repeated verbatim across sections", () => {
    const q = "what will you change tomorrow";
    const res = validateLivingReflection(
      {
        whatEmerged: "What will you change tomorrow, you asked yourself honestly.",
        whereYouStretched: "There is a real pull between comfort and honesty for you.",
        livingSentence: "Honesty asks more of you than comfort ever will.",
        nextInvitation: "What will you change tomorrow is worth carrying into Monday.",
      },
      { questionExcerpt: q },
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("question_repeated");
  });

  it("accepts meaningful second-person grounding with the question framing ONE section", () => {
    const res = validateLivingReflection(
      {
        whatEmerged: "You keep pointing at the silence you have been keeping with your team.",
        whereYouStretched: "There is a pull between protecting calm and naming what is true.",
        livingSentence: "The unsaid thing shapes the room more than the said one.",
        nextInvitation: "What would you change tomorrow if that silence were named out loud.",
      },
      { questionExcerpt: "what would you change tomorrow" },
    );
    expect(res.ok).toBe(true);
  });
});

describe("version", () => {
  it("is v1", () => {
    expect(REFLECTION_VERSION).toBe("v1");
  });
});
