import { describe, expect, it } from "vitest";
import {
  FIXTURE_IDENTITY,
  PREVIEW_ANSWERS,
  PREVIEW_CONTRACTS,
  PREVIEW_EVIDENCE_CEILING,
  PREVIEW_PROPOSAL,
  V7_LIVE,
} from "./fixture";
import {
  deriveEvidenceCeiling,
  deriveInstructionalContent,
  outcomeClaimIndex,
  retainGroundedAssumptions,
  validateEditedReview,
  PROGRAM_REJECT_CODES,
  PROGRAM_AUTHORSHIP_VERSION,
  PROGRAM_SCHEMA_NAME,
  type ProgramContracts,
} from "@/domain/foundry/module/program-authorship";
import { resolveRefusalCopy } from "@/components/foundry/event-rooms/programRefusalCopy";
import { DETAIL_FIELDS, FIELD_GROUP_HEADING } from "@/components/foundry/event-rooms/programReviewFields";
import {
  isJointConfirmer,
  namesIndependentMoment,
  renderCounterpartQuestion,
  validateScenarioContract,
  applicationMatchesTrigger,
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

const withCompletion = (confirmedBy: string, confirmationAction: string): ProgramContracts => ({
  ...PREVIEW_CONTRACTS,
  behavior: { ...PREVIEW_CONTRACTS.behavior, completion: { confirmedBy, confirmationAction } },
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
    expect(shown()).toContain("repeat back who owns the next step");
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
// G5–G10 — counterpart-aware follow-up
// ---------------------------------------------------------------------------

describe("[3.2L-R9] G5 — the exact live follow-up line cannot render", () => {
  it("'the same question' is gone for a counterpart confirmer", () => {
    const f = derived("follow_up")!;
    expect(f).not.toContain("will be asked the same question");
    expect(f).not.toContain("The person on the other side of it");
    expect(f).toContain("will be asked a different question");
  });
});

describe("[3.2L-R9] G6/G7 — two roles, two questions", () => {
  it("G6: the actor is asked about performing the actor's action", () => {
    expect(derived("follow_up")).toContain(
      "In 7 days you will be asked what happened after you were expected to state each unfinished item and identify its next owner",
    );
  });

  it("G7: the counterpart is asked about witnessing it and doing the confirming", () => {
    const q = renderCounterpartQuestion(PREVIEW_CONTRACTS.behavior);
    expect(q).toBe(
      "Did you see or hear team members state each unfinished item and identify its next owner, " +
        "and did you repeat back who owns the next step?",
    );
    // It must NOT ask the counterpart whether they performed the actor's action.
    expect(q).not.toMatch(/^Did you state each unfinished item/i);
  });

  it("the actor is told what the counterpart will be asked, in their own terms", () => {
    expect(derived("follow_up")).toContain(
      "The receiving team member will be asked a different question: did they see or hear you " +
        "state each unfinished item and identify its next owner, and did they repeat back who owns the next step?",
    );
  });
});

describe("[3.2L-R9] G8 — the counterpart question comes from the completion authority", () => {
  it("changing the confirmer changes who is asked, everywhere", () => {
    const c = withCompletion("the next owner", "confirm they understand what they are taking on");
    expect(renderCounterpartQuestion(c.behavior)).toContain("and did you confirm they understand what they are taking on?");
    expect(derived("follow_up", c)).toContain("The next owner will be asked a different question");
    expect(derived("follow_up", c)).not.toContain("receiving team member");
  });

  it("changing the confirmation action changes what they are asked", () => {
    const c = withCompletion("the receiving team member", "sign the handover sheet");
    expect(renderCounterpartQuestion(c.behavior)).toContain("and did you sign the handover sheet?");
    expect(derived("follow_up", c)).toContain("did they sign the handover sheet?");
  });
});

describe("[3.2L-R9] G10 — every confirmer shape renders role-correctly", () => {
  it("the three individual shapes", () => {
    for (const who of ["the receiving team member", "the next owner", "the incoming team member"]) {
      const c = withCompletion(who, "repeat back who owns the next step");
      expect(isJointConfirmer(who), who).toBe(false);
      const q = renderCounterpartQuestion(c.behavior);
      expect(q.startsWith("Did you see or hear "), q).toBe(true);
      expect(q.endsWith("did you repeat back who owns the next step?"), q).toBe(true);
      const f = derived("follow_up", c)!;
      expect(f, who).toContain(`${who.charAt(0).toUpperCase()}${who.slice(1)} will be asked a different question`);
    }
  });

  it("'both people' gets ONE shared question, and only that", () => {
    const c = withCompletion("both people", "agree who owns the next step");
    expect(isJointConfirmer("both people")).toBe(true);
    // Asking a pair whether they saw the actor act is false for half the audience.
    const q = renderCounterpartQuestion(c.behavior);
    expect(q).toBe("Did you agree who owns the next step?");
    expect(q).not.toContain("see or hear");

    const f = derived("follow_up", c)!;
    /*
      G1 — THE EXACT PHYSICAL FAILURE. R9 appended the shared question to the actor's own
      one, so the actor got two questions and the second person got one.
    */
    expect(f).toBe(
      "In 7 days, both people will be asked one shared question: Did you agree who owns the next step? " +
        "Each answer is a report, not an independent observation.",
    );
    // G3 — no actor-only question survives.
    expect(f).not.toContain("you will be asked what happened after you were expected to");
    expect(f).not.toContain("will be asked a different question");
    // G2 — exactly one substantive question.
    expect((f.match(/\?/g) ?? []).length).toBe(1);
    // G5 — none of the awkward R9 copy.
    for (const bad of ["the same one thing", "That is their account too", "person on the other side"]) {
      expect(f, bad).not.toContain(bad);
    }
    // G4 — still a report, never an observation by BTY.
    expect(f).toContain("Each answer is a report, not an independent observation.");
  });

  it("a joint confirmer only takes over when the other party is actually asked", () => {
    // The enum decides WHO is asked; the completion authority decides the shape.
    const c = { ...withCompletion("both people", "agree who owns the next step"), followUp: { reviewFocus: "what_happened_next", confirmer: "self_report" } as const };
    const f = derived("follow_up", c)!;
    expect(f).toContain("In 7 days you will be asked what happened after you were expected to");
    expect(f).toContain("That is your own account of it, not an observation.");
    expect(f).not.toContain("one shared question");
  });

  it("the other joint spellings are recognised too", () => {
    for (const who of ["both people", "the two of you", "everyone in the room", "each of you", "all three"]) {
      expect(isJointConfirmer(who), who).toBe(true);
    }
    for (const who of ["the next owner", "your manager", "the duty pharmacist"]) {
      expect(isJointConfirmer(who), who).toBe(false);
    }
  });
});

describe("[3.2L-R9] G9 — both answers stay reports", () => {
  it("the follow-up says so on its face", () => {
    const f = derived("follow_up")!;
    expect(f).toContain("That is your own account of it, not an observation.");
    expect(f).toContain("Their answer is a report too.");
    expect(f).not.toMatch(/BTY (?:saw|observed|verified)/i);
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
        "It is complete when you see the receiving team member repeat back who owns the next step.",
    );
    expect(derived("scenario")).toBe(
      "At each handoff point, even when a tight deadline is approaching and teammates are waiting for information, " +
        "team members must state each unfinished item and identify its next owner. " +
        "It is complete when you see the receiving team member repeat back who owns the next step.",
    );
    expect(derived("action_decision")).toBe(
      "At my next handoff point, I will state each unfinished item and identify its next owner.",
    );
    expect(derived("field_application")).toContain(
      "At the next handoff point, team members must state each unfinished item and identify its next owner.",
    );
  });

  it("one trigger, one completion authority, aligned application", () => {
    const clause = "you see the receiving team member repeat back who owns the next step";
    for (const kind of ["observable_standard", "scenario", "field_application"] as const) {
      expect(derived(kind), kind).toContain(clause);
    }
    expect(namesIndependentMoment(PREVIEW_CONTRACTS.scenario!.pressureCondition)).toBe(false);
    expect(applicationMatchesTrigger(V7_LIVE.applicationMoment, PREVIEW_CONTRACTS.behavior.trigger)).toBe(true);
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
    expect(FIXTURE_IDENTITY).toBe("R8.1 V7 live result b6842a08");
    expect(FIXTURE_IDENTITY.length).toBeLessThanOrEqual(40);
  });

  it("every displayed section is derived from one object", () => {
    expect(PREVIEW_PROPOSAL.displayTitle).toBe(V7_LIVE.displayTitle);
    for (const kind of REQUIRED) {
      expect(PREVIEW_PROPOSAL.elements.find((e) => e.kind === kind)?.content, kind).toBe(derived(kind));
    }
  });

  it("the authority version moves but the wire schema does not", () => {
    // The elements array, the contracts and every field are byte-identical on the wire;
    // what changed is who authors WHY THIS MATTERS. Reconciliation still has to tell the
    // two apart, so the authorship version increments and the schema name does not.
    expect(PROGRAM_AUTHORSHIP_VERSION).toBe("program_authorship_v8");
    expect(PROGRAM_SCHEMA_NAME).toBe("bty_guided_program_v7");
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

  it("G1/G2: each control names the ROLE, not just 'Who'", () => {
    expect(standard.find((f) => f.id === "actor")!.label).toBe("Who takes the action?");
    expect(standard.find((f) => f.id === "confirmed-by")!.label).toBe("Who confirms the action is complete?");
    expect(standard.find((f) => f.id === "action")!.label).toBe("What would you see or hear them do?");
    expect(standard.find((f) => f.id === "completion")!.label).toBe("What do they do to confirm it?");
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

  it("G3: the five fields fall into exactly two named groups, in order", () => {
    expect(standard.map((f) => f.group)).toEqual(["action", "action", "action", "completion", "completion"]);
    expect(FIELD_GROUP_HEADING.action).toBe("The action");
    expect(FIELD_GROUP_HEADING.completion).toBe("How completion is confirmed");
  });

  it("no internal vocabulary reaches a label or a heading", () => {
    const shown = [...labels, ...Object.values(FIELD_GROUP_HEADING)].join(" ").toLowerCase();
    for (const internal of ["actor", "contract", "confirmer", "behavior", "behaviour", "field", "trigger", "schema"]) {
      expect(shown, internal).not.toContain(internal);
    }
  });

  it("G4: the same values still produce byte-identical sentences", () => {
    // Labels are presentation. Every control still reads and writes the same contract field.
    const get = (id: string) => standard.find((f) => f.id === id)!;
    expect(get("actor").get(PREVIEW_CONTRACTS)).toBe(PREVIEW_CONTRACTS.behavior.actor);
    expect(get("confirmed-by").get(PREVIEW_CONTRACTS)).toBe(PREVIEW_CONTRACTS.behavior.completion.confirmedBy);
    expect(get("completion").get(PREVIEW_CONTRACTS)).toBe(PREVIEW_CONTRACTS.behavior.completion.confirmationAction);
    expect(derived("observable_standard")).toBe(
      "At each handoff point, team members must state each unfinished item and identify its next owner. " +
        "It is complete when you see the receiving team member repeat back who owns the next step.",
    );
  });

  it("G6/G7: each control writes ONLY its own field", () => {
    const get = (id: string) => standard.find((f) => f.id === id)!;
    // "both people" typed under the CONFIRMER control moves the confirmer, not the actor.
    const asConfirmer = get("confirmed-by").set(PREVIEW_CONTRACTS, "both people");
    expect(asConfirmer.behavior.completion.confirmedBy).toBe("both people");
    expect(asConfirmer.behavior.actor).toBe("team members");

    // …and typed under the ACTOR control it moves the actor, and never enters the joint branch.
    const asActor = get("actor").set(PREVIEW_CONTRACTS, "both people");
    expect(asActor.behavior.actor).toBe("both people");
    expect(asActor.behavior.completion.confirmedBy).toBe("the receiving team member");
    expect(derived("follow_up", asActor)).toContain("The receiving team member will be asked a different question");
    expect(derived("follow_up", asActor)).not.toContain("one shared question");
  });

  it("G8/G9: the joint branch is reached from the confirmer control, and released again", () => {
    const get = (id: string) => standard.find((f) => f.id === id)!;
    const joint = get("completion").set(get("confirmed-by").set(PREVIEW_CONTRACTS, "both people"), "agree who owns the next step");
    expect(derived("follow_up", joint)).toBe(
      "In 7 days, both people will be asked one shared question: Did you agree who owns the next step? " +
        "Each answer is a report, not an independent observation.",
    );
    const back = get("confirmed-by").set(joint, "the next owner");
    expect(derived("follow_up", back)).toContain("The next owner will be asked a different question: did they see or hear you");
    expect(derived("follow_up", back)).not.toContain("one shared question");
  });
});
