import { describe, it, expect } from "vitest";
import { actionNamesMoment, actionNamesActor } from "./program-coherence";

/**
 * SLICE 3.2P-R3.7 — THE ACTION IS THE ACTION.
 *
 * W6 succeeded and could not be used. The model wrote the host's own occasion into
 * `observable_action`, and the renderer — which owns the moment since v13 — prepended it again:
 * "During morning huddles, you must state the owner … DURING MORNING HUDDLES." Auditing the
 * other roles found the same hole: "you state the owner…" rendered as "you must you state…".
 *
 * The prompt had said not to since v13. Nothing checked. These are the check.
 *
 * The corpus below is labelled by SHAPE, not vocabulary, because the naive rule ("reject
 * `daily`, `weekly`, `morning`") refuses ordinary objects — and did, on the first attempt at
 * this file: "write the daily schedule", "update the weekly report" and "enter the weekly total
 * in the log" were all false positives. Those words are adjectives in front of the noun they
 * modify and adverbs when nothing follows, and position is what separates them.
 */

const CORPUS: [string, boolean, string][] = [
  // ---- INVALID: temporal adjuncts (label true) ----
  ["state the owner during morning huddles", true, "WHEN"],
  ["state the owner, action, and deadline for each agreed item during morning huddles", true, "WHEN"],
  ["confirm the deadline every morning", true, "WHEN"],
  ["name the owner at the next huddle", true, "WHEN"],
  ["name the owner whenever a problem is raised", true, "WHEN"],
  ["at each handoff, state the owner", true, "WHEN"],
  ["after the meeting ends, record the decision", true, "WHEN"],
  ["state each item at the end of every shift", true, "WHEN"],
  ["record the decision before each shift", true, "WHEN"],
  ["report the total weekly", true, "WHEN"],
  ["name the owner until the note records it", true, "WHEN/completion"],
  ["confirm the owner every time a task is agreed", true, "WHEN"],
  // ---- VALID: non-temporal objects and ordinary prepositions (label false) ----
  ["write the daily schedule", false, "object"],
  ["update the weekly report", false, "object"],
  ["record the morning reading", false, "object"],
  ["complete the evening checklist", false, "object"],
  ["enter the weekly total in the log", false, "object"],
  ["write them in the huddle note", false, "object"],
  ["name one owner and one deadline for every agreed action", false, "quantifies items"],
  ["state the owner, action, and deadline for each agreed item", false, "quantifies items"],
  ["write the owner and deadline in the shared note", false, "object"],
  ["state each unfinished item and identify its next owner", false, "quantifies items"],
  ["read the dosage back before signing off", false, "ordinary preposition"],
  ["repeat back who owns the next step", false, "ordinary"],
  ["confirm the agreed next step with the person taking over", false, "ordinary"],
  ["hand over the checklist to the person taking the next shift", false, "ordinary"],
  ["ask for the deadline in writing", false, "ordinary"],
];

const SUBJECTS: [string, boolean][] = [
  ["you state the owner and deadline", true],
  ["the leader states the owner and deadline", true],
  ["each member confirms the owner", true],
  ["they name the owner", true],
  ["team members name the owner", false], // documented residual — a bare plural-noun subject
  ["name one owner and one deadline for every agreed action", false],
  ["state the owner, action, and deadline for each agreed item", false],
  ["write them in the huddle note", false],
  ["read the dosage back before signing off", false],
];

describe("R3.7 §6 — expanded labelled corpus", () => {
  it("WHEN rule: precision / recall", () => {
    let tp = 0, fp = 0, fn = 0, tn = 0;
    for (const [a, want, why] of CORPUS) {
      const got = actionNamesMoment(a);
      if (got && want) tp++; else if (got && !want) fp++; else if (!got && want) fn++; else tn++;
      if (got !== want) console.log(`  WRONG (${why}) want=${want} got=${got}  ${JSON.stringify(a)}`);
    }
    const precision = tp / (tp + fp || 1), recall = tp / (tp + fn || 1);
    console.log(`WHEN  tp=${tp} fp=${fp} fn=${fn} tn=${tn}  precision=${precision.toFixed(2)} recall=${recall.toFixed(2)}`);
    // An ordinary object phrase becoming a false positive is disqualifying — it would refuse a
    // real behaviour for containing a calendar word.
    expect(fp, "no clean action may be refused").toBe(0);
    expect(fn, "no temporal adjunct may survive").toBe(0);
  });

  it("WHO rule: high-confidence shapes only", () => {
    let tp = 0, fp = 0, fn = 0, tn = 0;
    for (const [a, want] of SUBJECTS) {
      const got = actionNamesActor(a);
      if (got && want) tp++; else if (got && !want) fp++; else if (!got && want) fn++; else tn++;
      if (got !== want) console.log(`  WRONG want=${want} got=${got}  ${JSON.stringify(a)}`);
    }
    console.log(`WHO   tp=${tp} fp=${fp} fn=${fn} tn=${tn}`);
    expect(fp, "no bare verb phrase may be read as having a subject").toBe(0);
    /*
      THE DOCUMENTED RESIDUAL. "team members name the owner" begins with neither a pronoun nor a
      determiner, and separating a bare plural-noun subject from a verb needs a lexicon this
      system will not build. Asserted so the boundary is a decision rather than a surprise.
    */
    expect(actionNamesActor("team members name the owner")).toBe(false);
  });
});

import { validateProgramProposal, requiredProgramKinds, programSourceBlocker, recurringMomentReadsOnceOnly, PROGRAM_AUTHORSHIP_VERSION, PROGRAM_SCHEMA_NAME, repairLicenseFor } from "./program-authorship";
import { CANONICAL_ACTOR } from "./program-coherence";
import { decideAdoptionReceipt } from "./adoption-authority";
import type { BuilderAnswers } from "./module-builder";

const host = (recurringMoment: string): BuilderAnswers => ({
  arenaRecommended: true, audienceType: "leaders", capabilityCandidate: "Accountability",
  completionPrompt: "What specific phrases will you use to confirm the action owner and deadline?",
  evidenceType: "confirmed", followUpDays: 7, learningNeeds: ["shared_standard", "practice"], materialIntent: "pdf",
  observableBehavior: "Confirm the owner, action, and deadline for every agreed item.",
  problem: "During morning huddles, team members report problems but leave without naming who will act or when the next step will happen.",
  recurringMoment,
  sharedQuestion: "In your own words, what is the most important standard from this training?",
  successEvidence: "The huddle note records one owner and one deadline for every agreed action.",
} as unknown as BuilderAnswers);

const CLEAN_ACTION = "state the owner, action, and deadline for each agreed item";
const propose = (action: string, h: BuilderAnswers) => {
  const kinds = requiredProgramKinds(h);
  const c: Record<string, string> = {
    why_it_matters: "When a discussion ends without a named owner and a deadline, the problem stays where it was.",
    observable_standard: "Name one owner and one deadline for every agreed action before the group moves on.",
    scenario: "The group is running late and people are already standing to leave.",
    reflection: "In your own words, what is the most important standard from this training?",
    field_application: "Name one owner and one deadline for every agreed action and write them in the huddle note.",
    completion_check: "What exactly will you say to name the owner and the deadline?",
    follow_up: "You will be asked what you actually said.",
  };
  return validateProgramProposal({
    program: {
      display_title: "End every discussion with an owner and a deadline",
      elements: kinds.map((k) => ({ kind: k, content: c[k], rationale: "grounded in the host's own answers" })),
      assumptions: ["the team meets regularly"], warnings: ["a meeting nobody attends is an attendance problem"],
      behavior_contract: { observable_action: action },
      scenario_contract: { pressure_condition: "the group is running late and people are already standing to leave", pressure_detail: null },
      completion_contract: { verification_target: "the_behaviour", response_mode: "state_what_you_will_say" },
      follow_up_contract: { review_focus: "what_you_said", confirmer: "self_report" },
    },
  }, h, ["education.pdf"]);
};

describe("[3.2P-R3.7] A/B/C — the floor, end to end", () => {
  it("A — a pure action is accepted, and the moment appears exactly once", () => {
    const r = propose(CLEAN_ACTION, host("During morning huddles"));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const s = r.value.proposal.elements.find((e) => e.kind === "observable_standard")!.content;
    expect(s).toBe(
      "During morning huddles, you must state the owner, action, and deadline for each agreed item. " +
        "Completion evidence: The huddle note records one owner and one deadline for every agreed action.",
    );
    expect(s.toLowerCase().split("during morning huddles").length - 1, "the moment appears once").toBe(1);
  });

  it("B/C — an action that repeats or relocates the moment is refused, with its own reason", () => {
    for (const a of [
      `${CLEAN_ACTION} during morning huddles`,          // W6's exact shape
      "state the owner at the next huddle",
      "confirm the owner every morning",
      "after the meeting ends, record the decision",
    ]) {
      const r = propose(a, host("During morning huddles"));
      expect(r.ok, a).toBe(false);
      if (r.ok) continue;
      expect(r.code).toBe("non_observable_standard");
      expect(r.contract).toEqual({ field: "observableAction", reason: "action_reclaims_authority" });
    }
  });

  it("a subject the sentence already has is refused too", () => {
    for (const a of ["you state the owner and deadline", "the leader states the owner and deadline"]) {
      const r = propose(a, host("During morning huddles"));
      expect(r.ok, a).toBe(false);
      if (!r.ok) expect(r.contract?.reason).toBe("action_reclaims_authority");
    }
  });

  it("D/E/F — ordinary object phrases are NOT refused", () => {
    for (const a of ["write the daily schedule", "update the weekly report", "write them in the huddle note"]) {
      expect(actionNamesMoment(a), a).toBe(false);
      expect(actionNamesActor(a), a).toBe(false);
    }
  });
});

describe("[3.2P-R3.7] J–N — every real moment shape renders naturally", () => {
  it("prints the participant text for each", () => {
    for (const m of [
      "During morning huddles",
      "At each patient handoff",
      "Whenever a deadline changes",
      "During the weekly scheduling review",
      "아침 허들 때마다",
    ]) {
      const h = host(m);
      // N/M — none of these is blocked for its phrasing any more.
      expect(programSourceBlocker(h), m).toBeNull();
      const r = propose(CLEAN_ACTION, h);
      expect(r.ok, `${m} → ${r.ok ? "" : r.code}`).toBe(true);
      if (!r.ok) continue;
      const s = Object.fromEntries(r.value.proposal.elements.map((e) => [e.kind, e.content])) as Record<string, string>;
      console.log(`\n=== ${m} ===`);
      for (const k of ["observable_standard", "scenario", "action_decision", "field_application", "completion_check"]) {
        if (s[k]) console.log(`[${k}] ${s[k]}`);
      }
      // I — the application sections point at the next occurrence without rewriting the phrase.
      expect(s.field_application).toContain("The next time this happens");
      expect(s.field_application).not.toContain("the next " + m.toLowerCase().replace(/^(during|at|whenever)\s+/i, ""));
      // G/H — the moment is stated verbatim where it belongs, once.
      expect(s.observable_standard.startsWith(m)).toBe(true);
      expect(s.scenario.startsWith(m)).toBe(true);
      // O/P — actor and criterion stay server-owned.
      expect(s.observable_standard).toContain(`, ${CANONICAL_ACTOR} must `);
      expect(s.observable_standard).toContain("Completion evidence: The huddle note records");
    }
  });

  it("the advisory is advisory: a one-off phrase is guidance, not a refusal", () => {
    const once = host("At the next huddle");
    expect(recurringMomentReadsOnceOnly(once)).toBe(true);
    expect(programSourceBlocker(once), "the host is the authority on their own workplace").toBeNull();
    expect(propose(CLEAN_ACTION, once).ok).toBe(true);
  });

  it("T — an absent moment still blocks before any provider call", () => {
    const { recurringMoment: _d, ...without } = host("x") as Record<string, unknown>;
    expect(programSourceBlocker(without as BuilderAnswers)).toBe("recurring_moment_required");
  });
});

describe("[3.2P-R3.7] R/V/W — authority is unchanged where it should be", () => {
  it("R — repair still reaches only the two pressure fields", () => {
    expect(repairLicenseFor("scenario_without_pressure", "scenario")).toEqual({ surface: "scenario_pressure" });
  });

  it("V/W — W6's v13 is stale under v14, and v14 adopts its own", () => {
    const claim = (v: string) => ({
      mode: "initial" as const, claimedAttemptId: "a", journeyInSamePatch: true, durableJourneyPresent: false,
      attempt: { id: "a", draftId: "d", outcome: "success", contextFingerprint: "f", proposalDigest: "g", proposalVersion: v },
      draftId: "d", currentFingerprint: "f", currentAuthorityVersion: PROGRAM_AUTHORSHIP_VERSION,
      latestSuccessfulAttemptId: "a", adoptedJourneyDigest: "g",
    });
    expect(PROGRAM_AUTHORSHIP_VERSION).toBe("program_authorship_v14");
    expect(PROGRAM_SCHEMA_NAME).toBe("bty_guided_program_v10");
    for (const spent of ["v9", "v10", "v11", "v12", "v13"].map((v) => `program_authorship_${v}`)) {
      expect(decideAdoptionReceipt(claim(spent)), spent).toEqual({ ok: false, reason: "proposal_no_longer_valid" });
    }
    expect(decideAdoptionReceipt(claim(PROGRAM_AUTHORSHIP_VERSION))).toEqual({ ok: true });
  });
});
