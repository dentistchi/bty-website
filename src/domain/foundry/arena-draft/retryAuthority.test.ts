import { describe, it, expect } from "vitest";
import { UNREACHABLE_FROM_GENERATION, buildCorrectionPacket, canonicalPacketJson, renderCorrectionPacket, type ImmutableContext } from "./correctionPacket";
import { resolveRejection, registeredCodes, classifyCode, type Finding } from "./gatePrecedence";
import { SEMANTIC_REVIEW_JSON_SCHEMA } from "./semanticReview";
import { GEN_REVIEW_TEXT_MAX } from "./types";

/**
 * SERVER RETRY AUTHORITY (Slice 3.2I-R5B1A.1-R2.23C).
 *
 * THE RISK THIS FILE EXISTS TO CLOSE
 *
 * R2.23C cuts reviewer free text from 140 characters to 100. That is only safe if the retry never
 * depended on reviewer prose in the first place. So these cases prove the correction is constructed
 * ENTIRELY from structured findings — codes, coordinates, boundary ids, immutable facts and
 * server-owned templates — and remains fully actionable with the reviewer's explanation removed
 * altogether.
 *
 * If that were not true, the right answer would have been to keep 140 and report the budget
 * unproven, not to quietly ship a shorter, weaker correction.
 */

const IMMUTABLE: ImmutableContext = {
  facts: ["Your team missed a delivery you personally promised the client", "The recovery plan is not yet confirmed"],
  role: "leaders",
  locale: "en",
  boundaries: [{ id: "c1_verify", statement: "Two identifiers must be verified before treatment" }],
};

const packetFor = (findings: Finding[], attempt = 1) => {
  const r = resolveRejection(findings)!;
  return buildCorrectionPacket(attempt, r.primaryCode, r.findings, IMMUTABLE);
};

/** Every retryable defect the slice names, at a real coordinate. */
const RETRYABLE_DEFECTS: Array<[string, Finding]> = [
  ["confirmed_boundary_absent", { code: "confirmed_boundary_absent", gate: "boundary_grounding", boundaryId: "c1_verify" }],
  ["boundary_not_operationalized", { code: "boundary_not_operationalized", gate: "boundary_grounding", boundaryId: "c1_verify" }],
  ["unsafe_delay", { code: "unsafe_delay", gate: "urgency_review", phase: "primary", choiceIndex: 0 }],
  ["no_legitimate_value", { code: "no_legitimate_value", gate: "choice_construction", phase: "primary", choiceIndex: 1 }],
  ["no_real_cost", { code: "no_real_cost", gate: "choice_construction", phase: "flat_tradeoff", choiceIndex: 0 }],
  ["bad_faith_option", { code: "bad_faith_option", gate: "phase_choice_review", phase: "primary", choiceIndex: 1 }],
  ["vague_reassurance", { code: "vague_reassurance", gate: "phase_choice_review", phase: "branch_action", branchIndex: 1, choiceIndex: 0 }],
  ["non_commitment_decoy", { code: "non_commitment_decoy", gate: "phase_choice_review", phase: "branch_action", branchIndex: 0, choiceIndex: 1 }],
  ["tradeoff_repeats_primary", { code: "tradeoff_repeats_primary", gate: "branch_review", branchIndex: 0 }],
  ["action_repeats_tradeoff", { code: "action_repeats_tradeoff", gate: "branch_review", branchIndex: 1 }],
  ["cross_branch_axis_collapse", { code: "cross_branch_axis_collapse", gate: "cross_branch_review" }],
  ["interchangeable_branch_consequence", { code: "interchangeable_branch_consequence", gate: "cross_branch_review" }],
  ["review_contradictory", { code: "review_contradictory", gate: "semantic_review" }],
];

describe("27. every retryable defect has a SERVER correction template", () => {
  it.each(RETRYABLE_DEFECTS)("27. %s produces a specific, actionable instruction", (code, finding) => {
    const packet = packetFor([finding]);
    const item = packet.items.find((i) => i.code === code);
    expect(item, `${code} has no packet item`).toBeDefined();
    // A template, not the fallback: it must say what to DO, in more than a clause.
    expect(item!.requiredCorrection.length, `${code} instruction is too thin`).toBeGreaterThan(40);
    expect(item!.requiredCorrection, code).not.toMatch(/^Correct this defect while preserving/);
    expect(item!.requiredCorrection, code).toMatch(/Replace|Establish|Make|Give|State|Keep|Show|Remove|Name|Put|The primary|The tradeoff|Every branch|Not every branch|No later phase|Two choices|Reference only|Waiting|Deflection|This option|This frames|This branch|Produce|A choice|An active|One rule|Learner-facing|The shared|The escalation|The independent/);
  });

  it("27b. NO registered retryable code falls through to the generic fallback", () => {
    const uncovered = registeredCodes()
      .filter((c) => !classifyCode(c).terminal && classifyCode(c).level >= 3)
      .filter((c) => !UNREACHABLE_FROM_GENERATION.includes(c))
      .filter((c) => packetFor([{ code: c, gate: "g" }]).items[0]?.requiredCorrection.startsWith("Correct this defect while preserving"));
    expect(uncovered, `codes without a template: ${uncovered.join(", ")}`).toEqual([]);
  });

  it("27c. reviewer-contract failures share ONE honest instruction, not a fake per-code repair", () => {
    // A regeneration cannot fix a broken review. Pretending otherwise would be worse than saying so.
    for (const c of registeredCodes().filter((x) => x.startsWith("review_") && x !== "review_contradictory")) {
      const item = packetFor([{ code: c, gate: "semantic_review" }]).items[0];
      expect(item.requiredCorrection, c).toMatch(/could not be trusted|internally inconsistent/);
    }
  });

  it("27d. the `assessment_*` family is UNREACHABLE from generation after R2.23C, and recorded as such", () => {
    // The provider no longer authors attestations, so these codes can no longer be produced by the
    // generation path. They stay registered for legacy content and the canonical validator.
    expect(UNREACHABLE_FROM_GENERATION.every((c) => c.startsWith("assessment_"))).toBe(true);
    expect(UNREACHABLE_FROM_GENERATION).toHaveLength(7);
  });
});

describe("26/30. the retry is constructible WITHOUT any reviewer prose", () => {
  it("26. removing every reviewer explanation changes nothing about the correction", () => {
    // The packet is built from findings only — reviewer text is not one of its inputs.
    const findings = RETRYABLE_DEFECTS.slice(0, 6).map(([, f]) => f);
    const withFindings = renderCorrectionPacket(packetFor(findings));
    expect(withFindings).toMatch(/ATTEMPT 1 CORRECTION/);
    for (const [code] of RETRYABLE_DEFECTS.slice(0, 6)) expect(withFindings).toContain(`[${code}]`);
    // Nothing in the rendered correction is sourced from reviewer free text.
    expect(withFindings).not.toMatch(/Reviewer note|conciseExplanation|retryInstruction/);
  });

  it("30. the reviewer no longer authors any part of the correction — the schema does not ask", () => {
    expect(SEMANTIC_REVIEW_JSON_SCHEMA.required).not.toContain("retryInstruction");
    expect(Object.keys(SEMANTIC_REVIEW_JSON_SCHEMA.properties)).not.toContain("retryInstruction");
  });

  it("a 100-character reviewer field is SUPPORTING evidence — the correction stands without it", () => {
    expect(GEN_REVIEW_TEXT_MAX).toBe(100);
    const text = renderCorrectionPacket(packetFor([{ code: "vague_reassurance", gate: "r", phase: "branch_action", branchIndex: 0, choiceIndex: 1 }]));
    // Everything a person or a model needs is present with no explanation supplied at all.
    expect(text).toContain("branch 1, action choice 2");
    expect(text).toMatch(/who acts, what they do, and the trigger, checkpoint or threshold/);
    expect(text).toMatch(/Invent no dates, people or resources/);
  });
});

describe("28/29/31/32. packet requirements", () => {
  it("28. the exact phase, branch and choice index appear for every coordinate defect", () => {
    const text = renderCorrectionPacket(packetFor([
      { code: "vague_reassurance", gate: "r", phase: "branch_action", branchIndex: 1, choiceIndex: 0 },
      { code: "no_real_cost", gate: "c", phase: "flat_tradeoff", choiceIndex: 1 },
    ]));
    expect(text).toContain("branch 2, action choice 1");
    expect(text).toContain("tradeoff choice 2");
  });

  it("29. immutable facts, role, locale and the ACTIVE boundary statements are pinned", () => {
    const packet = packetFor([{ code: "confirmed_boundary_absent", gate: "b", boundaryId: "c1_verify" }]);
    expect(packet.immutable).toEqual(IMMUTABLE);
    const text = renderCorrectionPacket(packet);
    expect(text).toContain('[c1_verify] "Two identifiers must be verified before treatment"');
    expect(text).toMatch(/UNCHANGED: the training facts, the confirmed boundary ids and statements/);
  });

  it("31. the packet digest is deterministic and content-sensitive", () => {
    const a = canonicalPacketJson(packetFor([{ code: "unsafe_delay", gate: "u", phase: "primary", choiceIndex: 0 }]));
    const b = canonicalPacketJson(packetFor([{ code: "unsafe_delay", gate: "u", phase: "primary", choiceIndex: 0 }]));
    expect(a).toBe(b);
    expect(canonicalPacketJson(packetFor([{ code: "unsafe_delay", gate: "u", phase: "primary", choiceIndex: 1 }]))).not.toBe(a);
  });

  it("32. safety and boundary corrections are ordered before ordinary quality ones", () => {
    const packet = packetFor(RETRYABLE_DEFECTS.map(([, f]) => f));
    const levels = packet.items.map((i) => i.level);
    expect([...levels]).toEqual([...levels].sort((x, y) => x - y));
    expect(packet.items[0].level).toBe(3); // boundary / hard safety first
  });

  it("no credential, infrastructure detail or worked example reaches the model", () => {
    const text = renderCorrectionPacket(packetFor(RETRYABLE_DEFECTS.map(([, f]) => f)));
    expect(text).not.toMatch(/sk-|Authorization|Bearer |api[_-]?key|supabase|wrangler|localhost|https?:\/\//i);
    expect(text).not.toMatch(/for example, write|such as: "|e\.g\. "/);
  });
});
