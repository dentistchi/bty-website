import { describe, expect, it } from "vitest";
import { AI_PATIENT_SCENARIOS } from "./scenarios";
import { AI_PATIENT_SCENARIO_IDS } from "./scenarioCatalog";
import { buildFeedbackMessages, FEEDBACK_BEHAVIORS, reconcileFeedback, type ConcernKind, type RawFeedback } from "./feedback";
import { buildSafetyScreenMessages } from "./safetyScreen";
import { buildCoachingView, CONCERN_ORDER, TRY_FIRST, TRY_THEN } from "./coachingView";
import { SAFETY_SCOPE_RULE } from "./safetyScope";
import type { Turn } from "./sessionRules";

/**
 * SHARED SAFETY FALSE POSITIVE V1. The live gate's need_it_today.listen run, verbatim: the screen
 * flagged an unanswered question as `other`. An unanswered question alone is a coaching gap; a line that
 * also SAYS something unsafe is still flagged. One shared rule, no scenario branch.
 */

const kase = AI_PATIENT_SCENARIOS.need_it_today;

/** need_it_today.listen from /tmp/scenario-gate.json, exactly as the live run produced it. */
const LIVE_TURNS: Turn[] = [
  { role: "patient", text: "I took today off. I need you to just get this done today." },
  { role: "tc", text: "I can see today took a lot to arrange. Can I ask why getting it done today matters so much?" },
  { role: "patient", text: "I don't want to take more time off work. My manager makes it hard to get time off, and if I miss another day, I lose pay. The tooth doesn't hurt, but the sharp edge is annoying." },
  { role: "tc", text: "That makes sense, losing another day is hard. Let me be straight with you: today's schedule is full, and whether anything can be started today is Dr. Patel's call." },
  { role: "patient", text: "So you can't say now if I can start the crown today? Is there anything you can do to help with that?" },
  { role: "tc", text: "Let me check with Dr. Patel what's possible today. The next crown opening is Tuesday morning, and I can put you on our cancellation list too." },
  { role: "patient", text: "Tuesday is a few days away. Can you tell me if Dr. Patel thinks the crown can be done in one day or more? I’d like to know what I’m signing up for." },
  { role: "tc", text: "What would work best for you if today isn't possible?" },
  { role: "patient", text: "I really don’t want to lose another day off work. If it takes more than one visit, I’m worried about how that will work for me. Can you explain how the crown process works?" },
];
const FLAGGED_LINE = 7;

/** The coaching review the live run reconciled: these observations, and no coaching concern. */
const LIVE_REVIEW: RawFeedback = {
  observations: FEEDBACK_BEHAVIORS.map((b) => {
    const seen: Partial<Record<string, string[]>> = {
      open_question: ["Can I ask why getting it done today matters so much?"],
      found_concern: ["That makes sense, losing another day is hard."],
      told_apart: ["Can I ask why getting it done today matters so much?"],
      referred_clinical: ["Let me check with Dr. Patel what's possible today."],
      no_pressure: ["Let me check with Dr. Patel what's possible today. The next crown opening is Tuesday morning, and I can put you on our cancellation list too."],
    };
    if (seen[b.key]) return { key: b.key, status: "seen" as const, quotes: seen[b.key]!, note: "" };
    if (b.key === "respected_choice") return { key: b.key, status: "not_seen" as const, quotes: [], note: "" };
    return { key: b.key, status: "not_applicable" as const, quotes: [], note: "" };
  }),
  concerns: [],
  concernSurfaced: { status: "yes", quote: "That makes sense, losing another day is hard." },
  nextStep: "When the patient asks about the crown process, offer to have Dr. Patel explain it.",
};

const LIVE_FALSE_FINDING = [{ turnIndex: FLAGGED_LINE, kind: "other" as const, explanation: "You should not redirect the patient away from their clinical question." }];

describe("[Safety scope] the rule is shared, and still names everything that must be flagged", () => {
  it.each([...AI_PATIENT_SCENARIO_IDS])("%s: both the safety screen and the coaching review carry it", (id) => {
    const k = AI_PATIENT_SCENARIOS[id];
    expect(buildSafetyScreenMessages(LIVE_TURNS, k)[0]!.content).toContain(SAFETY_SCOPE_RULE);
    expect(buildFeedbackMessages(Object.keys(k.hiddenConcerns)[0]!, LIVE_TURNS, k)[0]!.content).toContain(SAFETY_SCOPE_RULE);
  });

  it("names the four things that are NOT safety by themselves", () => {
    for (const phrase of ["leaves a patient's question unanswered", "moves to a next step", "asks about the patient's preferences or what would work for them", "redirects the conversation"]) {
      expect(SAFETY_SCOPE_RULE).toContain(phrase);
    }
    expect(SAFETY_SCOPE_RULE).toMatch(/coaching point, not a safety concern/);
  });

  it("names everything that must STILL be flagged in the same line", () => {
    for (const phrase of [
      "clinical claim, diagnosis, prognosis or treatment recommendation",
      "insurance guarantee",
      "invented price, payment option, policy or schedule opening",
      "promise of same-day treatment",
      "pressure",
      "takes the choice away from the patient",
    ]) {
      expect(SAFETY_SCOPE_RULE).toContain(phrase);
    }
  });

  it("weakens nothing: every existing category, example and scenario signal is still in the screen", () => {
    const screen = buildSafetyScreenMessages(LIVE_TURNS, kase)[0]!.content;
    expect(screen).toMatch(/clinical_misrepresentation: changes, softens, reinterprets/);
    expect(screen).toMatch(/insurance_guarantee: promises, guarantees or confidently states/);
    expect(screen).toMatch(/pressure_or_urgency: pushes the patient to book or decide now/);
    expect(screen).toMatch(/other: anything else that disrespects the patient's right to accept, wait or decline, or invents a practice policy or payment option/);
    for (const list of Object.values(kase.safetySignals ?? {})) for (const s of list ?? []) expect(screen).toContain(s);
    for (const b of kase.roleBoundaries ?? []) expect(screen).toContain(b);
  });

  it("no scenario branch: the rule is one constant, and no scenario carries its own copy", () => {
    for (const k of Object.values(AI_PATIENT_SCENARIOS)) expect(JSON.stringify(k)).not.toContain("unanswered");
  });
});

describe("[Safety scope] the exact live false positive", () => {
  it("1. with the line not flagged, the coaching is fair: no safety point, no mentor prompt, no safety-derived step", () => {
    const f = reconcileFeedback(LIVE_REVIEW, "cannot_lose_another_day", LIVE_TURNS, [], kase);
    const c = buildCoachingView(f, LIVE_TURNS, kase.coaching);
    expect(f.concerns).toEqual([]);
    expect(f.suggestMentorReview).toBe(false);
    expect(c.safety).toEqual([]);
    expect(JSON.stringify(c)).not.toContain("Keep to what the schedule can confirm");
    expect(c.tryNext).not.toContain(kase.coaching!.tryThen!.other);
    // The unanswered question stays a coaching-quality point, not a correction.
    expect(c.growth).toEqual({ key: "respected_choice", text: expect.any(String) });
    expect(c.tryNext).toEqual([TRY_FIRST, TRY_THEN.respected_choice]);
  });

  it("9–10. the positives are exactly the grounded ones — nothing invented to compensate, one utterance each", () => {
    const f = reconcileFeedback(LIVE_REVIEW, "cannot_lose_another_day", LIVE_TURNS, [], kase);
    const c = buildCoachingView(f, LIVE_TURNS, kase.coaching);
    expect(c.helped).toEqual([
      { key: "told_apart", text: kase.coaching!.helped!.told_apart, quote: "Can I ask why getting it done today matters so much?" },
      { key: "referred_clinical", text: expect.any(String), quote: "Let me check with Dr. Patel what's possible today." },
    ]);
    const learner = LIVE_TURNS.filter((t) => t.role === "tc").map((t) => t.text);
    for (const h of c.helped) expect(learner.some((l) => l.includes(h.quote))).toBe(true);
    expect(c.helped.map((h) => h.quote)).not.toContain(LIVE_TURNS[FLAGGED_LINE]!.text);
  });

  it("what the live run showed was the false finding alone — the same review with it produces the unfair correction", () => {
    const f = reconcileFeedback(LIVE_REVIEW, "cannot_lose_another_day", LIVE_TURNS, LIVE_FALSE_FINDING, kase);
    const c = buildCoachingView(f, LIVE_TURNS, kase.coaching);
    expect(c.safety.map((p) => p.title)).toEqual(["Keep to what the schedule can confirm"]);
    expect(f.suggestMentorReview).toBe(true);
    expect(c.tryNext[1]).toBe(kase.coaching!.tryThen!.other);
  });
});

describe("[Safety scope] negative controls — a finding on any of these still becomes the main improvement", () => {
  const CONTROLS: Array<{ line: string; kinds: ConcernKind[] }> = [
    { line: "Dr. Patel can definitely do the crown today.", kinds: ["other", "clinical_misrepresentation"] },
    { line: "We can absolutely finish it in one visit.", kinds: ["clinical_misrepresentation"] },
    { line: "Our policy says we have to do it today.", kinds: ["other"] },
    { line: "Insurance will cover it if we do it today.", kinds: ["insurance_guarantee"] },
    { line: "If you don't do it today, it will get worse.", kinds: ["clinical_misrepresentation", "pressure_or_urgency"] },
    { line: "You need to just do it today.", kinds: ["pressure_or_urgency"] },
  ];

  it.each(CONTROLS)("$line", ({ line, kinds }) => {
    const turns: Turn[] = [...LIVE_TURNS.slice(0, FLAGGED_LINE), { role: "tc", text: line }];
    const f = reconcileFeedback(LIVE_REVIEW, "cannot_lose_another_day", turns, kinds.map((kind) => ({ turnIndex: FLAGGED_LINE, kind, explanation: "x" })), kase);
    const c = buildCoachingView(f, turns, kase.coaching);
    expect(f.suggestMentorReview).toBe(true);
    // 11. the main improvement is still chosen by the unchanged consequence order
    const expected = [...kinds].sort((a, b) => CONCERN_ORDER.indexOf(a) - CONCERN_ORDER.indexOf(b));
    expect(c.safety.map((p) => p.kind)).toEqual(expected);
    expect(c.safety[0]!.quote).toBe(line);
    expect(c.safety[0]!.quoteVerified).toBe(true);
    expect(c.growth).toBeNull();
    // 12. Try next time keeps its two-step shape
    expect(c.tryNext).toHaveLength(2);
    expect(c.tryNext[0]).toBe(TRY_FIRST);
  });
});
