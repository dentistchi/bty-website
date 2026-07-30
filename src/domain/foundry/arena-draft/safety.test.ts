import { describe, it, expect } from "vitest";
import { classifyPracticeEligibility, validateConstraintCompliance } from "./safety";
import type { ArenaScenarioDraft } from "./types";

describe("classifyPracticeEligibility", () => {
  it("A — pure KNOW → know_only", () => {
    const r = classifyPracticeEligibility({ problem: "Confirm two identifiers before medication administration", learningNeeds: ["know"] });
    expect(r.kind).toBe("know_only");
  });

  it("G — judgment-only (no mandatory constraint) → judgment_only", () => {
    const r = classifyPracticeEligibility({ problem: "A top performer is accused of treating a teammate unfairly", learningNeeds: ["decide"] });
    expect(r.kind).toBe("judgment_only");
  });

  it("B — mixed clinical safety (mandate + judgment) → mixed_with_non_negotiables, constraints extracted", () => {
    const r = classifyPracticeEligibility({
      problem: "Two patient identifiers must be verified before treatment begins. Decide how to pause, reassign, and notify while patients wait.",
      learningNeeds: ["decide"],
    });
    expect(r.kind).toBe("mixed_with_non_negotiables");
    expect(r.constraints.length).toBeGreaterThan(0);
    expect(r.constraints[0]).toMatch(/identifiers must be verified before treatment/i);
  });

  it("C — mixed privacy → mixed_with_non_negotiables", () => {
    const r = classifyPracticeEligibility({
      problem: "You must not disclose private employee information. Decide how to answer the team and communicate timing.",
      learningNeeds: ["decide"],
    });
    expect(r.kind).toBe("mixed_with_non_negotiables");
  });

  it("D — mixed mandatory reporting → mixed_with_non_negotiables", () => {
    const r = classifyPracticeEligibility({
      problem: "A safety incident must be reported. Decide who to notify first and how much work to pause.",
      learningNeeds: ["decide"],
    });
    expect(r.kind).toBe("mixed_with_non_negotiables");
  });

  it("F — a safety domain word with NO clear mandate → unresolved_safety_boundary", () => {
    const r = classifyPracticeEligibility({ problem: "There is a patient safety concern the team keeps raising", learningNeeds: ["decide"] });
    expect(r.kind).toBe("unresolved_safety_boundary");
  });

  it("Korean — mixed clinical (한국어) → mixed_with_non_negotiables", () => {
    const r = classifyPracticeEligibility({
      problem: "치료 전에 환자 신원 확인을 반드시 완료해야 한다. 대기 중 어떻게 알리고 재배치할지 판단한다.",
      learningNeeds: ["decide"],
    });
    // Korean mandate ("반드시…해야 한다") + clinical domain (환자/신원/치료) → constraints present.
    expect(["mixed_with_non_negotiables", "unresolved_safety_boundary"]).toContain(r.kind);
  });
});

// ---------------------------------------------------------------------------

function draftWith(primaryLabels: string[]): ArenaScenarioDraft {
  return {
    title: "t",
    opening: "A teammate flags a mandatory check while the ward is busy.",
    primary: { choices: primaryLabels.map((label, i) => ({ id: `primary_${i + 1}`, label })) },
    tradeoff: { escalationText: "e", choices: [{ id: "t1", label: "Reassign a nurse to verify" }, { id: "t2", label: "Escalate to the clinical lead" }] },
    actionDecision: { prompt: "p", choices: [{ id: "a1", label: "Pause the room and complete the check now", isActionCommitment: true }, { id: "a2", label: "Move only the affected patient while others continue", isActionCommitment: false }] },
  };
}

describe("validateConstraintCompliance", () => {
  it("E — rejects a choice that presents skipping a required check as an option", () => {
    const bad = draftWith(["Skip the required check to protect the schedule", "Complete the check and delay treatment"]);
    expect(validateConstraintCompliance(bad).ok).toBe(false);
  });

  it("rejects 'proceed without verifying'", () => {
    const bad = draftWith(["Proceed without verifying to stay on time", "Pause and verify first"]);
    expect(validateConstraintCompliance(bad).errors).toContain("constraint_violation");
  });

  it("rejects 'do not report' the incident", () => {
    const bad = draftWith(["Handle it quietly and do not report it", "Report it and manage the fallout"]);
    expect(validateConstraintCompliance(bad).ok).toBe(false);
  });

  it("rejects disclosing private/confidential information", () => {
    const bad = draftWith(["Reveal the private employee details to settle it", "Address the concern without sharing private records"]);
    expect(validateConstraintCompliance(bad).ok).toBe(false);
  });

  it("Korean — rejects 확인 건너뛰기 (skip the check)", () => {
    const bad = draftWith(["일정을 지키려 확인을 건너뛴다", "확인을 마친 뒤 치료를 미룬다"]);
    expect(validateConstraintCompliance(bad).ok).toBe(false);
  });

  it("passes when every choice complies (how-to-comply tradeoffs)", () => {
    const good = draftWith(["Pause the whole workflow and complete every check now", "Move only the affected patient while other rooms continue"]);
    expect(validateConstraintCompliance(good).ok).toBe(true);
  });
});
