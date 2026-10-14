import { describe, expect, it } from "vitest";
import { CASE_ACCEPTANCE_01 } from "./caseAcceptance01";
import { FEEDBACK_BEHAVIORS, reconcileFeedback, type RawFeedback } from "./feedback";
import { buildCoachingView, CONCERN_ORDER, GROWTH_TEXT, HELPED_TEXT, NO_VERIFIED_HELP, NOTHING_TO_CHANGE, SAFETY_COACHING } from "./coachingView";
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

  it("groups one theme into one point with a count, and keeps a separate theme as its own point", () => {
    const f = reconcileFeedback(raw(), "financial_limit", turns, screen);
    const c = buildCoachingView(f);
    expect(c.safety.map((p) => [p.kind, p.occurrences])).toEqual([
      ["clinical_misrepresentation", 1],
      ["insurance_guarantee", 2],
    ]);
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
    expect(p.tryInstead).toMatch(/hasn't confirmed it yet/);
  });

  it("the same line flagged twice is one event, not two", () => {
    const f = reconcileFeedback(
      raw({ concerns: [{ kind: "pressure_or_urgency", quote: "Of course", explanation: "x" }] }),
      "financial_limit",
      turns,
      [{ turnIndex: 1, kind: "pressure_or_urgency", explanation: "y" }],
    );
    expect(buildCoachingView(f).safety).toEqual([expect.objectContaining({ kind: "pressure_or_urgency", occurrences: 1 })]);
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
      NOTHING_TO_CHANGE,
    ].join(" ");
    expect(all).not.toMatch(/\b(fail(ed|ure)?|poor|wrong|bad|score|grade|rating|pass)\b/i);
  });

  it("model uncertainty reads as plain uncertainty, never as the learner's failure", () => {
    const f = reconcileFeedback(raw({ observations: obs("open_question", "seen", ["something never said"]) }), "financial_limit", turns);
    expect(f.observations.find((o) => o.key === "open_question")!.note).toBe("We couldn't confirm that from this conversation.");
  });

  it("try next time is the review's own single next step", () => {
    const f = reconcileFeedback(raw(), "financial_limit", turns);
    expect(buildCoachingView(f).tryNext).toBe("Ask one open question before explaining.");
  });
});
