import { describe, it, expect } from "vitest";
import {
  claimsMaterialContent, ungroundedArtifact, groundingCorpus,
  deriveMaterialAuthority, validateProgramProposal, requiredProgramKinds,
  isSemanticRepairableCode,
} from "./program-authorship";
import { SUPPORTED_EXTENSIONS } from "./draft-asset";
import type { BuilderAnswers } from "./module-builder";

/**
 * SLICE 3.2P-R3.1 — NAMING A FILE IS NOT READING IT.
 *
 * MEASURED GAP. "the checklist lists five steps" and "the training checklist lists five
 * steps" were both refused as material fabrication. Put a filename in the same noun phrase —
 * "the education.pdf checklist lists five steps" — and every honesty check passed. So did
 * `notes.txt`, `slides.pptx`, `training.v2.pdf`, `MRONJ-1.pdf` and `측정지표.pdf`, and so did
 * a filename speaking for itself: "education.pdf says to name an owner".
 *
 * Two causes, both in tokenization rather than policy:
 *   1. the modifier token class `[\w'-]+` cannot contain a dot, and `\w` excludes Hangul —
 *      8 of the 27 real filenames on staging are Korean;
 *   2. every content-claim pattern required a determiner plus a generic source noun, so a
 *      filename used as the SUBJECT was never examined at all.
 *
 * This matters for this pilot specifically: its prompt legitimately names `education.pdf` as
 * an artifact that EXISTS, while stating its contents were never read. The validator has to
 * hold the same line the prompt draws.
 */
const ANSWERS = {
  problem: "During morning huddles, team members report problems but leave without naming who will act or when the next step will happen.",
  audienceType: "leaders",
  evidenceType: "confirmed",
  followUpDays: 7,
  learningNeeds: ["shared_standard", "practice"],
  materialIntent: "pdf",
  sharedQuestion: "In your own words, what is the most important standard from this training?",
  successEvidence: "The huddle note records one owner and one deadline for every agreed action.",
  arenaRecommended: true,
  completionPrompt: "What specific phrases will you use in the next huddle to confirm the action owner and deadline for each reported issue?",
  recurringMoment: "During morning huddles",
  observableBehavior: "At the next huddle, what exact words will you use to confirm the owner, action, and deadline?",
  capabilityCandidate: "Accountability",
} as unknown as BuilderAnswers;

const VERIFIED = ["education.pdf"];
const CORPUS = groundingCorpus(ANSWERS, VERIFIED);
const refused = (t: string) => claimsMaterialContent(t) || ungroundedArtifact(t, CORPUS) !== null;

describe("[3.2P-R3.1] a filename in the noun phrase no longer hides a content claim", () => {
  const CLAIMS = [
    // the two that already worked — they must keep working
    "the checklist lists five steps",
    "the training checklist lists five steps",
    // the measured hole, in every shape it was found
    "the education.pdf checklist lists five steps",
    "the five steps in the education.pdf checklist",
    "the notes.txt checklist contains the five steps",
    "the training.v2.pdf checklist lists the required fields",   // two dots
    "the MRONJ-1.pdf checklist lists the required fields",       // hyphen + digit
    "the 측정지표.pdf checklist lists the required fields",        // non-ASCII letters
    "the guide.docx says to confirm the owner",
    // the filename as the SUBJECT — no determiner, no generic source noun
    "education.pdf says to name an owner",
    "education.pdf requires every leader to record a deadline",
    "the slides.pptx require a named owner",
  ];

  it("every one is refused", () => {
    const passed = CLAIMS.filter((t) => !refused(t));
    expect(passed, `wrongly allowed:\n${passed.join("\n")}`).toEqual([]);
  });
});

describe("[3.2P-R3.1] naming a file, without speaking for it, stays allowed", () => {
  const NEUTRAL = [
    "education.pdf is attached",
    "Open education.pdf",
    "A PDF named education.pdf is available",
    "Use the attached material",
    "education.pdf is available",
    "측정지표.pdf is attached",
    "MRONJ-1.pdf is attached",
    "[FINAL] Supp Reply.pdf is attached",
    // the connective guard: a named file, then a different subject entirely
    "Open education.pdf and the team lists the owners",
  ];

  it("none is refused", () => {
    const wrong = NEUTRAL.filter((t) => refused(t));
    expect(wrong, `false positives:\n${wrong.join("\n")}`).toEqual([]);
  });

  it("ordinary program prose is untouched", () => {
    const PROSE = [
      "The huddle leader names one owner and one deadline for every agreed action.",
      "At each morning huddle, before the group leaves, the huddle leader must name one owner and one deadline for every agreed action and write them in the huddle note.",
      "the huddle is running late and people are already standing to leave",
      "In 7 days you will be asked what you actually said at the huddle.",
      "What exactly will you say when you name one owner and one deadline and write them in the huddle note?",
      // dotted abbreviations are not file types
      "Confirm the owner e.g. the person who raised it.",
      "Record it i.e. write the deadline down.",
      "That is the standard. Templates are not provided.",
    ];
    const wrong = PROSE.filter((t) => refused(t));
    expect(wrong, `false positives:\n${wrong.join("\n")}`).toEqual([]);
  });

  it("a sentence stop still breaks the phrase — the dot may only sit INSIDE a token", () => {
    /*
      A trailing dot would let a claim be assembled from two unrelated clauses. It cannot:
      the filename rule needs whitespace after the extension, and a sentence stop is not that.
    */
    expect(claimsMaterialContent("Read education.pdf. The checklist can come later.")).toBe(false);
    // The only way this could match is by swallowing "owner." as a modifier and bridging into
    // the next sentence. It does not: a modifier token may not end on a dot.
    expect(ungroundedArtifact("Confirm it with the owner. Files are not provided.", CORPUS)).toBeNull();
    /*
      NOT a bridging case, and correctly refused before and after: "The template lists them"
      is a complete prescriptive claim needing no modifier at all. Kept here so the difference
      between "bridged" and "genuinely present" stays on the record.
    */
    expect(claimsMaterialContent("Agree what the team needs. The template lists them.")).toBe(true);
  });

  it("PRE-EXISTING, unchanged: a bare definite artifact is still an existence claim", () => {
    // Not introduced here — `ungroundedArtifact` refused these before this slice too. Recorded
    // so the distinction stays visible: the FILENAME rule did not fire on either.
    for (const t of ["Agree what the team needs. The checklist can come later.", "Read education.pdf. The checklist can come later."]) {
      expect(claimsMaterialContent(t), `filename rule must not fire: ${t}`).toBe(false);
      expect(ungroundedArtifact(t, CORPUS), t).toBe("checklist");
    }
  });
});

describe("[3.2P-R3.1] a verified filename is authority for EXISTENCE only", () => {
  it("deriveMaterialAuthority still reports contents as unverified", () => {
    const auth = deriveMaterialAuthority(ANSWERS, VERIFIED);
    expect(auth.exists).toEqual(["pdf", "education.pdf"]);
    expect(auth.contentsVerified).toBe(false);
  });

  it("and the claims that cross that line refuse even though the file is verified", () => {
    for (const t of [
      "education.pdf says to name an owner",
      "the education.pdf checklist requires a deadline",
    ]) {
      expect(refused(t), t).toBe(true);
    }
  });

  it("MEASURED RESIDUAL LIMIT — a copular claim about a file's contents is still allowed", () => {
    /*
      "the five steps in education.pdf are the ones to follow" asserts contents and passes.
      Catching it would mean treating "are"/"is" as attribution, and those are exactly the
      verbs a legitimate EXISTENCE statement uses ("education.pdf is attached"). No bounded
      rule separates the two on the evidence available, so this is recorded rather than
      guessed at. It needs no artifact noun and no attribution verb, which is why every
      pattern here misses it.
    */
    expect(refused("the five steps in education.pdf are the ones to follow")).toBe(false);
  });

  it("the extension list is the application's own upload allowlist", () => {
    expect(SUPPORTED_EXTENSIONS).toContain("pdf");
    expect(SUPPORTED_EXTENSIONS).toContain("txt");
    expect(SUPPORTED_EXTENSIONS).not.toContain("exe");
    // "e.g." and "i.e." can never be read as filenames because "g" and "e" are not in it.
    expect(SUPPORTED_EXTENSIONS).not.toContain("g");
    expect(SUPPORTED_EXTENSIONS).not.toContain("e");
  });
});

describe("[3.2P-R3.1] through the real validator, on the real pilot answers", () => {
  const CONTENT: Record<string, string> = {
    why_it_matters: "When a huddle ends without a named owner and a deadline, the problem that was raised stays exactly where it was.",
    observable_standard: "The huddle leader names one owner and one deadline for every agreed action before the group leaves.",
    scenario: "The huddle is running late and people are already standing to leave.",
    reflection: "In your own words, what is the most important standard from this training?",
    field_application: "At the next morning huddle, name one owner and one deadline for every agreed action and write them in the huddle note.",
    completion_check: "What exactly will you say at the next morning huddle to name the owner and the deadline?",
    follow_up: "In seven days you will be asked what you actually said at the huddle.",
  };
  const KINDS = requiredProgramKinds(ANSWERS);
  const proposal = (over: Record<string, unknown> = {}, content = CONTENT) => ({
    program: {
      display_title: "End every huddle with an owner and a deadline",
      elements: KINDS.map((k) => ({ kind: k, content: content[k], rationale: "grounded in the host's own answers" })),
      assumptions: ["the team holds a morning huddle"],
      warnings: ["a huddle nobody attends is an attendance problem, not a training one"],
      behavior_contract: {
        actor: "the huddle leader",
        trigger: "at each morning huddle, before the group leaves",
        observable_action: "names one owner and one deadline for every agreed action and writes them in the huddle note",
        completion: { confirmed_by: "the named owner", confirmation_action: "repeat back the action and the deadline" },
      },
      scenario_contract: { pressure_condition: "the huddle is running late and people are already standing to leave", pressure_detail: null },
      completion_contract: { verification_target: "the_behaviour", response_mode: "state_what_you_will_say" },
      follow_up_contract: { review_focus: "what_you_said", confirmer: "self_report" },
      ...over,
    },
  });

  it("the grounded seven-kind proposal still PASSES", () => {
    const r = validateProgramProposal(proposal(), ANSWERS, VERIFIED);
    expect(r.ok, r.ok ? "" : `${r.code}/${r.kind ?? ""}`).toBe(true);
  });

  it("each pilot filename claim is refused as material_fabrication, in the surface it appears in", () => {
    const cases: [string, string][] = [
      ["reflection", "What does the education.pdf checklist say you should do?"],
      ["reflection", "The education.pdf checklist lists five required steps. Which one do you miss?"],
      ["why_it_matters", "education.pdf requires every leader to name an owner before the group leaves."],
    ];
    for (const [kind, text] of cases) {
      const r = validateProgramProposal(proposal({}, { ...CONTENT, [kind]: text }), ANSWERS, VERIFIED);
      expect(r.ok, `${kind}: ${text}`).toBe(false);
      if (!r.ok) {
        expect(r.code, text).toBe("material_fabrication");
        expect(r.kind, text).toBe(kind);
      }
    }
  });

  it("an ASSUMPTION inventing file contents is refused too", () => {
    const r = validateProgramProposal(proposal({ assumptions: ["education.pdf contains a huddle checklist"] }), ANSWERS, VERIFIED);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("material_fabrication");
  });

  it("a neutral existence statement does NOT become fabrication", () => {
    const r = validateProgramProposal(proposal({ assumptions: ["education.pdf is available to the team"] }), ANSWERS, VERIFIED);
    expect(r.ok, r.ok ? "" : `${r.code}/${r.kind ?? ""}`).toBe(true);
  });

  it("the repair policy is untouched — material_fabrication was already repairable", () => {
    expect(isSemanticRepairableCode("material_fabrication")).toBe(true);
    expect(isSemanticRepairableCode("evidence_overclaim")).toBe(true);
    expect(isSemanticRepairableCode("scenario_without_pressure")).toBe(true);
    expect(isSemanticRepairableCode("non_observable_standard")).toBe(false);
  });
});
