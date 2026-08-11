import { describe, it, expect } from "vitest";
import { deriveFirstApplicationMoment } from "./program-coherence";

/**
 * SLICE 3.2P-R3.5 — A MORNING IS NOT A GERUND.
 *
 * W5 (attempt `65923a21`, v11) was refused `trigger_not_recurring` on a canonical draft whose
 * every Host field names the same repeating moment: "During morning huddles…", "At the next
 * huddle…", "…in the next huddle…". The refusal was durable and correct in the narrow sense —
 * whatever the model wrote could not be folded into "the next one" — but the fold itself was
 * broken for this Host's vocabulary.
 *
 * `bareRecurringInstance` refused any occasion head ending in `-ing`, guarding against a gerund
 * folding into "on the next leaving the floor". `morning` ends in `-ing`. Isolated to a single
 * word, before the repair:
 *
 *     at daily huddles    → PASS → "next daily huddles"
 *     at morning huddles  → FAIL → not_recurring
 *
 * The repair is a phrase-shape test, not a word list: an `-ing` head is a MODIFIER when a bare
 * word follows it, and a GERUND when it is phrase-final or takes a determiner.
 */
const folds = (t: string) => deriveFirstApplicationMoment(t);
const value = (t: string) => {
  const r = folds(t);
  return r.ok ? r.value : `REFUSED(${r.reason})`;
};

describe("[3.2P-R3.5] the phrases W5 proved BTY could not express", () => {
  it("the Host's own vocabulary now folds", () => {
    for (const t of [
      "During morning huddles",
      "at morning huddles",
      "at evening handover",
      "during evening rounds",
      "at morning briefing",
    ]) {
      expect(folds(t).ok, `${t} -> ${value(t)}`).toBe(true);
    }
  });

  it("isolated: the ONLY difference was the word, and now there is none", () => {
    expect(value("at daily huddles")).toBe(value("at morning huddles").replace("morning", "daily"));
    expect(folds("at morning standup").ok).toBe(true);
    expect(folds("at daily standup").ok).toBe(true);
  });

  it("the shapes that already worked are untouched", () => {
    expect(folds("at daily huddles").ok).toBe(true);
    expect(folds("at each morning huddle").ok).toBe(true);
    expect(folds("At the end of each morning huddle").ok).toBe(true);
    expect(folds("Whenever a problem is raised in the morning huddle").ok).toBe(true);
    expect(folds("every morning huddle").ok).toBe(true);
  });
});

describe("[3.2P-R3.5] a real gerund is still refused", () => {
  it("by the preposition set, which is what actually caught the documented example", () => {
    /*
      "before leaving the floor" never reached the `-ing` guard: `before` is not one of
      `at|on|during`. The guard was written to defend a case it could not see.
    */
    for (const t of ["before leaving the floor", "after finishing the task", "while preparing the report"]) {
      expect(folds(t), t).toEqual({ ok: false, reason: "not_recurring" });
    }
  });

  it("and by phrase shape, for the gerunds the preposition set DOES admit", () => {
    // A determiner after the -ing word means it has an object: this is an act, not an occasion.
    for (const t of ["on leaving the floor", "on completing the form", "during preparing the report", "at closing my station"]) {
      expect(folds(t), t).toEqual({ ok: false, reason: "not_recurring" });
    }
  });

  it("a phrase-final -ing word stays refused — undecidable, so conservative", () => {
    // "at briefing" could be an occasion or an act; nothing in the phrase decides it, and it
    // was refused before this repair. Widening it is not a bug fix.
    for (const t of ["at briefing", "during onboarding", "on closing"]) {
      expect(folds(t), t).toEqual({ ok: false, reason: "not_recurring" });
    }
  });

  it("non-recurring moments are refused as they always were", () => {
    for (const t of ["one time after the meeting", "tomorrow at 3 PM", "next Tuesday", "in a professional manner"]) {
      expect(folds(t), t).toEqual({ ok: false, reason: "not_recurring" });
    }
  });
});

/**
 * THE AMBIGUOUS FOUR — decided on product semantics, then encoded. None of these is refused
 * because of the `-ing` defect, and none is widened here: each is a separate question about
 * what a definite singular moment MEANS, which this slice does not answer.
 */
describe("[3.2P-R3.5] ambiguous cases keep their current behaviour, for stated reasons", () => {
  it("'At the morning huddle' — refused: a definite singular could be one specific huddle", () => {
    /*
      "the morning huddle" reads generically to a person and specifically to a parser, and BTY
      cannot tell which the model meant. Folding it would silently invent a recurrence.
      Deciding this belongs with Host-owned moment authority, not with a gerund fix.
    */
    expect(folds("At the morning huddle").ok).toBe(false);
    expect(folds("at the end of the morning huddle").ok).toBe(false);
  });

  it("'At the next huddle' — refused: it already names ONE instance, so there is no next one", () => {
    // A trigger that points at a single upcoming occasion has no recurrence to project from.
    // This is correct, not a defect — even though it is the Host's own phrasing.
    expect(folds("At the next huddle").ok).toBe(false);
  });

  it("'when the morning huddle ends' — refused: a condition, not a stated repetition", () => {
    // "when X" may or may not repeat; "whenever X" says it does, and that already folds.
    expect(folds("when the morning huddle ends").ok).toBe(false);
    expect(folds("Whenever the morning huddle ends").ok).toBe(true);
  });
});

describe("[3.2P-R3.5] §4 — the canonical Host source, deterministically", () => {
  it("'During morning huddles' folds to a sensible next application moment", () => {
    const r = folds("During morning huddles");
    expect(r).toEqual({ ok: true, value: "During the next morning huddles" });
  });

  it("and the singular form a model is likelier to write folds too", () => {
    // Leading case follows the input, as every stored moment does — the renderers re-case it.
    expect(value("during morning huddle")).toBe("during the next morning huddle");
    /*
      `at`/`in`/`on` fold PERSPECTIVE-NEUTRAL — the preposition is stripped and `momentClause`
      re-attaches it as "At my next …" or "At the next …" per section. `during` keeps its own,
      because "during the next X" already means what it says. Both are pre-existing.
    */
    expect(value("at morning huddles, before the group leaves")).toBe("next morning huddles, before the group leaves");
  });
});
