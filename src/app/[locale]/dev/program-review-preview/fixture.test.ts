import { describe, expect, it } from "vitest";
import {
  FIXTURE_IDENTITY,
  PREVIEW_ANSWERS,
  PREVIEW_CONTRACTS,
  PREVIEW_EVIDENCE_CEILING,
  PREVIEW_PROPOSAL,
  PREVIEW_FINGERPRINT,
  V7_LIVE,
} from "./fixture";
import { JOURNEY_KIND_ORDER, validateJourney, type RealityGroundedJourneyV1 } from "@/domain/foundry/module/journey";
import type { BuilderAnswers } from "@/domain/foundry/module/module-builder";
import {
  deriveEvidenceCeiling,
  deriveInstructionalContent,
  outcomeClaimIndex,
  retainGroundedAssumptions,
  validateEditedReview,
  applicationMomentFor,
  applyProgramProposal,
  attributionKind,
  derivesFrom,
  programContext,
  programContextFingerprint,
  readProvenance,
  PROGRAM_REJECT_CODES,
  PROGRAM_AUTHORSHIP_VERSION,
  PROGRAM_SCHEMA_NAME,
  type ProgramContracts,
} from "@/domain/foundry/module/program-authorship";
import { resolveRefusalCopy } from "@/components/foundry/event-rooms/programRefusalCopy";
import { DETAIL_FIELDS, FIELD_GROUP_HEADING } from "@/components/foundry/event-rooms/programReviewFields";
import {
  namesIndependentMoment,
  validateScenarioContract,
  deriveFirstApplicationMoment,
} from "@/domain/foundry/module/program-coherence";

/**
 * SLICE 3.2L-R9 — the two participant-facing defects the V7 live window shipped with.
 *
 * The instructional core (standard, scenario, decision, application, completion) was
 * physically usable and is regression-locked here. What failed was the rationale — four
 * unmeasured causal promises in new words — and a follow-up that told the actor the person
 * on the other side would be asked "the same question".
 */

const REQUIRED = [
  "why_it_matters",
  "observable_standard",
  "scenario",
  "action_decision",
  "field_application",
  "completion_check",
  "follow_up",
] as const;

const derived = (kind: (typeof REQUIRED)[number], c: ProgramContracts = PREVIEW_CONTRACTS) =>
  deriveInstructionalContent(kind, c);

const withCompletion = (criterion: string): ProgramContracts => ({
  ...PREVIEW_CONTRACTS,
  behavior: { ...PREVIEW_CONTRACTS.behavior, completion: { criterion } },
});

// ---------------------------------------------------------------------------
// G1–G4 — grounded rationale
// ---------------------------------------------------------------------------

describe("[3.2L-R9] G1 — the exact live WHY THIS MATTERS cannot be accepted unchanged", () => {
  it("every one of the four live claims is caught", () => {
    expect(outcomeClaimIndex(V7_LIVE.whyItMattersRecorded)).toBeGreaterThan(-1);
    for (const fragment of [
      "ensures that everyone is clear on responsibilities",
      "prevents important tasks from falling through the cracks",
      "supports team collaboration",
      "improves overall workflow efficiency",
    ]) {
      expect(outcomeClaimIndex(fragment), fragment).toBeGreaterThan(-1);
    }
  });

  it("and it is not displayed at all — the rationale is derived", () => {
    const shown = PREVIEW_PROPOSAL.elements.find((e) => e.kind === "why_it_matters")?.content ?? "";
    expect(shown).not.toContain("ensures");
    expect(shown).not.toContain("collaboration");
    expect(shown).toBe(derived("why_it_matters"));
  });
});

describe("[3.2L-R9] G2 — synonym substitution does not reopen the defect", () => {
  it("the same claim in unlisted words is still caught", () => {
    for (const claim of [
      "This strengthens accountability across the team.",
      "It eliminates rework and reduces delays.",
      "The standard fosters better communication.",
      "This will increase productivity over time.",
      "It helps to guarantee consistency in every project.",
      "Doing this leads to fewer mistakes.",
      "It promotes alignment between the two teams.",
      "This optimises workflow across shifts.",
      "It supports engagement and morale.",
      "This prevents items slipping through.",
    ]) {
      expect(outcomeClaimIndex(claim), claim).toBeGreaterThan(-1);
    }
  });

  it("the honest denial of the same claim is NOT caught", () => {
    for (const honest of [
      "This does not improve collaboration on its own.",
      "Nothing here can reduce delays by itself.",
      "It will not eliminate rework, and it is not meant to.",
    ]) {
      // The negation window is what keeps the language the slice wants sayable.
      expect(
        validateEditedReview(PREVIEW_CONTRACTS, REQUIRED, { evidence: honest }, PREVIEW_ANSWERS),
        honest,
      ).toEqual({ ok: true });
    }
  });
});

describe("[3.2L-R9] G3/G4 — the derived rationale is grounded and claims nothing", () => {
  const shown = () => derived("why_it_matters")!;

  it("names the Host's problem and the one visible action", () => {
    expect(shown()).toContain("Our handoffs are inconsistent");
    expect(shown()).toContain("state each unfinished item and identify its next owner");
    // v11: WHY THIS MATTERS closes on the Host's own evidence, in their words.
    expect(shown()).toContain("What shows it happened: Handoff record.");
  });

  it("claims no outcome of any kind", () => {
    expect(outcomeClaimIndex(shown())).toBe(-1);
    const t = shown().toLowerCase();
    for (const claim of ["collaborat", "efficien", "productiv", "no longer", "adopt"]) {
      expect(t, claim).not.toContain(claim);
    }
  });

  it("moves with the Host's problem rather than inventing one", () => {
    const other = { ...PREVIEW_CONTRACTS, problemStatement: "Nobody writes anything down at the ward round." };
    expect(derived("why_it_matters", other)).toContain("Nobody writes anything down at the ward round");
    expect(derived("why_it_matters", other)).not.toContain("handoffs are inconsistent");
  });

  it("falls back to the model's prose only when the Host stated no problem", () => {
    expect(derived("why_it_matters", { ...PREVIEW_CONTRACTS, problemStatement: "" })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// The counterpart follow-up, and why it is gone (Slice 3.2P-R3.4-R1)
// ---------------------------------------------------------------------------

/*
  R9 built an entire counterpart apparatus here — G5 through G10, some forty assertions —
  because the live v7 follow-up told the actor "The person on the other side of it will be
  asked the same question", which was a fixed string and was not true. R9's fix derived the
  counterpart from the completion authority instead: WHO is asked came from `confirmed_by`,
  WHAT they were asked came from `confirmation_action`, and `isJointConfirmer` kept "both
  people" from being asked whether they had witnessed themselves.

  Every one of those assertions was about a person the MODEL named. v11 has no such field, so
  there is nobody to address and no shape to get right — the honest replacement is not a
  migrated version of those tests but the guarantee that replaced them: this follow-up asks
  the participant, and introduces no one else.
*/
describe("[3.2P-R3.4-R1] O — the follow-up asks the participant, and nobody else", () => {
  it("the live v7 line, and R9's own replacement for it, are both unreachable", () => {
    const f = derived("follow_up")!;
    expect(f).not.toContain("will be asked the same question");
    expect(f).not.toContain("The person on the other side of it");
    // R9's counterpart sentence needed a confirmer to name. There is none to name.
    expect(f).not.toContain("will be asked a different question");
    expect(f).not.toMatch(/did they (?:see|hear)/i);
  });

  it("Q — no second person appears anywhere in the rendered program", () => {
    /*
      The W3/W4 failure was not that a confirmer rendered badly — it rendered perfectly. It was
      that a person nobody had named acquired a job. This asserts the absence across every
      section, which is the only place that failure could have shown up.
    */
    for (const kind of ["observable_standard", "scenario", "field_application", "why_it_matters", "follow_up"] as const) {
      const text = derived(kind);
      if (text === null) continue;
      expect(text, kind).not.toMatch(/(?:records manager|team lead|supervisor|reviewer|keeper)/i);
    }
  });

  it("and it is still a self-report, not an observation", () => {
    const f = derived("follow_up")!;
    expect(f).toContain("That is your own account of it, not an observation.");
    expect(f).not.toMatch(/BTY (?:saw|observed|verified)/i);
  });
});

describe("[3.2L-R9] G9 — both answers stay reports", () => {
  it("the follow-up says so on its face", () => {
    expect(derived("follow_up")).toContain("That is your own account of it, not an observation.");
  });

  it("and the evidence ceiling has not softened", () => {
    expect(PREVIEW_EVIDENCE_CEILING).toContain("not observed behavior");
    expect(PREVIEW_EVIDENCE_CEILING).toContain(
      "Nothing here can show that behaviour changed, that it was adopted, or that it lasted",
    );
    expect(outcomeClaimIndex(PREVIEW_EVIDENCE_CEILING)).toBe(-1);
  });
});

// ---------------------------------------------------------------------------
// G11/G12 — assumption integrity
// ---------------------------------------------------------------------------

describe("[3.2L-R9] G11/G12 — assumptions the Host can act on, or none", () => {
  it("both live assumptions are dropped", () => {
    expect(retainGroundedAssumptions([...V7_LIVE.assumptionsRecorded])).toEqual([]);
    expect(PREVIEW_PROPOSAL.assumptions).toEqual([]);
    expect(PREVIEW_PROPOSAL.warnings).toEqual([]);
  });

  it("motivation, competence, access and adoption assumptions never render", () => {
    expect(
      retainGroundedAssumptions([
        "Participants are willing to commit to adopting new practices.",
        "Staff are motivated to change.",
        "People have access to the template.",
        "Everyone is familiar with the process.",
        "The team will embrace the new standard.",
        "Participants are capable of doing this.",
      ]),
    ).toEqual([]);
  });

  it("an assumption about the world the behaviour needs survives", () => {
    const kept = [
      "The person taking over is present at the end of the shift.",
      "Handoffs happen at a predictable point in the day.",
    ];
    expect(retainGroundedAssumptions(kept)).toEqual(kept);
  });
});

// ---------------------------------------------------------------------------
// G13–G15 — regression on what the live window got right
// ---------------------------------------------------------------------------

describe("[3.2L-R9] G13 — the usable v7 instructional core is unchanged", () => {
  it("renders exactly what the phone displayed", () => {
    expect(derived("observable_standard")).toBe(
      "At each handoff point, team members must state each unfinished item and identify its next owner. " +
        "Completion evidence: Handoff record.",
    );
    expect(derived("scenario")).toBe(
      "At each handoff point, even when a tight deadline is approaching and teammates are waiting for information, " +
        "team members must state each unfinished item and identify its next owner. " +
        "Completion evidence: Handoff record.",
    );
    // 3.2P-R3.7: this line used to read "At my next handoff point". The fold that produced it
    // shipped "During the next morning huddles" in W6, so the commitment now points at the next
    // occurrence and the host's moment stays where it renders correctly, two sections above.
    expect(derived("action_decision")).toBe(
      "the next time this happens, I will state each unfinished item and identify its next owner.",
    );
    expect(derived("field_application")).toContain(
      "The next time this happens, team members must state each unfinished item and identify its next owner.",
    );
  });

  it("one trigger, one completion authority, aligned application", () => {
    /*
      B (Slice 3.2P-R3.4-R1): ONE criterion, from the Host, in all three — with a different
      lead-in in APPLY IT, because four sections closing on identical words is what the R3.4-R1
      corpus render audit caught.
    */
    for (const kind of ["observable_standard", "scenario", "field_application"] as const) {
      expect(derived(kind), kind).toContain(PREVIEW_ANSWERS.successEvidence!);
    }
    expect(derived("field_application")).toContain("You will know it happened by this: Handoff record.");
    expect(namesIndependentMoment(PREVIEW_CONTRACTS.scenario!.pressureCondition)).toBe(false);
    // v9: the first instance is DERIVED from the trigger, so alignment is not checked — it
    // is guaranteed by construction (Slice 3.2L-R10-A).
    expect(deriveFirstApplicationMoment(PREVIEW_CONTRACTS.behavior.trigger)).toEqual({ ok: true, value: "Next handoff point" });
    expect(derived("scenario")!.startsWith("At each handoff point, even when")).toBe(true);
  });

  it("a smuggled second moment is still refused with its own code", () => {
    const r = validateScenarioContract(
      { pressure_condition: "during the next team meeting nobody is listening", pressure_detail: null },
      PREVIEW_CONTRACTS.behavior,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.defect.reason).toBe("independent_moment");
    expect(PROGRAM_REJECT_CODES).toContain("scenario_independent_moment");
    expect(resolveRefusalCopy("validation_refused", "scenario_independent_moment").headline).toMatch(/different moment/i);
  });
});

describe("[3.2L-R9] G14/G15 — grounding and one ceiling", () => {
  it("the whole program passes the deterministic Apply gate", () => {
    expect(validateEditedReview(PREVIEW_CONTRACTS, REQUIRED, {}, PREVIEW_ANSWERS)).toEqual({ ok: true });
  });

  it("nothing invents a template, tool, approval or existing process", () => {
    const blob = PREVIEW_PROPOSAL.elements.map((e) => e.content).join(" ").toLowerCase();
    for (const invented of ["the template", "the checklist", "the form", "approval", "the system", "the tool"]) {
      expect(blob, invented).not.toContain(invented);
    }
  });

  it("exactly one ceiling, matching the configured journey", () => {
    expect(PREVIEW_PROPOSAL.evidenceLanguage).toBe(deriveEvidenceCeiling(PREVIEW_ANSWERS));
    expect(PREVIEW_EVIDENCE_CEILING).toBe(PREVIEW_PROPOSAL.evidenceLanguage);
    const knowOnly = deriveEvidenceCeiling({
      ...PREVIEW_ANSWERS,
      learningNeeds: ["know"],
      arenaRecommended: false,
      followUpDays: 0,
    });
    expect(knowOnly).not.toContain("Practice is rehearsal");
    expect(knowOnly).not.toContain("scheduled self-report");
  });
});

describe("[3.2L-R9] G16/G17 — fixture identity and authority version", () => {
  it("the preview names the window it replays", () => {
    expect(FIXTURE_IDENTITY).toBe("R10-A V9 canonical instance");
    expect(FIXTURE_IDENTITY.length).toBeLessThanOrEqual(40);
  });

  it("every displayed section is derived from one object", () => {
    expect(PREVIEW_PROPOSAL.displayTitle).toBe(V7_LIVE.displayTitle);
    for (const kind of REQUIRED) {
      expect(PREVIEW_PROPOSAL.elements.find((e) => e.kind === kind)?.content, kind).toBe(derived(kind));
    }
  });

  it("both the authority and the wire schema move", () => {
    // v9 REMOVES application_contract from the response, so unlike R9 this is a real wire
    // change and both names increment (Slice 3.2L-R10-A).
    /*
      v11 removes `behavior_contract.completion` from the response, so — like v9 before it —
      this is a real WIRE change and both names increment (Slice 3.2P-R3.4-R1).
    */
    expect(PROGRAM_AUTHORSHIP_VERSION).toBe("program_authorship_v14");
    expect(PROGRAM_SCHEMA_NAME).toBe("bty_guided_program_v10");
  });

  it("no string from a retired fixture survives", () => {
    const blob = JSON.stringify(PREVIEW_PROPOSAL) + JSON.stringify(PREVIEW_ANSWERS) + PREVIEW_EVIDENCE_CEILING;
    for (const stale of [
      "Improving Handoff Consistency",
      "Handing over what",
      "When a shift ends",
      "the next project handoff",
      "Establishing a consistent",
    ]) {
      expect(blob, stale).not.toContain(stale);
    }
  });
});

// ---------------------------------------------------------------------------
// R9.2 — actor / confirmer clarity (labels and grouping only)
// ---------------------------------------------------------------------------

describe("[3.2L-R9.2] the two decisions a Host is making are named", () => {
  const standard = DETAIL_FIELDS.observable_standard!;
  const labels = standard.map((f) => f.label);

  it("G1/G2: the one control names what it edits", () => {
    expect(standard.find((f) => f.id === "action")!.label).toBe("What would you see or hear them do?");
  });

  it("[3.2P-R3.4-R1 / R3.6-R1] three controls are gone, not renamed", () => {
    /*
      R9.2 gave these their own groups because they were contract roles the Host corrected on
      the model's behalf. Each is now sourced from a Host question in the Builder, so editing it
      here would create a second authority for one sentence:

        who confirms → "How will you know it worked?"        (v11)
        who acts     → the audience, rendered as "you"       (v11)
        when         → "When does this usually happen?"      (v13)

      The Host did not lose an edit; each moved back to where they wrote it.
    */
    expect(standard.map((f) => f.id)).toEqual(["action"]);
  });

  it("no two controls open with the same three words any more", () => {
    /*
      THE MEASURED CONFUSION. The old set was "Who does this?" / "Who confirms it's done?"
      and "What would someone see or hear them do?" / "What would you see them do?" — the
      same interrogative twice, four lines apart, in one flat list of identical fields.
    */
    const heads = labels.map((l) => l.split(/\s+/).slice(0, 3).join(" ").toLowerCase());
    expect(new Set(heads).size).toBe(heads.length);
  });

  it("G3: what remains is one named group", () => {
    expect(standard.map((f) => f.group)).toEqual(["action"]);
    expect(FIELD_GROUP_HEADING.action).toBe("The action");
  });

  it("no internal vocabulary reaches a label or a heading", () => {
    const shown = [...labels, ...Object.values(FIELD_GROUP_HEADING)].join(" ").toLowerCase();
    for (const internal of ["actor", "contract", "confirmer", "behavior", "behaviour", "field", "trigger", "schema"]) {
      expect(shown, internal).not.toContain(internal);
    }
  });

  it("G4: B — the standard renders from the ACTION controls plus the Host's own evidence", () => {
    const get = (id: string) => standard.find((f) => f.id === id)!;
    expect(get("action").get(PREVIEW_CONTRACTS)).toBe(PREVIEW_CONTRACTS.behavior.observableAction);
    expect(derived("observable_standard")).toBe(
      "At each handoff point, team members must state each unfinished item and identify its next owner. " +
        "Completion evidence: Handoff record.",
    );
    // …and that criterion is the Host's step-4 answer, not anything the model returned.
    expect(PREVIEW_CONTRACTS.behavior.completion.criterion).toBe(PREVIEW_ANSWERS.successEvidence);
  });

  it("G6/G7: each control writes ONLY its own field", () => {
    const get = (id: string) => standard.find((f) => f.id === id)!;
    const moved = get("action").set(PREVIEW_CONTRACTS, "reads every open item aloud");
    expect(moved.behavior.observableAction).toBe("reads every open item aloud");
    // Nothing a Host types into the action control can reach the moment, the actor or the
    // criterion — the three the product and the Host own.
    expect(moved.behavior.trigger).toBe(PREVIEW_CONTRACTS.behavior.trigger);
    expect(moved.behavior.actor).toBe(PREVIEW_CONTRACTS.behavior.actor);
    expect(moved.behavior.completion.criterion).toBe(PREVIEW_CONTRACTS.behavior.completion.criterion);
  });
});

// ---------------------------------------------------------------------------
// R10-A — the first instance is derived from the canonical trigger
// ---------------------------------------------------------------------------

describe("[3.2L-R10-A] one required moment, one derived first instance", () => {
  const withTrigger = (trigger: string): ProgramContracts => ({
    ...PREVIEW_CONTRACTS,
    behavior: { ...PREVIEW_CONTRACTS.behavior, trigger },
  });

  it("G1: the exact v8 architecture failure is unrepresentable", () => {
    // v8: trigger "at each handoff point" + a model-authored "at the next weekly staff
    // meeting". There is no field left to carry a second occasion.
    expect(PREVIEW_PROPOSAL.applicationContract).toBeNull();
    expect(PREVIEW_CONTRACTS.application).toBeNull();
    expect(JSON.stringify(PREVIEW_PROPOSAL)).not.toContain("application_moment");
    // And the moment is the HOST's, verbatim — 3.2P-R3.7 stopped folding it into a noun phrase.
    expect(applicationMomentFor(withTrigger("at each weekly staff meeting"))).toBe("at each weekly staff meeting");
  });

  /**
   * G2/G4 REPLACED BY 3.2P-R3.7 — the fold is gone, so there are no families to enumerate.
   *
   * These asserted a ten-row table of trigger → "At my next X" / "At the next X". W6 shipped
   * "During the next morning huddles" out of that machinery, and measuring it against real host
   * answers showed it also refuses "During the weekly scheduling review" and every Korean
   * moment. The application sections now point at the next occurrence and read the host's phrase
   * not at all, so every family renders the same way and none can be mis-transformed.
   */
  it("G2/G4: every moment, in any language, renders the same pointer", () => {
    for (const trigger of [
      "at each handoff point",
      "before closing each patient consultation",
      "each time the duty lead changes",
      "at shift change, before leaving the floor",
      "During the weekly scheduling review",
      "아침 허들 때마다",
    ]) {
      const c = withTrigger(trigger);
      expect(derived("action_decision", c)?.startsWith("the next time this happens, I will "), trigger).toBe(true);
      expect(derived("field_application", c)?.startsWith("The next time this happens, "), trigger).toBe(true);
      for (const bad of ["the the", "next next", "At at", "In during", "the a "]) {
        expect(derived("field_application", c), `${trigger}: ${bad}`).not.toContain(bad);
      }
      // THE STANDARD still states the host's own words, exactly once and unedited.
      expect(derived("observable_standard", c)?.startsWith(trigger.charAt(0).toUpperCase() + trigger.slice(1)), trigger).toBe(true);
    }
  });

  it("G5: a moment the fold cannot parse is the HOST's answer, not a failure (3.2P-R3.7)", () => {
    /*
      This asserted that such a trigger rendered nothing and blocked Apply. That was right while
      a renderer needed the fold; it is wrong now. The fold refuses "During the weekly scheduling
      review" and every Korean moment — ordinary answers to "when does this usually happen?" —
      and no renderer reads it any more. Whether a phrase reads as recurring is advisory guidance
      on the host's own question, never a refusal of their program.
    */
    for (const trigger of [
      "before leaving the floor",
      "at the Monday leadership review",
      "during all relevant transitions of work",
      "tomorrow at 7am",
    ]) {
      expect(deriveFirstApplicationMoment(trigger), trigger).toEqual({ ok: false, reason: "not_recurring" });
      // …and the program renders anyway, from the host's words.
      expect(applicationMomentFor(withTrigger(trigger)), trigger).toBe(trigger);
      expect(derived("field_application", withTrigger(trigger)), trigger).toContain("The next time this happens");
      expect(validateEditedReview(withTrigger(trigger), REQUIRED, {}, PREVIEW_ANSWERS), trigger).toEqual({ ok: true });
    }
    // The historical refusal stays readable — W5 carries it (Slice 3.2P-R3.5).
    expect(PROGRAM_REJECT_CODES).toContain("trigger_not_recurring");
    expect("trigger_not_recurring".length).toBeLessThanOrEqual(60);
    expect(resolveRefusalCopy("validation_refused", "trigger_not_recurring").headline).toMatch(/first real chance/i);
    /*
      `start_a_new_draft` since Slice 3.2P-R3.5 — the "nothing for you to change" category.
      W5 showed the old `adjust_your_training_inputs` telling a Host to supply a moment they
      had already given three times, through a Builder field that does not exist.
    */
    expect(resolveRefusalCopy("validation_refused", "trigger_not_recurring").recovery).toBe("start_a_new_draft");
  });

  it("G6: the derivation changes quantification and nothing else", () => {
    for (const trigger of ["at each handoff point", "during each ward round", "whenever a deadline moves"]) {
      const r = deriveFirstApplicationMoment(trigger);
      expect(r.ok).toBe(true);
      if (!r.ok) continue;
      const before = new Set(trigger.toLowerCase().match(/[a-z]+/g) ?? []);
      const added = (r.value.toLowerCase().match(/[a-z]+/g) ?? []).filter((w) => !before.has(w));
      // Only determiners may appear that were not in the trigger.
      expect(added.every((w) => ["the", "next", "time"].includes(w)), `${trigger} added ${added}`).toBe(true);
      for (const invented of ["meeting", "shift", "deadline", "call", "review", "calendar", "tomorrow"]) {
        if (!before.has(invented)) expect(r.value.toLowerCase(), `${trigger}/${invented}`).not.toContain(invented);
      }
    }
  });

  it("G7: proper nouns and acronyms survive the swap", () => {
    expect(deriveFirstApplicationMoment("at each SBAR handover")).toEqual({ ok: true, value: "next SBAR handover" });
    expect(deriveFirstApplicationMoment("during each Monday MDT")).toEqual({ ok: true, value: "during the next Monday MDT" });
  });

  it("G10/G11: editing the trigger moves both sections, and nothing else can", () => {
    const moved = withTrigger("at each morning huddle");
    // THE STANDARD and IN CONTEXT carry the host's moment; the two application sections point at
    // its next occurrence. Editing the trigger still moves all four, and nothing else can.
    expect(derived("observable_standard", moved)).toContain("At each morning huddle");
    expect(derived("scenario", moved)).toContain("At each morning huddle");
    expect(derived("action_decision", moved)).toContain("the next time this happens");
    expect(derived("field_application", moved)).toContain("The next time this happens");
    // No control anywhere still edits a first moment.
    const ids = Object.values(DETAIL_FIELDS).flat().map((f) => f?.id);
    expect(ids).not.toContain("moment");
    expect(ids).not.toContain("moment-apply");
  });

  it("G12: a legacy v1-v8 stored moment is no longer needed to replay one", () => {
    /*
      A legacy proposal carried its own model-authored moment, and this asserted it was used when
      the trigger could not fold. Nothing folds now and no section renders a moment noun phrase,
      so the host's trigger answers "is there a moment" on its own and the legacy field is inert.
    */
    const legacy: ProgramContracts = {
      ...withTrigger("before leaving the floor"),
      application: { applicationMoment: "next shift change" },
    };
    expect(applicationMomentFor(legacy)).toBe("before leaving the floor");
    expect(derived("field_application", legacy)).toContain("The next time this happens");
    expect(derived("field_application", legacy)).not.toContain("next shift change");
  });
});

// ---------------------------------------------------------------------------
// R10-A.1 — a BTY-owned section that cannot render must go quiet
// ---------------------------------------------------------------------------

describe("[3.2L-R10-A.1] fail-closed review coherence", () => {
  const withTrigger = (trigger: string): ProgramContracts => ({
    ...PREVIEW_CONTRACTS,
    behavior: { ...PREVIEW_CONTRACTS.behavior, trigger },
  });

  it("G1: the exact physical state cannot exist — two moments at once", () => {
    const broken = withTrigger("before leaving the floor");
    expect(derived("observable_standard", broken)).toContain("Before leaving the floor");
    /*
      3.2P-R3.7: these went quiet rather than render a second moment. They no longer name a
      moment at all, so the property is stronger — there is only ever ONE occasion in the
      program, and it is the host's, stated where it renders correctly.
    */
    expect(derived("action_decision", broken)).toContain("the next time this happens");
    expect(derived("field_application", broken)).toContain("The next time this happens");
    expect(derived("action_decision", broken)).not.toContain("leaving the floor");
    // …and they are still BTY's sections, so the surface knows to go quiet rather than
    // hand them back to the Host as narrative.
    expect(derivesFrom("action_decision", broken)).toBe(true);
    expect(derivesFrom("field_application", broken)).toBe(true);
  });

  it("G4/G9: no legacy moment is reachable from an active review", () => {
    const broken = withTrigger("before leaving the floor");
    expect(broken.application).toBeNull();
    // 3.2P-R3.7: the host's own trigger answers this, whatever its phrasing — the fold that used
    // to refuse it also refused ordinary answers like "During the weekly scheduling review".
    expect(applicationMomentFor(broken)).toBe("before leaving the floor");
    expect(validateEditedReview(broken, REQUIRED, {}, PREVIEW_ANSWERS)).toEqual({ ok: true });
  });

  it("G6: editing the trigger keeps both sections coherent", () => {
    const fixed = withTrigger("at each morning huddle");
    expect(derived("observable_standard", fixed)).toContain("At each morning huddle");
    expect(derived("action_decision", fixed)).toContain("the next time this happens");
    expect(derived("field_application", fixed)).toContain("The next time this happens");
    expect(validateEditedReview(fixed, REQUIRED, {}, PREVIEW_ANSWERS)).toEqual({ ok: true });
  });

  it("G8: a legacy stored moment no longer competes with the host's", () => {
    /*
      A v1-v8 proposal carried its own model-authored moment, and it used to render when the
      trigger could not fold. No section renders a moment noun phrase now, so the legacy field
      cannot reach a participant — which is the same guarantee, reached by removing the fork.
    */
    const legacy: ProgramContracts = {
      ...withTrigger("before leaving the floor"),
      application: { applicationMoment: "next shift change" },
    };
    expect(applicationMomentFor(legacy)).toBe("before leaving the floor");
    expect(derived("action_decision", legacy)).not.toContain("next shift change");
    expect(derived("field_application", legacy)).not.toContain("next shift change");
    expect(derivesFrom("action_decision", legacy)).toBe(true);
  });

  it("ownership is stable while availability changes", () => {
    for (const trigger of ["at each handoff point", "before leaving the floor", "whenever a deadline moves"]) {
      const c = withTrigger(trigger);
      for (const kind of ["observable_standard", "action_decision", "field_application", "scenario", "completion_check", "follow_up", "why_it_matters"] as const) {
        expect(derivesFrom(kind, c), `${trigger}/${kind}`).toBe(true);
      }
      // A narrative kind is never BTY's.
      expect(derivesFrom("evidence", c)).toBe(false);
      expect(derivesFrom("reflection", c)).toBe(false);
    }
    // …and WHY THIS MATTERS goes back to the Host when there is no problem to ground it in.
    expect(derivesFrom("why_it_matters", { ...PREVIEW_CONTRACTS, problemStatement: "" })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// R10-A.2 — BEFORE YOU FINISH is subordinate to the one moment
// ---------------------------------------------------------------------------

describe("[3.2L-R10-A.2] no section may create a second operational moment", () => {
  const withTrigger = (trigger: string): ProgramContracts => ({
    ...PREVIEW_CONTRACTS,
    behavior: { ...PREVIEW_CONTRACTS.behavior, trigger },
  });

  it("G1: the 'next time' side door is closed — now by naming no occasion at all", () => {
    /*
      R10-A.2 closed it by going quiet when the host's phrase could not be folded. 3.2P-R3.7
      closes it further: none of these three sections names an occasion any more, so there is no
      occasion for a participant to invent and nothing to fall silent about. The one moment in
      the program is the host's, stated where it renders correctly.
    */
    const broken = withTrigger("before leaving the floor");
    expect(derivesFrom("completion_check", broken)).toBe(true);
    for (const kind of ["completion_check", "action_decision", "field_application"] as const) {
      const q = derived(kind, broken)!;
      expect(q, kind).toMatch(/next time this happens/i);
      expect(q, kind).not.toContain("leaving the floor");
    }
  });

  it("G2: the valid state anchors the question to the derived first instance", () => {
    /*
      Wording updated in Slice 3.2O-R1: the question used to end "…to follow this standard",
      which named a construct the behaviour contract may never have defined and which BTY's
      own dependency graph then refused. The property G2 exists to protect — the question is
      anchored to the DERIVED first instance — is unchanged and still asserted.
    */
    expect(derived("completion_check")).toBe(
      "The next time this happens, what exactly will you do?",
    );
    // It never asks WHEN, and it does not repeat the standard verbatim.
    expect(derived("completion_check")).not.toMatch(/when is the next time/i);
    expect(derived("completion_check")).not.toContain("state each unfinished item");
    // And it introduces no construct of its own.
    expect(derived("completion_check")).not.toMatch(/\bthis standard\b/i);
  });

  it("G3: it moves with the trigger, from the same authority", () => {
    const c = withTrigger("at each morning huddle");
    expect(derived("completion_check", c)).toBe(
      "The next time this happens, what exactly will you do?",
    );
    // The host's moment appears where it is STATED — the standard and the scenario. The three
    // derived sections point at its next occurrence without naming it (3.2P-R3.7).
    for (const kind of ["observable_standard", "scenario"] as const) {
      expect(derived(kind, c), kind).toContain("morning huddle");
    }
    for (const kind of ["action_decision", "field_application", "completion_check"] as const) {
      expect(derived(kind, c), kind).toMatch(/next time this happens/i);
    }
  });

  it("every enum pair is moment-free or moment-derived, never moment-inventing", () => {
    for (const verificationTarget of ["the_behaviour", "the_application_plan", "the_confirmation_step"] as const) {
      for (const responseMode of ["name_the_moment", "state_what_you_will_say", "name_what_could_stop_you"] as const) {
        const ok = { ...PREVIEW_CONTRACTS, completion: { verificationTarget, responseMode } };
        const bad = { ...withTrigger("before leaving the floor"), completion: { verificationTarget, responseMode } };
        const q = derived("completion_check", ok);
        expect(q, `${verificationTarget}/${responseMode}`).not.toBeNull();
        expect(q!.endsWith("?"), q!).toBe(true);
        expect(q, `${verificationTarget}/${responseMode}`).not.toMatch(/when is the next time/i);
        // 3.2P-R3.7: no pair reads the host's moment any more, so none of them can go quiet
        // for its phrasing — and none can invent an occasion either.
        expect(derived("completion_check", bad), `${verificationTarget}`).not.toBeNull();
        if (responseMode === "name_the_moment") expect(q).toContain("The next time this happens,");
      }
    }
  });

  it("G8/G9: no second moment control, and no narrative escape", () => {
    const ids = Object.values(DETAIL_FIELDS).flat().map((f) => f?.id);
    expect(ids).not.toContain("moment");
    expect(ids).not.toContain("moment-apply");
    // BEFORE YOU FINISH is edited by two closed enums, never free text.
    for (const f of DETAIL_FIELDS.completion_check ?? []) expect(f.options, f.id).toBeDefined();
  });

  it("G10: the question stays a plan, and claims nothing happened", () => {
    const q = derived("completion_check")!;
    for (const claim of ["you did", "you have", "confirmed that you", "shows that", "proves"]) {
      expect(q.toLowerCase(), claim).not.toContain(claim);
    }
    expect(outcomeClaimIndex(q)).toBe(-1);
    // The ceiling is unchanged and still says a written answer is not competence.
    expect(PREVIEW_EVIDENCE_CEILING).toContain("A written answer shows reflection, not competence.");
  });
});

// ---------------------------------------------------------------------------
// R11 — AI proposal → human Apply → canonical draft journey
// ---------------------------------------------------------------------------

describe("[3.2L-R11] the Apply merge preserves what it does not own", () => {
  /** The EXACT live seed on canonical draft 093b0361, copied verbatim. */
  const SEED: RealityGroundedJourneyV1 = {
    version: 1,
    displayTitle: "Our handoffs are inconsistent.",
    displayTitleStatus: "grounded",
    elements: [
      { id: "el_why_it_matters", kind: "why_it_matters", content: "Our handoffs are inconsistent.", grounding: [{ sourceType: "host_statement", field: "problem" }], confirmationStatus: "grounded" },
      { id: "el_observable_standard", kind: "observable_standard", content: "Create a shared handoff standard.", grounding: [{ sourceType: "host_statement", field: "observableBehavior" }], confirmationStatus: "grounded" },
      { id: "el_evidence", kind: "evidence", content: "Handoff record", grounding: [{ sourceType: "host_statement", field: "successEvidence" }], confirmationStatus: "grounded" },
      { id: "el_completion_check", kind: "completion_check", content: "What specific elements will you include in your handoff record to align with the shared handoff standard?", grounding: [{ sourceType: "host_statement", field: "completionPrompt" }], confirmationStatus: "grounded" },
    ],
  };
  const useAll = PREVIEW_PROPOSAL.elements.map((e) => ({ kind: e.kind, decision: "use" as const, editedContent: e.content }));
  const applied = () => applyProgramProposal(SEED, PREVIEW_PROPOSAL, useAll, { titleDecision: "use" });

  it("G6/G12: the merge is deterministic, ordered and duplicate-free", () => {
    const out = applied();
    expect(validateJourney(out)).toEqual([]);
    const kinds = out.elements.map((e) => e.kind);
    expect(new Set(kinds).size).toBe(kinds.length);
    expect(kinds).toEqual([...kinds].sort((a, b) => JOURNEY_KIND_ORDER.indexOf(a) - JOURNEY_KIND_ORDER.indexOf(b)));
    expect(out.elements.every((e) => e.id === `el_${e.kind}`)).toBe(true);
  });

  it("G7: grounded evidence the proposal does not own survives BYTE-IDENTICALLY", () => {
    const before = SEED.elements.find((e) => e.kind === "evidence")!;
    const after = applied().elements.find((e) => e.kind === "evidence")!;
    expect(JSON.stringify(after)).toBe(JSON.stringify(before));
  });

  it("a proposal missing any kind never deletes grounded content", () => {
    for (const drop of ["completion_check", "why_it_matters", "observable_standard"] as const) {
      const partial = { ...PREVIEW_PROPOSAL, elements: PREVIEW_PROPOSAL.elements.filter((e) => e.kind !== drop) };
      const out = applyProgramProposal(SEED, partial, useAll.filter((c) => c.kind !== drop), { titleDecision: "use" });
      const kept = out.elements.find((e) => e.kind === drop)!;
      const seeded = SEED.elements.find((e) => e.kind === drop)!;
      expect(JSON.stringify(kept), drop).toBe(JSON.stringify(seeded));
    }
  });

  it("G9/G11: adoption is not authorship", () => {
    const out = applied();
    for (const kind of ["why_it_matters", "observable_standard", "scenario", "field_application"] as const) {
      expect(readProvenance(out.elements.find((e) => e.kind === kind)), kind).toBe("ai_proposed");
      expect(attributionKind(out.elements.find((e) => e.kind === kind)), kind).toBe("bty_authored");
    }
    // The preserved Host seed keeps its own authority.
    expect(readProvenance(out.elements.find((e) => e.kind === "evidence"))).toBe("host_statement");
    expect(attributionKind(out.elements.find((e) => e.kind === "evidence"))).toBe("from_host");
  });

  it("G10: a Host edit before Apply becomes host_edited, and a Host seed stays host_statement", () => {
    const edited = useAll.map((c) => (c.kind === "scenario" ? { ...c, decision: "edit" as const, editedContent: "My own words." } : c));
    const out = applyProgramProposal(SEED, PREVIEW_PROPOSAL, edited, { titleDecision: "use" });
    expect(readProvenance(out.elements.find((e) => e.kind === "scenario"))).toBe("host_edited");
    // Editing a section the HOST originally wrote leaves it theirs, not "host_edited AI".
    const editedSeed = useAll.map((c) => (c.kind === "why_it_matters" ? { ...c, decision: "edit" as const, editedContent: "Reworded." } : c));
    const out2 = applyProgramProposal(SEED, PREVIEW_PROPOSAL, editedSeed, { titleDecision: "use" });
    expect(readProvenance(out2.elements.find((e) => e.kind === "why_it_matters"))).toBe("host_statement");
  });

  it("G8: Apply upgrades no evidence level", () => {
    const out = applied();
    // `confirmationStatus` says the Host confirmed the section for the journey; it is not
    // an evidence level, and the ceiling itself is never written by Apply.
    expect(out.elements.every((e) => e.confirmationStatus === "grounded")).toBe(true);
    expect(JSON.stringify(out)).not.toContain("observed");
    expect(JSON.stringify(out)).not.toContain("sustained");
    expect(PREVIEW_EVIDENCE_CEILING).toContain("not observed behavior");
  });

  it("G13: applying the same proposal twice is idempotent", () => {
    const once = applied();
    const twice = applyProgramProposal(once, PREVIEW_PROPOSAL, useAll, { titleDecision: "use" });
    expect(JSON.stringify(twice)).toBe(JSON.stringify(once));
  });

  it("G16/G17/G18/G19: the applied journey keeps the V9 authorities", () => {
    const out = applied();
    const text = (k: string) => out.elements.find((e) => e.kind === k)!.content;
    expect(text("observable_standard")).toContain("At each handoff point");
    expect(text("action_decision")).toContain("the next time this happens");
    expect(text("field_application")).toContain("The next time this happens");
    expect(text("completion_check")).toContain("The next time this happens");
    for (const k of ["observable_standard", "scenario", "field_application"]) {
      expect(text(k), k).toContain(PREVIEW_ANSWERS.successEvidence!);
    }
    expect(text("follow_up")).toContain("That is your own account of it, not an observation.");
    expect(text("why_it_matters")).toContain("Our handoffs are inconsistent");
  });

  it("G14/G15: the fingerprint moves on a semantic change and not on navigation", () => {
    const base = programContextFingerprint(programContext(PREVIEW_ANSWERS)!);
    expect(base).toBe(PREVIEW_FINGERPRINT);
    // Navigation carries no answers change, so the authority is identical.
    expect(programContextFingerprint(programContext({ ...PREVIEW_ANSWERS })!)).toBe(base);
    // A provider-authoritative answer change moves it.
    const changes: BuilderAnswers[] = [
      { ...PREVIEW_ANSWERS, problem: "Our handovers drop things." },
      { ...PREVIEW_ANSWERS, observableBehavior: "Write a handoff note." },
      { ...PREVIEW_ANSWERS, followUpDays: 30 },
    ];
    for (const changed of changes) {
      expect(programContextFingerprint(programContext(changed)!)).not.toBe(base);
    }
  });

  it("G20: filtered assumptions are not resurrected by Apply", () => {
    expect(PREVIEW_PROPOSAL.assumptions).toEqual([]);
    expect(JSON.stringify(applied())).not.toContain("willing to commit");
  });
});
