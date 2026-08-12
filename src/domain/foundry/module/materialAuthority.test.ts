import { describe, it, expect } from "vitest";
import {
  claimsMaterialContent,
  deriveMaterialAuthority,
  groundingCorpus,
  materialAuthorityBrief,
  requiredProgramKinds,
  ungroundedArtifact,
  validateProgramProposal,
} from "./program-authorship";
import type { BuilderAnswers } from "./module-builder";

/**
 * SLICE 3.2L-R11.4G — the generator must author honestly when nothing was supplied.
 *
 * The canonical draft's one authorized generation was refused for `material_fabrication`.
 * The validator was right; the model had been given a bare material noun and a wall of
 * prohibitions. These tests hold BOTH halves: the refusals stay, and the honest program
 * that should have been written is provably acceptable.
 */

/** The canonical handoffs draft: a YouTube link, no uploaded file. */
const CANONICAL: BuilderAnswers = {
  problem: "Our handoffs are inconsistent.",
  recurringMoment: "at each handoff point",
  observableBehavior: "Create a shared handoff standard.",
  successEvidence: "Handoff record",
  completionPrompt:
    "What specific elements will you include in your handoff record to align with the shared handoff standard?",
  materialIntent: "youtube",
  materialText: "https://youtu.be/mRdT9oK1Cmo",
} as BuilderAnswers;

const corpusOf = (a: BuilderAnswers, verified: string[] = []) => groundingCorpus(a, verified);

describe("[3.2L-R11.4G] material authority", () => {
  it("a link and an upload prove existence; NO path in this product proves contents", () => {
    expect(deriveMaterialAuthority(CANONICAL, [])).toEqual({ exists: ["youtube"], contentsVerified: false });
    expect(deriveMaterialAuthority(CANONICAL, ["handoff-policy.pdf"])).toEqual({
      exists: ["youtube", "handoff-policy.pdf"],
      contentsVerified: false,
    });
    expect(deriveMaterialAuthority({} as BuilderAnswers, [])).toEqual({ exists: [], contentsVerified: false });
  });

  it("the brief tells the model what it MAY author, not only what it may not", () => {
    const withMaterial = materialAuthorityBrief(deriveMaterialAuthority(CANONICAL, [])).join("\n");
    expect(withMaterial).toMatch(/never read its contents|have not been read/i);
    expect(withMaterial).toMatch(/SELF-CONTAINED/);
    expect(withMaterial).toMatch(/CREATES during the training/i);
    expect(withMaterial).toContain("youtube");

    const none = materialAuthorityBrief(deriveMaterialAuthority({} as BuilderAnswers, [])).join("\n");
    expect(none).toMatch(/NO material of any kind/i);
    expect(none).toMatch(/SELF-CONTAINED/);
  });

  it("is generic — it names no subject matter of its own", () => {
    const brief = materialAuthorityBrief(deriveMaterialAuthority(CANONICAL, [])).join("\n").toLowerCase();
    // "handoff" appears only in the ALLOWED/FORBIDDEN illustration pair, never as a rule.
    for (const line of materialAuthorityBrief(deriveMaterialAuthority(CANONICAL, []))) {
      if (/handoff/i.test(line)) expect(line).toMatch(/ALLOWED|FORBIDDEN/);
    }
    expect(brief).not.toMatch(/nursing|clinic|shift change/);
  });
});

describe("[3.2L-R11.4G] the validator stays strong (Part 5)", () => {
  const corpus = corpusOf(CANONICAL);

  it("CASE A — 'Use the provided handoff template' is REFUSED with no verified artifacts", () => {
    expect(ungroundedArtifact("Use the provided handoff template before each shift.", corpus)).toBe("template");
  });

  it("CASE B — a content claim about the unverified link is REFUSED", () => {
    expect(claimsMaterialContent("The video explains the five required handoff steps.")).toBe(true);
    expect(claimsMaterialContent("Follow the steps described in the video.")).toBe(true);
    expect(claimsMaterialContent("According to the document, three fields are mandatory.")).toBe(true);
    expect(claimsMaterialContent("The material lists the approved wording.")).toBe(true);
  });

  it("CASE C — 'Complete the attached worksheet' is REFUSED", () => {
    expect(ungroundedArtifact("Complete the attached worksheet with your team.", corpus)).toBe("worksheet");
  });

  it("an upload does not unlock its CONTENTS — existence authority is not content authority", () => {
    const withFile = corpusOf(CANONICAL, ["handoff-template.pdf"]);
    // Existence is now grounded…
    expect(ungroundedArtifact("Use the handoff template.", withFile)).toBeNull();
    // …but speaking for what is inside it is still refused: the app stores a title, never a body.
    expect(claimsMaterialContent("The handoff template lists the four required fields.")).toBe(true);
    // …while the participant WRITING one is untouched (CASE F, creation-framed).
    expect(claimsMaterialContent("Agree which three items the checklist must include, and write it together.")).toBe(false);
  });
});

describe("[3.2L-R11.4G] honest self-contained authorship is ACCEPTED (Part 6)", () => {
  const corpus = corpusOf(CANONICAL);
  const clean = (text: string) => ungroundedArtifact(text, corpus) === null && !claimsMaterialContent(text);

  it("CASE D — the learner CREATES the record; its contents come from host-authored facts", () => {
    expect(
      clean(
        "Create a handoff record that identifies the responsible person, the next action, and how completion will be confirmed.",
      ),
    ).toBe(true);
  });

  it("CASE E — a verbal practice situation referencing no material at all", () => {
    expect(
      clean(
        "A tight deadline is approaching and a teammate is waiting: state each unfinished item aloud and name who owns the next action.",
      ),
    ).toBe(true);
  });

  it("CASE F — the learner writes a checklist during the exercise rather than being handed one", () => {
    expect(clean("Agree which three items every handover must include, and write that checklist down together.")).toBe(true);
    // The same noun, presupposed instead of created, is still refused.
    expect(clean("Work through the checklist your team already uses.")).toBe(false);
  });

  it("mentioning that material exists is fine — only speaking FOR it is not", () => {
    expect(clean("Your host has shared a video; watch it before the session.")).toBe(true);
    expect(clean("The video covers the required steps.")).toBe(false);
  });

  it("ordinary sentences that merely contain a media word are not refused", () => {
    expect(claimsMaterialContent("At the end of the video call, confirm who owns the next action.")).toBe(false);
    expect(claimsMaterialContent("Record the agreed next step in your own notes.")).toBe(false);
  });
});

/**
 * PART 6 — the whole seven-section program, authored with NO artifact of any kind, passes
 * the real validator. This is the program the refused attempt should have written.
 */
describe("[3.2L-R11.4G] a complete self-contained program validates (Part 6)", () => {
  const SELF_CONTAINED: BuilderAnswers = {
    problem: "Our handoffs are inconsistent.",
    audienceType: "everyone",
    recurringMoment: "at each handoff point",
    observableBehavior: "Create a shared handoff standard.",
    successEvidence: "Handoff record",
    evidenceType: "seen",
    learningNeeds: ["know", "decide", "practice"],
    materialIntent: "youtube",
    materialText: "https://youtu.be/mRdT9oK1Cmo",
    completionPrompt: "What specific elements will you include in your handoff record?",
    arenaRecommended: true,
    followUpDays: 7,
  } as BuilderAnswers;

  const el = (kind: string, content: string) => ({ kind, content, rationale: "because it fits" });

  /** Every sentence stands on host-authored facts. Nothing is provided, attached or quoted. */
  const proposal = {
    program: {
      display_title: "Handing over without gaps",
      elements: [
        el("why_it_matters", "When a handover misses a step, the next person starts without knowing what changed, and the risk lands on them."),
        el("observable_standard", "The outgoing person states each open item aloud and the incoming person repeats it back before signing off."),
        el("scenario", "The shift ran late and two people are already waiting to ask you questions."),
        el("action_decision", "I will decide which open items I always state aloud at handover, even when the shift ran late."),
        el("field_application", "At your next handover, you state the open items before leaving."),
        el("evidence", "Create a handoff record that names the responsible person, the next action, and how completion will be confirmed. It shows the items were stated, not that the next shift acted on them."),
        el("completion_check", "What will you say aloud at your next handover that you did not say before?"),
        el("follow_up", "In seven days you will be asked what you actually said at handover. That is your own account, not an observation."),
      ],
      assumptions: ["Handovers happen at a predictable moment."],
      warnings: ["If the handover step is missing from the workflow, training alone will not add it."],
      behavior_contract: {
        actor: "the outgoing person",
        trigger: "At the end of every shift, before leaving the floor",
        action_verb: "state", action_detail: "each open item aloud to the person taking over",
        completion: { confirmed_by: "the person taking over", confirmation_action: "repeat the open items back" },
      },
      scenario_contract: {
        pressure_condition: "two people are already waiting to ask you questions and the shift ran late",
        pressure_detail: null,
      },
      completion_contract: { verification_target: "the_behaviour", response_mode: "name_the_moment" },
      follow_up_contract: { review_focus: "what_you_said", confirmer: "self_report" },
    },
  };

  it("all seven required kinds are producible with zero verified artifacts", () => {
    const required = requiredProgramKinds(SELF_CONTAINED);
    expect(required).toEqual([
      "why_it_matters", "observable_standard", "scenario",
      "action_decision", "field_application", "completion_check", "follow_up",
    ]);
    const r = validateProgramProposal(proposal, SELF_CONTAINED, []);
    if (!r.ok) throw new Error(`refused ${r.code}${r.kind ? ` (${r.kind})` : ""}`);
    expect(r.ok).toBe(true);
    for (const kind of required) {
      expect(r.value.proposal.elements.some((e) => e.kind === kind)).toBe(true);
    }
  });

  it("and the SAME program with one provided-template sentence is still refused", () => {
    const bad = JSON.parse(JSON.stringify(proposal));
    bad.program.elements[4].content = "At your next handover, complete the provided handoff template.";
    const r = validateProgramProposal(bad, SELF_CONTAINED, []);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("material_fabrication");
  });

  it("and with one content claim about the link, still refused", () => {
    const bad = JSON.parse(JSON.stringify(proposal));
    bad.program.elements[0].content = "The video explains the five required handover steps.";
    const r = validateProgramProposal(bad, SELF_CONTAINED, []);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("material_fabrication");
  });
});
