import { createHash } from "node:crypto";
import { JOURNEY_KIND_ORDER, type JourneyElementKind, type RealityGroundedJourneyV1 } from "./journey";
import type { ProgramProposal } from "./program-authorship";

/**
 * THE EXACT IDENTITY OF A GENERATED PROPOSAL (Slice 3.2L-R11.3).
 *
 * R11.2 could prove the receipt named the NEWEST successful attempt at the current
 * fingerprint. That is not the same claim as "this exact proposal was adopted": any
 * schema-valid journey could take that attempt's receipt, because nothing durable said what
 * the attempt actually produced. `response_sha256` on the call row is a digest of the raw
 * provider BYTES — the adopted journey is the validated, derived, Host-chosen content, so
 * it can never be recomputed from one.
 *
 * WHAT IS HASHED, and why exactly this. The digest covers the title and the content of the
 * REQUIRED kinds — the sections the Host's own learning design asks for. Those are the only
 * things Apply moves from a proposal into `realityGroundedJourneyV1`, so they are the only
 * things a comparison at Apply time can honestly speak about.
 *
 * The required set is DELIBERATE, not incidental. Apply preserves grounded seed elements the
 * proposal never owned — `evidence` on the canonical draft — so hashing the whole journey
 * would make an honest, unedited adoption fail its own check. `requiredProgramKinds` is
 * computed server-side from the same answers on both sides, and a change to those answers is
 * already refused earlier by `context_moved`, so the two sides cannot drift apart.
 *
 * Rationale, assumptions, warnings and the evidence ceiling are review-surface material that
 * Apply never writes; including them would make the digest un-verifiable from the journey.
 *
 * DETERMINISM is structural, not conventional. Nothing depends on JavaScript key insertion
 * order: the payload is built as an ARRAY in `JOURNEY_KIND_ORDER`, and only two string
 * fields are serialized. `PROPOSAL_DIGEST_VERSION` is inside the hashed input, so a future
 * change to what counts as identity produces a different digest instead of silently
 * colliding with the old meaning.
 */
export const PROPOSAL_DIGEST_VERSION = "program_proposal_digest_v1";

/** `<version>:<sha256 hex>` — the version travels with the value, never only in code. */
export type ProposalDigest = string;

function canonicalPayload(
  displayTitle: string,
  contentByKind: ReadonlyMap<JourneyElementKind, string>,
  requiredKinds: readonly JourneyElementKind[],
): string {
  const required = new Set(requiredKinds);
  const sections: [string, string][] = [];
  for (const kind of JOURNEY_KIND_ORDER) {
    if (!required.has(kind)) continue;
    // A missing required section is hashed as its absence, never skipped silently.
    sections.push([kind, contentByKind.get(kind) ?? ""]);
  }
  // A two-element array per section, in one fixed order: no object keys, nothing to reorder.
  return JSON.stringify([PROPOSAL_DIGEST_VERSION, displayTitle, sections]);
}

function digestOf(payload: string): ProposalDigest {
  return `${PROPOSAL_DIGEST_VERSION}:${createHash("sha256").update(payload, "utf8").digest("hex")}`;
}

/**
 * The same digest, over sections given directly rather than read off a proposal or a journey
 * (Slice R4-R2E-R1). The mixed-authorship authority needs to hash a set of sections it did not
 * get from either shape — the reference supplied with an adoption request — and it must hash it
 * through EXACTLY this path, or "the reference matches the durable digest" would be comparing
 * two different functions.
 *
 * Both `proposalDigest` and `journeyDigest` now delegate here, so there is one implementation
 * and the three callers cannot drift.
 */
export function sectionDigest(
  displayTitle: string,
  contentByKind: Readonly<Record<string, string>>,
  requiredKinds: readonly JourneyElementKind[],
): ProposalDigest {
  const byKind = new Map<JourneyElementKind, string>();
  for (const [kind, content] of Object.entries(contentByKind)) byKind.set(kind as JourneyElementKind, content);
  return digestOf(canonicalPayload(displayTitle, byKind, requiredKinds));
}

/**
 * The identity of the proposal BTY generated, computed server-side from the validated
 * proposal that is returned for review. A client-supplied digest is never evidence.
 */
export function proposalDigest(proposal: ProgramProposal, requiredKinds: readonly JourneyElementKind[]): ProposalDigest {
  const byKind: Record<string, string> = {};
  for (const el of proposal.elements) byKind[el.kind] = el.content;
  return sectionDigest(proposal.displayTitle, byKind, requiredKinds);
}

/**
 * The identity of the journey a Host is adopting. Comparable with `proposalDigest` by
 * construction: the same two fields, the same order, the same serialization.
 *
 * A journey that adopted the proposal UNCHANGED digests identically. A journey the Host
 * edited does not — and must not: an edited program is no longer the generated one, and
 * claiming otherwise is exactly the false receipt this closes.
 */
export function journeyDigest(journey: RealityGroundedJourneyV1, requiredKinds: readonly JourneyElementKind[]): ProposalDigest {
  const byKind: Record<string, string> = {};
  for (const el of journey.elements) byKind[el.kind] = el.content;
  return sectionDigest(journey.displayTitle, byKind, requiredKinds);
}

/** `true` only for a well-formed digest of the CURRENT version. */
export function isProposalDigest(v: unknown): v is ProposalDigest {
  return typeof v === "string" && new RegExp(`^${PROPOSAL_DIGEST_VERSION}:[0-9a-f]{64}$`).test(v);
}
