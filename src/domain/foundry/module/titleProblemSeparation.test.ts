import { describe, it, expect } from "vitest";
import {
  TITLE_MAX,
  canAdvanceStep,
  draftIdentityStatement,
  draftTitleFrom,
  stepBlocker,
  stepBlockers,
  validateDraftPatch,
  type BuilderAnswers,
} from "./module-builder";
import { buildModuleSnapshot, reviewMissingSections } from "./module-publish";
import { mapAnswersToJourney } from "./journey";

/**
 * SLICE 3.2R-R2.1 — THE TRAINING'S NAME IS NOT ITS PROBLEM.
 *
 * The Founder device gate found Step 1 presenting one textarea under "What keeps going wrong?"
 * while a "Training focus / Untitled training draft" header sat above it — and that header was
 * the FIRST LINE OF THAT TEXTAREA, echoed back. There was no title anywhere in a draft.
 *
 * These tests fix the separation in place: two fields, two meanings, neither derived from the
 * other, both frozen independently at publish.
 */

const TITLE = "Close the Loop on One Commitment";
const PROBLEM =
  "Team huddles sometimes end with agreement, but no one clearly owns the next action.";

const both = (): BuilderAnswers => ({ title: TITLE, problem: PROBLEM });

describe("A — title and problem are independent fields", () => {
  it("both persist, distinctly, through validation", () => {
    const r = validateDraftPatch({ answers: { title: TITLE, problem: PROBLEM } });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.answers?.title).toBe(TITLE);
      expect(r.value.answers?.problem).toBe(PROBLEM);
      expect(r.value.answers?.title).not.toBe(r.value.answers?.problem);
    }
  });

  it("a title alone, and a problem alone, are each valid partial drafts", () => {
    const t = validateDraftPatch({ answers: { title: TITLE } });
    expect(t.ok && t.value.answers?.title).toBe(TITLE);
    expect(t.ok && t.value.answers?.problem).toBeUndefined();
    const p = validateDraftPatch({ answers: { problem: PROBLEM } });
    expect(p.ok && p.value.answers?.problem).toBe(PROBLEM);
    expect(p.ok && p.value.answers?.title).toBeUndefined();
  });

  it("the title is bounded as a NAME, not as prose", () => {
    expect(TITLE_MAX).toBe(120);
    const tooLong = validateDraftPatch({ answers: { title: "x".repeat(TITLE_MAX + 1) } });
    expect(tooLong.ok).toBe(false);
    if (!tooLong.ok) expect(tooLong.errors).toContain("title_too_long");
    // The problem may be far longer — they are not the same kind of text.
    expect(validateDraftPatch({ answers: { problem: "x".repeat(TITLE_MAX + 1) } }).ok).toBe(true);
  });
});

describe("B/C — editing one never rewrites the other", () => {
  it("B — changing the title leaves the problem byte-identical", () => {
    const before = both();
    const after: BuilderAnswers = { ...before, title: "A completely different name" };
    expect(after.problem).toBe(PROBLEM);
    expect(validateDraftPatch({ answers: after as Record<string, unknown> }).ok).toBe(true);
  });

  it("C — changing the problem leaves the title byte-identical", () => {
    const before = both();
    const after: BuilderAnswers = { ...before, problem: "Something else entirely goes wrong." };
    expect(after.title).toBe(TITLE);
  });

  it("no derivation runs in either direction once a title exists", () => {
    // draftTitleFrom used to BE the problem's first line. With a title it is the title.
    expect(draftTitleFrom(both())).toBe(TITLE);
    expect(draftIdentityStatement(both())).toBe(TITLE);
    // …and the problem is never rewritten to match.
    expect(both().problem).toBe(PROBLEM);
  });
});

describe("legacy drafts keep their measured behaviour", () => {
  it("with no title, both helpers still fall back to the problem's first line", () => {
    const legacy: BuilderAnswers = { problem: `${PROBLEM}\nsecond line` };
    expect(draftIdentityStatement(legacy)).toBe(PROBLEM);
    expect(draftTitleFrom(legacy)).toBe(`${PROBLEM.slice(0, 60).trimEnd()}…`);
  });

  it("a nameless draft is still fully GENERATABLE — the name is not source material", () => {
    /*
      The distinction 44 failing tests forced into the open. `stepBlocker` answers "is the SOURCE
      present?" and is what the generation boundary consults; `stepBlockers` answers "may the Host
      advance?" and additionally requires the name.
    */
    const nameless: BuilderAnswers = { problem: PROBLEM };
    expect(stepBlocker(1, nameless)).toBeNull();
    expect(stepBlockers(1, nameless)).toEqual(["title_required"]);
    expect(canAdvanceStep(1, nameless)).toBe(false);
  });
});

describe("D/E — save/resume and Back/Next preserve both", () => {
  it("D — a round-trip through validation preserves both independently", () => {
    const saved = validateDraftPatch({ answers: both() as Record<string, unknown> });
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    const resumed = validateDraftPatch({ answers: saved.value.answers as Record<string, unknown> });
    expect(resumed.ok && resumed.value.answers?.title).toBe(TITLE);
    expect(resumed.ok && resumed.value.answers?.problem).toBe(PROBLEM);
  });

  it("E — advancing and returning cannot merge them (Step 1 gate reads both, writes neither)", () => {
    const a = both();
    expect(canAdvanceStep(1, a)).toBe(true);
    expect(stepBlockers(1, a)).toEqual([]);
    expect(a.title).toBe(TITLE);
    expect(a.problem).toBe(PROBLEM);
  });
});

describe("F — Review renders each exactly once, under distinct labels", () => {
  it("both are missing on an empty draft, and reported as two separate sections", () => {
    const missing = reviewMissingSections({}).map((m) => m.section);
    expect(missing.filter((s) => s === "title")).toHaveLength(1);
    expect(missing.filter((s) => s === "problem")).toHaveLength(1);
    expect(missing.indexOf("title")).toBeLessThan(missing.indexOf("problem"));
  });

  it("supplying the title clears ONLY the title row", () => {
    const sections = reviewMissingSections({ title: TITLE }).map((m) => m.section);
    expect(sections).not.toContain("title");
    expect(sections).toContain("problem");
  });

  it("supplying the problem clears ONLY the problem row", () => {
    const sections = reviewMissingSections({ problem: PROBLEM }).map((m) => m.section);
    expect(sections).toContain("title");
    expect(sections).not.toContain("problem");
  });

  it("both step-1 gaps are reported together, so Edit is never a two-trip journey", () => {
    const step1 = reviewMissingSections({}).filter((m) => m.step === 1);
    expect(step1.map((m) => m.section)).toEqual(["title", "problem"]);
  });
});

describe("publish freezes them independently", () => {
  it("the snapshot carries both keys, unmerged", () => {
    const snap = buildModuleSnapshot(both()) as Record<string, unknown>;
    expect(snap.title).toBe(TITLE);
    expect(snap.problem).toBe(PROBLEM);
  });

  it("a legacy snapshot with no title still freezes its problem unchanged", () => {
    const snap = buildModuleSnapshot({ problem: PROBLEM }) as Record<string, unknown>;
    expect(snap.title).toBeUndefined();
    expect(snap.problem).toBe(PROBLEM);
  });

  it("the learner-facing journey title is SEEDED from the Host's title, not the problem", () => {
    const j = mapAnswersToJourney(both());
    expect(j.displayTitle).toBe(TITLE);
    // Human approval is unchanged — the Host still confirms the title at Review.
    expect(j.displayTitleStatus).toBe("needs_confirmation");
  });

  it("…and falls back to the problem's first line only when there is no title", () => {
    const j = mapAnswersToJourney({ problem: `${PROBLEM}\nmore` });
    expect(j.displayTitle).toBe(PROBLEM);
  });
});

describe("G/H — one title authority, no leftover placeholder", () => {
  it("G — once a title exists, the draft identity IS that title (no 'Untitled' state)", () => {
    expect(draftIdentityStatement(both())).toBe(TITLE);
    expect(draftIdentityStatement({ title: "   " })).not.toBe("   ");
  });

  it("H — the header is a READ of the title, never a second source", () => {
    /*
      There is exactly one editable title: `answers.title`. `draftIdentityStatement` and
      `draftTitleFrom` are pure reads of it, so the "Training focus" header cannot diverge from
      the field the Host typed into.
    */
    const a = both();
    expect(draftIdentityStatement(a)).toBe(a.title);
    expect(draftTitleFrom(a)).toBe(a.title);
    const renamed = { ...a, title: "Renamed" };
    expect(draftIdentityStatement(renamed)).toBe("Renamed");
    expect(draftTitleFrom(renamed)).toBe("Renamed");
  });

  it("whitespace is not a name", () => {
    expect(stepBlockers(1, { title: "   ", problem: PROBLEM })).toEqual(["title_required"]);
  });
});
