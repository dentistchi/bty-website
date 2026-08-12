import { describe, it, expect } from "vitest";
import {
  validateModuleDraft,
  moduleDraftContext,
  moduleDraftContextFingerprint,
  moduleDraftContextsCompatible,
  MODULE_DRAFT_GENERATION_VERSION,
} from "./module-draft-copilot";
import type { BuilderAnswers } from "./module-builder";

/**
 * Module-draft Copilot validator + context (Slice 2.4B). Fail-closed: enums, length,
 * completion-question quality, evidence honesty, material honesty, distinctness, and
 * markup. Context reconstruction reuses the Builder's own steps 1–4 gate.
 */

function validRaw() {
  return {
    module_draft: {
      learning_approach: ["practice", "shared_standard"],
      learning_approach_rationale: "The behavior needs a repeatable standard practiced under time pressure.",
      completion_question:
        "Before ending the next appointment call, what exact question will you use to confirm the patient understands the cost, preparation, and next step?",
      arena_recommended: true,
      arena_rationale: "The behavior must hold when the office is busy or the patient is uncertain.",
      follow_up_days: 7,
      follow_up_guidance: "Ask whether the confirmation step was used and what made it difficult.",
      material_guidance: {
        recommended_types: ["written", "live_discussion"],
        suggestion: "A short checklist and one example conversation may support this; the host provides the actual material.",
      },
    },
    assumptions: ["Staff can access accurate appointment and cost information."],
    warnings: ["This may also require a workflow or access change."],
    generation_version: MODULE_DRAFT_GENERATION_VERSION,
  };
}

// deep-ish clone that lets tests mutate module_draft freely
function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function expectReject(raw: unknown, code: string) {
  const r = validateModuleDraft(raw);
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.code).toBe(code);
}

describe("validateModuleDraft — shape + enums", () => {
  it("accepts a complete valid draft and normalizes it", () => {
    const r = validateModuleDraft(validRaw());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.module_draft.learning_approach).toEqual(["practice", "shared_standard"]);
    expect(r.value.module_draft.arena_recommended).toBe(true);
    expect(r.value.module_draft.follow_up_days).toBe(7);
    expect(r.value.module_draft.material_guidance.recommended_types).toEqual(["written", "live_discussion"]);
    expect(r.value.assumptions).toHaveLength(1);
    expect(r.value.warnings).toHaveLength(1);
  });

  it("rejects a non-object / missing module_draft", () => {
    expectReject(null, "not_object");
    expectReject({}, "missing_module_draft");
  });

  it("rejects a missing required proposal field", () => {
    const raw = clone(validRaw());
    delete (raw.module_draft as Record<string, unknown>).completion_question;
    expectReject(raw, "missing_field");
  });

  it("rejects an unsupported learning approach", () => {
    const raw = clone(validRaw());
    raw.module_draft.learning_approach = ["collaborate"];
    expectReject(raw, "unsupported_learning_approach");
  });

  it("rejects an unsupported follow-up value", () => {
    const raw = clone(validRaw());
    (raw.module_draft as Record<string, unknown>).follow_up_days = 14;
    expectReject(raw, "unsupported_follow_up");
  });

  it("rejects an invalid material type", () => {
    const raw = clone(validRaw());
    raw.module_draft.material_guidance.recommended_types = ["webinar"];
    expectReject(raw, "invalid_material_type");
  });

  it("rejects a non-boolean arena_recommended", () => {
    const raw = clone(validRaw());
    (raw.module_draft as Record<string, unknown>).arena_recommended = "yes";
    expectReject(raw, "field_type");
  });

  it("ignores unknown top-level keys (dropped, not applied)", () => {
    const raw = { ...clone(validRaw()), unexpected_key: { nested: true } };
    const r = validateModuleDraft(raw);
    expect(r.ok).toBe(true);
    if (r.ok) expect(Object.keys(r.value)).toEqual(["module_draft", "assumptions", "warnings"]);
  });
});

describe("validateModuleDraft — completion-question quality", () => {
  it("rejects the generic fallback question", () => {
    for (const q of [
      "What is one thing you will apply this week?",
      "이번 주에 적용할 한 가지는 무엇인가요?",
      "What did you learn?",
    ]) {
      const raw = clone(validRaw());
      raw.module_draft.completion_question = q;
      expectReject(raw, "completion_question_generic");
    }
  });

  it("rejects a yes/no question with no interrogative", () => {
    const raw = clone(validRaw());
    raw.module_draft.completion_question = "Will you commit to reading the dosage back before sign-off?";
    expectReject(raw, "completion_question_generic");
  });

  it("accepts a behavior-grounded, specific question (the valid fixture)", () => {
    expect(validateModuleDraft(validRaw()).ok).toBe(true);
  });
});

describe("validateModuleDraft — honesty gates", () => {
  it("rejects evidence overclaim", () => {
    for (const s of ["and confirm the patient fully understood everything", "which proves behavior permanently changed"]) {
      const raw = clone(validRaw());
      raw.module_draft.completion_question = `Before the next call, what will you say ${s}?`;
      expectReject(raw, "overclaiming_evidence");
    }
  });

  it("rejects material guidance that claims an asset already exists", () => {
    const raw = clone(validRaw());
    raw.module_draft.material_guidance.suggestion = "Use the official approved checklist document with the team.";
    expectReject(raw, "material_fabrication");
  });

  it("rejects duplicated generic content across distinct fields", () => {
    const raw = clone(validRaw());
    const same = "Ask what made the confirmation step difficult during a busy shift this week.";
    raw.module_draft.follow_up_guidance = same;
    raw.module_draft.arena_rationale = same;
    expectReject(raw, "duplicate_field_content");
  });
});

describe("validateModuleDraft — markup + length", () => {
  it("rejects HTML", () => {
    const raw = clone(validRaw());
    raw.module_draft.arena_rationale = "Practice matters <b>a lot</b> here.";
    expectReject(raw, "unsafe_markup");
  });
  it("rejects markdown fences", () => {
    const raw = clone(validRaw());
    raw.module_draft.follow_up_guidance = "```json\n{}\n```";
    expectReject(raw, "unsafe_markup");
  });
  it("rejects an overlong completion question", () => {
    const raw = clone(validRaw());
    raw.module_draft.completion_question = `What ${"x".repeat(320)}?`;
    expectReject(raw, "too_long");
  });
  it("normalizes surrounding + internal whitespace", () => {
    const raw = clone(validRaw());
    raw.module_draft.arena_rationale = "  Consistency   matters\n\nunder pressure.  ";
    const r = validateModuleDraft(raw);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.module_draft.arena_rationale).toBe("Consistency matters under pressure.");
  });
});

describe("validateModuleDraft — optional assumptions/warnings", () => {
  it("treats absent assumptions/warnings as empty arrays", () => {
    const raw = clone(validRaw());
    delete (raw as Record<string, unknown>).assumptions;
    delete (raw as Record<string, unknown>).warnings;
    const r = validateModuleDraft(raw);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.assumptions).toEqual([]);
      expect(r.value.warnings).toEqual([]);
    }
  });
  it("rejects an overlong assumption", () => {
    const raw = clone(validRaw());
    raw.assumptions = ["y".repeat(241)];
    expectReject(raw, "too_long");
  });
});

describe("moduleDraftContext + fingerprint", () => {
  const full: BuilderAnswers = {
    problem: "Handoffs skip the double-check.",
    audienceType: "everyone",
    recurringMoment: "at each handoff point",
    observableBehavior: "The charge nurse reads the dosage back before sign-off.",
    successEvidence: "Sign-offs include a witnessed read-back.",
  };

  it("returns null until steps 1–4 are complete", () => {
    expect(moduleDraftContext({})).toBeNull();
    expect(moduleDraftContext({ ...full, successEvidence: "" })).toBeNull();
    expect(moduleDraftContext({ ...full, audienceType: undefined })).toBeNull();
  });

  it("requires audience detail for a specific-role audience", () => {
    expect(moduleDraftContext({ ...full, audienceType: "specific_role", audienceDetail: "" })).toBeNull();
    expect(moduleDraftContext({ ...full, audienceType: "specific_role", audienceDetail: "charge nurse" })).not.toBeNull();
  });

  it("reconstructs the canonical context (capability optional)", () => {
    const ctx = moduleDraftContext(full);
    expect(ctx).not.toBeNull();
    expect(ctx!.capabilityCandidate).toBeNull();
    expect(ctx!.problemStatement).toBe("Handoffs skip the double-check.");
  });

  it("fingerprint is stable to whitespace/case and detects a real edit", () => {
    const a = moduleDraftContext(full)!;
    const b = moduleDraftContext({ ...full, problem: "  handoffs skip the DOUBLE-CHECK.  " })!;
    expect(moduleDraftContextsCompatible(a, b)).toBe(true);
    const c = moduleDraftContext({ ...full, observableBehavior: "Something entirely different now." })!;
    expect(moduleDraftContextsCompatible(a, c)).toBe(false);
    expect(moduleDraftContextFingerprint(a)).toContain("handoffs skip the double-check");
  });
});
