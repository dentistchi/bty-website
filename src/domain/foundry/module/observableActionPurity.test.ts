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

import { validateProgramProposal, requiredProgramKinds, programSourceBlocker, PROGRAM_AUTHORSHIP_VERSION, PROGRAM_SCHEMA_NAME, repairLicenseFor } from "./program-authorship";
import { CANONICAL_ACTOR, composeObservableAction, actionVerbDefect, momentIsConfidentlyOneOff } from "./program-coherence";
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
/** Split a whole action into the v15 wire fields the way a model would. */
const split = (action: string) => {
  const [verb, ...rest] = action.trim().split(/\s+/);
  return { action_verb: verb ?? "", action_detail: rest.join(" ") };
};
const proposeFields = (fields: { action_verb: string; action_detail: string }, h: BuilderAnswers) => {
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
      behavior_contract: fields,
      scenario_contract: { pressure_condition: "the group is running late and people are already standing to leave", pressure_detail: null },
      completion_contract: { verification_target: "the_behaviour", response_mode: "state_what_you_will_say" },
      follow_up_contract: { review_focus: "what_you_said", confirmer: "self_report" },
    },
  }, h, ["education.pdf"]);
};
/** The whole-phrase convenience the older cases were written against. */
const propose = (action: string, h: BuilderAnswers) => proposeFields(split(action), h);

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

  /**
   * A/B/C — A SUBJECT IS NOW UNREPRESENTABLE, not merely refused (Slice 3.2P-R3.7-R2).
   *
   * v14 caught a pronoun or a determiner and measurement showed a free string goes no further:
   * the only heuristic that also caught "team members name the owner" refused "write owner and
   * deadline in the note", a real behaviour. So the model returns the verb head separately and
   * the server composes it straight after "must". These are SHAPE refusals — the model misread
   * the contract — which is why they are not `action_reclaims_authority`.
   */
  it("A/B/C — no subject form can occupy the verb field", () => {
    /*
      The fixtures are TWO-FIELD, because that is what the contract receives. A model leaking a
      subject puts the subject where the sentence's first word goes — the verb field — and every
      shape of it is refused there: multi-word, pronoun, determiner, an inflected plural noun
      (`leaders` → `leader` under the same de-inflection that turns `states` into `state`), and a
      Korean subject particle.
    */
    const LEAKS: [string, string][] = [
      ["you", "state the owner and deadline"],
      ["the", "leader states the owner and deadline"],
      ["the leader", "states the owner and deadline"],
      ["team members", "name the owner"],          // v14 missed this as a free string
      ["leaders", "confirm the deadline"],
      ["supervisors", "review the note"],
      ["직원들이", "담당자를 정한다"],
      ["팀장이", "마감일을 말한다"],
      ["states", "the owner"],                     // inflected head, not a base form
    ];
    for (const [action_verb, action_detail] of LEAKS) {
      expect(actionVerbDefect(action_verb), action_verb).not.toBeNull();
      const r = proposeFields({ action_verb, action_detail }, host("During morning huddles"));
      expect(r.ok, action_verb).toBe(false);
      if (!r.ok) expect(r.code, action_verb).toBe("field_type");
    }
  });

  it("D/E/F — clean verbs, phrasal verbs, and role nouns inside the detail all compose", () => {
    const CASES: [string, string, string][] = [
      ["state", "the owner and deadline", "state the owner and deadline"],
      ["follow", "up with the owner", "follow up with the owner"],
      ["check", "in with the patient", "check in with the patient"],
      ["sign", "off on the checklist", "sign off on the checklist"],
      ["hand", "off the item", "hand off the item"],
      ["name", "the team members who own each item", "name the team members who own each item"],
      ["record", "the supervisor's approval", "record the supervisor's approval"],
      ["read", "the value aloud", "read the value aloud"],
    ];
    for (const [verb, detail, whole] of CASES) {
      expect(composeObservableAction(verb, detail), whole).toBe(whole);
      expect(actionVerbDefect(verb), verb).toBeNull();
    }
    /*
      End to end for the ones this HOST's material can ground. "the checklist" and "the patient"
      are refused by the pre-existing artifact floor for this draft — correctly, since neither
      appears in its source — so the phrasal-verb property is proven by composition above and by
      these two through the full pipeline.
    */
    for (const whole of ["follow up with the owner", "name the team members who own each item"]) {
      const r = propose(whole, host("During morning huddles"));
      expect(r.ok, whole).toBe(true);
      if (r.ok) {
        expect(r.value.proposal.behaviorContract!.observableAction).toBe(whole);
        expect(r.value.proposal.elements.find((e) => e.kind === "observable_standard")!.content)
          .toContain(`you must ${whole}`);
      }
    }
  });

  it("the residual is stated, not hidden", () => {
    /*
      `action_verb: "team"` is a real base form and `action_detail: "members name the owner"` is
      a real phrase. Nothing here can prove that wrong without the lexicon this system does not
      build. Asserted so the boundary stays a decision.
    */
    expect(actionVerbDefect("team")).toBeNull();
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

  it("I/J — confidently one-off blocks; merely unparsed never does", () => {
    /*
      NEGATIVE CERTAINTY (Slice 3.2P-R3.7-R2). The program says "the next time this happens",
      which is false against a date — so a moment that can only mean one occasion is refused
      before spend. Everything the rule cannot PROVE one-off is accepted, which is what keeps
      Korean and ordinary English answers working. Measured: "On August 20" folds and is still
      one-off, so recurrence-parsing and one-off-detection are genuinely different questions.
    */
    for (const m of ["Tomorrow at 3 PM", "At the next huddle", "This Friday", "On August 20", "One time after the meeting"]) {
      expect(momentIsConfidentlyOneOff(m), m).toBe(true);
      expect(programSourceBlocker(host(m)), m).toBe("recurring_moment_not_repeatable");
    }
    for (const m of [
      "During morning huddles", "At each patient handoff", "Whenever a deadline changes",
      "During the weekly scheduling review", "아침 허들 때마다", "매 인수인계마다",
      // uncertain — the parser cannot classify these, and that must never be a refusal
      "at the end of the shift", "before leaving the floor", "when the escalation lands", "매주 월요일 회의",
    ]) {
      expect(momentIsConfidentlyOneOff(m), m).toBe(false);
      expect(programSourceBlocker(host(m)), m).toBeNull();
    }
    // …and the host's words are never rewritten into a recurring form.
    expect(host("At the next huddle").recurringMoment).toBe("At the next huddle");
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

  it("R/S — W6's v13 is stale under v15, and v15 adopts its own", () => {
    const claim = (v: string) => ({
      mode: "initial" as const, claimedAttemptId: "a", journeyInSamePatch: true, durableJourneyPresent: false,
      attempt: { id: "a", draftId: "d", outcome: "success", contextFingerprint: "f", proposalDigest: "g", proposalVersion: v },
      draftId: "d", currentFingerprint: "f", currentAuthorityVersion: PROGRAM_AUTHORSHIP_VERSION,
      latestSuccessfulAttemptId: "a", adoptedJourneyDigest: "g",
    });
    expect(PROGRAM_AUTHORSHIP_VERSION).toBe("program_authorship_v19");
    expect(PROGRAM_SCHEMA_NAME).toBe("bty_guided_program_v11");
    for (const spent of ["v9", "v10", "v11", "v12", "v13", "v14", "v15", "v16", "v17"].map((v) => `program_authorship_${v}`)) {
      expect(decideAdoptionReceipt(claim(spent)), spent).toEqual({ ok: false, reason: "proposal_no_longer_valid" });
    }
    expect(decideAdoptionReceipt(claim(PROGRAM_AUTHORSHIP_VERSION))).toEqual({ ok: true });
  });
});
