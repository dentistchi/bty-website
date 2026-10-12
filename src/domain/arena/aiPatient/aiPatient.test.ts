import { describe, expect, it } from "vitest";
import { CASE_ACCEPTANCE_01, HIDDEN_CONCERNS } from "./caseAcceptance01";
import {
  AI_PATIENT_LIMITS,
  breaksPatientRole,
  cleanLearnerText,
  cleanPatientReply,
  sessionPhase,
  turnsLeft,
  type AiPatientSessionState,
} from "./sessionRules";
import { buildPatientMessages, buildPatientSystemPrompt } from "./patientPrompt";
import { buildFeedbackMessages, FEEDBACK_BEHAVIORS, isLearnerQuote, parseRawFeedback, reconcileFeedback, type RawFeedback } from "./feedback";
import { buildSafetyScreenMessages, parseSafetyScreen } from "./safetyScreen";

const T0 = 1_800_000_000_000;
const session = (over: Partial<AiPatientSessionState> = {}): AiPatientSessionState => ({
  v: 1,
  sid: "s",
  uid: "u",
  caseId: CASE_ACCEPTANCE_01.id,
  concern: "financial_limit",
  startedAt: T0,
  expiresAt: T0 + AI_PATIENT_LIMITS.sessionSeconds * 1000,
  turns: [{ role: "patient", text: CASE_ACCEPTANCE_01.openingLine }],
  ...over,
});

describe("[AI patient] the case is the Training's moment and is plainly fictional", () => {
  it("opens on the exact line the Founder specified for the role-play", () => {
    expect(CASE_ACCEPTANCE_01.openingLine).toBe("I'm not in pain, and my insurance doesn't cover much. I think I need to think about it.");
  });

  it("has exactly the two hidden concerns the pilot distinguishes", () => {
    expect([...HIDDEN_CONCERNS]).toEqual(["financial_limit", "clinical_need_doubt"]);
  });

  it("states that coverage is NOT confirmed and that the patient knows no plan details", () => {
    const facts = CASE_ACCEPTANCE_01.knownFacts.join(" ");
    expect(facts).toMatch(/has not confirmed coverage/);
    expect(facts).toMatch(/do not know your deductible/);
    expect(facts).toMatch(/do not know whether the office offers one/);
  });
});

describe("[AI patient] session limits are enforced from one place", () => {
  it("is active, then time_up, then closed to feedback", () => {
    const s = session();
    expect(sessionPhase(s, T0 + 1000)).toBe("active");
    expect(sessionPhase(s, s.expiresAt + 1)).toBe("time_up");
    expect(sessionPhase(s, s.expiresAt + AI_PATIENT_LIMITS.feedbackGraceSeconds * 1000 + 1)).toBe("feedback_window_closed");
  });

  it("ends the conversation when the learner's turns run out", () => {
    const turns = [session().turns[0]!];
    for (let i = 0; i < AI_PATIENT_LIMITS.maxLearnerTurns; i++) turns.push({ role: "tc", text: `q${i}` }, { role: "patient", text: `a${i}` });
    const s = session({ turns });
    expect(turnsLeft(s)).toBe(0);
    expect(sessionPhase(s, T0 + 1000)).toBe("turns_exhausted");
  });

  it("refuses — never trims — an over-long turn, and treats whitespace as nothing said", () => {
    expect(cleanLearnerText("  hello   there ")).toEqual({ ok: true, text: "hello there" });
    expect(cleanLearnerText("   ")).toEqual({ ok: false, reason: "empty" });
    expect(cleanLearnerText("x".repeat(AI_PATIENT_LIMITS.maxLearnerChars + 1))).toEqual({ ok: false, reason: "too_long" });
  });
});

describe("[AI patient] the patient stays the patient", () => {
  it.each([
    "As an AI, I can't really feel worried.",
    "I'm an assistant here to help you practice.",
    "Great job asking that question!",
    "In this role-play, you should have asked about cost.",
    "You should have asked me what my concern was.",
  ])("a reply that steps out of role is caught: %s", (reply) => {
    expect(breaksPatientRole(reply)).toBe(true);
  });

  it.each([
    "Honestly, it's just a lot of money right now.",
    "Why would I need a crown if it doesn't hurt?",
    "I don't know what my deductible is. Do you?",
  ])("an ordinary patient line is not: %s", (reply) => {
    expect(breaksPatientRole(reply)).toBe(false);
  });

  it("removes speaker labels and stage directions from a spoken line", () => {
    expect(cleanPatientReply('Dana: *sighs* "I just need to think."')).toBe("I just need to think.");
  });

  it("gives the model the case facts, the hidden concern and the in-role rules — and nothing to coach with", () => {
    const p = buildPatientSystemPrompt("clinical_need_doubt");
    for (const f of CASE_ACCEPTANCE_01.knownFacts) expect(p).toContain(f);
    expect(p).toContain(CASE_ACCEPTANCE_01.hiddenConcerns.clinical_need_doubt.patientTruth);
    expect(p).not.toContain(CASE_ACCEPTANCE_01.hiddenConcerns.financial_limit.patientTruth);
    expect(p).toMatch(/Never invent clinical facts, insurance facts, prices, policies or payment options/);
    expect(p).toMatch(/Never say you are an AI/);
    expect(p).toMatch(/Never coach, praise, grade or give feedback/);
  });

  it("maps the transcript onto the conversation: learner = user, patient = assistant, opening first", () => {
    const msgs = buildPatientMessages("financial_limit", [...session().turns, { role: "tc", text: "What feels hardest?" }]);
    expect(msgs.map((m) => m.role)).toEqual(["system", "assistant", "user"]);
    expect(msgs[1]!.content).toBe(CASE_ACCEPTANCE_01.openingLine);
  });
});

const learnerTurns = [
  { role: "patient" as const, text: CASE_ACCEPTANCE_01.openingLine },
  { role: "tc" as const, text: "That makes sense. What part of the decision feels hardest right now?" },
  { role: "patient" as const, text: "Honestly, money is tight this month." },
  { role: "tc" as const, text: "Your insurance will definitely cover most of it, so you should book today." },
];

const raw = (over: Partial<RawFeedback> = {}): RawFeedback => ({
  observations: FEEDBACK_BEHAVIORS.map((b) => ({ key: b.key, status: "not_seen" as const, quotes: [], note: "n" })),
  concerns: [],
  concernSurfaced: { status: "no", quote: "" },
  nextStep: "Ask one open question first.",
  ...over,
});

describe("[AI patient] feedback is grounded in what the learner actually said", () => {
  it("accepts a quote only from the learner's own turns", () => {
    expect(isLearnerQuote("What part of the decision feels hardest", learnerTurns)).toBe(true);
    expect(isLearnerQuote("money is tight this month", learnerTurns)).toBe(false); // the patient said that
    expect(isLearnerQuote("I will waive the fee", learnerTurns)).toBe(false);
  });

  it("an observation claimed without the learner's words becomes 'unclear', never credited", () => {
    const f = reconcileFeedback(
      raw({ observations: [{ key: "open_question", status: "seen", quotes: ["Tell me about your worries"], note: "asked well" }] }),
      "financial_limit",
      learnerTurns,
    );
    const o = f.observations.find((x) => x.key === "open_question")!;
    expect(o.status).toBe("unclear");
    expect(o.quotes).toEqual([]);
  });

  it("reports every behavior exactly once, in a fixed order, even when the model skips some", () => {
    const f = reconcileFeedback(raw({ observations: [] }), "financial_limit", learnerTurns);
    expect(f.observations.map((o) => o.key)).toEqual(FEEDBACK_BEHAVIORS.map((b) => b.key));
    expect(f.observations.every((o) => o.status === "unclear")).toBe(true);
  });

  it("keeps a possible safety concern even when its quote is paraphrased — marked unverified — and suggests a mentor", () => {
    const f = reconcileFeedback(
      raw({
        concerns: [
          { kind: "insurance_guarantee", quote: "Your insurance will definitely cover most of it", explanation: "Coverage was not confirmed." },
          { kind: "pressure_or_urgency", quote: "you need to book right now", explanation: "Pushing for a date." },
        ],
      }),
      "financial_limit",
      learnerTurns,
    );
    expect(f.safetyScreen).toBe("unavailable"); // no screen result was supplied
    expect(f.concerns.map((c) => [c.kind, c.quoteVerified])).toEqual([
      ["insurance_guarantee", true],
      ["pressure_or_urgency", false],
    ]);
    expect(f.suggestMentorReview).toBe(true);
  });

  it("reveals the hidden concern from the case file, not from the model", () => {
    expect(reconcileFeedback(raw(), "clinical_need_doubt", learnerTurns).hiddenConcern).toEqual({
      key: "clinical_need_doubt",
      label: CASE_ACCEPTANCE_01.hiddenConcerns.clinical_need_doubt.label,
    });
  });

  it("asks for no score and names the three unsafe behaviors the reviewer must look for", () => {
    const sys = buildFeedbackMessages("financial_limit", learnerTurns)[0]!.content;
    expect(sys).toMatch(/Never give a score, grade, rating, percentage or pass\/fail/);
    expect(sys).toMatch(/clinical_misrepresentation/);
    expect(sys).toMatch(/insurance_guarantee/);
    expect(sys).toMatch(/pressure_or_urgency/);
  });

  it("rejects malformed model output instead of guessing", () => {
    expect(parseRawFeedback(null)).toBeNull();
    expect(parseRawFeedback({ observations: [], concerns: [], nextStep: "x" })).toBeNull();
    expect(parseRawFeedback({ observations: [], concerns: [], nextStep: "x", concernSurfaced: { status: "maybe", quote: "" } })).toBeNull();
    // Unknown keys and statuses are dropped, not trusted.
    const p = parseRawFeedback({
      observations: [{ key: "made_up", status: "seen", quotes: [], note: "" }, { key: "no_pressure", status: "excellent", quotes: [], note: "" }],
      concerns: [{ kind: "nonsense", quote: "q", explanation: "e" }],
      concernSurfaced: { status: "no", quote: "" },
      nextStep: "x",
    });
    expect(p?.observations).toEqual([]);
    expect(p?.concerns).toEqual([]);
  });
});

describe("[AI patient] the safety screen", () => {
  it("sees what the dentist actually said and that coverage is unconfirmed, and only the TC's lines are numbered", () => {
    const [sys, user] = buildSafetyScreenMessages(learnerTurns);
    for (const f of CASE_ACCEPTANCE_01.reviewerFacts) expect(sys!.content).toContain(f);
    expect(sys!.content).toMatch(/just being cautious/); // the measured miss is named as an example
    expect(user!.content).toContain("LINE 1: That makes sense.");
    expect(user!.content).toContain("LINE 3: Your insurance will definitely cover");
    expect(user!.content).not.toMatch(/LINE 0|LINE 2/);
  });

  it("keeps only findings that point at a real TC line with a known kind, once each", () => {
    expect(
      parseSafetyScreen(
        {
          findings: [
            { line: 3, kind: "insurance_guarantee", explanation: "a" },
            { line: 3, kind: "insurance_guarantee", explanation: "dup" },
            { line: 2, kind: "pressure_or_urgency", explanation: "patient line" },
            { line: 99, kind: "other", explanation: "no such line" },
            { line: 1, kind: "made_up", explanation: "unknown kind" },
          ],
        },
        learnerTurns,
      ),
    ).toEqual([{ turnIndex: 3, kind: "insurance_guarantee", explanation: "a" }]);
    expect(parseSafetyScreen({ nope: true }, learnerTurns)).toBeNull();
  });

  it("a screen finding becomes a verified concern quoting the learner's whole line", () => {
    const f = reconcileFeedback(raw(), "financial_limit", learnerTurns, [{ turnIndex: 3, kind: "insurance_guarantee", explanation: "Not confirmed." }]);
    expect(f.safetyScreen).toBe("ran");
    expect(f.concerns).toEqual([{ kind: "insurance_guarantee", quote: learnerTurns[3]!.text, explanation: "Not confirmed.", quoteVerified: true, source: "screen" }]);
  });

  it("a coaching concern on the same line and kind is merged into the screen's, not repeated", () => {
    const f = reconcileFeedback(
      raw({ concerns: [{ kind: "insurance_guarantee", quote: "Your insurance will definitely cover most of it", explanation: "dup" }] }),
      "financial_limit",
      learnerTurns,
      [{ turnIndex: 3, kind: "insurance_guarantee", explanation: "Not confirmed." }],
    );
    expect(f.concerns).toHaveLength(1);
    expect(f.concerns[0]!.source).toBe("screen");
  });
});
