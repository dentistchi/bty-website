import { describe, it, expect } from "vitest";
import {
  validateProgramProposal, requiredProgramKinds, programContext, completionCriterionFrom,
  PROGRAM_JSON_SCHEMA, PROGRAM_AUTHORSHIP_VERSION, PROGRAM_SCHEMA_NAME, repairLicenseFor, isSemanticRepairableCode,
} from "./program-authorship";
import { CANONICAL_ACTOR, CONTRACT_DEFECT_REASONS, CONFIRMERS } from "./program-coherence";
import { stepBlocker, type BuilderAnswers } from "./module-builder";
import { decideAdoptionReceipt, type AdoptionClaim } from "./adoption-authority";

/**
 * SLICE 3.2P-R3.4-R1 — COMPLETION IS THE HOST'S, AND THE MODEL CANNOT REACH IT.
 *
 * R3.3 measured the contradiction: `confirmed_by` was defined as a person, artifact heads were
 * refused as confirmers, and most real Host evidence is agentless — so the schema left the model
 * no legal answer but to invent someone. W3 named a "team lead", W4 a "records manager"; neither
 * appears in either source.
 *
 * R3.4 measured the way out across all 34 real drafts: `successEvidence` is directly usable as
 * the completion criterion, in every shape that corpus contains, WITHOUT extracting a person, a
 * role, an artifact or a system from it. This file holds that result: the criterion comes from
 * the Host, the model has no field for it, and none of the shapes needs decomposing to render.
 *
 * No provider call. Every case below is a real Host evidence sentence from the repository
 * corpus or its exact shape.
 */
const PILOT = {
  problem: "During morning huddles, team members report problems but leave without naming who will act or when the next step will happen.",
  audienceType: "leaders", evidenceType: "confirmed", followUpDays: 7,
  learningNeeds: ["shared_standard", "practice"], materialIntent: "pdf",
  sharedQuestion: "In your own words, what is the most important standard from this training?",
  successEvidence: "The huddle note records one owner and one deadline for every agreed action.",
  arenaRecommended: true,
  completionPrompt: "What specific phrases will you use in the next huddle to confirm the action owner and deadline for each reported issue?",
  recurringMoment: "During morning huddles",
  observableBehavior: "At the next huddle, name the owner, the action and the deadline out loud.",
  capabilityCandidate: "Accountability",
} as unknown as BuilderAnswers;

const KINDS = requiredProgramKinds(PILOT);
const CONTENT: Record<string, string> = {
  why_it_matters: "When a huddle ends without a named owner and a deadline, the problem that was raised stays exactly where it was.",
  observable_standard: "The huddle leader names one owner and one deadline for every agreed action before the group leaves.",
  scenario: "The huddle is running late and people are already standing to leave.",
  reflection: "In your own words, what is the most important standard from this training?",
  field_application: "At the next morning huddle, name one owner and one deadline for every agreed action and write them in the huddle note.",
  completion_check: "What exactly will you say at the next morning huddle to name the owner and the deadline?",
  follow_up: "In seven days you will be asked what you actually said at the huddle.",
};

const proposal = (over: Record<string, unknown> = {}) => ({
  program: {
    display_title: "End every huddle with an owner and a deadline",
    elements: KINDS.map((k) => ({ kind: k, content: CONTENT[k], rationale: "grounded in the host's own answers" })),
    assumptions: ["the team holds a morning huddle"],
    warnings: ["a huddle nobody attends is an attendance problem, not a training one"],
    behavior_contract: {
      actor: "the huddle leader",
      trigger: "at each morning huddle, before the group leaves",
      action_verb: "name", action_detail: "one owner and one deadline for every agreed action and writes them in the huddle note",
    },
    scenario_contract: { pressure_condition: "the huddle is running late and people are already standing to leave", pressure_detail: null },
    completion_contract: { verification_target: "the_behaviour", response_mode: "state_what_you_will_say" },
    follow_up_contract: { review_focus: "what_you_said", confirmer: "self_report" },
    ...over,
  },
});

/** Render the whole program for a Host whose evidence sentence is `evidence`. */
const forEvidence = (evidence: string) => {
  const answers = { ...PILOT, successEvidence: evidence } as BuilderAnswers;
  const r = validateProgramProposal(proposal(), answers, ["education.pdf"]);
  if (!r.ok) throw new Error(`expected PASS for "${evidence}", got ${r.code}`);
  return {
    contract: r.value.proposal.behaviorContract!,
    sections: Object.fromEntries(r.value.proposal.elements.map((e) => [e.kind, e.content])) as Record<string, string>,
  };
};

describe("[3.2P-R3.4-R1] A/B — the model has no completion field, and the Host supplies one", () => {
  it("A — `completion` is absent from the provider contract entirely", () => {
    const contract = PROGRAM_JSON_SCHEMA.properties.program.properties.behavior_contract;
    expect([...contract.required]).toEqual(["action_verb", "action_detail"]);
    expect("completion" in contract.properties).toBe(false);
    // …and nothing else may be added under another name.
    expect(contract.additionalProperties).toBe(false);
  });

  it("B — the criterion is the Host's `successEvidence`, byte for byte", () => {
    const { contract } = forEvidence(PILOT.successEvidence!);
    expect(contract.completion).toEqual({ criterion: PILOT.successEvidence });
    expect(completionCriterionFrom(PILOT)).toBe(PILOT.successEvidence);
    expect(programContext(PILOT)!.successEvidence).toBe(PILOT.successEvidence);
  });

  it("C — no human confirmer appears in any participant-facing sentence", () => {
    const { sections } = forEvidence(PILOT.successEvidence!);
    const text = Object.values(sections).join(" ");
    /*
      W3 and W4 both put an invented person into all four derived sections. The criterion is
      agentless, so nothing here can name a keeper for it — and the sections say so by
      containing no role the Host never wrote.
    */
    for (const invented of ["team lead", "records manager", "reviewer", "keeper", "supervisor"]) {
      expect(text.toLowerCase(), invented).not.toContain(invented);
    }
  });
});

/**
 * D–H — THE FOUR SHAPES THE OLD FIELD COULD NOT HOLD, plus Korean.
 *
 * Each of these is a real Host answer, or its exact shape, from the R3.4 corpus. Under v10 the
 * artifact and system rows were structurally refusable (`ARTIFACT_OR_CONSTRUCT_HEAD` rejects
 * `record`, `checklist`, `form`, `log`, `document`, `system`) and the model had to name a person
 * instead. Here they are simply carried.
 */
describe("[3.2P-R3.4-R1] D–H — every real evidence shape works without extraction", () => {
  const CORPUS: [string, string][] = [
    ["D artifact — record", "The huddle note records one owner and one deadline for every agreed action."],
    ["D artifact — checklist", "A checklist review form is signed off by the leader, indicating the review took place"],
    ["D artifact — minutes", "Meeting minutes document contributions from various team members"],
    ["E system — software", "Supervisors can access the software to review screen time, logged tasks and confirm completion"],
    ["E system — log", "A completed version control log is submitted for review"],
    ["F human — observed", "A dentist observes the employee performing the inspection and confirms it was completed correctly"],
    ["F human — signed off", "A supervisor reviews the shared documentation and confirms that the handoff steps were followed"],
    ["G relational", "A team member confirms that their paraphrase accurately reflects the speaker's message"],
    ["H korean", "불평보다는 감사한 점을 하루에 하나 나눌 수 있는 수준이 되면 성공"],
  ];

  for (const [label, evidence] of CORPUS) {
    it(`${label} — validates, renders, and is never decomposed`, () => {
      const { contract, sections } = forEvidence(evidence);
      // Carried whole: no person, role, artifact or system is extracted from it.
      expect(contract.completion.criterion).toBe(evidence);
      // …and it reaches the participant intact, minus only the terminal stop BTY re-adds.
      const core = evidence.replace(/\.$/, "");
      for (const kind of ["observable_standard", "field_application", "why_it_matters"] as const) {
        expect(sections[kind], `${label} / ${kind}`).toContain(core);
      }
    });
  }

  it("and each surface leads with different words, so a program does not repeat itself", () => {
    const { sections } = forEvidence(PILOT.successEvidence!);
    expect(sections.observable_standard).toContain("Completion evidence:");
    expect(sections.field_application).toContain("You will know it happened by this:");
    expect(sections.why_it_matters).toContain("What shows it happened:");
  });
});

describe("[3.2P-R3.4-R1] I/J — the source gate and the participant subject are unchanged", () => {
  it("I — absent evidence is blocked at the Builder, BEFORE any provider call", () => {
    const noEvidence = { ...PILOT, successEvidence: "" } as BuilderAnswers;
    /*
      Unchanged authority, deliberately: R3.4 §9 found this already correct. Step 4 refuses,
      `programContext` returns null, and generation cannot be reached — so an empty criterion is
      never something a paid call discovers.
    */
    expect(stepBlocker(5, noEvidence)).toBe("evidence_required");
    expect(programContext(noEvidence)).toBeNull();
  });

  it("J — the participant subject is still server-written", () => {
    const { contract, sections } = forEvidence(PILOT.successEvidence!);
    expect(contract.actor).toBe(CANONICAL_ACTOR);
    expect(sections.observable_standard).toContain(`${CANONICAL_ACTOR} must`);
    expect(sections.observable_standard).not.toContain("the huddle leader");
  });
});

describe("[3.2P-R3.4-R1] P — no repair can touch the criterion", () => {
  it("the licensed surfaces do not include it, because it is not in the response", () => {
    /*
      Two independent reasons, and either alone would be enough. The scenario-pressure licence
      names two fields and neither is completion; and the criterion is not part of what the model
      returns at all, so there is no field for ANY licence to unfreeze.
    */
    expect(repairLicenseFor("scenario_without_pressure", "scenario")).toEqual({ surface: "scenario_pressure" });
    const contract = PROGRAM_JSON_SCHEMA.properties.program.properties.behavior_contract;
    expect("completion" in contract.properties).toBe(false);
    // The repairable set is unchanged and none of its members is about completion.
    for (const code of ["evidence_overclaim", "material_fabrication", "scenario_without_pressure"] as const) {
      expect(isSemanticRepairableCode(code)).toBe(true);
    }
  });

  it("and a retry cannot change what the Host wrote, because the Host is the only author", () => {
    const before = forEvidence(PILOT.successEvidence!).contract.completion.criterion;
    // A second identical generation against the same answers yields the same criterion; the only
    // thing that can move it is the Host editing step 4 — which moves the fingerprint too.
    expect(forEvidence(PILOT.successEvidence!).contract.completion.criterion).toBe(before);
    expect(before).toBe(PILOT.successEvidence);
  });
});

describe("[3.2P-R3.4-R1] R/S/T — history stays readable, stale proposals stay refused", () => {
  it("R — every reason the ledger has ever stored is still in the vocabulary", () => {
    /*
      `confirmer_unauthorized` is on W4's real row and `not_a_role` / `no_confirmation` /
      `meta_only` are how completion used to fail. No current path emits any of them for
      completion, and all four must still decode. Shrinking this list is data loss, not cleanup.
    */
    for (const retired of ["confirmer_unauthorized", "not_a_role", "no_confirmation", "meta_only"]) {
      expect(CONTRACT_DEFECT_REASONS).toContain(retired);
    }
  });

  it("the follow-up confirmer vocabulary lost exactly the one that needed a confirmer", () => {
    expect([...CONFIRMERS]).toEqual(["self_report", "the_host"]);
  });

  const DRAFT = "3e079b1b-0077-48e6-80f7-fb7869b7eef1";
  const FP = "during morning huddles…¦leaders¦¦accountability¦…¦pdf";
  const DIGEST = "program_proposal_digest_v1:7bdfeca7";
  const claim = (proposalVersion: string | null): AdoptionClaim => ({
    mode: "initial",
    claimedAttemptId: "513e1642-92be-4be6-bb52-50febfe81b3c",
    journeyInSamePatch: true,
    durableJourneyPresent: false,
    attempt: {
      id: "513e1642-92be-4be6-bb52-50febfe81b3c", draftId: DRAFT, outcome: "success",
      contextFingerprint: FP, proposalDigest: DIGEST, proposalVersion,
    },
    draftId: DRAFT,
    currentFingerprint: FP,
    currentAuthorityVersion: PROGRAM_AUTHORSHIP_VERSION,
    latestSuccessfulAttemptId: "513e1642-92be-4be6-bb52-50febfe81b3c",
    adoptedJourneyDigest: DIGEST,
  });

  it("S — every version this pilot spent under is refused by the current Apply gate", () => {
    // v9 (W2/W3), v10 (W4), v11 (W5). R3.5 widened the recurring-moment fold, so v11 joins them.
    for (const old of ["program_authorship_v9", "program_authorship_v10", "program_authorship_v11", "program_authorship_v12", "program_authorship_v13", "program_authorship_v14", "program_authorship_v15", "program_authorship_v16", "program_authorship_v17"]) {
      expect(decideAdoptionReceipt(claim(old)), old).toEqual({ ok: false, reason: "proposal_no_longer_valid" });
    }
  });

  it("T — a proposal generated under v11 is accepted", () => {
    expect(decideAdoptionReceipt(claim(PROGRAM_AUTHORSHIP_VERSION))).toEqual({ ok: true });
  });

  it("the version moved because the accepted SHAPE moved, not because a deploy happened", () => {
    expect(PROGRAM_AUTHORSHIP_VERSION).toBe("program_authorship_v19");
    expect(PROGRAM_AUTHORSHIP_VERSION).not.toMatch(/^[0-9a-f]{40}$/);
    // …and the WIRE contract did NOT move: R3.5 changed acceptance, not the response shape.
    expect(PROGRAM_SCHEMA_NAME).toBe("bty_guided_program_v11");
  });
});
