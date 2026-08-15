import { describe, it, expect } from "vitest";
import {
  validateDraftPatch,
  stepBlocker,
  stepBlockers,
  canAdvanceStep,
  recommendArenaForNeed,
  recommendArenaForNeeds,
  normalizeLearningNeeds,
  draftTitleFrom,
  PROBLEM_MAX,
  BUILDER_STEP_MAX,
  type BuilderAnswers,
} from "./module-builder";

describe("validateDraftPatch — partial-save friendly", () => {
  it("accepts an empty patch", () => {
    expect(validateDraftPatch({})).toEqual({ ok: true, value: {} });
  });

  it("accepts a partial draft (one field) without requiring the rest", () => {
    const r = validateDraftPatch({ answers: { problem: "handoffs keep missing the check" } });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.answers).toEqual({ problem: "handoffs keep missing the check" });
  });

  it("preserves raw strings (no trim) for mid-edit fidelity", () => {
    const r = validateDraftPatch({ answers: { problem: "typing… " } });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.answers?.problem).toBe("typing… ");
  });

  it("drops unknown answer keys (never persisted)", () => {
    const r = validateDraftPatch({ answers: { problem: "x", sneaky: "nope", owner_user_id: "hack" } as never });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.answers).toEqual({ problem: "x" });
  });

  it("cannot forge attachment/document_asset_ref via a client PATCH", () => {
    const r = validateDraftPatch({
      answers: { problem: "x", document_asset_ref: "owner/hax.pdf", attachment: { present: true } } as never,
    });
    expect(r.ok).toBe(true);
    // only the whitelisted answer field survives — the server owns the ref.
    if (r.ok) expect(r.value.answers).toEqual({ problem: "x" });
  });

  it("validates current_step range 1..BUILDER_STEP_MAX", () => {
    expect(validateDraftPatch({ currentStep: 1 }).ok).toBe(true);
    expect(validateDraftPatch({ currentStep: BUILDER_STEP_MAX }).ok).toBe(true);
    expect(validateDraftPatch({ currentStep: 0 })).toEqual({ ok: false, errors: ["current_step_invalid"] });
    expect(validateDraftPatch({ currentStep: 10 })).toEqual({ ok: false, errors: ["current_step_invalid"] });
    expect(validateDraftPatch({ currentStep: 2.5 })).toEqual({ ok: false, errors: ["current_step_invalid"] });
  });

  it("rejects invalid enum values with stable codes", () => {
    expect(validateDraftPatch({ answers: { audienceType: "nobody" } as never })).toEqual({
      ok: false,
      errors: ["audience_type_invalid"],
    });
    expect(validateDraftPatch({ answers: { learningNeed: "guess" } as never })).toEqual({
      ok: false,
      errors: ["learning_need_invalid"],
    });
    expect(validateDraftPatch({ answers: { materialIntent: "fax" } as never })).toEqual({
      ok: false,
      errors: ["material_intent_invalid"],
    });
    expect(validateDraftPatch({ answers: { followUpDays: 14 } as never })).toEqual({
      ok: false,
      errors: ["follow_up_days_invalid"],
    });
  });

  it("accepts the valid enum values", () => {
    const answers: BuilderAnswers = {
      audienceType: "specific_role",
      audienceDetail: "charge nurse",
      evidenceType: "confirmed",
      learningNeed: "practice",
      materialIntent: "pdf",
      arenaRecommended: true,
      followUpDays: 7,
    };
    const r = validateDraftPatch({ answers });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.answers).toEqual(answers);
  });

  it("rejects an over-length text field", () => {
    const long = "a".repeat(PROBLEM_MAX + 1);
    expect(validateDraftPatch({ answers: { problem: long } })).toEqual({
      ok: false,
      errors: ["problem_too_long"],
    });
  });

  it("rejects a non-object answers payload", () => {
    expect(validateDraftPatch({ answers: "nope" as never })).toEqual({ ok: false, errors: ["answers_invalid"] });
  });

  // Adaptive Clarification (Slice 2.4C) — namespaced, bounded, resume-safe persistence.
  it("persists a well-formed clarification state verbatim", () => {
    const clarification = {
      version: "clarification_v1",
      answers: [{ dimension: "observable_behavior", choiceKey: null, text: "Reads the dosage back before sign-off" }],
    };
    const r = validateDraftPatch({ answers: { clarification } as never });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.answers?.clarification).toEqual(clarification);
  });

  it("rejects a malformed clarification payload (bad shape / over-long text / too many answers)", () => {
    expect(validateDraftPatch({ answers: { clarification: { answers: "nope" } } as never })).toEqual({
      ok: false,
      errors: ["clarification_invalid"],
    });
    const longText = "x".repeat(301);
    expect(
      validateDraftPatch({ answers: { clarification: { version: "v", answers: [{ dimension: "target", choiceKey: null, text: longText }] } } as never }),
    ).toEqual({ ok: false, errors: ["clarification_invalid"] });
    const tooMany = Array.from({ length: 7 }, () => ({ dimension: "target", choiceKey: null, text: "x" }));
    expect(
      validateDraftPatch({ answers: { clarification: { version: "v", answers: tooMany } } as never }),
    ).toEqual({ ok: false, errors: ["clarification_invalid"] });
  });
});

describe("stepBlocker / canAdvanceStep — client Next-guard", () => {
  const full: BuilderAnswers = {
    // Slice 3.2R-R2.1 — a full answer set now includes the training's NAME, distinct from the
    // problem sentence below it.
    title: "Read Back Before Sign-Off",
    problem: "handoffs keep missing the double-check",
    audienceType: "specific_role",
    audienceDetail: "charge nurse",
    recurringMoment: "at each handoff point",
    observableBehavior: "reads the dosage back at handoff",
    successEvidence: "receiving nurse confirms a read-back",
    learningNeed: "practice",
    materialIntent: "pdf",
    followUpDays: 7,
  };

  it("blocks step 1 until the problem is meaningful (SOURCE readiness)", () => {
    /*
      Slice 3.2R-R2.1 — `stepBlocker` answers "is the SOURCE present?", which is what the
      generation boundary consumes. A nameless draft is still designable, so the title is
      deliberately absent from this gate.
    */
    expect(stepBlocker(1, {})).toBe("problem_required");
    expect(stepBlocker(1, { problem: "ok" })).toBe("problem_required"); // too short
    expect(stepBlocker(1, { problem: full.problem })).toBeNull();
    expect(stepBlocker(1, { problem: full.problem, title: undefined })).toBeNull();
  });

  it("stepBlockers additionally requires the NAME, and reports both gaps at once", () => {
    expect(stepBlockers(1, {})).toEqual(["title_required", "problem_required"]);
    expect(stepBlockers(1, { problem: full.problem })).toEqual(["title_required"]);
    expect(stepBlockers(1, { title: full.title })).toEqual(["problem_required"]);
    expect(stepBlockers(1, { title: full.title, problem: full.problem })).toEqual([]);
  });

  it("title and problem are independent — neither satisfies the other", () => {
    expect(stepBlockers(1, { title: "A name" })).toEqual(["problem_required"]);
    expect(stepBlockers(1, { problem: full.problem })).toEqual(["title_required"]);
  });

  it("a nameless but fully-designed draft can still ADVANCE nowhere, yet still GENERATE", () => {
    /*
      The split that 44 failing tests forced into the open: the Next-guard stops an unnamed draft,
      and the generation boundary does not — because a program is authored from the problem, not
      from its name.
    */
    const nameless = { ...full, title: undefined };
    expect(canAdvanceStep(1, nameless)).toBe(false);
    for (const step of [1, 2, 3, 4, 5]) expect(stepBlocker(step, nameless)).toBeNull();
  });

  it("blocks step 2 until audience (and detail when required) is set", () => {
    expect(stepBlocker(2, {})).toBe("audience_required");
    expect(stepBlocker(2, { audienceType: "job_group" })).toBe("audience_detail_required");
    expect(stepBlocker(2, { audienceType: "job_group", audienceDetail: "nurses" })).toBeNull();
    expect(stepBlocker(2, { audienceType: "everyone" })).toBeNull();
  });

  it("blocks steps 3-8 on their own required field", () => {
    // Slice 3.2P-R3.6-R1 inserted "When does this usually happen?" at 3; everything after moved once.
    expect(stepBlocker(3, {})).toBe("recurring_moment_required");
    expect(stepBlocker(4, {})).toBe("behavior_required");
    expect(stepBlocker(5, {})).toBe("evidence_required");
    expect(stepBlocker(6, {})).toBe("learning_need_required");
    expect(stepBlocker(7, {})).toBe("material_intent_required");
    expect(stepBlocker(8, {})).toBe("follow_up_required");
    expect(stepBlocker(8, { followUpDays: 0 })).toBeNull(); // "none" is a valid pick
  });

  it("never blocks the review step", () => {
    expect(stepBlocker(BUILDER_STEP_MAX, {})).toBeNull();
  });

  it("canAdvanceStep passes with a full answer set", () => {
    for (let s = 1; s <= 9; s++) expect(canAdvanceStep(s, full)).toBe(true);
  });
});

describe("recommendArenaForNeed — deterministic", () => {
  it("recommends for decide / practice / shared_standard", () => {
    expect(recommendArenaForNeed("decide")).toBe(true);
    expect(recommendArenaForNeed("practice")).toBe(true);
    expect(recommendArenaForNeed("shared_standard")).toBe(true);
  });
  it("does not recommend for pure information (know) or unknown", () => {
    expect(recommendArenaForNeed("know")).toBe(false);
    expect(recommendArenaForNeed(undefined)).toBe(false);
  });
});

describe("multi-select learning needs (2.1)", () => {
  it("validates a learningNeeds array and de-duplicates", () => {
    const r = validateDraftPatch({ answers: { learningNeeds: ["know", "practice", "know"] } as never });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.answers?.learningNeeds).toEqual(["know", "practice"]);
  });

  it("rejects an invalid member of learningNeeds", () => {
    expect(validateDraftPatch({ answers: { learningNeeds: ["know", "bogus"] } as never })).toEqual({
      ok: false,
      errors: ["learning_needs_invalid"],
    });
  });

  it("normalizes a legacy singular learningNeed into the array", () => {
    expect(normalizeLearningNeeds({ learningNeed: "decide" })).toEqual(["decide"]);
    expect(normalizeLearningNeeds({ learningNeeds: ["know", "shared_standard"] })).toEqual(["know", "shared_standard"]);
    expect(normalizeLearningNeeds({})).toEqual([]);
  });

  it("step 5 is satisfied by a non-empty learningNeeds array", () => {
    expect(stepBlocker(6, { learningNeeds: ["know"] })).toBeNull();
    expect(stepBlocker(6, { learningNeeds: [] })).toBe("learning_need_required");
  });

  it("Arena recommendation derives from the array (any qualifying need)", () => {
    expect(recommendArenaForNeeds(["know"])).toBe(false);
    expect(recommendArenaForNeeds(["know", "decide"])).toBe(true);
    expect(recommendArenaForNeeds([])).toBe(false);
  });
});

describe("draftTitleFrom", () => {
  it("derives a title from the first line of the problem", () => {
    expect(draftTitleFrom({ problem: "Handoffs keep missing the check\nmore detail" })).toBe(
      "Handoffs keep missing the check",
    );
  });
  it("truncates long problems", () => {
    const long = "a".repeat(80);
    const title = draftTitleFrom({ problem: long });
    expect(title?.endsWith("…")).toBe(true);
    expect((title ?? "").length).toBeLessThanOrEqual(61);
  });
  it("returns null when there is no usable problem", () => {
    expect(draftTitleFrom({})).toBeNull();
    expect(draftTitleFrom({ problem: "   " })).toBeNull();
  });
});
