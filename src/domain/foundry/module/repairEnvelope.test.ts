import { describe, it, expect } from "vitest";
import {
  isSemanticRepairableCode,
  repairFreezeViolated,
  repairLicenseFor,
  scenarioRepairFreezeViolated,
  semanticRepairInstruction,
  validateProgramProposal,
} from "./program-authorship";

/**
 * SLICE 3.2P-R0 — EVERY REPAIR HAS AN ENVELOPE, AND THE ENVELOPE IS ENFORCED.
 *
 * The fourth pilot window was refused on a reflection sentence, and its bounded repair
 * deleted the `follow_up` element. The attempt then died on `missing_required_kind` — the
 * consequence of the repair, not the fault that caused it — and the original refusal was lost.
 *
 * R4's freeze would have caught that, but it only covered `scenario_without_pressure`. These
 * tests hold the generalised version: a license per class, structure frozen in every case, and
 * the original refusal preserved when a repair leaves its lane. Zero provider calls.
 */
const ANSWERS = {
  problem: "No confirmation calls made",
  recurringMoment: "at each handoff point",
  observableBehavior: "Employees make a confirmation call and follow a checklist of required questions.",
  successEvidence: "A checklist is completed and submitted after each call, with supervisor verification.",
  learningNeeds: ["shared_standard", "practice", "decide"],
  materialIntent: "youtube", materialText: "x".repeat(48),
  completionPrompt: "Describe how you will use the checklist on your next confirmation call.",
  audienceType: "job_group", audienceDetail: "Admin", evidenceType: "confirmed",
  followUpDays: 7, arenaRecommended: true,
  sharedQuestion: "In your own words, what is the most important standard from this training?",
  capabilityCandidate: "Process Adherence",
} as never;

const KINDS = ["why_it_matters","observable_standard","scenario","reflection","action_decision","field_application","completion_check","follow_up"] as const;

const proposal = (over: { reflection?: string; elements?: unknown; program?: Record<string, unknown> } = {}) => ({
  program: {
    display_title: "Confirmation calls that land",
    elements: over.elements ?? KINDS.map((k) => ({
      kind: k,
      content: k === "reflection" ? (over.reflection ?? "When did you last skip a confirmation call, and what made it easy to skip?") : `A grounded sentence for ${k} that the team would read.`,
      rationale: "grounded",
    })),
    assumptions: ["staff can reach the person before the appointment"],
    warnings: ["an out-of-date phone list needs fixing, not training"],
    behavior_contract: {
      actor: "the admin on duty", trigger: "before each scheduled appointment",
      observable_action: "make a confirmation call and follow the checklist of required questions",
      completion: { confirmed_by: "the supervisor", confirmation_action: "review the completed checklist" },
    },
    scenario_contract: { pressure_condition: "a queue is building at the desk", pressure_detail: "the phone list is out of date" },
    completion_contract: { verification_target: "the_behaviour", response_mode: "state_what_you_will_say" },
    follow_up_contract: { review_focus: "what_you_said", confirmer: "self_report" },
    ...over.program,
  },
});

const verdict = (p: unknown) => {
  const r = validateProgramProposal(p, ANSWERS, []);
  return r.ok ? "PASS" : `${r.code}${r.kind ? "/" + r.kind : ""}`;
};
/** The reflection defects that are actually repairable, per class. */
const OVERCLAIM = "Now that confirmation calls are consistently made, what improved for your patients?";
const FABRICATION = "The video explains which three items every confirmation call must include — which did you miss?";

describe("[3.2P-R0] licenses are derived from the refusal, not from the model's claim", () => {
  it("scenario pressure keeps its measured minimum", () => {
    expect(repairLicenseFor("scenario_without_pressure", "scenario")).toEqual({ surface: "scenario_pressure" });
  });
  it("a prose refusal licenses that element alone", () => {
    expect(repairLicenseFor("evidence_overclaim", "reflection")).toEqual({ surface: "element", kind: "reflection" });
    expect(repairLicenseFor("material_fabrication", "follow_up")).toEqual({ surface: "element", kind: "follow_up" });
  });
  it("the two contract-backed kinds license their backing contract too", () => {
    // `unsafe()` guards those contract fields and reports them under these kinds; licensing
    // only the element would make such a repair impossible rather than merely bounded.
    expect(repairLicenseFor("material_fabrication", "observable_standard"))
      .toEqual({ surface: "element_and_contract", kind: "observable_standard", contract: "behavior_contract" });
    expect(repairLicenseFor("evidence_overclaim", "scenario"))
      .toEqual({ surface: "element_and_contract", kind: "scenario", contract: "scenario_contract" });
  });
  it("a refusal with no element licenses the narrative prose only", () => {
    expect(repairLicenseFor("evidence_overclaim", undefined)).toEqual({ surface: "narrative" });
  });
  it("the repairable set is unchanged — exactly three", () => {
    for (const ok of ["evidence_overclaim", "material_fabrication", "scenario_without_pressure"] as const) {
      expect(isSemanticRepairableCode(ok), ok).toBe(true);
    }
    for (const no of ["scenario_independent_moment","dependency_inversion","missing_required_kind","non_observable_standard","generic_completion"] as const) {
      expect(isSemanticRepairableCode(no), no).toBe(false);
    }
  });
});

describe("[3.2P-R0] WINDOW 4 REPLAY — a reflection repair may not delete follow_up", () => {
  for (const [label, defect] of [["evidence_overclaim", OVERCLAIM], ["material_fabrication", FABRICATION]] as const) {
    describe(label, () => {
      const before = proposal({ reflection: defect });
      const frozen = { code: label, kind: "reflection" as const };

      it("the initial proposal really fails on reflection alone", () => {
        expect(verdict(before)).toBe(`${label}/reflection`);
      });

      it("A — repair changes only reflection → freeze PASS, full validation PASS", () => {
        const after = proposal({ reflection: "When did you last skip a confirmation call, and what made it easy to skip?" });
        expect(repairFreezeViolated({ ...frozen, before, after })).toBe(false);
        expect(verdict(after)).toBe("PASS");
      });

      it("B — repair fixes reflection but DROPS follow_up → freeze FAIL (the window-4 fault)", () => {
        const after = proposal({
          elements: KINDS.filter((k) => k !== "follow_up").map((k) => ({ kind: k, content: `A grounded sentence for ${k} that the team would read.`, rationale: "grounded" })),
        });
        expect(repairFreezeViolated({ ...frozen, before, after })).toBe(true);
      });

      it("C — repair fixes reflection but edits action_decision or scenario → freeze FAIL", () => {
        for (const victim of ["action_decision", "scenario"] as const) {
          const after = proposal({
            elements: KINDS.map((k) => ({ kind: k, content: k === victim ? "Something the model rewrote." : `A grounded sentence for ${k} that the team would read.`, rationale: "grounded" })),
          });
          expect(repairFreezeViolated({ ...frozen, before, after }), victim).toBe(true);
        }
      });

      it("D — repair ADDS an element → freeze FAIL", () => {
        const after = proposal({
          elements: [...KINDS.map((k) => ({ kind: k, content: `A grounded sentence for ${k} that the team would read.`, rationale: "grounded" })), { kind: "evidence", content: "extra", rationale: "x" }],
        });
        expect(repairFreezeViolated({ ...frozen, before, after })).toBe(true);
      });

      it("H — repair REORDERS the required kinds → freeze FAIL", () => {
        const reordered = [...KINDS].reverse().map((k) => ({ kind: k, content: `A grounded sentence for ${k} that the team would read.`, rationale: "grounded" }));
        expect(repairFreezeViolated({ ...frozen, before, after: proposal({ elements: reordered }) })).toBe(true);
      });

      it("E — repair mutates a contract outside its license → freeze FAIL", () => {
        for (const program of [
          { behavior_contract: { actor: "Someone else", trigger: "before each scheduled appointment", observable_action: "make a confirmation call and follow the checklist of required questions", completion: { confirmed_by: "the supervisor", confirmation_action: "review the completed checklist" } } },
          { scenario_contract: { pressure_condition: "something else entirely", pressure_detail: "the phone list is out of date" } },
          { completion_contract: { verification_target: "the_confirmation_step", response_mode: "name_the_moment" } },
          { follow_up_contract: { review_focus: "the_confirmation", confirmer: "the_host" } },
        ]) {
          expect(repairFreezeViolated({ ...frozen, before, after: proposal({ program }) }), JSON.stringify(program).slice(0, 40)).toBe(true);
        }
      });

      it("F/G — title, assumptions and warnings are frozen for an element license", () => {
        for (const program of [{ display_title: "A different title" }, { assumptions: ["something else"] }, { warnings: [] }]) {
          expect(repairFreezeViolated({ ...frozen, before, after: proposal({ program }) }), JSON.stringify(program)).toBe(true);
        }
      });

      it("J — a repair that fixes nothing stays refused", () => {
        const after = proposal({ reflection: defect });
        expect(repairFreezeViolated({ ...frozen, before, after })).toBe(false);
        expect(verdict(after)).toBe(`${label}/reflection`);
      });
    });
  }
});

describe("[3.2P-R0] the narrative license", () => {
  const before = proposal({ program: { display_title: "Use the provided confirmation-call template" } });
  const frozen = { code: "material_fabrication" as const, kind: undefined };

  it("F — the title IS editable when the refusal was the narrative", () => {
    const after = proposal({ program: { display_title: "Confirmation calls that land" } });
    expect(repairFreezeViolated({ ...frozen, before, after })).toBe(false);
  });
  it("but an element edit under a narrative license is still a violation", () => {
    const after = proposal({
      program: { display_title: "Confirmation calls that land" },
      elements: KINDS.map((k) => ({ kind: k, content: k === "reflection" ? "rewritten" : `A grounded sentence for ${k} that the team would read.`, rationale: "grounded" })),
    });
    expect(repairFreezeViolated({ ...frozen, before, after })).toBe(true);
  });
});

describe("[3.2P-R0] instruction ↔ license parity", () => {
  for (const code of ["evidence_overclaim", "material_fabrication", "scenario_without_pressure"] as const) {
    it(`${code}: the words describe the same envelope the code enforces`, () => {
      const msg = semanticRepairInstruction(code, ANSWERS);
      if (code === "scenario_without_pressure") {
        expect(msg).toMatch(/ONLY the scenario pressure fields/i);
      } else {
        // Structure is frozen deterministically, so the instruction must say so too.
        expect(msg).toMatch(/Do NOT add, remove, rename or reorder any element/i);
        expect(msg).toMatch(/same kinds must come back in the same order/i);
        expect(msg).toMatch(/Do NOT touch the title, the assumptions, the warnings/i);
      }
    });
  }
});

describe("[3.2P-R0] the R4 entry point still behaves exactly as before", () => {
  it("scenario pressure freeze is unchanged", () => {
    const before = proposal({ program: { scenario_contract: { pressure_condition: "the workload is heavy", pressure_detail: "" } } });
    const ok = proposal({ program: { scenario_contract: { pressure_condition: "a queue is building at the desk", pressure_detail: "" } } });
    const bad = proposal({ program: { scenario_contract: { pressure_condition: "a queue is building at the desk", pressure_detail: "" }, display_title: "changed" } });
    expect(scenarioRepairFreezeViolated(before, ok)).toBe(false);
    expect(scenarioRepairFreezeViolated(before, bad)).toBe(true);
  });
});
