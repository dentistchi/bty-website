import { describe, expect, it } from "vitest";
import { CASE_ACCEPTANCE_01 } from "./caseAcceptance01";
import { FEEDBACK_BEHAVIORS, reconcileFeedback, type RawFeedback } from "./feedback";
import { buildCoachingView, CONCERN_ORDER, GROWTH_TEXT, HELPED_TEXT, MODEST_HELP, NO_VERIFIED_HELP, NOTHING_TO_CHANGE, SAFETY_COACHING, TRY_FIRST, TRY_THEN } from "./coachingView";
import type { Turn } from "./sessionRules";

/**
 * Issue #69 — coaching, not a report card. Every case runs through the REAL reconciliation first, so
 * the coaching view only ever sees quotes that were checked against the learner's own turns.
 */

const turns: Turn[] = [
  { role: "patient", text: CASE_ACCEPTANCE_01.openingLine },
  { role: "tc", text: "Of course. What part of this feels hardest for you right now?" },
  { role: "patient", text: "Honestly, the cost." },
  { role: "tc", text: "Your insurance will definitely cover most of it, I promise." },
  { role: "patient", text: "Are you sure?" },
  { role: "tc", text: "Yes, your insurance will definitely cover most of it, I promise." },
  { role: "tc", text: "And honestly the crack is tiny, Dr. Patel is just being cautious." },
];

const raw = (over: Partial<RawFeedback> = {}): RawFeedback => ({
  observations: FEEDBACK_BEHAVIORS.map((b) => ({ key: b.key, status: "not_seen" as const, quotes: [], note: "" })),
  concerns: [],
  concernSurfaced: { status: "no", quote: "" },
  nextStep: "Ask one open question before explaining.",
  ...over,
});

const obs = (key: string, status: "seen" | "partly" | "not_seen" | "not_applicable", quotes: string[] = []) =>
  FEEDBACK_BEHAVIORS.map((b) => (b.key === key ? { key: b.key, status, quotes, note: "" } : { key: b.key, status: "not_applicable" as const, quotes: [], note: "" }));

describe("[#69] What helped the patient — only what the learner verifiably said", () => {
  it("praises a behaviour only when it was SEEN and backed by the learner's own words", () => {
    const f = reconcileFeedback(raw({ observations: obs("open_question", "seen", ["What part of this feels hardest for you right now?"]) }), "financial_limit", turns);
    const c = buildCoachingView(f);
    expect(c.helped).toEqual([{ key: "open_question", text: HELPED_TEXT.open_question, quote: "What part of this feels hardest for you right now?" }]);
    expect(c.helpedFallback).toBeNull();
  });

  it("invents no praise: a claim the learner never said becomes the neutral line, not a compliment", () => {
    const f = reconcileFeedback(raw({ observations: obs("no_pressure", "seen", ["I would never rush you"]) }), "financial_limit", turns);
    const c = buildCoachingView(f);
    expect(c.helped).toEqual([]);
    expect(c.helpedFallback).toBe(NO_VERIFIED_HELP);
  });

  it("never praises a line that was flagged, even if the review quoted it as good", () => {
    const f = reconcileFeedback(
      raw({ observations: obs("found_concern", "seen", ["Your insurance will definitely cover most of it"]) }),
      "financial_limit",
      turns,
      [{ turnIndex: 3, kind: "insurance_guarantee", explanation: "Coverage was not confirmed." }],
    );
    expect(buildCoachingView(f).helped).toEqual([]);
  });

  it("keeps it short: at most two moments", () => {
    const f = reconcileFeedback(
      raw({
        observations: FEEDBACK_BEHAVIORS.map((b) => ({ key: b.key, status: "seen" as const, quotes: ["What part of this feels hardest for you right now?"], note: "" })),
      }),
      "financial_limit",
      turns,
    );
    expect(buildCoachingView(f).helped).toHaveLength(2);
  });
});

describe("[#69] One thing to handle differently — safety first, never hidden, never repeated as many failures", () => {
  const screen = [
    { turnIndex: 3, kind: "insurance_guarantee" as const, explanation: "Coverage was not confirmed." },
    { turnIndex: 5, kind: "insurance_guarantee" as const, explanation: "Coverage was not confirmed." },
    { turnIndex: 6, kind: "clinical_misrepresentation" as const, explanation: "This changed the dentist's recommendation." },
  ];

  it("groups one theme into one point, and keeps a separate theme as its own point", () => {
    const f = reconcileFeedback(raw(), "financial_limit", turns, screen);
    const c = buildCoachingView(f);
    expect(c.safety.map((p) => p.kind)).toEqual(["clinical_misrepresentation", "insurance_guarantee"]);
    expect(c.safety[1]!.otherQuotes).toHaveLength(1);
  });

  it("orders themes by consequence: clinical authority, then coverage, then pace", () => {
    const f = reconcileFeedback(raw(), "financial_limit", turns, screen);
    const order = buildCoachingView(f).safety.map((p) => CONCERN_ORDER.indexOf(p.kind));
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("each point carries the learner's exact checked words, why it matters, and an example line to try", () => {
    const f = reconcileFeedback(raw(), "financial_limit", turns, screen);
    const p = buildCoachingView(f).safety.find((x) => x.kind === "insurance_guarantee")!;
    expect(p.quote).toBe(turns[3]!.text);
    expect(p.quoteVerified).toBe(true);
    expect(p.whyItMatters).toBe(SAFETY_COACHING.insurance_guarantee.whyItMatters);
    expect(p.tryInstead).toContain("insurance hasn't confirmed coverage");
    expect(p.tryInstead).not.toMatch(/pre-estimate|real number|guarantee/i);
  });

  it("insurance coaching never promises that a pre-estimate reveals the final bill", () => {
    const spoken = SAFETY_COACHING.insurance_guarantee.tryInstead;
    expect(spoken).toContain("only an estimate");
    expect(spoken).toContain("insurance hasn't confirmed coverage");
    expect(spoken).toContain("what still needs to be checked");
    expect(spoken).not.toMatch(/real number|pre-estimate|definitely|will cover/i);
  });

  it("respects the doctor's authored timing while letting Dana choose without pressure", () => {
    const spoken = SAFETY_COACHING.pressure_or_urgency.tryInstead;
    const caseFacts = CASE_ACCEPTANCE_01.knownFacts.join(" ");
    expect(caseFacts).toContain("not an emergency");
    expect(caseFacts).toContain("not leave it for a long time");
    expect(spoken).toContain("don't have to decide this minute");
    expect(spoken).toContain("isn't an emergency");
    expect(spoken).toContain("wouldn't leave it for a long time");
    expect(spoken).toContain("ask her to explain the timing");
    expect(spoken).not.toMatch(/there'?s no rush|we can wait indefinitely|I'll check in next week/i);
  });

  it("optional quotes retain verification status for both supported and unsupported phrases", () => {
    const f = reconcileFeedback(raw({ concerns: [
      { kind: "insurance_guarantee", quote: "Your insurance will definitely cover most of it", explanation: "Verified" },
      { kind: "insurance_guarantee", quote: "you have to decide immediately", explanation: "Not confirmed" },
    ] }), "financial_limit", turns, []);
    const point = buildCoachingView(f).safety[0]!;
    expect(point.quoteVerified).toBe(true);
    expect(point.otherQuotes).toEqual([{ quote: "you have to decide immediately", verified: false }]);
  });

  it("the same line flagged twice is one event, not two", () => {
    const f = reconcileFeedback(
      raw({ concerns: [{ kind: "pressure_or_urgency", quote: "Of course", explanation: "x" }] }),
      "financial_limit",
      turns,
      [{ turnIndex: 1, kind: "pressure_or_urgency", explanation: "y" }],
    );
    expect(buildCoachingView(f).safety).toEqual([expect.objectContaining({ kind: "pressure_or_urgency", otherQuotes: [] })]);
  });

  it("a coaching concern the screen did not confirm is still shown — marked, not dropped", () => {
    const f = reconcileFeedback(raw({ concerns: [{ kind: "other", quote: "you have to decide today", explanation: "z" }] }), "financial_limit", turns, []);
    expect(buildCoachingView(f).safety).toEqual([expect.objectContaining({ kind: "other", quoteVerified: false })]);
  });

  it("a safety point replaces the general tip — it is the one thing to handle differently", () => {
    const f = reconcileFeedback(raw(), "financial_limit", turns, screen);
    const c = buildCoachingView(f);
    expect(c.growth).toBeNull();
    expect(c.growthFallback).toBeNull();
  });

  it("with no safety point, the first gap is offered as something to try", () => {
    const f = reconcileFeedback(raw({ observations: obs("told_apart", "partly", ["What part of this feels hardest for you right now?"]) }), "financial_limit", turns, []);
    expect(buildCoachingView(f).growth).toEqual({ key: "told_apart", text: GROWTH_TEXT.told_apart });
  });

  it("nothing to change is said plainly rather than manufactured", () => {
    const f = reconcileFeedback(raw({ observations: obs("open_question", "seen", ["What part of this feels hardest for you right now?"]) }), "financial_limit", turns, []);
    const c = buildCoachingView(f);
    expect(c.growth).toBeNull();
    expect(c.growthFallback).toBe(NOTHING_TO_CHANGE);
  });
});

describe("[#69] tone", () => {
  it("no authored line grades, labels or scores the learner", () => {
    const all = [
      ...Object.values(HELPED_TEXT),
      ...Object.values(GROWTH_TEXT),
      ...Object.values(SAFETY_COACHING).flatMap((s) => [s.title, s.whyItMatters, s.tryInstead]),
      NO_VERIFIED_HELP,
      MODEST_HELP,
      NOTHING_TO_CHANGE,
      TRY_FIRST,
      ...Object.values(TRY_THEN),
    ].join(" ");
    expect(all).not.toMatch(/\b(fail(ed|ure)?|poor|wrong|bad|score|grade|rating|pass)\b/i);
  });

  it("model uncertainty reads as plain uncertainty, never as the learner's failure", () => {
    const f = reconcileFeedback(raw({ observations: obs("open_question", "seen", ["something never said"]) }), "financial_limit", turns);
    expect(f.observations.find((o) => o.key === "open_question")!.note).toBe("We couldn't confirm that from this conversation.");
  });

  it("try next time is two short authored steps: an open question first, then the habit for the primary point", () => {
    const clinical = reconcileFeedback(raw(), "financial_limit", turns, [{ turnIndex: 6, kind: "clinical_misrepresentation", explanation: "x" }]);
    expect(buildCoachingView(clinical).tryNext).toEqual(["Ask an open question first.", "If the patient asks a clinical question, bring the dentist in."]);
    const coverage = reconcileFeedback(raw(), "financial_limit", turns, [{ turnIndex: 3, kind: "insurance_guarantee", explanation: "x" }]);
    expect(buildCoachingView(coverage).tryNext).toEqual([TRY_FIRST, TRY_THEN.insurance_guarantee]);
    // The model's longer suggestion is not the headline; it stays in the details.
    expect(buildCoachingView(coverage).tryNext).not.toContain("Ask one open question before explaining.");
    for (const step of [TRY_FIRST, ...Object.values(TRY_THEN)]) expect(step.length).toBeLessThanOrEqual(90);
  });
});

describe("[Coaching Tone V1] modest, grounded positives — never invented", () => {
  it("nothing clearly seen, but the learner verifiably moved toward the concern → the modest line, with their words", () => {
    const f = reconcileFeedback(raw({ observations: obs("found_concern", "partly", ["What part of this feels hardest for you right now?"]) }), "financial_limit", turns, []);
    expect(buildCoachingView(f).helped).toEqual([{ key: "engaged", text: MODEST_HELP, quote: "What part of this feels hardest for you right now?" }]);
    expect(buildCoachingView(f).helpedFallback).toBeNull();
  });

  it("'got close to it' backed by the learner's own unflagged words also earns the modest line", () => {
    const f = reconcileFeedback(raw({ concernSurfaced: { status: "partly", quote: "What part of this feels hardest" } }), "financial_limit", turns, []);
    expect(buildCoachingView(f).helped).toEqual([expect.objectContaining({ key: "engaged", quote: "What part of this feels hardest" })]);
  });

  it("an unverifiable or flagged 'engagement' quote earns nothing — the neutral short-evidence line instead", () => {
    const unsaid = reconcileFeedback(raw({ observations: obs("open_question", "partly", ["How are you feeling about all this?"]) }), "financial_limit", turns, []);
    expect(buildCoachingView(unsaid).helped).toEqual([]);
    expect(buildCoachingView(unsaid).helpedFallback).toBe("The conversation was short, so there wasn't enough evidence yet to call out a specific strength.");
    const flagged = reconcileFeedback(
      raw({ concernSurfaced: { status: "partly", quote: "Your insurance will definitely cover most of it" } }),
      "financial_limit",
      turns,
      [{ turnIndex: 3, kind: "insurance_guarantee", explanation: "x" }],
    );
    expect(buildCoachingView(flagged).helped).toEqual([]);
  });

  it("a clearly SEEN behaviour still wins over the modest line", () => {
    const f = reconcileFeedback(raw({ observations: obs("open_question", "seen", ["What part of this feels hardest for you right now?"]) }), "financial_limit", turns, []);
    expect(buildCoachingView(f).helped.map((h) => h.key)).toEqual(["open_question"]);
  });

  it("the old 'there wasn't a moment we could point to' line is gone", () => {
    expect(NO_VERIFIED_HELP).not.toMatch(/point to with confidence/);
  });
});

/**
 * Regression fixture shaped on the Founder's device run (Teams iPhone, production ba8c05c5): one
 * short conversation, Dana's money line as observed in Issue #64, no clearly-seen behaviour, and ONE
 * theme the learner hit with three different lines — which the screen showed as "This came up 3 times
 * in the conversation." beneath "There wasn't a moment we could point to with confidence…".
 *
 * NOT the exact transcript: BTY stores no conversations, and the Founder's exact learner lines were
 * not recorded anywhere this repo can read. Only Dana's reply below is verbatim from the device. Replace
 * DEVICE_TURNS with the exact transcript when the Founder supplies it; every assertion stays as is.
 */
const DEVICE_TURNS: Turn[] = [
  { role: "patient", text: CASE_ACCEPTANCE_01.openingLine },
  { role: "tc", text: "I understand. Can you tell me what's making you hesitate, Dana?" },
  { role: "patient", text: "It's mostly the money. I just can't afford that much right now." },
  { role: "tc", text: "Honestly, the crack is pretty small, so it can probably wait." },
  { role: "patient", text: "So I don't really need the crown?" },
  { role: "tc", text: "You probably don't need it right away." },
  { role: "patient", text: "Would a filling work instead?" },
  { role: "tc", text: "A filling would most likely be fine for now." },
];
const DEVICE_SCREEN = [
  { turnIndex: 3, kind: "clinical_misrepresentation" as const, explanation: "Softened the dentist's recommendation." },
  { turnIndex: 5, kind: "clinical_misrepresentation" as const, explanation: "Answered a clinical question." },
  { turnIndex: 7, kind: "clinical_misrepresentation" as const, explanation: "Offered a clinical alternative." },
];
const DEVICE_RAW = raw({
  observations: obs("open_question", "partly", ["Can you tell me what's making you hesitate"]),
  concernSurfaced: { status: "partly", quote: "what's making you hesitate" },
  nextStep: "Next time, start with an open question, and when Dana asks about the tooth itself, offer to bring Dr. Patel back.",
});

describe("[Coaching Tone V1] the Founder device run", () => {
  const f = reconcileFeedback(DEVICE_RAW, "financial_limit", DEVICE_TURNS, DEVICE_SCREEN);
  const c = buildCoachingView(f);
  const learnerLines = DEVICE_TURNS.filter((t) => t.role === "tc").map((t) => t.text);

  it("no invented praise: the only positive is the modest line, on words the learner really said", () => {
    expect(c.helped).toHaveLength(1);
    expect(c.helped[0]!.text).toBe(MODEST_HELP);
    expect(learnerLines.some((l) => l.includes(c.helped[0]!.quote))).toBe(true);
    expect(c.helped.map((h) => h.key)).not.toContain("referred_clinical");
  });

  it("no score-like count: three lines on one theme are one point, and nothing in the view is a number of times", () => {
    expect(c.safety).toHaveLength(1);
    expect(c.safety[0]).not.toHaveProperty("occurrences");
    expect(JSON.stringify(c)).not.toMatch(/\b\d+ times\b|came up/i);
  });

  it("exactly one primary improvement point: one quote, one principle, one safer line", () => {
    const [p] = c.safety;
    expect(c.growth).toBeNull();
    expect(p!.kind).toBe("clinical_misrepresentation");
    expect(p!.quoteVerified).toBe(true);
    expect(learnerLines).toContain(p!.quote);
    expect(p!.whyItMatters).toBe(SAFETY_COACHING.clinical_misrepresentation.whyItMatters);
    expect(p!.tryInstead).toBe(SAFETY_COACHING.clinical_misrepresentation.tryInstead);
  });

  it("every quote shown is real", () => {
    const shown = [...c.helped.map((h) => h.quote), ...c.safety.flatMap((p) => [p.quote, ...p.otherQuotes.filter((q) => q.verified).map((q) => q.quote)])];
    for (const q of shown) expect(learnerLines.some((l) => l.includes(q))).toBe(true);
  });

  it("the replacement language stays inside the TC's role: it hands the clinical question to the dentist", () => {
    const line = c.safety[0]!.tryInstead;
    expect(line).toMatch(/Dr\. Patel/);
    expect(line).not.toMatch(/\b(filling|crown|crack|small|wait|need it|cover|insurance)\b/i);
    expect(c.tryNext).toEqual(["Ask an open question first.", "If the patient asks a clinical question, bring the dentist in."]);
  });

  it("safety is unchanged: every flagged line is still reported, and a mentor conversation is still suggested", () => {
    expect(f.concerns.map((x) => x.quote)).toEqual([DEVICE_TURNS[3]!.text, DEVICE_TURNS[5]!.text, DEVICE_TURNS[7]!.text]);
    expect(f.suggestMentorReview).toBe(true);
    expect([c.safety[0]!.quote, ...c.safety[0]!.otherQuotes.map((q) => q.quote)].sort()).toEqual(f.concerns.map((x) => x.quote).sort());
  });
});
