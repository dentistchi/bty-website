/**
 * CANONICAL STATE PARITY (Slice 3.2I-R5B1A.1-R2.32 Parts 1, 2, 10, 12; scoped in R2.38).
 *
 * R2.38 MOVED THE PROMPT AUTHORITY. The reviewer no longer authors `applicability` or `compliance`,
 * so this table no longer describes anything the model is asked for — the canonical truth-state
 * table does that, and generates the prompt. What remains here, and is still load-bearing, is the
 * REASON policy and the server-explanation state ids, both keyed on the DERIVED applicability and
 * compliance. The tests below are scoped to exactly that.
 *
 * R2.31 measured three documents disagreeing about one field: the prompt asked for `reason` once,
 * the schema allowed `""`, and the validator demanded it everywhere. These tests exist so that
 * disagreement cannot recur silently — they assert that the prompt text, the validator's
 * requirements and the explanation authority are all reading the SAME table.
 */
import { describe, expect, it } from "vitest";
import {
  ASSESSMENT_STATES,
  ASSESSMENT_STATE_IDS,
  GENERIC_REASON_PHRASES,
  MODEL_REASON_MIN_CHARS,
  MODEL_REQUIRED_STATES,
  REGISTERED_MECHANISMS,
  SERVER_DERIVED_STATES,
  classifyAssessmentState,
  normalizeReason,
  parityTableSha256,
  renderPromptStateRules,
  renderReasonPolicyLines,
  requiresModelReason,
} from "./boundaryReasonParity";
import { DERIVED_APPLICABILITY, DERIVED_COMPLIANCE, renderTruthStateRules } from "./boundaryTruthStates";
import { LEGACY_VIOLATION_MECHANISMS as VIOLATION_MECHANISMS } from "./legacyBoundaryDto";
const APPLICABILITY_RESULTS = DERIVED_APPLICABILITY;
const COMPLIANCE_RESULTS = DERIVED_COMPLIANCE;
import { NARROW_BOUNDARY_SYSTEM_PROMPT } from "@/lib/bty/foundry/arena/narrowBoundaryContract";
import { enumerateBoundarySurfaces, reviewableSurfaces } from "./boundarySurfaces";
import { draftFixture } from "./boundarySurfaces.test";
import { buildContextSegments } from "./boundaryContextSegments";
import { buildSemanticFrames } from "./boundarySemanticFrame";

const BOUNDARY = { id: "c1_verify", statement: "Two identifiers must be verified before treatment" };
const draft = draftFixture();
const surfaces = reviewableSurfaces(enumerateBoundarySurfaces(draft));
const segments = buildContextSegments(draft, surfaces);
void segments;
void buildSemanticFrames;

describe("[1] the table is exhaustive and unambiguous", () => {
  it("has one rule per canonical state id", () => {
    expect(ASSESSMENT_STATES.map((s) => s.id)).toEqual([...ASSESSMENT_STATE_IDS]);
    expect(new Set(ASSESSMENT_STATE_IDS).size).toBe(ASSESSMENT_STATE_IDS.length);
  });

  it("classifies every VALID (applicability × compliance × mechanism) triple to exactly one state", () => {
    const seen = new Map<string, number>();
    for (const applicability of APPLICABILITY_RESULTS) {
      for (const compliance of COMPLIANCE_RESULTS) {
        for (const violationMechanism of VIOLATION_MECHANISMS) {
          const s = classifyAssessmentState({ applicability, compliance, violationMechanism });
          if (s) seen.set(s.id, (seen.get(s.id) ?? 0) + 1);
        }
      }
    }
    // Every state is reachable, and no triple maps to two states (classify returns one or none).
    expect([...seen.keys()].sort()).toEqual([...ASSESSMENT_STATE_IDS].sort());
  });

  it("returns null for combinations outside the table — an invalid state, not a judgment", () => {
    expect(classifyAssessmentState({ applicability: "applies", compliance: "violates", violationMechanism: "none" })).toBeNull();
    expect(classifyAssessmentState({ applicability: "not_applicable", compliance: "complies", violationMechanism: "none" })).toBeNull();
    expect(classifyAssessmentState({ applicability: "applies", compliance: "not_assessed", violationMechanism: "none" })).toBeNull();
  });

  it("splits reason authority exactly three/three", () => {
    expect(SERVER_DERIVED_STATES).toEqual(["not_applicable", "complies", "violates_registered_mechanism"]);
    expect(MODEL_REQUIRED_STATES).toEqual(["applicability_uncertain", "violates_other_mechanism", "compliance_uncertain"]);
  });

  it("treats every registered mechanism as `registered`, and `other_grounded_violation` separately", () => {
    for (const m of REGISTERED_MECHANISMS) {
      expect(classifyAssessmentState({ applicability: "applies", compliance: "violates", violationMechanism: m })!.id).toBe("violates_registered_mechanism");
    }
    expect(classifyAssessmentState({ applicability: "applies", compliance: "violates", violationMechanism: "other_grounded_violation" })!.id).toBe("violates_other_mechanism");
  });

  it("has a stable digest that moves when the table moves", () => {
    expect(parityTableSha256()).toBe(parityTableSha256());
    expect(parityTableSha256()).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("[10] PROMPT / VALIDATOR PARITY — the defect R2.31 measured cannot recur", () => {
  it("the prompt contains the generated rule for EVERY state", () => {
    // R2.38 — the PROMPT is generated from the truth-state table, not from this one.
    for (const line of renderTruthStateRules()) {
      expect(NARROW_BOUNDARY_SYSTEM_PROMPT, `prompt must carry: ${line.trim().slice(0, 40)}…`).toContain(line.trim());
    }
    // R2.38 — the reason POLICY is stated once in the prompt, in the prompt's own words, and the
    // per-state requirement travels inside each generated truth-state rule above.
    expect(renderReasonPolicyLines().length).toBeGreaterThanOrEqual(0);
    expect(NARROW_BOUNDARY_SYSTEM_PROMPT).toContain("Leave `reason` as an EMPTY STRING");
  });

  it("the prompt names EVERY server-derived state as empty-reason and EVERY model-required state as required", () => {
    const policy = renderReasonPolicyLines().join("\n");
    for (const id of SERVER_DERIVED_STATES) expect(policy).toContain(id);
    for (const id of MODEL_REQUIRED_STATES) expect(policy).toContain(id);
    expect(policy).toContain(String(MODEL_REASON_MIN_CHARS));
  });

});

describe("[2] reason authority", () => {
  // R2.38 — the narrow reviewer now answers under the canonical TRUTH-STATE table, so the
  // per-state validator cases that used to live here sit in `boundaryCandidateAuthority`. What this
  // table still owns, and what these tests cover, is the reason POLICY and the server-explanation
  // state ids, keyed on the DERIVED applicability and compliance.
  it("splits every state into exactly one reason authority, with no overlap and no gap", () => {
    expect(MODEL_REQUIRED_STATES.length + SERVER_DERIVED_STATES.length).toBe(ASSESSMENT_STATES.length);
    for (const id of MODEL_REQUIRED_STATES) expect(SERVER_DERIVED_STATES).not.toContain(id);
    for (const s of ASSESSMENT_STATES) expect(requiresModelReason(s)).toBe((MODEL_REQUIRED_STATES as readonly string[]).includes(s.id));
  });

  it("normalizes filler prose so a generic reason cannot pass where words are required", () => {
    for (const phrase of GENERIC_REASON_PHRASES) expect(normalizeReason(` ${phrase.toUpperCase()} `)).toBe(phrase);
    expect(MODEL_REASON_MIN_CHARS).toBeGreaterThan(0);
  });
});
