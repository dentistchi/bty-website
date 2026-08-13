import { describe, it, expect } from "vitest";
import { systemPrompt } from "./programAuthorshipService";
import {
  PROGRAM_AUTHORSHIP_VERSION, PROGRAM_SCHEMA_NAME, deriveMaterialAuthority,
  evidenceClaimBrief, requiredProgramKinds,
} from "@/domain/foundry/module/program-authorship";
import type { BuilderAnswers } from "@/domain/foundry/module/module-builder";

/**
 * SLICE 3.2P-A2-R2 — A QUESTION MUST LEAVE ROOM FOR "IT DOESN'T HAPPEN".
 *
 * A2 (`14d622a1`, v16) passed every floor and still failed Founder acceptance. Its reflection:
 *
 *   "How do you currently ensure that action items are assigned to specific owners and
 *    deadlines during your huddles?"
 *
 * That is a wh-question over the MANNER of an asserted proposition — it takes "you ensure this"
 * as given and asks only how. The learner this training exists for is exactly the one for whom
 * it does not happen, and the question leaves them nothing truthful to say.
 *
 * The instruction had said only "examine their own current practice honestly", which describes
 * how they should ANSWER, never what the question may ASSUME. The requirement lived in the
 * acceptance gate and nowhere the model could read it.
 */
const HOST = {
  arenaRecommended: true, audienceType: "leaders", evidenceType: "confirmed", followUpDays: 7,
  learningNeeds: ["shared_standard", "practice"], materialIntent: "pdf",
  problem: "During morning huddles, team members report problems but leave without naming who will act.",
  recurringMoment: "During morning huddles",
  observableBehavior: "Confirm the owner, action, and deadline for every agreed item.",
  successEvidence: "The huddle note records one owner and one deadline for every agreed action.",
  sharedQuestion: "In your own words, what is the most important standard from this training?",
  completionPrompt: "What specific phrases will you use in the next huddle?",
} as unknown as BuilderAnswers;

const build = (locale: "en" | "ko") =>
  systemPrompt(
    locale,
    requiredProgramKinds(HOST),
    "Reading or watching the material can show only that people were exposed to it.",
    deriveMaterialAuthority(HOST, []),
    evidenceClaimBrief(HOST),
    ["The training is for leaders."],
    HOST.successEvidence as string,
    HOST.recurringMoment as string,
  );
const PROMPT = build("en");

describe("[3.2P-A2-R2] the prompt now carries the acceptance requirement", () => {
  it("names the property: current practice, and no assumption that it already happens", () => {
    expect(PROMPT).toMatch(/REFLECT — the honest question:/);
    expect(PROMPT).toMatch(/CURRENT practice/);
    expect(PROMPT).toMatch(/truthfully answerable by someone who does NOT do the trained behaviour today/);
  });

  it("makes room for the three answers a learner must be able to give", () => {
    for (const answer of ["it doesn't happen", "it happens sometimes", "nobody does this"]) {
      expect(PROMPT, answer).toContain(answer);
    }
    expect(PROMPT).toMatch(/assumes its own answer/);
  });

  it("teaches the RELATION, not a vocabulary", () => {
    // The measured trap: banning `ensure` refuses "How do you currently ensure everyone can hear
    // the huddle?", which is a fine reflection. The prompt says so explicitly.
    expect(PROMPT).toMatch(/about what the question ASSUMES, not about particular words/);
    expect(PROMPT).toMatch(/UNRELATED to the trained behaviour is perfectly fine/);
  });

  it("contrasts by shape, with generic examples", () => {
    expect(PROMPT).toContain("What usually happens when an action needs an owner?");
    expect(PROMPT).toContain("How do you ensure this always happens?");
  });

  it("and the kind brief points at the same rule rather than repeating a weaker one", () => {
    expect(PROMPT).toMatch(/- reflection: one question about the participant's CURRENT practice/);
    expect(PROMPT).toMatch(/see REFLECT below/);
    // The v16 wording, which described only how to ANSWER, is gone.
    expect(PROMPT).not.toContain("examine their own current practice honestly");
  });

  it("carries no pilot vocabulary into general policy", () => {
    const reflect = PROMPT.slice(PROMPT.indexOf("REFLECT — the honest question:"), PROMPT.indexOf("THE STANDARD — behavior_contract:"));
    for (const pilot of ["huddle", "morning", "deadline for every agreed", "accountability"]) {
      expect(reflect.toLowerCase(), pilot).not.toContain(pilot);
    }
  });

  it("the Korean prompt carries the same rule — there is no second reflection branch", () => {
    /*
      MEASURED, not assumed: `KIND_BRIEF` and the REFLECT block are locale-free. Locale reaches
      the prompt only through the closing "write ALL participant-facing text in …" line, so the
      rule cannot drift between locales. This asserts that rather than inventing localisation
      the product does not have.
    */
    const ko = build("ko");
    expect(ko).toContain("REFLECT — the honest question:");
    expect(ko).toMatch(/truthfully answerable by someone who does NOT do the trained behaviour today/);
    expect(ko).toContain("Write ALL participant-facing text in Korean.");
    expect(PROMPT).toContain("Write ALL participant-facing text in English.");
  });
});

describe("[3.2P-A2-R2] what did NOT change", () => {
  it("no deterministic reflection validator was added", () => {
    /*
      A DOCUMENTED BOUNDARY. Measured on seventeen labelled questions, every lexical or shape
      rule produced the same disqualifying false positives — "How do you currently ensure
      everyone can hear the huddle?" and "What steps do you take to ensure the room is booked?"
      are ordinary reflections whose presupposition is simply not the trained behaviour.
      Separating them needs a relation between the question and the contract, not a scan.

      So neutrality is PROMPT-ENFORCED and PRODUCT-REVIEWED. The server does not claim to prove
      it, and this test exists so that claim is never quietly made.
    */
    expect(PROMPT).not.toMatch(/reflection_presupposes|presupposition_check/);
  });

  it("the wire shape and the repair identities are untouched", () => {
    expect(PROGRAM_AUTHORSHIP_VERSION).toBe("program_authorship_v20");
    expect(PROGRAM_SCHEMA_NAME).toBe("bty_guided_program_v11");
  });
});
