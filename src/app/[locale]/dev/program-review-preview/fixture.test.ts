import { describe, expect, it } from "vitest";
import {
  FIXTURE_IDENTITY,
  PREVIEW_ANSWERS,
  PREVIEW_CONTRACTS,
  PREVIEW_EVIDENCE_CEILING,
  PREVIEW_PROPOSAL,
  V5_LIVE,
  WHY_IT_MATTERS_SHOWN,
  withoutOutcomeClaim,
} from "./fixture";
import {
  deriveEvidenceCeiling,
  deriveInstructionalContent,
  validateEditedReview,
} from "@/domain/foundry/module/program-authorship";
import {
  namesIndependentMoment,
  renderScenarioSentence,
  validateScenarioContract,
  applicationMatchesTrigger,
  type ScenarioContract,
} from "@/domain/foundry/module/program-coherence";

/**
 * SLICE 3.2L-R8.1 — the four defects the R8 physical gate found, as failing-first gates.
 *
 * The gate itself passed on completion authority and grammar, and failed on: a scenario and
 * a trigger that were still two different moments; a preview fixture that mixed a live
 * result with an older invented narrative; two evidence-ceiling paragraphs; and provenance
 * badges that did not describe the sentence next to them.
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

const derived = (kind: (typeof REQUIRED)[number]) => deriveInstructionalContent(kind, PREVIEW_CONTRACTS);

describe("[3.2L-R8.1] G1 — the preview replays ONE source object", () => {
  it("every displayed proposal value traces to V5_LIVE or to the derivation over it", () => {
    expect(PREVIEW_PROPOSAL.displayTitle).toBe(V5_LIVE.displayTitle);
    expect(PREVIEW_PROPOSAL.behaviorContract).toEqual(PREVIEW_CONTRACTS.behavior);
    expect(PREVIEW_PROPOSAL.applicationContract?.applicationMoment).toBe(V5_LIVE.applicationMoment);
    // Instructional sections are RENDERED, never authored in the fixture.
    for (const kind of REQUIRED) {
      const d = derived(kind);
      if (d === null) continue;
      expect(PREVIEW_PROPOSAL.elements.find((e) => e.kind === kind)?.content).toBe(d);
    }
  });

  it("no string from the retired shift-handover fixture survives anywhere", () => {
    const blob = JSON.stringify(PREVIEW_PROPOSAL) + JSON.stringify(PREVIEW_ANSWERS) + PREVIEW_EVIDENCE_CEILING;
    for (const stale of [
      "Handing over what isn’t finished",
      "When a shift ends",
      "Handovers happen at a predictable shift change",
      "shifts are scheduled with no overlap",
      "the outgoing team member",
      "the person taking over",
    ]) {
      expect(blob, stale).not.toContain(stale);
    }
  });

  it("carries a short, safe fixture identity for the recording", () => {
    expect(FIXTURE_IDENTITY).toBe("R7 V5 live result c9718bd3");
    expect(FIXTURE_IDENTITY.length).toBeLessThanOrEqual(40);
  });
});

describe("[3.2L-R8.1] G2 — the live title and narrative, handled honestly", () => {
  it("uses the recorded v5 title", () => {
    expect(PREVIEW_PROPOSAL.displayTitle).toBe("Improving Handoff Consistency");
  });

  it("cuts the recorded outcome promise at the phrase the validator refuses on", () => {
    expect(V5_LIVE.whyItMattersRecorded).toContain("ultimately affects project success");
    expect(WHY_IT_MATTERS_SHOWN).not.toContain("ultimately affects");
    expect(WHY_IT_MATTERS_SHOWN).toContain("Establishing a consistent handoff standard");
    // Ends on terminal punctuation, with no dangling connective and no doubled stop.
    expect(WHY_IT_MATTERS_SHOWN).toMatch(/[.…?!]$/u);
    expect(WHY_IT_MATTERS_SHOWN).not.toMatch(/[,;:—–-]\s*[.…]$/u);
    expect(WHY_IT_MATTERS_SHOWN).not.toContain("….");
    // The elision is preserved: the middle of the live narrative was never stored.
    expect(WHY_IT_MATTERS_SHOWN.endsWith("…")).toBe(true);
  });

  it("the cut is driven by the phrase list, not a hard-coded substring", () => {
    expect(withoutOutcomeClaim("Handoffs slip and this equipped to lead teams.")).toBe("Handoffs slip and this.");
    expect(withoutOutcomeClaim("Handoffs slip when nobody says what is left.")).toBe(
      "Handoffs slip when nobody says what is left.",
    );
  });
});

describe("[3.2L-R8.1] G3 — assumption and warning fidelity", () => {
  it("carries no assumption or warning that was never recorded for this proposal", () => {
    expect(PREVIEW_PROPOSAL.assumptions).toEqual([]);
    expect(PREVIEW_PROPOSAL.warnings).toEqual([]);
  });
});

describe("[3.2L-R8.1] G4/G5 — one trigger, and the exact physical failure", () => {
  it("IN CONTEXT opens on the canonical trigger and stitches no second moment", () => {
    const s = derived("scenario")!;
    expect(s.startsWith("At the end of each project or task,")).toBe(true);
    expect(s).not.toContain("Even then");
    expect(s).not.toContain("During a team meeting");
    expect(s).not.toContain("In during");
  });

  it("the EXACT live pair can no longer render as two stitched moments", () => {
    // v5's own values. The pressure is a condition and survives; the context named its own
    // occasion, and the v7 contract has nowhere to put it.
    const s = renderScenarioSentence(PREVIEW_CONTRACTS.behavior, {
      pressureCondition: V5_LIVE.scenarioV5.pressureOrConstraint,
      pressureDetail: "",
    });
    expect(s).toBe(
      "At the end of each project or task, even when a tight deadline is approaching and team members are waiting for information, " +
        "each team member must state each unfinished item and identify its next owner. " +
        "It is complete when you see the next owner confirm they understand what they are taking on.",
    );
    expect(s.indexOf("at the end of each project or task")).toBe(-1); // exactly one, and it leads
  });

  it("a pressure that smuggles in its own occasion is refused, not rendered", () => {
    for (const smuggled of [
      V5_LIVE.scenarioV5.contextDetail,
      "at the next handover the other person has already left",
      "before the deadline someone is already waiting",
      "at the end of each project people are rushing",
      "when the shift ends nobody is left to tell",
    ]) {
      expect(namesIndependentMoment(smuggled), smuggled).toBe(true);
      const r = validateScenarioContract(
        { pressure_condition: smuggled, pressure_detail: null },
        PREVIEW_CONTRACTS.behavior,
      );
      expect(r.ok, smuggled).toBe(false);
      if (!r.ok) expect(r.defect.reason).toBe("independent_moment");
    }
  });

  it("a genuine pressure condition that merely mentions a noun is not refused", () => {
    for (const ok of [
      "a tight deadline is approaching and team members are waiting for information",
      "two people are already waiting to ask you something else and the shift ran late",
      "a senior colleague disagrees in front of everyone",
    ]) {
      expect(namesIndependentMoment(ok), ok).toBe(false);
      expect(validateScenarioContract({ pressure_condition: ok, pressure_detail: null }, PREVIEW_CONTRACTS.behavior).ok, ok).toBe(true);
    }
  });

  it("the optional second condition is joined, and obeys the same rule", () => {
    const two: ScenarioContract = {
      pressureCondition: "a tight deadline is approaching",
      pressureDetail: "the next owner has already left for the day",
    };
    const s = renderScenarioSentence(PREVIEW_CONTRACTS.behavior, two);
    expect(s).toContain("even when a tight deadline is approaching and the next owner has already left for the day,");
    const bad = validateScenarioContract(
      { pressure_condition: two.pressureCondition, pressure_detail: "during the next team meeting" },
      PREVIEW_CONTRACTS.behavior,
    );
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.defect).toEqual({ field: "pressureDetail", reason: "independent_moment" });
  });
});

describe("[3.2L-R8.1] G6 — application alignment survives", () => {
  it("the first real moment is an instance of the trigger", () => {
    expect(applicationMatchesTrigger(V5_LIVE.applicationMoment, PREVIEW_CONTRACTS.behavior.trigger)).toBe(true);
    expect(validateEditedReview(PREVIEW_CONTRACTS, REQUIRED, { why_it_matters: WHY_IT_MATTERS_SHOWN }, PREVIEW_ANSWERS)).toEqual({ ok: true });
  });
});

describe("[3.2L-R8.1] G7 — one completion authority reaches every section", () => {
  it("THE STANDARD, IN CONTEXT and APPLY IT share the same confirmer and act", () => {
    const clause = "you see the next owner confirm they understand what they are taking on";
    for (const kind of ["observable_standard", "scenario", "field_application"] as const) {
      expect(derived(kind), kind).toContain(clause);
    }
  });
});

describe("[3.2L-R8.1] G8/G9 — one honest evidence block", () => {
  it("the proposal's ceiling and the API's ceiling are the same derivation, not two paragraphs", () => {
    expect(PREVIEW_PROPOSAL.evidenceLanguage).toBe(deriveEvidenceCeiling(PREVIEW_ANSWERS));
    expect(PREVIEW_EVIDENCE_CEILING).toBe(PREVIEW_PROPOSAL.evidenceLanguage);
  });

  it("it claims no competence, readiness, adoption, observation or sustained change", () => {
    const t = PREVIEW_PROPOSAL.evidenceLanguage.toLowerCase();
    for (const claim of ["equipped to", "ready to", "now competent", "has adopted", "was observed", "sustained improvement"]) {
      expect(t, claim).not.toContain(claim);
    }
    // What it DOES say is what the journey actually records.
    expect(t).toContain("reflection, not competence");
    expect(t).toContain("rehearsal, never field mastery");
    expect(t).toContain("not observed behavior");
  });

  it("names only the evidence the configured journey actually produces", () => {
    const knowOnly = deriveEvidenceCeiling({ ...PREVIEW_ANSWERS, learningNeeds: ["know"], arenaRecommended: false, followUpDays: 0 });
    expect(knowOnly).not.toContain("Practice is rehearsal");
    expect(knowOnly).not.toContain("scheduled self-report");
    expect(knowOnly).not.toContain("action decision");
  });
});

describe("[3.2L-R8.1] G10/G11 — provenance follows the visible sentence", () => {
  /** The exact comparison the review surface makes. */
  const changed = (next: typeof PREVIEW_CONTRACTS, kind: (typeof REQUIRED)[number]) =>
    deriveInstructionalContent(kind, next) !== deriveInstructionalContent(kind, PREVIEW_CONTRACTS);

  const withConfirmer = {
    ...PREVIEW_CONTRACTS,
    behavior: {
      ...PREVIEW_CONTRACTS.behavior,
      completion: { confirmedBy: "the incoming team member", confirmationAction: "repeat back who owns the next action" },
    },
  };

  it("G10: the exact required case — APPLY IT changes, so APPLY IT is adjusted", () => {
    expect(deriveInstructionalContent("field_application", PREVIEW_CONTRACTS)).toContain(
      "You will know it happened when you see the next owner confirm they understand what they are taking on.",
    );
    expect(deriveInstructionalContent("field_application", withConfirmer)).toContain(
      "You will know it happened when you see the incoming team member repeat back who owns the next action.",
    );
    expect(changed(withConfirmer, "field_application")).toBe(true);
    expect(changed(withConfirmer, "observable_standard")).toBe(true);
    expect(changed(withConfirmer, "scenario")).toBe(true);
  });

  it("G11: sections whose sentence is byte-identical stay Drafted by BTY", () => {
    // The live badge defect, inverted: these two did NOT change and claimed they had.
    expect(deriveInstructionalContent("completion_check", withConfirmer)).toBe(
      deriveInstructionalContent("completion_check", PREVIEW_CONTRACTS),
    );
    expect(changed(withConfirmer, "completion_check")).toBe(false);
    expect(changed(withConfirmer, "follow_up")).toBe(false);
    // And an actor change never reaches YOUR DECISION, which speaks in the first person.
    const withActor = { ...PREVIEW_CONTRACTS, behavior: { ...PREVIEW_CONTRACTS.behavior, actor: "every engineer" } };
    expect(changed(withActor, "action_decision")).toBe(false);
    expect(changed(withActor, "observable_standard")).toBe(true);
  });

  it("G12: restoring the proposed contracts restores every sentence exactly", () => {
    for (const kind of REQUIRED) {
      expect(deriveInstructionalContent(kind, { ...PREVIEW_CONTRACTS }), kind).toBe(derived(kind));
      expect(changed({ ...PREVIEW_CONTRACTS }, kind), kind).toBe(false);
    }
  });
});

describe("[3.2L-R8.1] whole-program coherence (Part 6)", () => {
  it("the title, the narrative and the standard describe one operating problem", () => {
    const words = (s: string) => new Set(s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 4));
    const title = words(PREVIEW_PROPOSAL.displayTitle);
    const shared = [...title].filter((w) => words(WHY_IT_MATTERS_SHOWN).has(w));
    expect(shared.length, `${[...title]}`).toBeGreaterThan(0);
    expect(words(PREVIEW_ANSWERS.problem ?? "").has("unfinished")).toBe(true);
    expect(derived("observable_standard")).toContain("unfinished item");
  });

  it("nothing in the fixture introduces a conflicting trigger", () => {
    const blob = [
      PREVIEW_PROPOSAL.displayTitle,
      WHY_IT_MATTERS_SHOWN,
      ...PREVIEW_PROPOSAL.assumptions,
      ...PREVIEW_PROPOSAL.warnings,
      PREVIEW_PROPOSAL.evidenceLanguage,
    ].join(" ");
    expect(namesIndependentMoment(blob)).toBe(false);
  });

  it("the whole program passes the same deterministic Apply gate the Host's edits do", () => {
    expect(validateEditedReview(PREVIEW_CONTRACTS, REQUIRED, { why_it_matters: WHY_IT_MATTERS_SHOWN }, PREVIEW_ANSWERS)).toEqual({ ok: true });
  });
});
