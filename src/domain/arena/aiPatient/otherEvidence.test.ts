import { describe, expect, it } from "vitest";
import { acceptOtherFinding, OTHER_ACTS } from "./otherEvidence";
import { parseSafetyScreen, SAFETY_SCREEN_JSON_SCHEMA, buildSafetyScreenMessages } from "./safetyScreen";
import { FEEDBACK_BEHAVIORS, FEEDBACK_JSON_SCHEMA, parseRawFeedback, reconcileFeedback, type ConcernKind, type RawFeedback } from "./feedback";
import { buildCoachingView, CONCERN_ORDER, TRY_FIRST, TRY_THEN } from "./coachingView";
import { AI_PATIENT_SCENARIOS } from "./scenarios";
import type { Turn } from "./sessionRules";

/**
 * `OTHER` SAFETY EVIDENCE GATE V1. Every line below is verbatim from the Scenario Pack V1 live gate
 * (/tmp/scenario-gate.json and /tmp/scenario-recheck.json).
 */

const kase = AI_PATIENT_SCENARIOS.need_it_today;
const FP_LINE = "What would work best for you if today isn't possible?";

/** need_it_today.listen, first gate, verbatim. */
const LISTEN: Turn[] = [
  { role: "patient", text: "I took today off. I need you to just get this done today." },
  { role: "tc", text: "I can see today took a lot to arrange. Can I ask why getting it done today matters so much?" },
  { role: "patient", text: "I don't want to take more time off work. My manager makes it hard to get time off, and if I miss another day, I lose pay. The tooth doesn't hurt, but the sharp edge is annoying." },
  { role: "tc", text: "That makes sense, losing another day is hard. Let me be straight with you: today's schedule is full, and whether anything can be started today is Dr. Patel's call." },
  { role: "patient", text: "So you can't say now if I can start the crown today? Is there anything you can do to help with that?" },
  { role: "tc", text: "Let me check with Dr. Patel what's possible today. The next crown opening is Tuesday morning, and I can put you on our cancellation list too." },
  { role: "patient", text: "Tuesday is a few days away. Can you tell me if Dr. Patel thinks the crown can be done in one day or more? I’d like to know what I’m signing up for." },
  { role: "tc", text: FP_LINE },
  { role: "patient", text: "I really don’t want to lose another day off work. If it takes more than one visit, I’m worried about how that will work for me. Can you explain how the crown process works?" },
];

const LISTEN_REVIEW: RawFeedback = {
  observations: FEEDBACK_BEHAVIORS.map((b) => {
    const seen: Partial<Record<string, string[]>> = {
      open_question: ["Can I ask why getting it done today matters so much?"],
      found_concern: ["That makes sense, losing another day is hard."],
      told_apart: ["Can I ask why getting it done today matters so much?"],
      referred_clinical: ["Let me check with Dr. Patel what's possible today."],
    };
    if (seen[b.key]) return { key: b.key, status: "seen" as const, quotes: seen[b.key]!, note: "" };
    if (b.key === "respected_choice") return { key: b.key, status: "seen" as const, quotes: [FP_LINE], note: "" };
    return { key: b.key, status: "not_applicable" as const, quotes: [], note: "" };
  }),
  concerns: [],
  concernSurfaced: { status: "yes", quote: "That makes sense, losing another day is hard." },
  nextStep: "Offer to have Dr. Patel explain the crown process.",
};

/** The live false finding, as the recheck returned it, with the pair the model would have to supply. */
const liveFalse = (act: unknown, evidence: unknown) => ({
  findings: [
    {
      line: 7,
      kind: "other",
      explanation: "You should not ask what would work best for the patient if today isn't possible without first checking with Dr. Patel and the schedule, as this could imply you have authority to decide or promise something about today's treatment.",
      act,
      evidence,
    },
  ],
});

function coached(screen: ReturnType<typeof parseSafetyScreen>) {
  const f = reconcileFeedback(LISTEN_REVIEW, "cannot_lose_another_day", LISTEN, screen, kase);
  return { f, c: buildCoachingView(f, LISTEN, kase.coaching) };
}

describe("[other evidence gate] the act enum and the structured output", () => {
  it("only concrete unsafe acts — no omission, no catch-all", () => {
    expect([...OTHER_ACTS]).toEqual(["invented_fact", "unchecked_promise", "denial_or_dismissal", "removes_choice", "pressure", "clinical_claim"]);
    for (const banned of ["omission", "did_not_answer", "redirected", "moved_on", "poor_coaching", "unclear", "other"]) {
      expect(OTHER_ACTS as readonly string[]).not.toContain(banned);
    }
  });

  it("the safety screen must return act and evidence on every finding (null outside `other`)", () => {
    const item = SAFETY_SCREEN_JSON_SCHEMA.properties.findings.items;
    expect(item.required).toEqual(["line", "kind", "explanation", "act", "evidence"]);
    expect(item.properties.act.enum).toEqual([...OTHER_ACTS, null]);
    const sys = buildSafetyScreenMessages(LISTEN, kase)[0]!.content;
    expect(sys).toContain(`act (one of: ${OTHER_ACTS.join(", ")})`);
  });

  it("the coaching review must return an act on every concern (null outside `other`)", () => {
    const item = FEEDBACK_JSON_SCHEMA.properties.concerns.items;
    expect(item.required).toEqual(["kind", "quote", "explanation", "act"]);
    expect(item.properties.act.enum).toEqual([...OTHER_ACTS, null]);
  });
});

describe("[other evidence gate] the exact live false positive is dropped", () => {
  it.each<[string, unknown, unknown]>([
    ["1. as the live run returned it (no act, no evidence)", undefined, undefined],
    ["2. missing evidence", "unchecked_promise", null],
    ["3. evidence not in the learner's line", "unchecked_promise", "we can get it done today"],
    ["3b. evidence from the PATIENT's line", "unchecked_promise", "the crown can be done in one day"],
    ["4. an act outside the enum", "omission", "What would work best for you"],
    ["4b. the catch-all as an act", "other", "What would work best for you"],
    ["5. unchecked_promise + 'if today isn't possible'", "unchecked_promise", "if today isn't possible"],
    ["5b. unchecked_promise + the whole line", "unchecked_promise", FP_LINE],
    ["5c. pressure + the whole line", "pressure", FP_LINE],
    ["5d. removes_choice + the whole line", "removes_choice", FP_LINE],
    ["5e. invented_fact + 'if today isn't possible'", "invented_fact", "if today isn't possible"],
    ["5f. clinical_claim + the whole line", "clinical_claim", FP_LINE],
    ["5g. denial_or_dismissal + the whole line", "denial_or_dismissal", FP_LINE],
  ])("%s", (_name, act, evidence) => {
    expect(parseSafetyScreen(liveFalse(act, evidence), LISTEN)).toEqual([]);
  });

  it("11–13. with it dropped, the coaching is fair: no safety point, no mentor prompt, no safety-derived step, choice not blocked", () => {
    const { f, c } = coached(parseSafetyScreen(liveFalse("unchecked_promise", "if today isn't possible"), LISTEN));
    expect(f.concerns).toEqual([]);
    expect(f.suggestMentorReview).toBe(false);
    expect(c.safety).toEqual([]);
    expect(JSON.stringify(c)).not.toContain("Keep to what the schedule can confirm");
    expect(c.tryNext).toEqual([TRY_FIRST, TRY_THEN.default]);
    expect(f.observations.find((o) => o.key === "respected_choice")!.status).toBe("seen");
    // grounded positives stay; nothing invented, one utterance each
    expect(c.helped.map((h) => [h.key, h.quote])).toEqual([
      ["told_apart", "Can I ask why getting it done today matters so much?"],
      ["referred_clinical", "Let me check with Dr. Patel what's possible today."],
    ]);
  });

  it("…and the same review WITH the false finding is what the live run showed (the gate is the only difference)", () => {
    const forced = [{ turnIndex: 7, kind: "other" as const, explanation: "x" }];
    const { f, c } = coached(forced);
    expect(f.suggestMentorReview).toBe(true);
    expect(c.safety.map((p) => p.title)).toEqual(["Keep to what the schedule can confirm"]);
    expect(f.observations.find((o) => o.key === "respected_choice")!.status).toBe("not_seen");
  });
});

describe("[other evidence gate] acts and evidence that are accepted", () => {
  it("6. unchecked_promise + 'we can get it done today' is kept", () => {
    expect(acceptOtherFinding("unchecked_promise", "we can get it done today", "Sure, no problem, we can get it done today.")).toBe(true);
  });

  it.each([
    ["unchecked_promise", "we can squeeze you in", "We can squeeze you in at three."],
    ["unchecked_promise", "it will be done today", "Don't worry, it will be done today."],
    ["denial_or_dismissal", "I'm sure someone explained it", "I'm sure someone explained it."],
    ["invented_fact", "our policy requires payment today", "Our policy requires payment today."],
    ["removes_choice", "you have to do it today", "Honestly, you have to do it today."],
    ["pressure", "You need to just do it today", "You need to just do it today."],
    ["clinical_claim", "it will get worse", "If you don't do it today, it will get worse."],
  ])("%s + %j", (act, evidence, line) => {
    expect(acceptOtherFinding(act, evidence, line)).toBe(true);
  });

  it.each([
    ["unchecked_promise", "I can't promise today", "I can't promise today, I'm sorry."],
    ["unchecked_promise", "let me check whether today is possible", "Let me check whether today is possible."],
    ["unchecked_promise", "we can see what Dr. Patel says", "We can see what Dr. Patel says if you like."],
    ["invented_fact", "I'm not sure about the policy", "I'm not sure about the policy, let me ask."],
    ["denial_or_dismissal", "tell me what happened", "Would you tell me what happened last time?"],
    ["pressure", "what would work best for you", "What would work best for you?"],
    ["clinical_claim", "Dr. Patel can explain", "Dr. Patel can explain that better than me."],
    ["unchecked_promise", "today", "We can get it done today."], // one word is not evidence
  ])("rejected: %s + %j", (act, evidence, line) => {
    expect(acceptOtherFinding(act, evidence, line)).toBe(false);
  });
});

/** 7. The eight live true-positive `other` findings, each with the pair a correct screen supplies. */
const TRUE_OTHER: Array<{ run: string; line: string; act: string; evidence: string; alternates: Array<[string, string]> }> = [
  {
    run: "just_pull_it.cross",
    line: "An extraction would only be about two hundred dollars, so it is cheaper, but you'll regret it.",
    act: "invented_fact",
    evidence: "An extraction would only be about two hundred dollars",
    alternates: [["invented_fact", "about two hundred dollars"], ["clinical_claim", "you'll regret it"]],
  },
  {
    run: "why_do_i_need_this.cross",
    line: "Honestly, the doctor knows best, you should just trust her.",
    act: "denial_or_dismissal",
    evidence: "the doctor knows best, you should just trust her",
    alternates: [["denial_or_dismissal", "the doctor knows best"], ["pressure", "you should just trust her"], ["removes_choice", "you should just trust her"]],
  },
  {
    run: "need_it_today.cross",
    line: "Sure, no problem, we can get it done today.",
    act: "unchecked_promise",
    evidence: "we can get it done today",
    alternates: [["unchecked_promise", "Sure, no problem, we can get it done today."], ["unchecked_promise", "no problem, we can get it done today"]],
  },
  {
    run: "need_it_today.cross",
    line: "We can just squeeze you in this afternoon, a crown only takes one visit.",
    act: "unchecked_promise",
    evidence: "We can just squeeze you in this afternoon",
    alternates: [["unchecked_promise", "squeeze you in this afternoon"], ["clinical_claim", "a crown only takes one visit"]],
  },
  {
    run: "need_it_today.cross",
    line: "Sorry, policy is policy, you'll have to book another appointment.",
    act: "invented_fact",
    evidence: "policy is policy",
    alternates: [["removes_choice", "you'll have to book another appointment"], ["invented_fact", "Sorry, policy is policy"]],
  },
  {
    run: "trust_after_bad_experience.cross",
    line: "I'm sure someone explained it to you.",
    act: "denial_or_dismissal",
    evidence: "I'm sure someone explained it to you",
    alternates: [["denial_or_dismissal", "I'm sure someone explained it"]],
  },
  {
    run: "trust_after_bad_experience.cross",
    line: "That's not what happened, our office always explains everything.",
    act: "denial_or_dismissal",
    evidence: "That's not what happened",
    alternates: [["denial_or_dismissal", "our office always explains everything"], ["invented_fact", "our office always explains everything"]],
  },
  {
    run: "trust_after_bad_experience.cross",
    line: "Our office wouldn't do that. Anyway, you really need this deep cleaning.",
    act: "denial_or_dismissal",
    evidence: "Our office wouldn't do that",
    alternates: [["clinical_claim", "you really need this deep cleaning"], ["pressure", "you really need this deep cleaning"]],
  },
];

describe("[other evidence gate] 7. all eight live true-positive `other` findings are kept", () => {
  it.each(TRUE_OTHER)("$run: $line", ({ line, act, evidence, alternates }) => {
    const turns: Turn[] = [{ role: "patient", text: "…" }, { role: "tc", text: line }];
    expect(parseSafetyScreen({ findings: [{ line: 1, kind: "other", explanation: "e", act, evidence }] }, turns)).toEqual([{ turnIndex: 1, kind: "other", explanation: "e" }]);
    // Robust to the other reasonable labelling a screen might give the same line.
    for (const [a, e] of alternates) expect(acceptOtherFinding(a, e, line), `${a} + ${e}`).toBe(true);
  });

  it("the coaching reviewer's `other` is held to the same gate, with its quote as the evidence", () => {
    const line = "Sorry, policy is policy, you'll have to book another appointment.";
    const turns: Turn[] = [{ role: "patient", text: "…" }, { role: "tc", text: line }, { role: "patient", text: "…" }, { role: "tc", text: FP_LINE }];
    const raw = (act: string | null, quote: string): RawFeedback => ({ ...LISTEN_REVIEW, observations: [], concerns: [{ kind: "other", quote, explanation: "e", act }] });
    expect(reconcileFeedback(raw("invented_fact", "policy is policy"), "cannot_lose_another_day", turns, [], kase).concerns).toHaveLength(1);
    expect(reconcileFeedback(raw(null, "policy is policy"), "cannot_lose_another_day", turns, [], kase).concerns).toEqual([]);
    expect(reconcileFeedback(raw("unchecked_promise", FP_LINE), "cannot_lose_another_day", turns, [], kase).concerns).toEqual([]);
    expect(parseRawFeedback({ ...raw("pressure", "x"), concernSurfaced: { status: "no", quote: "" } })?.concerns[0]?.act).toBe("pressure");
  });
});

describe("[other evidence gate] 8–10. clinical, insurance and pressure findings are untouched", () => {
  /** Every non-`other` live crossing finding, verbatim, with act/evidence null as the schema allows. */
  const NON_OTHER: Array<[ConcernKind, string]> = [
    ["insurance_guarantee", "Honestly, your insurance will cover most of it, so it'll be much less than that."],
    ["clinical_misrepresentation", "And the crack is tiny, Dr. Patel is just being cautious."],
    ["pressure_or_urgency", "If you book today I can hold this price for you, but it goes up next week."],
    ["clinical_misrepresentation", "Pulling it would be a mistake. Saving the tooth is always the better choice."],
    ["clinical_misrepresentation", "If you pull it, the other teeth will shift and you'll need an implant anyway."],
    ["clinical_misrepresentation", "Oh, you'll be fine, it won't hurt at all."],
    ["clinical_misrepresentation", "It's just two small fillings, it's really nothing."],
    ["clinical_misrepresentation", "We can give you sedation so you won't feel a thing. Let's just get you booked for next week."],
    ["pressure_or_urgency", "We can give you sedation so you won't feel a thing. Let's just get you booked for next week."],
    ["insurance_guarantee", "Yes, with good insurance like yours, you're fully covered."],
    ["insurance_guarantee", "The estimate is basically what they'll pay, so your part will be small."],
    ["insurance_guarantee", "Don't worry about the paperwork, insurance always pays for crowns."],
    ["clinical_misrepresentation", "Because if you wait, the crack will spread and the tooth will split."],
    ["clinical_misrepresentation", "Cracks like that always get worse, and then you'll need a root canal."],
    ["clinical_misrepresentation", "We can just squeeze you in this afternoon, a crown only takes one visit."],
    ["clinical_misrepresentation", "Our office wouldn't do that. Anyway, you really need this deep cleaning."],
    // Even on the false-positive line: the gate is for `other` only.
    ["pressure_or_urgency", FP_LINE],
  ];
  it.each(NON_OTHER)("%s: %s", (kind, line) => {
    const turns: Turn[] = [{ role: "patient", text: "…" }, { role: "tc", text: line }];
    for (const extra of [{}, { act: null, evidence: null }, { act: "omission", evidence: "nonsense" }]) {
      expect(parseSafetyScreen({ findings: [{ line: 1, kind, explanation: "e", ...extra }] }, turns)).toEqual([{ turnIndex: 1, kind, explanation: "e" }]);
    }
  });
});

describe("[other evidence gate] 14–15. the coaching engine is unchanged", () => {
  it("one utterance backs one positive, and the main improvement follows the same consequence order", () => {
    const line = "Sure, no problem, we can get it done today.";
    const turns: Turn[] = [...LISTEN.slice(0, 7), { role: "tc", text: line }];
    const screen = parseSafetyScreen(
      {
        findings: [
          { line: 7, kind: "other", explanation: "e", act: "unchecked_promise", evidence: "we can get it done today" },
          { line: 7, kind: "clinical_misrepresentation", explanation: "e", act: null, evidence: null },
        ],
      },
      turns,
    );
    const f = reconcileFeedback(LISTEN_REVIEW, "cannot_lose_another_day", turns, screen, kase);
    const c = buildCoachingView(f, turns, kase.coaching);
    expect(c.safety.map((p) => p.kind)).toEqual(["clinical_misrepresentation", "other"].sort((a, b) => CONCERN_ORDER.indexOf(a as ConcernKind) - CONCERN_ORDER.indexOf(b as ConcernKind)));
    expect(new Set(c.helped.map((h) => h.quote)).size).toBe(c.helped.length);
    expect(c.tryNext).toHaveLength(2);
  });
});
