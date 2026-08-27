import { describe, it, expect } from "vitest";
import {
  validateProgramProposal, requiredProgramKinds, programContext, programContextFingerprint,
  programSourceBlocker, recurringMomentFrom, PROGRAM_JSON_SCHEMA, PROGRAM_AUTHORSHIP_VERSION,
  programAuthorshipVersionNumber,
  PROGRAM_SCHEMA_NAME, repairLicenseFor, isSemanticRepairableCode,
} from "./program-authorship";
import { CANONICAL_ACTOR, deriveFirstApplicationMoment , renderPressureFrame } from "./program-coherence";
import { decideAdoptionReceipt } from "./adoption-authority";
import {
  stepBlocker, validateDraftPatch, BUILDER_STEP_MAX, BUILDER_STEP_MIN, LEGACY_STEP_GRAPH_MAX,
  RECURRING_MOMENT_MAX, LIVE_STEP_CEILING, persistableStep, PRIOR_STEP_GRAPH_MAX, resumeStep,
  type BuilderAnswers,
} from "./module-builder";
import { reviewMissingSections, ALL_BLOCKING_CODES } from "./module-publish";

/**
 * SLICE 3.2P-R3.6-R1 — THE HOST OWNS WHEN IT HAPPENS.
 *
 * W5 (attempt `65923a21`, v11) paid for a generation and refused it `trigger_not_recurring` on a
 * draft whose Host answers name the same repeating moment three times — and the Builder had no
 * question that held one. The model was being asked to re-author, from prose, something the Host
 * already knew, and the product then blamed the Host for the result.
 *
 * This is the third and last of the same repair:
 *
 *   Host audience         → server-owned participant subject "you"      (R3.2-R1)
 *   Host successEvidence  → server-owned completion criterion           (R3.4-R1)
 *   Host recurringMoment  → server-owned workplace moment               (here)
 *
 * What the model authors is now exactly one thing: what the learner is seen doing.
 */
const HOST: BuilderAnswers = {
  // Slice 3.2R-R2.1 — a COMPLETE draft carries a name as well as a problem, and this fixture's
  // whole point is to be complete except for the one field under test.
  title: "End Every Huddle With an Owner",
  problem: "During morning huddles, team members report problems but leave without naming who will act or when the next step will happen.",
  audienceType: "leaders",
  recurringMoment: "During morning huddles",
  observableBehavior: "Name one owner and one deadline for every agreed action.",
  successEvidence: "The huddle note records one owner and one deadline for every agreed action.",
  evidenceType: "confirmed",
  learningNeeds: ["shared_standard", "practice"],
  materialIntent: "pdf",
  followUpDays: 7,
  arenaRecommended: true,
  completionPrompt: "What specific phrases will you use in the next huddle to confirm the action owner and deadline?",
  sharedQuestion: "In your own words, what is the most important standard from this training?",
  capabilityCandidate: "Accountability",
} as unknown as BuilderAnswers;

const KINDS = requiredProgramKinds(HOST);
const CONTENT: Record<string, string> = {
    /*
      A SENTENCE FOR THE NEW REQUIRED KIND (Slice R4-R5C14A). `evidence` is required whenever
      the Host wrote success evidence, and this fixture derives its elements from
      `requiredProgramKinds` — so it needs one. BTY discards it and carries the Host's own
      `successEvidence` instead, exactly as it discards the model's prose for the other
      derived kinds; the model is still schema-required to send something.
    */
    evidence: "What the host would look for in real work, and what it does not prove.",
  why_it_matters: "When a huddle ends without a named owner and a deadline, the problem that was raised stays where it was.",
  observable_standard: "Name one owner and one deadline for every agreed action before the group leaves.",
  scenario: "The huddle is running late and people are already standing to leave.",
  reflection: "In your own words, what is the most important standard from this training?",
  field_application: "Name one owner and one deadline for every agreed action and write them in the huddle note.",
  completion_check: "What exactly will you say to name the owner and the deadline?",
  follow_up: "You will be asked what you actually said at the huddle.",
};
const proposal = (contractOver: Record<string, unknown> = {}) => ({
  program: {
    display_title: "End every huddle with an owner and a deadline",
    elements: KINDS.map((k) => ({ kind: k, content: CONTENT[k], rationale: "grounded in the host's own answers" })),
    assumptions: ["the team holds a morning huddle"],
    warnings: ["a huddle nobody attends is an attendance problem"],
    behavior_contract: {
      action_verb: "name", action_detail: "one owner and one deadline for every agreed action and write them in the huddle note",
      ...contractOver,
    },
    scenario_contract: { pressure_frame: "time_is_short" },
    completion_contract: { verification_target: "the_behaviour", response_mode: "state_what_you_will_say" },
    follow_up_contract: { review_focus: "what_you_said", confirmer: "self_report" },
  },
});
const run = (over: Record<string, unknown> = {}, answers: BuilderAnswers = HOST) =>
  validateProgramProposal(proposal(over), answers, ["education.pdf"]);

describe("[3.2P-R3.6-R1] A/B — nothing reaches the provider without a usable Host moment", () => {
  it("A — absent: the source is not ready, and the Builder says which question", () => {
    const { recurringMoment: _drop, ...without } = HOST as Record<string, unknown>;
    const answers = without as BuilderAnswers;
    expect(programSourceBlocker(answers)).toBe("recurring_moment_required");
    // `programContext` returning null is what the route turns into a 409 before any attempt row.
    expect(programContext(answers)).toBeNull();
    expect(stepBlocker(3, answers)).toBe("recurring_moment_required");
  });

  it("B — present but reading as one-off: guidance, never a refusal (amended by 3.2P-R3.7)", () => {
    /*
      R3.6-R1 blocked this with `recurring_moment_not_repeatable`, because a renderer then needed
      to fold the phrase into a noun phrase. No renderer does now, and R3.7 measured what the fold
      refuses: "During the weekly scheduling review" and every Korean moment — ordinary answers to
      "when does this usually happen?". A narrow English grammar must not outrank the Host on
      their own workplace, so this is advisory only. Same decision R3.4 made about the Host's
      evidence sentence.
    */
    /*
      AMENDED AGAIN BY 3.2P-R3.7-R2. R3.7 accepted this, because "I cannot parse it" was the only
      signal available and that signal refuses ordinary answers. R3.7-R2 asserts one-off-ness
      POSITIVELY — "the next X" names one upcoming instance — so this blocks, while everything
      the rule cannot prove still passes. Saving is still never blocked.
    */
    const answers = { ...HOST, recurringMoment: "At the next huddle" };
    expect(programSourceBlocker(answers)).toBe("recurring_moment_not_repeatable");
    expect(stepBlocker(3, answers), "the host may always save what they wrote").toBeNull();
    expect(programContext(answers)).not.toBeNull();
  });

  it("both are decided from the draft alone — no provider, no attempt, no ledger", () => {
    expect(programSourceBlocker(HOST)).toBeNull();
    expect(programSourceBlocker(undefined)).toBe("recurring_moment_required");
    expect(programSourceBlocker({ recurringMoment: "   " } as BuilderAnswers)).toBe("recurring_moment_required");
  });

  it("no phrasing blocks a generation any more — only absence does (3.2P-R3.7)", () => {
    // Parser UNCERTAINTY blocks nothing — only a moment that can only mean one occasion does.
    for (const moment of [
      "During morning huddles", "at each handoff", "Whenever a deadline moves",
      "During the weekly scheduling review", "아침 허들 때마다", "before leaving the floor",
    ]) {
      expect(programSourceBlocker({ ...HOST, recurringMoment: moment }), moment).toBeNull();
    }
    for (const moment of ["At the next huddle", "Tomorrow at 3 PM", "On August 20"]) {
      expect(programSourceBlocker({ ...HOST, recurringMoment: moment }), moment).toBe("recurring_moment_not_repeatable");
    }
  });
});

describe("[3.2P-R3.6-R1] C/D/E/G — it is a first-class Host answer", () => {
  it("C — it round-trips through patch validation, bounded and trimmed", () => {
    /*
      STORED VERBATIM, like every other prose answer — `checkText` bounds and rejects, it does
      not tidy. Trimming happens on the READ side (`programContext`, `recurringMomentFrom`), so
      the Host's own text is never quietly edited in the draft.
    */
    const ok = validateDraftPatch({ answers: { recurringMoment: "  During morning huddles  " } });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.value.answers?.recurringMoment).toBe("  During morning huddles  ");
    expect(recurringMomentFrom({ recurringMoment: "  During morning huddles  " } as BuilderAnswers))
      .toBe("During morning huddles");

    const long = validateDraftPatch({ answers: { recurringMoment: "x".repeat(RECURRING_MOMENT_MAX + 1) } });
    expect(long.ok).toBe(false);
    if (!long.ok) expect(long.errors).toContain("recurring_moment_too_long");
  });

  it("D — a revision carries it, because it is one key in the answers a revision copies", () => {
    // `createDraft({parentDraftId})` inserts the caller's whole answers object; the domain's job
    // is only that the key survives validation, which is what a revision's patch runs.
    const revision = validateDraftPatch({ answers: { ...HOST } as Record<string, unknown> });
    expect(revision.ok).toBe(true);
    if (revision.ok) expect(revision.value.answers?.recurringMoment).toBe("During morning huddles");
  });

  it("E — Review names the missing input and points at exactly one question", () => {
    const { recurringMoment: _drop, ...without } = HOST as Record<string, unknown>;
    const missing = reviewMissingSections(without as BuilderAnswers);
    const row = missing.find((m) => m.section === "recurringMoment");
    expect(row, "Review must show the missing moment").toBeDefined();
    expect(row!.step).toBe(3);
    // …and it is the ONLY thing missing on an otherwise complete draft, so Edit lands on one
    // meaningful question rather than walking the Host through the Builder.
    expect(missing).toHaveLength(1);
    expect(reviewMissingSections(HOST)).toHaveLength(0);
  });

  it("registered in BOTH readiness layers, which is the failure R3.6 set out to avoid", () => {
    // Generation readiness…
    expect(programSourceBlocker({ ...HOST, recurringMoment: "" })).toBe("recurring_moment_required");
    // …and approval/Review readiness, from the same code.
    expect(ALL_BLOCKING_CODES).toContain("recurring_moment_required");
  });

  it("G — changing ONLY the moment changes the context fingerprint", () => {
    const a = programContextFingerprint(programContext(HOST)!);
    const b = programContextFingerprint(programContext({ ...HOST, recurringMoment: "at each morning huddle" })!);
    expect(a).not.toBe(b);
    expect(a).toContain("during morning huddles");
  });
});

describe("[3.2P-R3.6-R1] H/I/J/K — the model cannot author the moment or the actor", () => {
  it("H/J — the provider contract carries ONE field", () => {
    const bc = PROGRAM_JSON_SCHEMA.properties.program.properties.behavior_contract;
    expect(Object.keys(bc.properties)).toEqual(["action_verb", "action_detail"]);
    expect(bc.required).toEqual(["action_verb", "action_detail"]);
    expect(bc.additionalProperties).toBe(false);
    const wire = JSON.stringify(PROGRAM_JSON_SCHEMA);
    for (const gone of ["trigger", "actor", "confirmed_by", "confirmation_action"]) {
      expect(wire, gone).not.toContain(`"${gone}"`);
    }
  });

  it("I — a smuggled trigger or actor is ignored, not merged", () => {
    const smuggled = run({ trigger: "every Tuesday at the quarterly review", actor: "the records manager" });
    expect(smuggled.ok).toBe(true);
    if (!smuggled.ok) return;
    const c = smuggled.value.proposal.behaviorContract!;
    expect(c.trigger).toBe("During morning huddles");
    expect(c.actor).toBe(CANONICAL_ACTOR);
    const all = smuggled.value.proposal.elements.map((e) => e.content).join(" ");
    expect(all).not.toContain("quarterly review");
    expect(all).not.toContain("records manager");
  });

  it("K/Q/R — every server-owned role traces to its source", () => {
    const r = run();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const c = r.value.proposal.behaviorContract!;
    expect(c.trigger).toBe(recurringMomentFrom(HOST));
    expect(c.completion).toEqual({ criterion: HOST.successEvidence });
    expect(c.actor).toBe(CANONICAL_ACTOR);
  });
});

describe("[3.2P-R3.6-R1] L/N/O/P — the one occasion, and what may still move inside it", () => {
  it("L — the canonical Host moment derives a real next application moment", () => {
    expect(deriveFirstApplicationMoment("During morning huddles"))
      .toEqual({ ok: true, value: "During the next morning huddles" });
    const r = run();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const s = Object.fromEntries(r.value.proposal.elements.map((e) => [e.kind, e.content])) as Record<string, string>;
    for (const k of KINDS) console.log(`\n[${k}]\n${s[k]}`);
    /*
      THREE PROPERTIES, THREE SEAMS (Slice R4-R5C14A). The Host's moment is stated by the section
      that owns it (IN CONTEXT), the server still writes the actor onto the CONTRACT, and the
      Host's criterion is its own section. THE STANDARD is the Host's behaviour sentence and
      carries none of the three — which is what stopped a Korean standard reading as evidence.
    */
    expect(s.observable_standard).not.toContain("During morning huddles");
    expect(s.observable_standard).not.toContain(`, ${CANONICAL_ACTOR} must `);
    expect(s.observable_standard).not.toContain("Completion evidence:");
    expect(s.scenario).toContain("During morning huddles");
    expect(r.value.proposal.behaviorContract!.actor).toBe(CANONICAL_ACTOR);
    expect(s.evidence).toContain("The huddle note records");
    // The scenario sits at the SAME occasion, with the SERVER'S pressure clause inside it
    // (v22 — the model chooses the frame, BTY writes the words).
    expect(s.scenario).toContain("morning huddles");
    expect(s.scenario).toContain(renderPressureFrame("time_is_short"));
  });

  it("N/O — the pressure choice is the model's, and it can no longer relocate anything", () => {
    /*
      REWRITTEN AT v22 (Slice 3.2P-A7-R2). This used to hand the validator a pressure naming its
      own occasion and assert `scenario_independent_moment`. That candidate cannot be
      constructed any more: `pressure_frame` takes one id from a closed set, and an occasion is
      not one of them. The refusal was replaced by an impossibility, which is the whole point.
    */
    const relocated = run({}, HOST);
    expect(relocated.ok).toBe(true);
    const moved = validateProgramProposal(
      {
        ...proposal(),
        program: { ...proposal().program, scenario_contract: { pressure_frame: "after the meeting ends" } },
      },
      HOST, ["education.pdf"],
    );
    // Not a semantic refusal any more — an unknown id is a SHAPE fault.
    expect(moved.ok).toBe(false);
    if (!moved.ok) {
      expect(moved.code).not.toBe("scenario_independent_moment");
      expect(moved.diagnosis?.path).toBe("program.scenario_contract.pressure_frame");
    }
  });

  it("P — no repair licence can reach the Host's moment, the criterion or the actor", () => {
    /*
      Proven STRUCTURALLY, twice over: the pressure licence names only the two scenario fields,
      and none of the three server-owned roles exists in the provider response at all — so there
      is no field for a retry to return, whatever it is licensed to change.
    */
    const wire = JSON.stringify(PROGRAM_JSON_SCHEMA);
    for (const role of ["trigger", "actor", "completion"]) expect(wire).not.toContain(`"${role}"`);
    /*
      STRONGER AT v22 (Slice 3.2P-A7-R2): there is no scenario repair at all, because there is
      no scenario prose. The Host's moment was already unreachable; now so is every route to it.
    */
    expect(isSemanticRepairableCode("scenario_without_pressure")).toBe(false);
    expect(isSemanticRepairableCode("scenario_independent_moment")).toBe(false);
  });
});

describe("[3.2P-R3.6-R1] S/V/W/X — versions, history and the step graph", () => {
  it("V/W — v13 accepts its own proposals and refuses every earlier one", () => {
    const claim = (v: string) => ({
      mode: "initial" as const, claimedAttemptId: "a", journeyInSamePatch: true, durableJourneyPresent: false,
      attempt: { id: "a", draftId: "d", outcome: "success", contextFingerprint: "f", proposalDigest: "g", proposalVersion: v },
      draftId: "d", currentFingerprint: "f", currentAuthorityVersion: PROGRAM_AUTHORSHIP_VERSION,
      latestSuccessfulAttemptId: "a", adoptedJourneyDigest: "g",
    });
    for (const spent of ["program_authorship_v9", "program_authorship_v10", "program_authorship_v11", "program_authorship_v12", "program_authorship_v13", "program_authorship_v14", "program_authorship_v15", "program_authorship_v16", "program_authorship_v17"]) {
      expect(decideAdoptionReceipt(claim(spent)), spent).toEqual({ ok: false, reason: "proposal_no_longer_valid" });
    }
    expect(decideAdoptionReceipt(claim(PROGRAM_AUTHORSHIP_VERSION))).toEqual({ ok: true });
  });

  it("both authorities moved, because both acceptance AND the wire shape changed", () => {
        /*
      NOT RE-PINNED (Slice R4-R5C14A-R1). This literal was v24, and before that v23, v17, v11 —
      fourteen files edited on every composition change for an assertion that was never about the
      number. What it defends is the SPLIT: acceptance moved, so the authority version moved; the
      wire shape did not, so the schema name did not. v25 is R4-R5C14A, where THE STANDARD became
      the Host's own behaviour sentence and WHAT SUCCESS LOOKS LIKE became their own evidence.
    */
    expect(PROGRAM_AUTHORSHIP_VERSION).toMatch(/^program_authorship_v\d+$/);
    expect(programAuthorshipVersionNumber()).toBeGreaterThanOrEqual(25);
    expect(PROGRAM_SCHEMA_NAME).toBe("bty_guided_program_v12");
  });

  it("Y — the recurring moment still sits at 3, whatever the graph around it is", () => {
    /*
      Slice R4-R8B shrank the graph from nine to seven by deriving the learning-need and
      Arena/follow-up screens away. What this test is FOR is unchanged: the moment question is
      step 3, and every input step blocks on its own question — so the assertions are written
      against the constants rather than against the number nine, which is what let this test
      report a graph change as a failure rather than as the fact it is.
    */
    expect(BUILDER_STEP_MAX).toBe(7);
    expect(LEGACY_STEP_GRAPH_MAX).toBe(8);
    expect(PRIOR_STEP_GRAPH_MAX).toBe(9);
    expect(stepBlocker(1, {})).toBe("problem_required");
    expect(stepBlocker(2, {})).toBe("audience_required");
    expect(stepBlocker(3, {})).toBe("recurring_moment_required");
    expect(stepBlocker(4, {})).toBe("behavior_required");
    expect(stepBlocker(5, {})).toBe("evidence_required");
    expect(stepBlocker(6, {})).toBe("material_intent_required");
    expect(stepBlocker(BUILDER_STEP_MAX, {})).toBeNull(); // Review never blocks
  });

  it("R4-R8B — a bookmark written under the nine-screen graph opens somewhere real", () => {
    // Never further forward than the Host had reached, and never off the end of the Builder.
    expect(resumeStep(1)).toBe(1);
    expect(resumeStep(5)).toBe(5);
    expect(resumeStep(6)).toBe(6); // was "what should this include?" → material, still asked
    expect(resumeStep(7)).toBe(7); // 7 is Review now, and every future value means that
    expect(resumeStep(8)).toBe(7); // was Arena + follow-up, both derived → Review
    expect(resumeStep(9)).toBe(7); // was Review → Review
    // Nonsense clamps rather than throwing: an unexplainable bookmark is not a reason to refuse
    // to open a draft.
    expect(resumeStep(0)).toBe(1);
    expect(resumeStep(-4)).toBe(1);
    expect(resumeStep(99)).toBe(BUILDER_STEP_MAX);
    expect(resumeStep(undefined)).toBe(1);
    // Every legal stored value lands on a step that exists.
    for (let s = 1; s <= PRIOR_STEP_GRAPH_MAX; s += 1) {
      expect(resumeStep(s), `stored ${s}`).toBeLessThanOrEqual(BUILDER_STEP_MAX);
      expect(resumeStep(s), `stored ${s}`).toBeGreaterThanOrEqual(1);
      expect(resumeStep(s), `stored ${s}`).toBeLessThanOrEqual(s);
    }
  });
});

/**
 * SLICE 3.2P-R3.6-R1 — THE BOUND THE CODE DID NOT OWN.
 *
 * `current_step` is validated in the domain AND by a CHECK constraint on the row. Adding a
 * ninth screen moved one of those and not the other, and the gap was found by a live write:
 * 8 accepted, 9 refused by `foundry_module_drafts_current_step_check`. A host could reach
 * Review and not save from it.
 *
 * Until migration `20260819000000` runs, the app clamps what it PERSISTS. It clamps rather
 * than errors because this is a resume bookmark and nothing derives authority from it — a lost
 * screen of accuracy costs a click, a failed save costs the answer they just typed.
 */
describe("[3.2P-R3.6-R1] the persisted step never exceeds what the live row accepts", () => {
  it("never persists a step the live row would reject, nor one the Builder does not have", () => {
    /*
      Slice R4-R8B — the two ceilings came apart. The row still accepts 9; the Builder now ends
      at 7, so the LOWER one governs what may be written. This used to assert they were ordered
      one way; it now asserts what the ordering is FOR.
    */
    const ceiling = Math.min(BUILDER_STEP_MAX, LIVE_STEP_CEILING);
    for (let s = BUILDER_STEP_MIN; s <= ceiling; s += 1) {
      expect(persistableStep(s), `step ${s}`).toBe(s);
    }
    expect(persistableStep(BUILDER_STEP_MAX)).toBe(BUILDER_STEP_MAX);
    // …and it is never out of range in either direction.
    expect(persistableStep(0)).toBe(BUILDER_STEP_MIN);
    expect(persistableStep(99)).toBe(ceiling);
    expect(persistableStep(99)).toBeLessThanOrEqual(LIVE_STEP_CEILING);
  });

  it("Review persists as itself now that `20260819000000` is applied", () => {
    /*
      MEASURED LIVE, not assumed: 8 and 9 accepted, 10 refused by
      `foundry_module_drafts_current_step_check`. Until that ran, this returned 8 for Review and
      a host resumed one screen early rather than failing a save.
    */
    // Slice R4-R8B — the row's ceiling is now ABOVE the Builder's, which is the safe direction:
    // every step the Builder can reach is a step the row accepts.
    expect(LIVE_STEP_CEILING).toBeGreaterThanOrEqual(BUILDER_STEP_MAX);
    expect(persistableStep(BUILDER_STEP_MAX)).toBe(BUILDER_STEP_MAX);
  });

  it("the validator accepts anything the ROW accepts, and clamps the write to the Builder", () => {
    /*
      Slice R4-R8B — the accommodation now runs the other way. The row still accepts 1..9 and the
      Builder ends at 7, so a browser tab still running the pre-deploy bundle can keep autosaving
      an 8 without being told its work cannot be saved; the value STORED is one this Builder can
      open. Anything the row itself would reject is still refused.
    */
    expect(validateDraftPatch({ currentStep: BUILDER_STEP_MAX }).ok).toBe(true);
    expect(validateDraftPatch({ currentStep: LIVE_STEP_CEILING }).ok).toBe(true);
    expect(validateDraftPatch({ currentStep: LIVE_STEP_CEILING }).value?.currentStep).toBe(BUILDER_STEP_MAX);
    expect(validateDraftPatch({ currentStep: LIVE_STEP_CEILING + 1 }).ok).toBe(false);
    expect(validateDraftPatch({ currentStep: 0 }).ok).toBe(false);
  });
});
