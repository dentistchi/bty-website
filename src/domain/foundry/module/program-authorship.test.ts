import { describe, it, expect } from "vitest";
import {
  requiredProgramKinds,
  missingProgramKinds,
  programContext,
  programContextFingerprint,
  programContextsCompatible,
  validateProgramProposal,
  groundingCorpus,
  ungroundedArtifact,
  isStructuralCode,
  repairInstruction,
  jsonTypeOf,
  PROGRAM_JSON_SCHEMA,
  applyProgramProposal,
  provenanceAfterHostEdit,
  readProvenance,
  attributionKind,
  isHostAuthored,
  type ProgramProposal,
} from "./program-authorship";
import type { BuilderAnswers } from "./module-builder";
import { journeyElementId, type RealityGroundedJourneyV1 } from "./journey";

/**
 * Slice 3.2L — the program contract.
 *
 * Two things are being held here. First, that "complete" is decided by the Host's own
 * learning design and not by a fixed count: a program that omits the element its design
 * depends on is incomplete no matter how many others it has. Second, that the validator
 * fails CLOSED — a program a Host reviews section by section must never contain a
 * fabricated policy number in the third one.
 */

/** The canonical audit draft: know + decide + practice, Arena, 7-day follow-up. */
const CANONICAL: BuilderAnswers = {
  problem: "Our handoffs are inconsistent.",
  audienceType: "everyone",
  observableBehavior: "Create a shared handoff standard.",
  successEvidence: "Handoff record",
  evidenceType: "seen",
  learningNeeds: ["know", "decide", "practice"],
  materialIntent: "youtube",
  materialText: "https://youtu.be/x",
  completionPrompt: "What specific elements will you include in your handoff record?",
  arenaRecommended: true,
  followUpDays: 7,
};

const el = (kind: string, content: string, rationale = "because it fits") => ({ kind, content, rationale });

/** A behavioral contract that satisfies all four R4 role checks. */
const CONTRACT = {
  actor: "the outgoing person",
  trigger: "At the end of every shift, before leaving the floor",
  observable_action: "states each open item aloud to the person taking over",
  completion_signal: "the person taking over repeats the open items back and confirms they have them",
};

/** A proposal that satisfies every rule for CANONICAL. */
function goodProposal(over: Record<string, unknown> = {}) {
  return {
    program: {
      display_title: "Handing over without gaps",
      elements: [
        el("why_it_matters", "When a handoff misses a step, the next person starts without knowing what changed, and the risk lands on them."),
        // The model still sends a sentence for this kind, but the validated contract is
        // what the Host sees — R4 renders THE STANDARD from `behavior_contract`.
        el("observable_standard", "The outgoing person states each open item aloud and the incoming person repeats it back before signing off."),
        el("scenario", "You are finishing a long shift and the handoff standard is waiting, but two people are already asking you questions."),
        el("action_decision", "I will decide which open items I always state aloud at handoff, even when the shift ran late."),
        el("field_application", "At your next shift change, you state the open items before leaving the floor."),
        el("evidence", "The handoff record shows the open items were stated. It shows they were recorded, not that the next shift acted on them."),
        el("completion_check", "What will you say aloud at your next handoff that you did not say before?"),
        el("follow_up", "In seven days you will be asked what you actually said at handoff. That is your own account, not an observation."),
      ],
      assumptions: ["Handoffs happen at a predictable shift change."],
      warnings: ["If the handoff step is missing from the workflow, training alone will not add it."],
      evidence_language: "Completing this shows people were exposed to the standard and decided something. It does not show behaviour changed.",
      // R4: the behavioral contract THE STANDARD is rendered from. It NAMES the shared
      // handoff standard while defining it, which is what makes later sections free to
      // refer to it.
      behavior_contract: {
        actor: "the outgoing person",
        trigger: "At the end of every shift, before leaving the floor",
        observable_action:
          "follows the shared handoff standard by stating each open item aloud to the person taking over",
        completion_signal: "the person taking over repeats the open items back and confirms they have them",
      },
      ...over,
    },
  };
}

describe("[3.2L] required elements follow the Host's learning design", () => {
  it("information alone requires no fabricated rehearsal", () => {
    const kinds = requiredProgramKinds({ ...CANONICAL, learningNeeds: ["know"], arenaRecommended: false, followUpDays: 0 });
    expect(kinds).toEqual(["why_it_matters", "observable_standard", "completion_check"]);
    expect(kinds).not.toContain("scenario");
    expect(kinds).not.toContain("action_decision");
  });

  it("a decision design requires an action decision", () => {
    expect(requiredProgramKinds({ ...CANONICAL, learningNeeds: ["decide"], arenaRecommended: false, followUpDays: 0 }))
      .toContain("action_decision");
  });

  it("practice — or an Arena recommendation on its own — requires a scenario", () => {
    expect(requiredProgramKinds({ ...CANONICAL, learningNeeds: ["practice"], arenaRecommended: false, followUpDays: 0 })).toContain("scenario");
    expect(requiredProgramKinds({ ...CANONICAL, learningNeeds: ["know"], arenaRecommended: true, followUpDays: 0 })).toContain("scenario");
  });

  it("a scheduled follow-up requires both field application and follow-up", () => {
    const kinds = requiredProgramKinds({ ...CANONICAL, learningNeeds: ["know"], arenaRecommended: false, followUpDays: 7 });
    expect(kinds).toContain("field_application");
    expect(kinds).toContain("follow_up");
    expect(requiredProgramKinds({ ...CANONICAL, learningNeeds: ["know"], arenaRecommended: false, followUpDays: 0 }))
      .not.toContain("follow_up");
  });

  it("a configured shared question requires reflection", () => {
    expect(requiredProgramKinds({ ...CANONICAL, sharedQuestion: "What is the most important standard here?" })).toContain("reflection");
    expect(requiredProgramKinds(CANONICAL)).not.toContain("reflection");
  });

  it("the canonical draft requires the COMPLETE practice journey", () => {
    expect(requiredProgramKinds(CANONICAL)).toEqual([
      "why_it_matters", "observable_standard", "scenario", "action_decision", "field_application", "completion_check", "follow_up",
    ]);
  });

  it("required kinds are always in canonical render order", () => {
    const kinds = requiredProgramKinds({ ...CANONICAL, sharedQuestion: "q" });
    expect([...kinds].sort()).not.toEqual(kinds); // order is meaningful, not alphabetical
    expect(kinds.indexOf("why_it_matters")).toBeLessThan(kinds.indexOf("completion_check"));
    expect(kinds.indexOf("scenario")).toBeLessThan(kinds.indexOf("action_decision"));
  });

  it("missingProgramKinds reports empty content as missing, not just absence", () => {
    const journey: RealityGroundedJourneyV1 = {
      version: 1,
      displayTitle: "t",
      displayTitleStatus: "grounded",
      elements: [{ id: journeyElementId("why_it_matters"), kind: "why_it_matters", content: "   ", grounding: [], confirmationStatus: "grounded" }],
    };
    expect(missingProgramKinds(CANONICAL, journey)).toContain("why_it_matters");
  });
});

describe("[3.2L] the authorship context is stale-protected", () => {
  it("refuses to build a context from an unready draft", () => {
    expect(programContext({ problem: "only this" })).toBeNull();
  });

  it("changing ANY intent field changes the fingerprint", () => {
    const a = programContext(CANONICAL)!;
    const fields: Partial<BuilderAnswers>[] = [
      { problem: "Something else entirely." },
      { observableBehavior: "Do a different thing." },
      { successEvidence: "A different record" },
      { learningNeeds: ["know"] },
      { arenaRecommended: false },
      { followUpDays: 30 },
      { sharedQuestion: "new" },
      { completionPrompt: "changed" },
    ];
    for (const f of fields) {
      const b = programContext({ ...CANONICAL, ...f })!;
      expect(programContextFingerprint(a), JSON.stringify(f)).not.toBe(programContextFingerprint(b));
      expect(programContextsCompatible(a, b)).toBe(false);
    }
  });

  it("insignificant whitespace does NOT change the fingerprint", () => {
    const a = programContext(CANONICAL)!;
    const b = programContext({ ...CANONICAL, problem: "  Our handoffs   are inconsistent.  " })!;
    expect(programContextsCompatible(a, b)).toBe(true);
  });
});

describe("[3.2L] the validator fails closed", () => {
  it("accepts a complete, honest program", () => {
    const r = validateProgramProposal(goodProposal(), CANONICAL);
    expect(r.ok, r.ok ? "" : `${r.code} ${r.kind ?? ""}`).toBe(true);
    if (r.ok) {
      expect(r.value.proposal.elements).toHaveLength(8);
      // canonical order, never the model's
      expect(r.value.proposal.elements[0].kind).toBe("why_it_matters");
      expect(r.value.proposal.elements.at(-1)!.kind).toBe("follow_up");
    }
  });

  const reject = (mutate: (p: ReturnType<typeof goodProposal>) => void, code: string) => {
    const p = goodProposal();
    mutate(p);
    const r = validateProgramProposal(p, CANONICAL);
    expect(r.ok, `expected rejection ${code}`).toBe(false);
    if (!r.ok) expect(r.code).toBe(code);
  };

  it("refuses a program missing an element the design requires", () => {
    reject((p) => { p.program.elements = p.program.elements.filter((e) => e.kind !== "scenario"); }, "missing_required_kind");
  });

  it("refuses the manager's complaint replayed at the team", () => {
    reject((p) => { p.program.elements[0].content = "Our handoffs are inconsistent and keep being inconsistent."; }, "complaint_replay");
  });

  it("refuses invented specifics the host never supplied", () => {
    for (const invented of ["Follow section 4.2 of the policy.", "Use form HR-118 at handoff.", "As agreed last Tuesday, state each item."]) {
      reject((p) => { p.program.elements[4].content = invented + " You do this at your next shift change."; }, "invented_specifics");
    }
  });

  it("refuses claims that material already exists", () => {
    reject((p) => { p.program.elements[0].content = "Read the attached handoff policy, which has been approved already."; }, "material_fabrication");
  });

  it("refuses evidence overclaim", () => {
    for (const over of [
      "After this you will have mastered the handoff.",
      "This proves that you can hand over safely.",
      "Completing this shows behaviour changed permanently.",
    ]) {
      reject((p) => { p.program.elements[5].content = over + " The record is the source."; }, "evidence_overclaim");
    }
  });

  it("refuses an action decision that is only reflection", () => {
    reject((p) => { p.program.elements[3].content = "Think about what you might do differently at handoff sometime."; }, "decision_is_only_reflection");
  });

  it("refuses a field application with no actor or situation", () => {
    reject((p) => { p.program.elements[4].content = "Handoffs. Standards. Records. Items. Steps."; }, "application_without_actor");
  });

  it("refuses a scenario unrelated to the behaviour", () => {
    reject((p) => { p.program.elements[2].content = "A courier misplaces a parcel while cycling across town in heavy rain."; }, "scenario_unrelated");
  });

  it("refuses a generic completion question", () => {
    for (const generic of ["What is one thing you will apply this week?", "How did you feel about the material?", "What did you learn?"]) {
      reject((p) => { p.program.elements[6].content = generic; }, "generic_completion");
    }
  });

  it("refuses language that evaluates a person", () => {
    reject((p) => { p.program.elements[0].content = "Some colleagues are careless and have a poor attitude about handovers."; }, "person_evaluation");
  });

  it("refuses internal Builder vocabulary reaching a participant", () => {
    reject((p) => { p.program.elements[0].content = "This module raises you on the evidence ladder toward the standard."; }, "internal_jargon");
  });

  it("refuses two sections that say the same thing", () => {
    reject((p) => { p.program.elements[4].content = p.program.elements[3].content; }, "duplicate_content");
  });

  /**
   * The rule that matters: a pure-information training must not be given a fabricated
   * rehearsal. `evidence` and `reflection` stay allowed as optional additions because
   * both are honest and useful anywhere; a scenario for a design that asked for none is
   * invention.
   */
  it("refuses a fabricated scenario for a pure-information design", () => {
    const infoOnly: BuilderAnswers = { ...CANONICAL, learningNeeds: ["know"], arenaRecommended: false, followUpDays: 0 };
    const p = {
      program: {
        display_title: "Reading the handoff standard",
        elements: [
          el("why_it_matters", "When a handoff misses a step, the next person starts without knowing what changed."),
          el("observable_standard", "The outgoing person states each open item aloud before signing off."),
          el("completion_check", "Which open item will you state aloud that you did not before?"),
          el("scenario", "You are finishing a long shift and two people are already asking you questions about handoffs."),
        ],
        assumptions: [],
        warnings: [],
        evidence_language: "This shows people were exposed to the standard. It does not show behaviour changed.",
        behavior_contract: CONTRACT,
      },
    };
    const r = validateProgramProposal(p, infoOnly);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("unrequested_kind");
      expect(r.kind).toBe("scenario");
    }
  });

  it("still allows the optional honest additions", () => {
    const infoOnly: BuilderAnswers = { ...CANONICAL, learningNeeds: ["know"], arenaRecommended: false, followUpDays: 0 };
    const p = {
      program: {
        display_title: "Reading the handoff standard",
        elements: [
          el("why_it_matters", "When a handoff misses a step, the next person starts without knowing what changed."),
          el("observable_standard", "The outgoing person states each open item aloud before signing off."),
          el("evidence", "The handoff record shows the items were stated. It does not show the next shift acted."),
          el("completion_check", "Which open item will you state aloud that you did not before?"),
        ],
        assumptions: [],
        warnings: [],
        evidence_language: "This shows exposure only. It does not show behaviour changed.",
        behavior_contract: CONTRACT,
      },
    };
    expect(validateProgramProposal(p, infoOnly).ok).toBe(true);
  });

  it("refuses a duplicated kind", () => {
    reject((p) => { p.program.elements.push(el("scenario", "Another situation entirely about handoffs and standards being stated aloud.")); }, "duplicate_kind");
  });

  it("refuses markup and control characters", () => {
    reject((p) => { p.program.elements[0].content = "<script>alert(1)</script> handoffs need care and attention here."; }, "unsafe_markup");
  });

  it("refuses a non-object, a missing program and a missing field", () => {
    expect(validateProgramProposal(null, CANONICAL)).toMatchObject({ ok: false, code: "not_object" });
    expect(validateProgramProposal({}, CANONICAL)).toMatchObject({ ok: false, code: "missing_program" });
    expect(validateProgramProposal({ program: { display_title: "t", elements: [] } }, CANONICAL)).toMatchObject({ ok: false, code: "missing_field" });
  });

  it("refuses overclaim in the evidence language itself", () => {
    reject((p) => { p.program.evidence_language = "Completing this guarantees the behaviour is now permanent."; }, "evidence_overclaim");
  });

  it("names the offending element so a refusal is diagnosable", () => {
    const p = goodProposal();
    p.program.elements[2].content = "A courier misplaces a parcel while cycling across town in heavy rain.";
    const r = validateProgramProposal(p, CANONICAL);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe("scenario");
  });
});

describe("[3.2L] provenance is honest", () => {
  it("a Host edit always transfers authorship away from the model", () => {
    expect(provenanceAfterHostEdit("ai_proposed")).toBe("host_edited");
    expect(provenanceAfterHostEdit("deterministic_derived")).toBe("host_edited");
    expect(provenanceAfterHostEdit("host_edited")).toBe("host_edited");
    // the Host's own words stay their own words
    expect(provenanceAfterHostEdit("host_statement")).toBe("host_statement");
  });

  it("only host-authored content counts as the Host's", () => {
    expect(isHostAuthored("host_statement")).toBe(true);
    expect(isHostAuthored("host_edited")).toBe(true);
    expect(isHostAuthored("ai_proposed")).toBe(false);
    expect(isHostAuthored("deterministic_derived")).toBe(false);
  });

  it("AI output is NEVER attributed to the Host", () => {
    const aiEl = { grounding: [{ sourceType: "ai_proposed" }] };
    expect(attributionKind(aiEl)).toBe("bty_authored");
    expect(attributionKind(aiEl)).not.toBe("from_host");
    expect(attributionKind({ grounding: [{ sourceType: "host_statement" }] })).toBe("from_host");
    expect(attributionKind({ grounding: [{ sourceType: "host_edited" }] })).toBe("host_edited");
  });

  it("tolerates a legacy element with no recorded provenance", () => {
    expect(readProvenance({ grounding: [] })).toBeNull();
    expect(attributionKind(undefined)).toBeNull();
  });
});

describe("[3.2L] apply is atomic and decision-driven", () => {
  const proposal: ProgramProposal = {
    displayTitle: "Handing over without gaps",
    elements: [
      { kind: "why_it_matters", content: "AI why", rationale: "r" },
      { kind: "observable_standard", content: "AI standard", rationale: "r" },
      { kind: "completion_check", content: "AI check", rationale: "r" },
    ],
    assumptions: [],
    warnings: [],
    evidenceLanguage: "honest",
    behaviorContract: {
    actor: "the outgoing person",
    trigger: "At the end of every shift",
    observableAction: "states each open item aloud to the person taking over",
    completionSignal: "the person taking over repeats them back and confirms",
    },
  };
  const current: RealityGroundedJourneyV1 = {
    version: 1,
    displayTitle: "Old title",
    displayTitleStatus: "needs_confirmation",
    elements: [
      { id: journeyElementId("why_it_matters"), kind: "why_it_matters", content: "Host why", grounding: [{ sourceType: "host_statement", field: "problem" }], confirmationStatus: "grounded" },
    ],
  };

  it("`use` takes the proposal and marks it ai_proposed", () => {
    const j = applyProgramProposal(current, proposal, [{ kind: "why_it_matters", decision: "use" }], { titleDecision: "use" });
    const e = j.elements.find((x) => x.kind === "why_it_matters")!;
    expect(e.content).toBe("AI why");
    expect(readProvenance(e)).toBe("ai_proposed");
  });

  it("`keep` preserves the Host's own content and provenance", () => {
    const j = applyProgramProposal(current, proposal, [{ kind: "why_it_matters", decision: "keep" }], { titleDecision: "keep" });
    const e = j.elements.find((x) => x.kind === "why_it_matters")!;
    expect(e.content).toBe("Host why");
    expect(readProvenance(e)).toBe("host_statement");
    expect(j.displayTitle).toBe("Old title");
  });

  it("`edit` takes the Host's words and transfers authorship to them", () => {
    const j = applyProgramProposal(current, proposal, [{ kind: "why_it_matters", decision: "edit", editedContent: "  My own words  " }], { titleDecision: "edit", editedTitle: "My title" });
    const e = j.elements.find((x) => x.kind === "why_it_matters")!;
    expect(e.content).toBe("My own words");
    expect(readProvenance(e)).toBe("host_statement"); // it was already the Host's
    expect(j.displayTitle).toBe("My title");
  });

  it("editing AI output marks it host_edited, never ai_proposed", () => {
    const aiCurrent: RealityGroundedJourneyV1 = {
      ...current,
      elements: [{ ...current.elements[0], grounding: [{ sourceType: "ai_proposed", field: "problem" }] }],
    };
    const j = applyProgramProposal(aiCurrent, proposal, [{ kind: "why_it_matters", decision: "edit", editedContent: "Rewritten" }], { titleDecision: "keep" });
    expect(readProvenance(j.elements[0])).toBe("host_edited");
  });

  it("produces ONE complete journey in canonical order — never a partial apply", () => {
    const j = applyProgramProposal(current, proposal, proposal.elements.map((e) => ({ kind: e.kind, decision: "use" as const })), { titleDecision: "use" });
    expect(j.elements.map((e) => e.kind)).toEqual(["why_it_matters", "observable_standard", "completion_check"]);
    expect(j.elements.every((e) => e.confirmationStatus === "grounded")).toBe(true);
    expect(j.displayTitleStatus).toBe("grounded");
    expect(j.version).toBe(1);
  });

  it("an unresolved section with no prior content is simply absent, never empty", () => {
    const j = applyProgramProposal(undefined, proposal, [{ kind: "why_it_matters", decision: "use" }], { titleDecision: "use" });
    expect(j.elements.map((e) => e.kind)).toEqual(["why_it_matters"]);
    expect(j.elements.every((e) => e.content.trim().length > 0)).toBe(true);
  });

  it("an empty edit falls back rather than writing blank content", () => {
    const j = applyProgramProposal(current, proposal, [{ kind: "why_it_matters", decision: "edit", editedContent: "   " }], { titleDecision: "keep" });
    expect(j.elements[0].content).toBe("Host why");
  });
});

describe("[3.2L-R2] an artifact may not be claimed to exist unless the Host grounded it", () => {
  /**
   * THE THIRD CONTROLLED WINDOW, reproduced exactly. Generated against the canonical
   * draft — YouTube URL, successEvidence "Handoff record", observableBehavior "Create a
   * shared handoff standard." — the model produced an Apply section directing the
   * participant to use "the handoff record template", justified by an assumption that
   * tools and templates were accessible. Neither is established anywhere.
   */
  const withApply = (apply: string, assumptions: string[] = []) => {
    const p = goodProposal();
    p.program.elements = p.program.elements.map((e) => (e.kind === "field_application" ? { ...e, content: apply } : e));
    p.program.assumptions = assumptions;
    return p;
  };

  it("G1 — the exact live miss: 'the handoff record template' is refused", () => {
    const r = validateProgramProposal(
      withApply("In our next project, I will use the handoff record template to document and share information with my colleagues at the end of each task."),
      CANONICAL,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("material_fabrication");
      expect(r.kind).toBe("field_application");
    }
  });

  it("G2 — the exact live assumption is refused, even though it is advisory", () => {
    const r = validateProgramProposal(
      withApply(
        "At your next shift change, you state the open items before leaving the floor.",
        ["There is access to the necessary tools and templates for creating handoff records."],
      ),
      CANONICAL,
    );
    expect(r.ok, "an advisory field must not bypass a safety rule").toBe(false);
    if (!r.ok) expect(r.code).toBe("material_fabrication");
  });

  it("G3 — an Apply that depends on an artifact only an assumption supports is ONE refusal", () => {
    const r = validateProgramProposal(
      withApply("I will use the template at each handoff.", ["The team has access to the template."]),
      CANONICAL,
    );
    expect(r.ok).toBe(false);
    // Whole-proposal: the remaining sections are never returned as usable.
    if (!r.ok) expect(r.code).toBe("material_fabrication");
  });

  it("an assumption can NEVER ground an artifact — that circularity is the defect", () => {
    // Even a proposal whose assumption explicitly asserts the artifact exists is refused,
    // because only the HOST's context grounds anything.
    const r = validateProgramProposal(
      withApply("Use the checklist before signing off.", ["A checklist already exists for this."]),
      CANONICAL,
    );
    expect(r.ok).toBe(false);
  });

  it("G4 — honest future creation is accepted", () => {
    const r = validateProgramProposal(
      withApply("Before your next shift change, agree on the required fields and create a shared handoff record together."),
      CANONICAL,
    );
    expect(r.ok, r.ok ? "" : `${r.code} ${r.kind ?? ""}`).toBe(true);
  });

  it("G5 — a conditional reference is not an existence claim", () => {
    const r = validateProgramProposal(
      withApply("Use your team's existing template if one exists; otherwise agree on the required fields at your next handoff."),
      CANONICAL,
    );
    expect(r.ok, r.ok ? "" : `${r.code} ${r.kind ?? ""}`).toBe(true);
  });

  it("G6 — a Host-named artifact grounds a definite reference to it", () => {
    const grounded: BuilderAnswers = { ...CANONICAL, problem: "Our handoffs are inconsistent. We already use the ABC handoff template." };
    const r = validateProgramProposal(
      withApply("At your next shift change, complete the ABC handoff template before leaving the floor."),
      grounded,
    );
    expect(r.ok, r.ok ? "" : `${r.code} ${r.kind ?? ""}`).toBe(true);
    // …and the SAME sentence is refused for the canonical draft, which never named it.
    expect(validateProgramProposal(withApply("At your next shift change, complete the ABC handoff template before leaving the floor."), CANONICAL).ok).toBe(false);
  });

  it("G7 — a URL grounds nothing about the material's contents", () => {
    // The canonical draft HAS a YouTube URL. It still cannot ground a template.
    expect(CANONICAL.materialText).toContain("youtu.be");
    expect(groundingCorpus(CANONICAL)).not.toContain("youtu.be");
    const r = validateProgramProposal(withApply("Follow the checklist shown in the video at each handoff."), CANONICAL);
    expect(r.ok).toBe(false);
  });

  it("G8 — a VERIFIED uploaded file grounds its own existence", () => {
    const apply = "At your next shift change, complete the template before leaving the floor.";
    expect(validateProgramProposal(withApply(apply), CANONICAL).ok, "ungrounded without the file").toBe(false);
    expect(
      validateProgramProposal(withApply(apply), CANONICAL, ["Handoff Record Template.pdf"]).ok,
      "grounded by the verified upload",
    ).toBe(true);
  });

  it("G9 — ordinary outputs and actions are NOT rejected", () => {
    const accepted = [
      "At your next shift change, you state the open items and note them on the handoff record.",
      "You and your team follow the shared standard you agreed at the start of the shift.",
      "You pass on the required information before leaving the floor.",
      "Create a shared handoff record with the fields your team agreed.",
    ];
    for (const apply of accepted) {
      const r = validateProgramProposal(withApply(apply), CANONICAL);
      expect(r.ok, `false positive on: "${apply}" (${r.ok ? "" : r.code})`).toBe(true);
    }
  });

  it("covers the whole artifact class, not just the two live phrasings", () => {
    for (const apply of [
      "Log it in your workflow tool at the end of each task.",
      "Update the dashboard after every handoff.",
      "Follow the SOP when you hand over.",
      "Complete the form before you leave.",
      "Record it in the existing system at shift change.",
    ]) {
      const r = validateProgramProposal(withApply(apply), CANONICAL);
      expect(r.ok, `should refuse: "${apply}"`).toBe(false);
    }
  });

  it("the offending artifact is identified without echoing generated prose", () => {
    expect(ungroundedArtifact("I will use the handoff record template.", groundingCorpus(CANONICAL))).toBe("template");
    expect(ungroundedArtifact("There is access to the necessary tools.", groundingCorpus(CANONICAL))).toBe("tool");
    expect(ungroundedArtifact("Create a shared handoff record.", groundingCorpus(CANONICAL))).toBeNull();
  });
});

describe("[3.2L-R3] structural faults are diagnosed exactly, not just named", () => {
  const withEl = (mutate: (els: Record<string, unknown>[]) => void) => {
    const p = goodProposal();
    mutate(p.program.elements as unknown as Record<string, unknown>[]);
    return p;
  };

  it("G1 — the exact live class: why_it_matters.content is an object", () => {
    const r = validateProgramProposal(withEl((els) => { els[0].content = { text: "why" }; }), CANONICAL);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("field_type");
      expect(r.kind).toBe("why_it_matters");
      expect(r.diagnosis).toBeDefined();
      expect(r.diagnosis!.path).toBe("elements[0].content");
      expect(r.diagnosis!.actual).toBe("object");
      expect(r.diagnosis!.expected).toContain("string");
      expect(r.diagnosis!.retryable, "a shape fault is repairable").toBe(true);
      expect(r.diagnosis!.stage).toBe("structural");
    }
  });

  it("G2 — missing content is diagnosed as missing, not merely wrong-typed", () => {
    const r = validateProgramProposal(withEl((els) => { delete els[0].content; }), CANONICAL);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.diagnosis).toMatchObject({ path: "elements[0].content", actual: "missing", retryable: true });
  });

  it("G3 — null content is handled deterministically", () => {
    const r = validateProgramProposal(withEl((els) => { els[0].content = null; }), CANONICAL);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.diagnosis).toMatchObject({ path: "elements[0].content", actual: "null" });
  });

  it("distinguishes content from rationale — the ambiguity that made the live failure unreadable", () => {
    const bad = validateProgramProposal(withEl((els) => { els[2].rationale = ["a", "b"]; }), CANONICAL);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.diagnosis).toMatchObject({ path: "elements[2].rationale", actual: "array" });
  });

  it("names non-element paths the old refusal_kind could not carry at all", () => {
    const cases: [string, (p: ReturnType<typeof goodProposal>) => void, string][] = [
      ["program.display_title", (p) => { (p.program as Record<string, unknown>).display_title = 7; }, "number"],
      ["program.evidence_language", (p) => { (p.program as Record<string, unknown>).evidence_language = null; }, "null"],
      ["program.assumptions", (p) => { (p.program as Record<string, unknown>).assumptions = "not a list"; }, "string"],
      ["program.warnings", (p) => { (p.program as Record<string, unknown>).warnings = 3; }, "number"],
    ];
    for (const [path, mutate, actual] of cases) {
      const p = goodProposal();
      mutate(p);
      const r = validateProgramProposal(p, CANONICAL);
      expect(r.ok, `expected refusal at ${path}`).toBe(false);
      if (!r.ok) expect(r.diagnosis).toMatchObject({ path, actual });
    }
  });

  it("G4 — rationale is REVIEW-ADVISORY: absent or null is accepted, nothing fabricated", () => {
    const omitted = validateProgramProposal(withEl((els) => { delete els[0].rationale; }), CANONICAL);
    expect(omitted.ok, omitted.ok ? "" : `${omitted.code}`).toBe(true);
    if (omitted.ok) expect(omitted.value.proposal.elements[0].rationale).toBe("");

    const nulled = validateProgramProposal(withEl((els) => { els[0].rationale = null; }), CANONICAL);
    expect(nulled.ok).toBe(true);
    if (nulled.ok) expect(nulled.value.proposal.elements[0].rationale, "no invented fallback prose").toBe("");
  });

  it("G8 — an advisory rationale is still safety-checked WHEN PRESENT", () => {
    const r = validateProgramProposal(
      withEl((els) => { els[0].rationale = "Grounded in the handoff record template the team already uses."; }),
      CANONICAL,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("material_fabrication");
  });

  it("a semantic refusal is NOT marked repairable — asking again is spend, not repair", () => {
    const r = validateProgramProposal(
      withEl((els) => { els[4].content = "I will use the handoff record template at each handoff."; }),
      CANONICAL,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("material_fabrication");
      expect(isStructuralCode(r.code), "grounding is a meaning fault").toBe(false);
    }
  });

  it("produces a repair instruction that names shape only, never model prose", () => {
    const r = validateProgramProposal(withEl((els) => { els[0].content = { secret: "the model's actual words" }; }), CANONICAL);
    expect(r.ok).toBe(false);
    if (!r.ok && r.diagnosis) {
      const instruction = repairInstruction(r.diagnosis);
      expect(instruction).toContain("elements[0].content");
      expect(instruction).toContain("object");
      expect(instruction).not.toContain("the model's actual words");
      expect(instruction).not.toContain("secret");
    }
  });

  it("G10 — the provider schema pins every field the live failure got wrong", () => {
    const el = PROGRAM_JSON_SCHEMA.properties.program.properties.elements.items;
    expect(el.required).toEqual(["kind", "content", "rationale"]);
    expect(el.properties.content).toEqual({ type: "string" });
    // Advisory, so nullable rather than omitted — strict mode requires every key present.
    expect(el.properties.rationale).toEqual({ type: ["string", "null"] });
    expect(el.additionalProperties).toBe(false);
    expect(el.properties.kind.enum).toContain("why_it_matters");
    expect(PROGRAM_JSON_SCHEMA.properties.program.required).toContain("display_title");
  });
});
