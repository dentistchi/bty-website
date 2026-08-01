/**
 * BOUNDARY SEMANTIC FRAME (Slice 3.2I-R5B1A.1-R2.36 Part 4).
 *
 * THE MEASURED DEFECT (R2.35)
 *
 * The reviewer was handed a boundary as ONE opaque sentence — "Two identifiers must be verified
 * before treatment" — and asked whether each surface complies. Nothing in the contract separated
 * the PREREQUISITE (verifying two identifiers) from the GOVERNED ACTION (treatment) or from the
 * TEMPORAL requirement (verification before treatment).
 *
 * With no such separation, "the branch still has scheduling delays" and "the second patient remains
 * unverified" were equally available as prerequisite-failure evidence. Only one of them concerns
 * the prerequisite; the contract could not tell.
 *
 * THIS MODULE
 *
 * Decomposes a confirmed boundary into its clauses so the server can ask a narrower question, and
 * FAILS CLOSED when it cannot. A frame is never invented: a boundary that does not decompose
 * reliably is marked `uncertain` and blocks semantic acceptance rather than producing a confident
 * answer about a rule nobody parsed.
 *
 * Pure domain: no I/O, no provider, no clock.
 */

import { createHash } from "node:crypto";

export const SEMANTIC_FRAME_VERSION = "practice-boundary-semantic-frame/1";

export const RULE_KINDS = [
  /** "X must happen before Y" — a prerequisite gates a governed action. The c1_verify shape. */
  "prerequisite_before_action",
  /** "Never do X" — no prerequisite exists; the action itself is forbidden. */
  "prohibition",
  /** "X must hold" — a state requirement with no explicit governed action. */
  "state_requirement",
  /** Not reliably decomposable. Blocks semantic acceptance. */
  "uncertain",
] as const;
export type RuleKind = (typeof RULE_KINDS)[number];

export const TEMPORAL_REQUIREMENTS = ["prerequisite_before_action", "none", "uncertain"] as const;
export type TemporalRequirement = (typeof TEMPORAL_REQUIREMENTS)[number];

export type BoundarySemanticFrame = {
  boundaryId: string;
  exactBoundaryText: string;
  ruleKind: RuleKind;
  /** A faithful excerpt of the boundary text. Empty when the rule kind has no prerequisite. */
  prerequisiteClause: string;
  /** A faithful excerpt naming what the rule governs. Empty when undecomposable. */
  governedActionClause: string;
  temporalRequirement: TemporalRequirement;
  sha256: string;
};

export const SEMANTIC_FRAME_CODES = ["boundary_semantic_frame_uncertain"] as const;
export type SemanticFrameCode = (typeof SEMANTIC_FRAME_CODES)[number];

/**
 * Connectives that mark a prerequisite→action rule. Deliberately small and explicit: this is a
 * DECOMPOSITION aid over a Manager-authored sentence, not a semantic classifier. Anything it cannot
 * split confidently becomes `uncertain`, which fails closed.
 */
const BEFORE_CONNECTIVES = [" before ", " prior to ", " ahead of "];
const PROHIBITION_MARKERS = [/\bnever\b/i, /\bmust not\b/i, /\bmay not\b/i, /\bdo not\b/i, /\bis forbidden\b/i];

const tidy = (s: string): string => s.replace(/\s+/g, " ").trim();

/**
 * Decompose one confirmed boundary.
 *
 * `prerequisite_before_action` requires a "before"-shaped connective with non-empty text on both
 * sides. Everything else is either an explicit prohibition, a bare state requirement, or — when
 * nothing can be said with confidence — `uncertain`.
 */
export function buildSemanticFrame(boundary: { id: string; statement: string }): BoundarySemanticFrame {
  const text = tidy(boundary.statement);
  const lower = text.toLowerCase();

  const frame = (ruleKind: RuleKind, prerequisiteClause: string, governedActionClause: string, temporalRequirement: TemporalRequirement): BoundarySemanticFrame => {
    const body = { boundaryId: boundary.id, exactBoundaryText: text, ruleKind, prerequisiteClause, governedActionClause, temporalRequirement };
    return { ...body, sha256: createHash("sha256").update(JSON.stringify({ version: SEMANTIC_FRAME_VERSION, ...body })).digest("hex").slice(0, 32) };
  };

  // A prohibition is checked FIRST: "never treat before verifying" is a prohibition, not a
  // prerequisite rule, and treating it as the latter would invert its meaning.
  if (PROHIBITION_MARKERS.some((p) => p.test(text))) {
    return frame("prohibition", "", text, "none");
  }

  for (const connective of BEFORE_CONNECTIVES) {
    const i = lower.indexOf(connective);
    if (i <= 0) continue;
    const prerequisiteClause = tidy(text.slice(0, i));
    const governedActionClause = tidy(text.slice(i + connective.length));
    if (!prerequisiteClause || !governedActionClause) continue;
    return frame("prerequisite_before_action", prerequisiteClause, governedActionClause, "prerequisite_before_action");
  }

  // A "must"-shaped sentence with no temporal connective states a condition, not an ordering.
  if (/\bmust\b|\brequired\b|\bshall\b/i.test(text)) return frame("state_requirement", text, "", "none");

  return frame("uncertain", "", "", "uncertain");
}

export const buildSemanticFrames = (boundaries: Array<{ id: string; statement: string }>): BoundarySemanticFrame[] =>
  boundaries.map(buildSemanticFrame);

/**
 * A frame that could not be decomposed blocks semantic acceptance. The server does not guess what a
 * rule means, and it does not let a reviewer answer confidently about a rule nobody parsed.
 */
export function validateSemanticFrames(frames: BoundarySemanticFrame[]): { ok: boolean; codes: SemanticFrameCode[]; uncertainBoundaryIds: string[] } {
  const uncertain = frames.filter((f) => f.ruleKind === "uncertain");
  return {
    ok: uncertain.length === 0,
    codes: uncertain.length ? ["boundary_semantic_frame_uncertain"] : [],
    uncertainBoundaryIds: uncertain.map((f) => f.boundaryId),
  };
}

export const framesSha256 = (frames: BoundarySemanticFrame[]): string =>
  createHash("sha256").update(JSON.stringify({ version: SEMANTIC_FRAME_VERSION, frames })).digest("hex");

/** The contract digest — moves when decomposition or the vocabulary moves. */
export const semanticFrameContractSha256 = (): string =>
  createHash("sha256")
    .update(JSON.stringify({ version: SEMANTIC_FRAME_VERSION, ruleKinds: RULE_KINDS, temporal: TEMPORAL_REQUIREMENTS, connectives: BEFORE_CONNECTIVES, prohibitionMarkers: PROHIBITION_MARKERS.map(String) }))
    .digest("hex");
