import { describe, it, expect } from "vitest";
import {
  validateProgramProposal, requiredProgramKinds, programContext, programContextFingerprint,
  programSourceBlocker, recurringMomentFrom, PROGRAM_JSON_SCHEMA, PROGRAM_AUTHORSHIP_VERSION,
  PROGRAM_SCHEMA_NAME, repairLicenseFor, isSemanticRepairableCode,
} from "./program-authorship";
import { CANONICAL_ACTOR, deriveFirstApplicationMoment } from "./program-coherence";
import { decideAdoptionReceipt } from "./adoption-authority";
import {
  stepBlocker, validateDraftPatch, BUILDER_STEP_MAX, BUILDER_STEP_MIN, LEGACY_STEP_GRAPH_MAX,
  RECURRING_MOMENT_MAX, LIVE_STEP_CEILING, persistableStep,
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
    scenario_contract: { pressure_condition: "the huddle is running late and people are already standing to leave", pressure_detail: null },
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
    expect(s.observable_standard).toContain("During morning huddles");
    expect(s.observable_standard).toContain(`, ${CANONICAL_ACTOR} must `);
    expect(s.observable_standard).toContain("Completion evidence: The huddle note records");
    // The scenario sits at the SAME occasion, with the model's pressure inside it.
    expect(s.scenario).toContain("morning huddles");
    expect(s.scenario).toContain("running late");
  });

  it("N/O — the pressure is still the model's, and still cannot relocate the action", () => {
    const relocated = run({}, HOST);
    expect(relocated.ok).toBe(true);
    // A pressure that names its own occasion is refused, exactly as before.
    const moved = validateProgramProposal(
      {
        ...proposal(),
        program: {
          ...proposal().program,
          scenario_contract: { pressure_condition: "during the weekly review the manager is waiting", pressure_detail: null },
        },
      },
      HOST, ["education.pdf"],
    );
    expect(moved.ok).toBe(false);
    if (!moved.ok) expect(moved.code).toBe("scenario_independent_moment");
  });

  it("P — no repair licence can reach the Host's moment, the criterion or the actor", () => {
    /*
      Proven STRUCTURALLY, twice over: the pressure licence names only the two scenario fields,
      and none of the three server-owned roles exists in the provider response at all — so there
      is no field for a retry to return, whatever it is licensed to change.
    */
    expect(repairLicenseFor("scenario_without_pressure", "scenario")).toEqual({ surface: "scenario_pressure" });
    const wire = JSON.stringify(PROGRAM_JSON_SCHEMA);
    for (const role of ["trigger", "actor", "completion"]) expect(wire).not.toContain(`"${role}"`);
    expect(isSemanticRepairableCode("scenario_without_pressure")).toBe(true);
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
    expect(PROGRAM_AUTHORSHIP_VERSION).toBe("program_authorship_v20");
    expect(PROGRAM_SCHEMA_NAME).toBe("bty_guided_program_v11");
  });

  it("Y — the step graph grew by exactly one, and the old one is still named", () => {
    expect(BUILDER_STEP_MAX).toBe(9);
    expect(LEGACY_STEP_GRAPH_MAX).toBe(8);
    // Every input step still blocks on its own question, in the new order.
    expect(stepBlocker(1, {})).toBe("problem_required");
    expect(stepBlocker(2, {})).toBe("audience_required");
    expect(stepBlocker(3, {})).toBe("recurring_moment_required");
    expect(stepBlocker(4, {})).toBe("behavior_required");
    expect(stepBlocker(5, {})).toBe("evidence_required");
    expect(stepBlocker(6, {})).toBe("learning_need_required");
    expect(stepBlocker(7, {})).toBe("material_intent_required");
    expect(stepBlocker(8, {})).toBe("follow_up_required");
    expect(stepBlocker(9, {})).toBeNull(); // Review never blocks
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
  it("never persists a step the live row would reject", () => {
    expect(LIVE_STEP_CEILING).toBeLessThanOrEqual(BUILDER_STEP_MAX);
    for (let s = BUILDER_STEP_MIN; s <= LIVE_STEP_CEILING; s += 1) {
      expect(persistableStep(s), `step ${s}`).toBe(s);
    }
    expect(persistableStep(BUILDER_STEP_MAX)).toBe(LIVE_STEP_CEILING);
    // …and it is never out of range in either direction.
    expect(persistableStep(0)).toBe(BUILDER_STEP_MIN);
    expect(persistableStep(99)).toBe(LIVE_STEP_CEILING);
  });

  it("Review persists as itself now that `20260819000000` is applied", () => {
    /*
      MEASURED LIVE, not assumed: 8 and 9 accepted, 10 refused by
      `foundry_module_drafts_current_step_check`. Until that ran, this returned 8 for Review and
      a host resumed one screen early rather than failing a save.
    */
    expect(LIVE_STEP_CEILING).toBe(BUILDER_STEP_MAX);
    expect(persistableStep(BUILDER_STEP_MAX)).toBe(BUILDER_STEP_MAX);
  });

  it("the domain validator still accepts the whole new graph — only the WRITE is clamped", () => {
    // The clamp is a deploy-order accommodation, not a narrower contract: once the migration
    // runs, moving LIVE_STEP_CEILING to 9 is the only change needed.
    expect(validateDraftPatch({ currentStep: BUILDER_STEP_MAX }).ok).toBe(true);
    expect(validateDraftPatch({ currentStep: BUILDER_STEP_MAX + 1 }).ok).toBe(false);
  });
});
