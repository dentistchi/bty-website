import { describe, it, expect } from "vitest";
import {
  canApprove,
  canMutateDraft,
  canPublish,
  canTransition,
  nextModuleVersion,
  observableBehaviorWarning,
  recommendArena,
  validateEvidenceHonesty,
  validateModuleDraft,
  ARENA_RECOMMENDED_LEARNING_TYPES,
  LEARNING_TYPES,
  EVIDENCE_LADDER,
  type ModuleDraftAnswers,
  type ModuleDraftStatus,
} from "./module-draft";

/** A complete, approval-ready answer set used as the baseline for validation tests. */
function completeAnswers(): ModuleDraftAnswers {
  return {
    problem: "Frontline nurses skip the double-check step during medication handoff.",
    capability: "Reliable medication handoff",
    targetRoles: ["charge_nurse"],
    observableBehavior:
      "The charge nurse reads back the dosage during every shift handoff before signing off.",
    successEvidence: "Handoff sign-offs include a verbal read-back witnessed by the receiving nurse.",
    learningType: "handoff",
    reflectionPrompt: "When did a rushed handoff last cost you rework?",
    actionDecisionPrompt: "What is the one read-back you will commit to on your next shift?",
  };
}

describe("module lifecycle transitions", () => {
  it("allows only draft -> approved -> published, forward", () => {
    expect(canTransition("draft", "approved")).toBe(true);
    expect(canTransition("approved", "published")).toBe(true);
  });

  it("rejects backward transitions", () => {
    expect(canTransition("approved", "draft")).toBe(false);
    expect(canTransition("published", "approved")).toBe(false);
    expect(canTransition("published", "draft")).toBe(false);
  });

  it("rejects skipping a state", () => {
    expect(canTransition("draft", "published")).toBe(false);
  });

  it("rejects self-transitions", () => {
    for (const s of ["draft", "approved", "published"] as ModuleDraftStatus[]) {
      expect(canTransition(s, s)).toBe(false);
    }
  });

  it("published is terminal", () => {
    expect(canTransition("published", "approved")).toBe(false);
    expect(canTransition("published", "published")).toBe(false);
  });
});

describe("mutation / publish guards", () => {
  it("only a draft is mutable", () => {
    expect(canMutateDraft("draft")).toBe(true);
    expect(canMutateDraft("approved")).toBe(false);
    expect(canMutateDraft("published")).toBe(false);
  });

  it("only an approved draft may publish", () => {
    expect(canPublish("draft")).toBe(false);
    expect(canPublish("approved")).toBe(true);
    expect(canPublish("published")).toBe(false);
  });
});

describe("nextModuleVersion", () => {
  it("increments a valid version", () => {
    expect(nextModuleVersion(1)).toBe(2);
    expect(nextModuleVersion(7)).toBe(8);
  });

  it("floors a corrupt/absent value to 1", () => {
    expect(nextModuleVersion(0)).toBe(1);
    expect(nextModuleVersion(-3)).toBe(1);
    expect(nextModuleVersion(1.5)).toBe(1);
    expect(nextModuleVersion(NaN)).toBe(1);
  });
});

describe("learning-type -> Arena recommendation", () => {
  it("recommends Arena for judgment/conversation/conflict/handoff/escalation/leadership/decision", () => {
    for (const t of ARENA_RECOMMENDED_LEARNING_TYPES) {
      expect(recommendArena(t)).toBe(true);
    }
  });

  it("does NOT recommend Arena for policy or informational content", () => {
    expect(recommendArena("policy")).toBe(false);
    expect(recommendArena("informational")).toBe(false);
  });

  it("does not recommend Arena for unknown values", () => {
    expect(recommendArena("random")).toBe(false);
    expect(recommendArena(undefined)).toBe(false);
  });

  it("every learning type is classified deterministically", () => {
    for (const t of LEARNING_TYPES) {
      expect(typeof recommendArena(t)).toBe("boolean");
    }
  });
});

describe("evidence-ladder honesty", () => {
  it("exposes the full ladder low->high", () => {
    expect(EVIDENCE_LADDER).toEqual([
      "exposed",
      "reflected",
      "decided",
      "practiced",
      "applied",
      "observed",
      "sustained",
    ]);
  });

  it("completion / self_report may only claim up to 'decided'", () => {
    for (const source of ["completion", "self_report"] as const) {
      expect(validateEvidenceHonesty("exposed", source).ok).toBe(true);
      expect(validateEvidenceHonesty("decided", source).ok).toBe(true);
      // the verified-behavior tier is an overclaim for a self-reported source.
      for (const level of ["applied", "observed", "sustained"] as const) {
        const r = validateEvidenceHonesty(level, source);
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.reason).toBe("evidence_overclaim");
      }
      // 'practiced' also requires a stronger source.
      expect(validateEvidenceHonesty("practiced", source).ok).toBe(false);
    }
  });

  it("system_practice may claim 'practiced' but not the verified-behavior tier", () => {
    expect(validateEvidenceHonesty("practiced", "system_practice").ok).toBe(true);
    expect(validateEvidenceHonesty("applied", "system_practice").ok).toBe(false);
  });

  it("manager_observation may claim the verified-behavior tier", () => {
    for (const level of ["applied", "observed", "sustained"] as const) {
      expect(validateEvidenceHonesty(level, "manager_observation").ok).toBe(true);
    }
  });

  it("rejects invalid level/source values", () => {
    expect(validateEvidenceHonesty("bogus", "completion")).toEqual({
      ok: false,
      reason: "evidence_level_invalid",
    });
    expect(validateEvidenceHonesty("decided", "bogus")).toEqual({
      ok: false,
      reason: "evidence_source_invalid",
    });
  });
});

describe("observable-behavior warning", () => {
  it("warns on known vague trait phrases", () => {
    expect(observableBehaviorWarning("communicate better")).toBe("observable_behavior_vague");
    expect(observableBehaviorWarning("Be more responsible with tasks")).toBe("observable_behavior_vague");
    expect(observableBehaviorWarning("show leadership")).toBe("observable_behavior_vague");
  });

  it("warns on too-short statements", () => {
    expect(observableBehaviorWarning("do better")).toBe("observable_behavior_vague");
  });

  it("passes a concrete actor + observable verb + trigger/result", () => {
    expect(
      observableBehaviorWarning(
        "The charge nurse reads back the dosage during every shift handoff before signing off.",
      ),
    ).toBeNull();
  });

  it("flags a missing/empty behavior", () => {
    expect(observableBehaviorWarning("")).toBe("observable_behavior_missing");
    expect(observableBehaviorWarning(undefined)).toBe("observable_behavior_missing");
  });
});

describe("validateModuleDraft (approval-readiness)", () => {
  it("passes a complete answer set", () => {
    const r = validateModuleDraft(completeAnswers());
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it("collects errors for every missing required field", () => {
    const r = validateModuleDraft({});
    expect(r.ok).toBe(false);
    expect(r.errors).toEqual(
      expect.arrayContaining([
        "problem_required",
        "capability_required",
        "observable_behavior_required",
        "success_evidence_required",
        "reflection_prompt_required",
        "action_decision_prompt_required",
        "target_roles_required",
        "learning_type_required",
      ]),
    );
  });

  it("requires at least one non-empty target role", () => {
    const r = validateModuleDraft({ ...completeAnswers(), targetRoles: ["  "] });
    expect(r.errors).toContain("target_roles_required");
  });

  it("treats a vague observable behavior as a WARNING, not a blocking error", () => {
    const r = validateModuleDraft({ ...completeAnswers(), observableBehavior: "show leadership" });
    // still ok (approval not blocked), but a warning is surfaced.
    expect(r.ok).toBe(true);
    expect(r.warnings).toContain("observable_behavior_vague");
  });

  it("treats an evidence overclaim as a hard ERROR", () => {
    const r = validateModuleDraft({
      ...completeAnswers(),
      evidenceLevel: "observed",
      evidenceSource: "completion",
    });
    expect(r.ok).toBe(false);
    expect(r.errors).toContain("evidence_overclaim");
  });

  it("accepts an honest evidence pairing", () => {
    const r = validateModuleDraft({
      ...completeAnswers(),
      evidenceLevel: "reflected",
      evidenceSource: "self_report",
    });
    expect(r.ok).toBe(true);
  });
});

describe("canApprove", () => {
  it("requires a draft AND a valid answer set", () => {
    const a = completeAnswers();
    expect(canApprove("draft", a)).toBe(true);
    expect(canApprove("approved", a)).toBe(false);
    expect(canApprove("published", a)).toBe(false);
    expect(canApprove("draft", {})).toBe(false);
  });
});
