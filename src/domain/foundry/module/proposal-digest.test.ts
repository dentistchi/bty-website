import { describe, it, expect } from "vitest";
import { proposalDigest, journeyDigest, isProposalDigest, PROPOSAL_DIGEST_VERSION } from "./proposal-digest";
import type { ProgramProposal } from "./program-authorship";
import type { JourneyElementKind, RealityGroundedJourneyV1 } from "./journey";

const REQUIRED: JourneyElementKind[] = [
  "why_it_matters", "observable_standard", "scenario", "action_decision", "field_application", "completion_check", "follow_up",
];
const el = (kind: JourneyElementKind, content: string) => ({ kind, content, rationale: "advisory" });
const PROPOSAL = {
  displayTitle: "Establishing a Shared Handoff Standard",
  elements: REQUIRED.map((k) => el(k, `content for ${k}`)),
  assumptions: [], warnings: [], evidenceLanguage: "ceiling",
} as unknown as ProgramProposal;

/** The journey an unedited Apply produces: the proposal's kinds PLUS a preserved seed. */
const journeyFrom = (over: Partial<Record<JourneyElementKind, string>> = {}, title = PROPOSAL.displayTitle): RealityGroundedJourneyV1 => ({
  version: 1, displayTitle: title, displayTitleStatus: "grounded",
  elements: [
    ...REQUIRED.map((k) => ({ id: `el_${k}`, kind: k, content: over[k] ?? `content for ${k}`, grounding: [{ sourceType: "ai_proposed" as const, field: "problem" as const }], confirmationStatus: "grounded" as const })),
    { id: "el_evidence", kind: "evidence" as const, content: "Handoff record", grounding: [{ sourceType: "host_statement" as const, field: "successEvidence" as const }], confirmationStatus: "grounded" as const },
  ].sort((a, b) => REQUIRED.concat("evidence").indexOf(a.kind) - REQUIRED.concat("evidence").indexOf(b.kind)),
});

describe("[3.2L-R11.3] canonical proposal identity", () => {
  it("G2: an unedited adoption digests identically to the proposal", () => {
    expect(journeyDigest(journeyFrom(), REQUIRED)).toBe(proposalDigest(PROPOSAL, REQUIRED));
  });

  it("a PRESERVED seed element the proposal never owned does not break the match", () => {
    // The whole reason the digest spans the required kinds only.
    const j = journeyFrom();
    expect(j.elements.some((e) => e.kind === "evidence")).toBe(true);
    expect(journeyDigest(j, REQUIRED)).toBe(proposalDigest(PROPOSAL, REQUIRED));
  });

  it("G1: object-key insertion order cannot change the digest", () => {
    const reordered = {
      elements: [...PROPOSAL.elements].reverse().map((e) => ({ rationale: e.rationale, content: e.content, kind: e.kind })),
      evidenceLanguage: "ceiling", warnings: [], assumptions: [],
      displayTitle: PROPOSAL.displayTitle,
    } as unknown as ProgramProposal;
    expect(proposalDigest(reordered, REQUIRED)).toBe(proposalDigest(PROPOSAL, REQUIRED));
  });

  it("G3: a changed display title changes the digest", () => {
    expect(journeyDigest(journeyFrom({}, "Something else"), REQUIRED)).not.toBe(proposalDigest(PROPOSAL, REQUIRED));
  });

  it("G4: one character of section text changes the digest", () => {
    expect(journeyDigest(journeyFrom({ scenario: "content for scenario." }), REQUIRED)).not.toBe(proposalDigest(PROPOSAL, REQUIRED));
  });

  it("G5: a missing required element changes the digest", () => {
    const j = journeyFrom();
    j.elements = j.elements.filter((e) => e.kind !== "follow_up");
    expect(journeyDigest(j, REQUIRED)).not.toBe(proposalDigest(PROPOSAL, REQUIRED));
  });

  it("G6: swapping two sections' content changes the digest", () => {
    const swapped = journeyFrom({ scenario: "content for action_decision", action_decision: "content for scenario" });
    expect(journeyDigest(swapped, REQUIRED)).not.toBe(proposalDigest(PROPOSAL, REQUIRED));
  });

  it("G7: transient review-surface material is not part of identity", () => {
    const noisy = { ...PROPOSAL, assumptions: ["x"], warnings: ["y"], evidenceLanguage: "different",
      elements: PROPOSAL.elements.map((e) => ({ ...e, rationale: "totally different advisory" })) } as ProgramProposal;
    expect(proposalDigest(noisy, REQUIRED)).toBe(proposalDigest(PROPOSAL, REQUIRED));
  });

  it("the version travels with the value and is inside the hashed input", () => {
    const d = proposalDigest(PROPOSAL, REQUIRED);
    expect(d.startsWith(`${PROPOSAL_DIGEST_VERSION}:`)).toBe(true);
    expect(isProposalDigest(d)).toBe(true);
    for (const bad of ["", "deadbeef", `${PROPOSAL_DIGEST_VERSION}:zz`, "program_proposal_digest_v0:" + "a".repeat(64), null, 7]) {
      expect(isProposalDigest(bad), String(bad)).toBe(false);
    }
  });

  it("is stable across repeated computation", () => {
    const a = proposalDigest(PROPOSAL, REQUIRED);
    for (let i = 0; i < 5; i++) expect(proposalDigest(PROPOSAL, REQUIRED)).toBe(a);
  });
});
