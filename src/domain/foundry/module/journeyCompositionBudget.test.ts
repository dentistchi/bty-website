import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { overlapRatio } from "@/domain/foundry/module/program-authorship";
import {
  baseActionPhrase,
  renderStandardSentence,
  renderRationaleSentence,
  renderScenarioSentence,
  renderDecisionSentence,
  renderApplicationSentence,
  renderCompletionQuestion,
  renderFollowUpSentence,
  type BehaviorContract,
} from "@/domain/foundry/module/program-coherence";

/**
 * R4-R5C11 — THE DERIVED-OUTPUT REPETITION BUDGET.
 *
 * WHY THIS EXISTS, AND WHY IT IS A TEST AND NOT A RUNTIME GATE.
 *
 * Seven of the nine Journey kinds are rendered by BTY: `deriveContent` discards the model's
 * sentence and composes one from the behaviour contract. Six of those seven restated THE
 * STANDARD's action clause, and four also restated the Host's completion criterion. Measured on
 * one real published training the behaviour clause reached the learner SEVEN times and the
 * criterion FOUR, and the learner described it as being shown the answer and then asked to type
 * it back.
 *
 * A proposal-validator reject code cannot answer that. Pointed at the DISPLAYED text it grades
 * BTY's own renderers and refuses every generation; pointed at the model's prose it grades
 * strings that are discarded before anyone reads them. The composition itself had to change, and
 * what protects the change is an acceptance test over the renderers' own output — no provider
 * call, no runtime refusal, no new content gate on a Host.
 *
 * THE PRODUCT CONTRACT IT ENCODES: the full behavioural instruction appears ONCE, in THE
 * STANDARD. The Host's completion criterion appears there too, because it is a field of the
 * contract THE STANDARD renders — and in WHAT SUCCESS LOOKS LIKE, which is the Host's own
 * evidence section and is not written by these renderers. No other derived section states either.
 */

// ---------------------------------------------------------------------------
// The measure — the repository's own primitive, not a second similarity system
// ---------------------------------------------------------------------------

/**
 * `overlapRatio` is REUSED rather than reimplemented. It is already trusted for
 * `complaint_replay` and `section_contradiction`, and it is SET-BASED, so it scores a reordered
 * clause the same as a verbatim one — "Before ending a handoff, ask X" and "ask X before the
 * handoff ends" both come out at 1.00 against the action. A substring test misses exactly that
 * case, and missing it is how the original measurement first returned a false zero.
 */
const RESTATEMENT_BUDGET = 0.6;

/** Tokens, for the contiguous-run check that covers actions too short to have significant words. */
const tokens = (s: string) =>
  s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);

/**
 * Does `haystack` contain `needle` as a contiguous run of WHOLE tokens?
 *
 * Whole tokens, not raw substring: `overlapRatio` drops words of three characters or fewer, so a
 * one-word action like "ask" scores 0.00 against everything and the ratio alone cannot see it.
 * Raw substring would then flag "you will be asked what happened" for containing "ask", which is
 * a different word. This is the floor that catches literal copying at any length without
 * inventing a stemmer.
 */
function containsPhrase(haystack: string, needle: string): boolean {
  const h = tokens(haystack);
  const n = tokens(needle);
  if (n.length === 0) return false;
  for (let i = 0; i + n.length <= h.length; i++) {
    if (n.every((t, j) => h[i + j] === t)) return true;
  }
  return false;
}

type Restatement = { kind: string; reason: "action" | "criterion"; score: number };

/**
 * THE GUARD. Given the sections BTY derives, report every one that restates the behaviour or the
 * Host's criterion. `observable_standard` is exempt by contract, not by accident: it is the one
 * section entitled to state the whole instruction, and the criterion is a field of the contract
 * it renders.
 */
function restatements(sections: Record<string, string>, b: BehaviorContract): Restatement[] {
  const action = baseActionPhrase(b.observableAction);
  const criterion = b.completion.criterion.trim();
  const out: Restatement[] = [];
  for (const [kind, text] of Object.entries(sections)) {
    if (kind === "observable_standard" || text.length === 0) continue;
    const score = overlapRatio(text, action);
    if (score >= RESTATEMENT_BUDGET || containsPhrase(text, action)) {
      out.push({ kind, reason: "action", score });
    }
    if (criterion.length > 0 && containsPhrase(text, criterion)) {
      out.push({ kind, reason: "criterion", score: overlapRatio(text, criterion) });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const contract = (actor: string, trigger: string, action: string, criterion: string): BehaviorContract =>
  ({ actor, trigger, observableAction: action, completion: { criterion } }) as BehaviorContract;

const SCENARIO = { frame: "time_is_short" } as never;
const APPLICATION = { applicationMoment: "the next one" } as never;
const FOLLOW_UP = { reviewFocus: "what_happened_next", confirmer: "self_report" } as never;
const COMPLETION = { verificationTarget: "the_behaviour", responseMode: "state_what_you_will_say" } as never;

/** Everything BTY renders for one contract, keyed by kind. */
function derivedSections(b: BehaviorContract, problem: string): Record<string, string> {
  return {
    observable_standard: renderStandardSentence(b),
    why_it_matters: renderRationaleSentence(problem, b, null),
    scenario: renderScenarioSentence(b, SCENARIO),
    action_decision: renderDecisionSentence(b, APPLICATION),
    field_application: renderApplicationSentence(b, APPLICATION, null),
    completion_check: renderCompletionQuestion(b, COMPLETION) ?? "",
    follow_up: renderFollowUpSentence(b, FOLLOW_UP, 7),
  };
}

/**
 * THE MEASURED DEFECT, SANITIZED (Slice R4-R5C11 §11).
 *
 * This is the SHAPE of the published training a real learner completed — the Host's behaviour
 * rewritten to a neutral equivalent, with no learner answer, no reflection, no response body and
 * no participant data of any kind. Nothing here was read from a learner; the sentences are the
 * training's own instructional copy, which is what the composition produces.
 */
const CLOSE_THE_LOOP = contract(
  "team members",
  "Before ending a handoff",
  "ask the receiver to state the next action in their own words",
  "another team member can hear it",
);
const CLOSE_THE_LOOP_PROBLEM = "Handoffs end without the receiver confirming what they picked up";

/**
 * WHAT THE LEARNER ACTUALLY READ, recorded verbatim as DATA.
 *
 * These are the pre-repair renderer outputs. They are pinned here rather than reconstructed,
 * because the differential this slice owes is "this shape was produced, and now it is not" — and
 * a test that regenerates both sides from the same code cannot show that.
 */
const BEFORE_REPAIR: Record<string, string> = {
  why_it_matters:
    "Handoffs end without the receiver confirming what they picked up. This program introduces one visible way of working: " +
    "team members ask the receiver to state the next action in their own words. What shows it happened: Another team member can hear it.",
  scenario:
    "Before ending a handoff, even when time is running short, team members must ask the receiver to state the next action " +
    "in their own words. Completion evidence: Another team member can hear it.",
  action_decision: "The next time this happens, I will ask the receiver to state the next action in their own words.",
  field_application:
    "The next time this happens, team members must ask the receiver to state the next action in their own words. " +
    "You will know it happened by this: Another team member can hear it.",
  completion_check: "What exactly will you say when you ask the receiver to state the next action in their own words?",
  follow_up:
    "In 7 days you will be asked what happened after you were expected to ask the receiver to state the next action in " +
    "their own words. That is your own account of it, not an observation.",
};

// ---------------------------------------------------------------------------
// §11 — the real defect fixture, before and after
// ---------------------------------------------------------------------------

describe("[R4-R5C11] §11 the measured training — before and after", () => {
  it("BEFORE: every derived section restated the behaviour, and three restated the criterion", () => {
    const found = restatements(BEFORE_REPAIR, CLOSE_THE_LOOP);
    const byAction = found.filter((f) => f.reason === "action").map((f) => f.kind).sort();
    const byCriterion = found.filter((f) => f.reason === "criterion").map((f) => f.kind).sort();
    // SIX sections beyond THE STANDARD carried the whole behaviour clause: seven occurrences.
    expect(byAction).toEqual([
      "action_decision", "completion_check", "field_application", "follow_up", "scenario", "why_it_matters",
    ]);
    // …and the Host's criterion was copied into three of them, four occurrences with THE STANDARD.
    expect(byCriterion).toEqual(["field_application", "scenario", "why_it_matters"]);
    // Every one of them scored the maximum: this was copying, not resemblance.
    for (const f of found.filter((x) => x.reason === "action")) expect(f.score, f.kind).toBe(1);
  });

  it("AFTER: the behaviour and the criterion appear in THE STANDARD and nowhere BTY writes", () => {
    const sections = derivedSections(CLOSE_THE_LOOP, CLOSE_THE_LOOP_PROBLEM);
    expect(restatements(sections, CLOSE_THE_LOOP)).toEqual([]);
    // The instruction is still stated — once, completely, where it belongs.
    expect(containsPhrase(sections.observable_standard, "ask the receiver to state the next action in their own words")).toBe(true);
    expect(sections.observable_standard).toContain("Completion evidence:");
  });

  it("AFTER: not one of the six is the sentence the learner read", () => {
    const sections = derivedSections(CLOSE_THE_LOOP, CLOSE_THE_LOOP_PROBLEM);
    for (const kind of Object.keys(BEFORE_REPAIR)) {
      expect(sections[kind], kind).not.toBe(BEFORE_REPAIR[kind]);
    }
  });
});

// ---------------------------------------------------------------------------
// §14 — the differential matrix
// ---------------------------------------------------------------------------

describe("[R4-R5C11] §14 T1–T13 — one behaviour, different jobs", () => {
  const sections = derivedSections(CLOSE_THE_LOOP, CLOSE_THE_LOOP_PROBLEM);
  const ACTION = baseActionPhrase(CLOSE_THE_LOOP.observableAction);

  it("T1 — the full behaviour clause occurs only in observable_standard", () => {
    const carrying = Object.entries(sections).filter(([, t]) => containsPhrase(t, ACTION)).map(([k]) => k);
    expect(carrying).toEqual(["observable_standard"]);
  });

  it("T2 — WHY does not use the action phrase", () => {
    expect(containsPhrase(sections.why_it_matters, ACTION)).toBe(false);
    expect(overlapRatio(sections.why_it_matters, ACTION)).toBeLessThan(RESTATEMENT_BUDGET);
    // It still does the job it is there for: the Host's own problem, stated.
    expect(sections.why_it_matters).toContain(CLOSE_THE_LOOP_PROBLEM);
  });

  it("T3 — WHY does not copy the completion evidence", () => {
    expect(containsPhrase(sections.why_it_matters, CLOSE_THE_LOOP.completion.criterion)).toBe(false);
    expect(sections.why_it_matters).not.toContain("What shows it happened");
  });

  it("T4 — IN CONTEXT adds the moment and the pressure without restating the instruction", () => {
    expect(sections.scenario).toContain("Before ending a handoff");
    expect(sections.scenario).toContain("time is running short");
    expect(containsPhrase(sections.scenario, ACTION)).toBe(false);
    expect(containsPhrase(sections.scenario, CLOSE_THE_LOOP.completion.criterion)).toBe(false);
  });

  it("T6 — YOUR DECISION is not a prewritten first-person standard", () => {
    expect(sections.action_decision).not.toMatch(/\bI will\b/);
    expect(containsPhrase(sections.action_decision, ACTION)).toBe(false);
    // It asks. The learner's own answer is the decision.
    expect(sections.action_decision).toMatch(/\?$/);
  });

  it("T7 — the completion question cannot be answered by copying the section above it", () => {
    expect(containsPhrase(sections.completion_check, ACTION)).toBe(false);
    expect(containsPhrase(sections.completion_check, sections.action_decision)).toBe(false);
    expect(containsPhrase(sections.completion_check, sections.field_application)).toBe(false);
    expect(sections.completion_check).toMatch(/\?$/);
  });

  it("T8 — APPLY IT names the occasion and hands the attempt over", () => {
    expect(sections.field_application).toContain("The next time this happens");
    expect(containsPhrase(sections.field_application, ACTION)).toBe(false);
    expect(containsPhrase(sections.field_application, CLOSE_THE_LOOP.completion.criterion)).toBe(false);
  });

  it("T9/T10 — the Host's criterion survives whole in THE STANDARD and is copied nowhere else", () => {
    // `containsPhrase`, not `toContain`: THE STANDARD sentence-cases the criterion after its
    // lead-in, so a case-sensitive match would be testing `upperFirst`, not the criterion.
    expect(containsPhrase(sections.observable_standard, CLOSE_THE_LOOP.completion.criterion)).toBe(true);
    for (const kind of ["why_it_matters", "scenario", "field_application", "follow_up", "completion_check", "action_decision"]) {
      expect(containsPhrase(sections[kind], CLOSE_THE_LOOP.completion.criterion), kind).toBe(false);
    }
  });

  it("T11/T12 — WHAT HAPPENS NEXT keeps the window and the self-report boundary, and states no behaviour", () => {
    for (const days of [7, 30]) {
      const f = renderFollowUpSentence(CLOSE_THE_LOOP, FOLLOW_UP, days);
      expect(f).toContain(`In ${days} days`);
      expect(f).toContain("That is your own account of it, not an observation.");
      expect(containsPhrase(f, ACTION)).toBe(false);
    }
    // The host-confirmed variant keeps its own boundary sentence and is equally quiet.
    const hosted = renderFollowUpSentence(CLOSE_THE_LOOP, { reviewFocus: "the_confirmation", confirmer: "the_host" } as never, 30);
    expect(hosted).toContain("Your host will read it with you.");
    expect(containsPhrase(hosted, ACTION)).toBe(false);
  });

  it("T13 — a very short standard produces no pathological or empty output", () => {
    for (const [actor, trigger, action, criterion] of [
      ["you", "Daily", "ask", "a note exists"],
      ["you", "Now", "stop", "seen"],
      ["you", "Before each call", "listen", "the log shows it"],
    ] as const) {
      const b = contract(actor, trigger, action, criterion);
      const s = derivedSections(b, "It is missed");
      expect(restatements(s, b), action).toEqual([]);
      for (const [kind, text] of Object.entries(s)) {
        expect(text.trim().length, `${action}/${kind}`).toBeGreaterThan(12);
        expect(text, `${action}/${kind}`).not.toMatch(/\s{2,}|,\s*,|\s+\.|undefined|null/);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Calibration — the threshold is measured, not chosen
// ---------------------------------------------------------------------------

describe("[R4-R5C11] §10 the budget is calibrated against both sides", () => {
  /** A spread of real Host shapes: different lengths, actors, and domain vocabulary. */
  const CORPUS: [string, BehaviorContract, string][] = [
    ["handoff", CLOSE_THE_LOOP, CLOSE_THE_LOOP_PROBLEM],
    ["huddle owner", contract("the facilitator", "At each handoff point", "name one owner and one deadline for each open action item", "The huddle notes show a named owner"), "Team huddles end with agreement but no owner"],
    ["shift handover", contract("Doctors", "At the end of every shift", "state each unfinished task out loud to the person taking over", "The handover note lists every open item"), "Unfinished tasks are lost at shift change"],
    ["confirmation call", contract("you", "Before closing each case", "make a confirmation call", "A completed call log is submitted"), "No confirmation calls made today"],
    // The hardest healthy case: the ACTION's own words are the domain's words, so WHY and IN
    // CONTEXT cannot avoid sharing vocabulary with it without lying about the subject.
    ["action words are domain words", contract("you", "Before ending a handoff", "hand off the open items", "the handoff log shows them"), "Handoffs drop items"],
  ];

  it("no shape in the corpus restates, and the worst honest score sits well under the budget", () => {
    let worst = 0;
    for (const [label, b, problem] of CORPUS) {
      const s = derivedSections(b, problem);
      expect(restatements(s, b), label).toEqual([]);
      const action = baseActionPhrase(b.observableAction);
      for (const [kind, text] of Object.entries(s)) {
        if (kind === "observable_standard") continue;
        worst = Math.max(worst, overlapRatio(text, action));
      }
    }
    /*
      MEASURED, not chosen. The worst honest section across the corpus scores 0.33 — WHY THIS
      MATTERS on a program whose Host problem is literally "No confirmation calls made today"
      against an action of "make a confirmation call". That is necessary domain vocabulary, and
      §10 requires it not to fail. The budget sits at 0.60, roughly midway to the other side.
    */
    expect(worst).toBeLessThan(0.4);
    expect(RESTATEMENT_BUDGET).toBeGreaterThan(worst);
  });

  it("every pre-repair section scores the maximum, so the budget separates the two populations", () => {
    for (const [kind, text] of Object.entries(BEFORE_REPAIR)) {
      expect(overlapRatio(text, baseActionPhrase(CLOSE_THE_LOOP.observableAction)), kind).toBe(1);
    }
  });

  it("sections that merely share domain nouns are not flagged", () => {
    const action = baseActionPhrase(CLOSE_THE_LOOP.observableAction);
    for (const [label, text] of Object.entries({
      reflection: "What usually happens when you finish explaining a task during a handoff?",
      why: "When a handoff ends without confirming understanding, ownership and next steps can stay unclear.",
      scenario: "Before ending a handoff, when someone else is already waiting, this is easiest to skip.",
    })) {
      expect(overlapRatio(text, action), label).toBeLessThan(RESTATEMENT_BUDGET);
      expect(containsPhrase(text, action), label).toBe(false);
    }
  });

  it("a reordered clause is caught — the trap a substring test walks into", () => {
    const action = baseActionPhrase(CLOSE_THE_LOOP.observableAction);
    const reordered = "Ask the receiver, before the handoff ends, to state the next action in their own words.";
    // No contiguous run, so the phrase check alone would miss it…
    expect(containsPhrase(reordered, action)).toBe(false);
    // …and the set-based ratio does not care about order.
    expect(overlapRatio(reordered, action)).toBeGreaterThanOrEqual(RESTATEMENT_BUDGET);
  });
});

// ---------------------------------------------------------------------------
// §14 T14/T15 — containment: no new spend, no rewritten history
// ---------------------------------------------------------------------------

describe("[R4-R5C11] §14 T14/T15 — what this slice did NOT touch", () => {
  const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

  it("T14 — the provider budget is unchanged: one bounded retry, and no new call site", () => {
    const svc = read("src/lib/bty/foundry/events/programAuthorshipService.ts");
    expect(svc).toContain("const MAX_ATTEMPTS = 2; // one bounded retry, for present-but-invalid output only");
    expect(svc).toContain("for (let i = 0; i < MAX_ATTEMPTS; i++)");
    /*
      The repetition this slice removes was written by BTY, not by the model, so nothing here
      needed to ask the model again. The prompt rule "Each element must say something DIFFERENT"
      is still truthful for the two kinds whose prose survives, so it stays as it is.
    */
    expect(svc).toContain("Each element must say something DIFFERENT");
  });

  it("T15 — no migration touches a published snapshot, and none was added for this", () => {
    for (const f of readdirSync(join(process.cwd(), "supabase/migrations"))) {
      const sql = read(join("supabase/migrations", f)).replace(/^--.*$/gm, "");
      expect(sql, `${f} must not rewrite module_snapshot`).not.toMatch(
        /update\s+[^;]*foundry_event_module[^;]*module_snapshot/i,
      );
    }
    // Composition is runtime-only: a published journey is frozen at publish and re-renders never.
    expect(readdirSync(join(process.cwd(), "supabase/migrations")).some((f) => /R4[-_]?R5C11|composition/i.test(f))).toBe(false);
  });
});
