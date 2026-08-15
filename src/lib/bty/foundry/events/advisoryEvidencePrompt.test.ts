import { describe, it, expect } from "vitest";
import { systemPrompt } from "./programAuthorshipService";
import {
  PROGRAM_AUTHORSHIP_VERSION, PROGRAM_SCHEMA_NAME, deriveMaterialAuthority,
  evidenceClaimBrief, requiredProgramKinds,
} from "@/domain/foundry/module/program-authorship";
import { EVIDENCE_POLICY, EVIDENCE_SCOPE, evidenceFamilyContrasts } from "@/domain/foundry/module/evidence-policy";
import { PRESSURE_FRAMES } from "@/domain/foundry/module/program-coherence";
import type { BuilderAnswers } from "@/domain/foundry/module/module-builder";

/**
 * SLICE 3.2P-A4-R2 — THE PROMPT MEETS THE VALIDATOR, NOT THE REVERSE.
 *
 * A1 (v15) and A4 (v18) were both refused `evidence_overclaim` / kind null / path `program` —
 * the title, the assumptions and the warnings. Measured on the composed v18 prompt: the
 * evidence block mentioned `assumption` false, `warning` false, `title` false; `appliesTo` was
 * rendered nowhere; 0 of 11 forbidden/legal pairs were rendered. The one line that commissioned
 * those fields asked for "warnings when training alone will not fix the problem (a workflow,
 * staffing, access or policy change may be needed)" — which is the remedy clause, one step from
 * the refused shape.
 *
 * This asserts the composed prompt, because a rule that lives in a helper nobody renders is the
 * exact defect being fixed.
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

describe("[3.2P-A4-R2] the advisory scope is stated", () => {
  it("C — the evidence block itself names assumptions, warnings and the title", () => {
    const block = PROMPT.slice(PROMPT.indexOf("WHAT THIS TRAINING CAN PROVE"), PROMPT.indexOf("HARD RULES:"));
    expect(block).toContain(EVIDENCE_SCOPE);
    for (const word of ["assumption", "warning", "title"]) {
      expect(block.toLowerCase(), `evidence block never says ${word}`).toContain(word);
    }
    expect(block).toContain("is NOT an exception");
  });

  it("and it is the same scope string every rule declares — one source", () => {
    for (const r of EVIDENCE_POLICY) expect(r.appliesTo, r.id).toBe(EVIDENCE_SCOPE);
    expect(PROMPT).toContain(EVIDENCE_SCOPE);
  });

  it("A/B — every validator-live family still reaches the model in its own words", () => {
    for (const r of EVIDENCE_POLICY) expect(PROMPT, r.id).toContain(r.promptLine);
  });

  it("five contrasts reach the prompt, not eleven", () => {
    const contrasts = evidenceFamilyContrasts();
    expect(contrasts).toHaveLength(5);
    for (const c of contrasts) {
      expect(PROMPT, c.family).toContain(c.forbidden);
      expect(PROMPT, c.family).toContain(c.legal);
    }
    /*
      THE MEASURED CHOICE (strategy B). Rendering all eleven pairs costs +762 characters for six
      extra samples whose failure mode a sibling already illustrates; every rule still states
      itself through `promptLine`. If a future family is added the contrast appears on its own,
      so this number is derived, not typed.
    */
    const rendered = EVIDENCE_POLICY.filter((r) => PROMPT.includes(r.forbiddenSample));
    expect(rendered).toHaveLength(5);
  });
});

describe("[3.2P-A4-R2] the advisory commission asks for a condition, not a cure", () => {
  it("the remedy-clause wording is gone", () => {
    expect(PROMPT).not.toContain("warnings when training alone will not fix the problem");
    expect(PROMPT).not.toContain("a workflow, staffing, access or policy change may be needed");
  });

  it("and what replaced it names the condition and forbids the outcome", () => {
    expect(PROMPT).toContain("warnings for what training alone cannot settle");
    expect(PROMPT).toMatch(/A warning names a CONDITION, not a cure/);
    expect(PROMPT).toContain("Never say what that other thing would achieve");
    expect(PROMPT).toMatch(/A title names the capability or the problem/);
  });

  it("D — honest limitation language is explicitly protected, not merely tolerated", () => {
    expect(PROMPT).toContain("LIMITATIONS ARE WELCOME; THE OUTCOME OF A REMEDY IS NOT");
    expect(PROMPT).toContain("Training alone cannot ensure consistency.");
    expect(PROMPT).toContain("what stays unknown");
  });

  it("carries no pilot vocabulary into general policy", () => {
    const block = PROMPT.slice(PROMPT.indexOf("WHAT THIS TRAINING CAN PROVE"), PROMPT.indexOf("HARD RULES:"));
    for (const pilot of ["huddle", "morning", "owner and deadline"]) {
      expect(block.toLowerCase(), pilot).not.toContain(pilot);
    }
  });

  it("the Korean prompt carries the same rule — there is no second evidence branch", () => {
    const ko = build("ko");
    expect(ko).toContain(EVIDENCE_SCOPE);
    expect(ko).toContain("A warning names a CONDITION, not a cure");
    expect(ko).toContain("Write ALL participant-facing text in Korean.");
  });
});

describe("[3.2P-A4-R2] what did NOT change", () => {
  it("I — the semantic contract moved; the wire shape did not", () => {
    expect(PROGRAM_AUTHORSHIP_VERSION).toBe("program_authorship_v23");
    expect(PROGRAM_SCHEMA_NAME).toBe("bty_guided_program_v12");
  });

  it("the reflection contract is untouched (v17), and still not deterministically validated", () => {
    expect(PROMPT).toContain("REFLECT — the honest question:");
    expect(PROMPT).toMatch(/truthfully answerable by someone who does NOT do the trained behaviour today/);
    expect(PROMPT).not.toMatch(/reflection_presupposes|presupposition_check/);
  });

  it("the scenario section now offers FRAMES, not difficulty prose (v22)", () => {
    // A7-R2 replaced the seventeen detector families in the prompt with twelve product frames.
    for (const f of PRESSURE_FRAMES) expect(PROMPT, f.id).toContain(`- ${f.id}: ${f.meaning}`);
  });
});
