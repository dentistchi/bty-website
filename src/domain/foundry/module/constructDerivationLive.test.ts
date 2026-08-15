import { describe, it, expect } from "vitest";
import { contractsFromProposal, deriveInstructionalContent, type ProgramProposal } from "./program-authorship";
import { deriveOperationalConstruct, renderApplicationSentence } from "./program-coherence";
import type { BuilderAnswers } from "./module-builder";

/**
 * SLICE 3.2R-R2.3-R2 — a construct extracted by yesterday's code must not outlive the fix.
 *
 * R2.3 repaired the extractor and the pure derivation was clean, yet the Founder still saw
 * "This is the sometimes end with agreement in practice." after the deploy. The forensics:
 * draft `ee79e3b3` has exactly ONE generation attempt, `d36c5309`, produced under
 * `deploy_version 64e559ac` — the R2.1 commit. YOUR DECISION and BEFORE YOU FINISH looked fixed
 * because the review surface RE-DERIVES them from the contracts; APPLY IT did not, because its
 * construct clause renders from `proposal.operationalConstruct`, stored at generation time.
 *
 * The repaired extractor was running the whole time. It was being handed a value it could no
 * longer produce. And Apply writes the currently rendered sentence, so that value was one click
 * from being frozen into a published journey.
 */

/** The Founder's live draft, verbatim from the database. */
const LIVE: BuilderAnswers = {
  observableBehavior: "Before the huddle ends, name one owner and one deadline for each open action item.",
  successEvidence:
    "The huddle notes or action tracker show a named owner and deadline for the next action before the meeting ends.",
  problem: "Team huddles sometimes end with agreement, but no one clearly owns the next action.",
} as unknown as BuilderAnswers;

const BEHAVIOR = {
  actor: "the facilitator",
  trigger: "At the end of a team huddle when there are open action items that need follow-through",
  observableAction: "name one owner and one deadline for each open action item",
  completion: { criterion: LIVE.successEvidence! },
};

/** The malformed construct exactly as R2.1 stored it on the live proposal. */
const STALE_CONSTRUCT = { label: "sometimes end with agreement", noun: "agreement", authorityMode: "host_grounded_existing" as const };

const proposalWith = (construct: unknown): ProgramProposal =>
  ({
    displayTitle: "Close the loop on one commitment",
    elements: [],
    assumptions: [],
    warnings: [],
    evidenceLanguage: "",
    behaviorContract: BEHAVIOR,
    scenarioContract: null,
    applicationContract: { applicationMoment: "The next time this happens" },
    completionContract: { verificationTarget: "the_behaviour", responseMode: "name_the_moment" },
    followUpContract: null,
    operationalConstruct: construct,
  }) as unknown as ProgramProposal;

describe("a stale stored construct can no longer reach the Host", () => {
  it("re-derives from the Host's answers, discarding the stored malformed construct", () => {
    const c = contractsFromProposal(proposalWith(STALE_CONSTRUCT), 7, LIVE.problem, null, LIVE);
    expect(c).not.toBeNull();
    expect(c!.construct).toBeNull();
  });

  it("APPLY IT renders grammatically, and omits the clause entirely", () => {
    const c = contractsFromProposal(proposalWith(STALE_CONSTRUCT), 7, LIVE.problem, null, LIVE)!;
    const apply = deriveInstructionalContent("field_application", c);
    expect(apply).not.toBeNull();
    expect(apply!).not.toContain("sometimes end with agreement");
    expect(apply!).not.toContain("in practice.");
    // The truthful target shape: the behaviour, then the evidence. Nothing invented between them.
    expect(apply!).toContain("The next time this happens, the facilitator must name one owner and one deadline");
    expect(apply!).toContain("You will know it happened by this:");
  });

  it("WITHOUT the answers it still replays the stored construct — so the caller must pass them", () => {
    /*
      The old behaviour, kept reachable and pinned: `contractsFromProposal` is also used by a
      preview fixture that has no answers. This asserts the difference is the parameter, not luck,
      and that the production caller is the thing that must supply it.
    */
    const c = contractsFromProposal(proposalWith(STALE_CONSTRUCT), 7, LIVE.problem, null)!;
    expect(c.construct).toEqual(STALE_CONSTRUCT);
  });

  it("a LEGITIMATE stored construct is re-derived to the same value, not lost", () => {
    const answers = { ...LIVE, observableBehavior: "Follow the shared handoff standard at every shift change." } as BuilderAnswers;
    const c = contractsFromProposal(proposalWith(STALE_CONSTRUCT), 7, answers.problem, null, answers)!;
    expect(c.construct?.label).toBe("shared handoff standard");
    expect(deriveInstructionalContent("field_application", c)!).toContain("This is the shared handoff standard in practice.");
  });
});

describe("PART 6 — construct extraction regression matrix", () => {
  const label = (source: string, field: "problem" | "observableBehavior" = "problem") =>
    deriveOperationalConstruct({ [field]: source } as never)?.label ?? null;

  it("1 — 'sometimes end with agreement' names no construct", () => {
    expect(label("Team huddles sometimes end with agreement, but no one clearly owns the next action.")).toBeNull();
  });

  it("2 — 'a shared escalation checklist' … is not a construct noun, so nothing is invented", () => {
    // `checklist` is deliberately NOT in CONSTRUCT_NOUNS; the vocabulary is closed.
    expect(label("We use a shared escalation checklist for every transfer.")).toBeNull();
  });

  it("2b — a determiner phrase over a REAL construct noun is kept", () => {
    expect(label("We use a shared escalation process for every transfer.")).toBe("shared escalation process");
  });

  it("3 — 'Our handoff standard is …' is preserved", () => {
    expect(label("Our handoff standard is ignored during busy shifts.")).toBe("handoff standard");
  });

  it("4 — 'work around the process' does not become 'the work around the process'", () => {
    const l = label("People often work around the process when the ward is busy.");
    expect(l).not.toContain("work around");
    expect(l).toBe("process"); // the determiner closes the phrase; the verb never enters it
  });

  it("5 — 'Teams sometimes agree verbally' invents nothing", () => {
    expect(label("Teams sometimes agree verbally and never write it down.")).toBeNull();
  });

  it("6 — a preposition directly before the noun blocks it, in every phrasing", () => {
    for (const s of [
      "Shifts end with agreement about the plan.",
      "We settle on a routine and then drift.",
      "They sign off without agreement.",
    ]) {
      const l = label(s);
      // null is the strongest possible pass — no construct was named at all.
      if (l !== null) expect(l, s).not.toMatch(/\b(with|on|without)\b/);
    }
  });

  it("7 — 'the escalation process' is a valid named construct", () => {
    expect(label("The escalation process is not followed after hours.")).toBe("escalation process");
  });

  it("8 — the Founder's exact draft renders grammatical APPLY IT prose", () => {
    const construct = deriveOperationalConstruct({
      observableBehavior: LIVE.observableBehavior,
      successEvidence: LIVE.successEvidence,
      problem: LIVE.problem,
    } as never);
    expect(construct).toBeNull();
    const s = renderApplicationSentence(BEHAVIOR as never, { applicationMoment: "The next time this happens" } as never, construct);
    expect(s).toBe(
      "The next time this happens, the facilitator must name one owner and one deadline for each open action item. " +
        "You will know it happened by this: The huddle notes or action tracker show a named owner and deadline for the next action before the meeting ends.",
    );
  });

  it("no derived construct label ever contains a function word", () => {
    const sources = [
      "Team huddles sometimes end with agreement, but no one clearly owns the next action.",
      "People often work around the process when the ward is busy.",
      "We keep missing the weekly cadence for checking open items.",
      "Handovers rarely follow the process we agreed last year.",
      "Nurses do not always follow the shared handoff standard.",
      "Shift changes seldom end with agreement on what is outstanding.",
      "Our reviews often finish without a clear agreement about next steps.",
    ];
    for (const s of sources) {
      const l = label(s);
      if (l === null) continue;
      expect(l, s).not.toMatch(/\b(with|without|on|for|about|and|but|often|sometimes|rarely|seldom|always|never|keep|end|ends|follow|finish|missing|work)\b/);
    }
  });
});
