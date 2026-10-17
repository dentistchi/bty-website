import { describe, expect, it } from "vitest";
import { AI_PATIENT_SCENARIO_CATALOG, AI_PATIENT_SCENARIO_IDS, DEFAULT_SCENARIO_ID, type AiPatientScenarioId } from "./scenarioCatalog";
import { AI_PATIENT_SCENARIOS, isValidSessionCase, resolveCase } from "./scenarios";
import { CASE_ACCEPTANCE_01, type AiPatientCase } from "./caseAcceptance01";
import { buildPatientSystemPrompt } from "./patientPrompt";
import { buildFeedbackMessages, FEEDBACK_BEHAVIORS, reconcileFeedback, type ConcernKind, type RawFeedback } from "./feedback";
import { buildSafetyScreenMessages } from "./safetyScreen";
import { buildCoachingView, GROWTH_TEXT, HELPED_TEXT, SAFETY_COACHING, TRY_FIRST, TRY_THEN } from "./coachingView";
import type { Turn } from "./sessionRules";

/**
 * SCENARIO PACK V1 — the test matrix. Every scenario runs through the SAME reconciliation and coaching
 * code; only its case data differs. Each scenario has one focused regression conversation: a listening
 * line the review credits twice (the one-utterance rule must keep one), and one line that crosses the
 * scenario's own boundary, flagged by the safety screen.
 */

/** The opening lines exactly as the Founder specified them. */
const SPEC_OPENINGS: Record<AiPatientScenarioId, string> = {
  cost_concern: "That's a lot more than I expected. I'm not sure I can afford this.",
  just_pull_it: "I don't want to spend all that money trying to save it. Can't you just pull it?",
  afraid_of_treatment: "I don't think I can do this. Dental treatment really scares me.",
  insurance_will_cover_it: "My insurance is good. They're going to cover all of this, right?",
  why_do_i_need_this: "But why do I actually need this treatment? The tooth doesn't even hurt.",
  need_it_today: "I took today off. I need you to just get this done today.",
  trust_after_bad_experience: "Last time I was here, nobody explained anything to me. Why should I trust this now?",
};

const SPEC_TITLES: Record<AiPatientScenarioId, string> = {
  cost_concern: "Cost Concern",
  just_pull_it: "Just Pull It",
  afraid_of_treatment: "Afraid of Treatment",
  insurance_will_cover_it: "Insurance Will Cover It",
  why_do_i_need_this: "Why Do I Need This?",
  need_it_today: "I Need It Today",
  trust_after_bad_experience: "I Don't Trust This Office",
};

/** One focused regression conversation per scenario. */
const CONVERSATIONS: Record<AiPatientScenarioId, { listen: string; patientOpens: string; crossing: string; kind: ConcernKind }> = {
  cost_concern: {
    listen: "That's a fair reaction. What part of this feels hardest right now — the cost, or something about the treatment?",
    patientOpens: "Honestly it's the money. We had a car repair this month.",
    crossing: "Don't worry, your insurance will cover most of it.",
    kind: "insurance_guarantee",
  },
  just_pull_it: {
    listen: "I hear you. What makes pulling it feel like the better option for you?",
    patientOpens: "It's cheaper and I just want it over with.",
    crossing: "Honestly, pulling it is the smarter choice for a back tooth.",
    kind: "clinical_misrepresentation",
  },
  afraid_of_treatment: {
    listen: "That sounds really hard. What part of it worries you most?",
    patientOpens: "The needle. And not being able to make it stop.",
    crossing: "You'll be fine, it won't hurt at all.",
    kind: "clinical_misrepresentation",
  },
  insurance_will_cover_it: {
    listen: "Good question. What have you been told about what your plan covers?",
    patientOpens: "I figured the sheet is what they'll pay.",
    crossing: "Yes, with good insurance you're fully covered.",
    kind: "insurance_guarantee",
  },
  why_do_i_need_this: {
    listen: "That's a really fair question. What would help you feel sure about it?",
    patientOpens: "I just want to understand why, if it doesn't hurt.",
    crossing: "If you wait, the crack will spread and the tooth will split.",
    kind: "clinical_misrepresentation",
  },
  need_it_today: {
    listen: "I can see today took a lot. Can I ask why getting it done today matters so much?",
    patientOpens: "It's an unpaid day. I can't lose another one.",
    crossing: "Sure, we can get it done today.",
    kind: "other",
  },
  trust_after_bad_experience: {
    listen: "I'm sorry it felt that way. Would you tell me what happened last time?",
    patientOpens: "I felt rushed and the bill was a surprise.",
    crossing: "I'm sure someone explained it to you.",
    kind: "other",
  },
};

function transcript(id: AiPatientScenarioId): Turn[] {
  const c = CONVERSATIONS[id];
  return [
    { role: "patient", text: AI_PATIENT_SCENARIOS[id].openingLine },
    { role: "tc", text: c.listen },
    { role: "patient", text: c.patientOpens },
    { role: "tc", text: c.crossing },
  ];
}

/** The review a model might return: the listening line credited for TWO behaviours, the crossing line as a concern. */
function review(id: AiPatientScenarioId): RawFeedback {
  const c = CONVERSATIONS[id];
  return {
    observations: FEEDBACK_BEHAVIORS.map((b) =>
      b.key === "told_apart" || b.key === "found_concern"
        ? { key: b.key, status: "seen" as const, quotes: [c.listen], note: "" }
        : { key: b.key, status: "not_seen" as const, quotes: [], note: "" },
    ),
    concerns: [{ kind: c.kind, quote: c.crossing, explanation: "Crossed the boundary." }],
    concernSurfaced: { status: "yes", quote: c.listen },
    nextStep: "Keep asking first.",
  };
}

function run(id: AiPatientScenarioId) {
  const kase = AI_PATIENT_SCENARIOS[id];
  const turns = transcript(id);
  const concern = Object.keys(kase.hiddenConcerns)[0]!;
  const f = reconcileFeedback(review(id), concern, turns, [{ turnIndex: 3, kind: CONVERSATIONS[id].kind, explanation: "Flagged." }], kase);
  return { kase, turns, f, c: buildCoachingView(f, turns, kase.coaching) };
}

/** Lines the coaching itself suggests. None may promise, diagnose or guarantee. */
function authoredLines(kase: AiPatientCase): string[] {
  const kinds = Object.keys(SAFETY_COACHING) as ConcernKind[];
  return [
    ...kinds.flatMap((k) => [kase.coaching?.safety?.[k]?.tryInstead ?? SAFETY_COACHING[k].tryInstead]),
    ...Object.values(kase.coaching?.helped ?? {}),
    ...Object.values(kase.coaching?.growth ?? {}),
    ...Object.values(kase.coaching?.tryThen ?? {}),
  ];
}

const CERTAINTY = /\b(will (?:cover|pay)|fully covered|covered in full|guarantee[ds]?|won'?t hurt|you'?ll be fine|definitely|nothing to worry|we can (?:do|get) it (?:done )?today|simple procedure|smarter choice|better option is)\b/i;

describe("[Scenario Pack V1] the catalog and the case files", () => {
  it("seven scenarios, in the specified order, with the specified titles; Cost Concern is the default", () => {
    expect([...AI_PATIENT_SCENARIO_IDS]).toEqual(Object.keys(SPEC_OPENINGS));
    expect(AI_PATIENT_SCENARIO_CATALOG.map((s) => [s.id, s.title])).toEqual(Object.entries(SPEC_TITLES));
    expect(DEFAULT_SCENARIO_ID).toBe("cost_concern");
    for (const s of AI_PATIENT_SCENARIO_CATALOG) expect(s.description.length).toBeLessThanOrEqual(70);
  });

  it("the client-safe catalog carries no hidden concern, truth or reveal rule", () => {
    const catalog = JSON.stringify(AI_PATIENT_SCENARIO_CATALOG);
    for (const kase of Object.values(AI_PATIENT_SCENARIOS)) {
      for (const [key, def] of Object.entries(kase.hiddenConcerns)) {
        expect(catalog).not.toContain(key);
        expect(catalog).not.toContain(def.label);
        expect(catalog).not.toContain(def.patientTruth);
      }
    }
  });

  it("a sealed session is valid only on a known case with one of that case's own concerns", () => {
    expect(isValidSessionCase("afraid_of_treatment", "fear_of_treatment")).toBe(true);
    expect(isValidSessionCase("afraid_of_treatment", "financial_limit")).toBe(false);
    expect(isValidSessionCase("made_up", "fear_of_treatment")).toBe(false);
    expect(isValidSessionCase(CASE_ACCEPTANCE_01.id, "clinical_need_doubt")).toBe(true); // pre-pack sessions finish
    expect(isValidSessionCase("cost_concern", "toString")).toBe(false);
    expect(resolveCase(CASE_ACCEPTANCE_01.id)).toBe(CASE_ACCEPTANCE_01);
  });

  it("Cost Concern keeps the device-pass case truth and coaching wording unchanged", () => {
    const cost = AI_PATIENT_SCENARIOS.cost_concern;
    expect(cost.patientName).toBe("Dana");
    expect(cost.knownFacts).toEqual(CASE_ACCEPTANCE_01.knownFacts);
    expect(cost.reviewerFacts).toEqual(CASE_ACCEPTANCE_01.reviewerFacts);
    expect(Object.keys(cost.hiddenConcerns)).toEqual(["financial_limit"]);
    expect(cost.coaching).toBeUndefined();
    expect(cost.learnerTargets).toBeUndefined();
  });
});

describe.each([...AI_PATIENT_SCENARIO_IDS])("[Scenario Pack V1] %s", (id) => {
  const kase = AI_PATIENT_SCENARIOS[id];
  const concern = Object.keys(kase.hiddenConcerns)[0]!;

  it("1–2. loads, and opens on the specified line", () => {
    expect(resolveCase(id)).toBe(kase);
    expect(kase.id).toBe(id);
    expect(kase.openingLine).toBe(SPEC_OPENINGS[id]);
    expect(Object.keys(kase.hiddenConcerns)).toHaveLength(1);
  });

  it("3. the patient is held in role: its own facts and concern, the shared role policy, nothing to coach with", () => {
    const p = buildPatientSystemPrompt(concern, kase);
    expect(p).toContain(`You are role-playing ${kase.patientName}`);
    for (const f of kase.knownFacts) expect(p).toContain(f);
    expect(p).toContain(kase.hiddenConcerns[concern]!.patientTruth);
    expect(p).toMatch(/Never invent clinical facts, insurance facts, prices, policies or payment options/);
    expect(p).toMatch(/is not your dentist/);
    expect(p).toMatch(/Never diagnose yourself/);
    expect(p).toMatch(/Never invent history/);
    expect(p).toMatch(/Never coach, praise, grade or give feedback/);
    // Other scenarios' private truths never leak in.
    for (const other of Object.values(AI_PATIENT_SCENARIOS)) {
      if (other === kase) continue;
      for (const def of Object.values(other.hiddenConcerns)) expect(p).not.toContain(def.patientTruth);
    }
  });

  it("4. listening can move the patient: guarded at first, opening up when heard, closing when pushed", () => {
    const p = buildPatientSystemPrompt(concern, kase);
    expect(p).toContain(kase.hiddenConcerns[concern]!.revealWhen);
    expect(p).toMatch(/you start guarded/i);
    expect(p).toMatch(/being listened to makes you more engaged and then more open/);
    expect(p).toMatch(/more frustrated or more closed/);
    // The internal state labels are instructions to the model only — never part of what the learner sees.
    expect(JSON.stringify(AI_PATIENT_SCENARIO_CATALOG)).not.toMatch(/guarded|engaged|frustrated/i);
  });

  it("5. no coaching line encourages clinical or insurance certainty, and the reviewers see this scenario's boundaries", () => {
    for (const line of authoredLines(kase)) expect(line, line).not.toMatch(CERTAINTY);
    const reviewer = buildFeedbackMessages(concern, transcript(id), kase)[0]!.content;
    const screen = buildSafetyScreenMessages(transcript(id), kase)[0]!.content;
    for (const fact of kase.reviewerFacts) {
      expect(reviewer).toContain(fact);
      expect(screen).toContain(fact);
    }
    for (const b of kase.roleBoundaries ?? []) {
      expect(reviewer).toContain(b);
      expect(screen).toContain(b);
    }
  });

  it("6–7. End produces coaching, and every quote in it is the learner's own words", () => {
    const { c, turns } = run(id);
    expect(c.helped.length).toBeGreaterThan(0);
    const learner = turns.filter((t) => t.role === "tc").map((t) => t.text);
    const quotes = [...c.helped.map((h) => h.quote), ...c.safety.map((p) => p.quote)];
    for (const q of quotes) expect(learner.some((l) => l.includes(q)), q).toBe(true);
  });

  it("8. one utterance backs at most one positive point — and it is the scenario's own wording", () => {
    const { c } = run(id);
    expect(c.helped).toEqual([{ key: "told_apart", text: kase.coaching?.helped?.told_apart ?? HELPED_TEXT.told_apart, quote: CONVERSATIONS[id].listen }]);
    expect(c.helped.length).toBeLessThanOrEqual(2);
  });

  it("9. exactly one main improvement: the boundary this conversation crossed", () => {
    const { c } = run(id);
    expect(c.safety).toHaveLength(1);
    expect(c.safety[0]!.kind).toBe(CONVERSATIONS[id].kind);
    expect(c.safety[0]!.quote).toBe(CONVERSATIONS[id].crossing);
    expect(c.growth).toBeNull();
  });

  it("10. Try next time stays two short steps", () => {
    const { c } = run(id);
    expect(c.tryNext).toHaveLength(2);
    expect(c.tryNext[0]).toBe(TRY_FIRST);
    for (const step of c.tryNext) expect(step.length).toBeLessThanOrEqual(90);
    for (const step of Object.values(kase.coaching?.tryThen ?? {})) expect(step.length).toBeLessThanOrEqual(90);
  });

  it("11. safety stays visible and suggests a mentor; nothing in the view is a count", () => {
    const { c, f } = run(id);
    expect(f.suggestMentorReview).toBe(true);
    expect(c.safety[0]!.quoteVerified).toBe(true);
    expect(c.safety[0]!.tryInstead.length).toBeGreaterThan(0);
    expect(JSON.stringify(c)).not.toMatch(/\b\d+ times\b|came up/i);
  });

  it("the details label and the revealed concern come from this scenario", () => {
    const { f } = run(id);
    expect(f.hiddenConcern.label).toBe(kase.hiddenConcerns[concern]!.label);
    const label = f.observations.find((o) => o.key === "told_apart")!.label;
    expect(label).toBe(kase.learnerTargets?.told_apart?.label ?? FEEDBACK_BEHAVIORS.find((b) => b.key === "told_apart")!.label);
  });
});

describe("[Scenario Pack V1] one engine", () => {
  it("scenarios only supply wording: the same review shapes into the same structure under every scenario's copy", () => {
    const shapes = AI_PATIENT_SCENARIO_IDS.map((id) => {
      const { c } = run(id);
      return { helped: c.helped.map((h) => h.key), safety: c.safety.length, growth: c.growth, tryNext: c.tryNext.length };
    });
    for (const s of shapes) expect(s).toEqual({ helped: ["told_apart"], safety: 1, growth: null, tryNext: 2 });
  });

  it("Cost Concern's coaching is byte-for-byte the pre-pack wording", () => {
    const { c } = run("cost_concern");
    expect(c.helped[0]!.text).toBe(HELPED_TEXT.told_apart);
    expect(c.safety[0]!.tryInstead).toBe(SAFETY_COACHING.insurance_guarantee.tryInstead);
    expect(c.tryNext).toEqual([TRY_FIRST, TRY_THEN.insurance_guarantee]);
    expect(GROWTH_TEXT.told_apart).toMatch(/cost/);
  });
});

describe("[Scenario Pack V1] hidden concerns stay on the server", () => {
  it("nothing the screen imports pulls in a case file: only type imports from feedback/case modules", async () => {
    const { readFileSync } = await import("node:fs");
    const files = ["src/components/app-shell/AiPatientPractice.tsx", "src/domain/arena/aiPatient/coachingView.ts", "src/domain/arena/aiPatient/scenarioCatalog.ts", "src/domain/arena/aiPatient/quoteMatch.ts"];
    for (const f of files) {
      const valueImports = readFileSync(f, "utf8")
        .split("\n")
        .filter((l) => /^import\s+(?!type\b)/.test(l) && /(feedback|caseAcceptance01|scenarios|patientPrompt|safetyScreen)"/.test(l));
      expect(valueImports, f).toEqual([]);
    }
  });
});
