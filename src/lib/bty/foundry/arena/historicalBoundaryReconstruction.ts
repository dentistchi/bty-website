/**
 * HISTORICAL BOUNDARY RECONSTRUCTION (Slice 3.2I-R5B1A.1-R2.27).
 *
 * WHAT THIS IS NOT
 *
 * A reconstructed subject is NOT evidence of what the historical reviewer received. R2.26 proved
 * the opposite: the R2.25 c18 replay was handed `confirmedBoundaries: []`, and the reviewer's own
 * `boundaryIdsConsidered: []` confirms the question was never asked. Nothing here changes that
 * record, and every subject this module produces is labelled `reconstructed: true` so it can never
 * be quoted as original provenance.
 *
 * WHAT IT IS FOR
 *
 * Rebuilding the boundary from stored evidence so a CORRECTED replay can finally ask the reviewer
 * the question it was never asked.
 *
 * TWO INDEPENDENT SOURCES MUST AGREE
 *
 * One source could be the very thing that was wrong. Agreement is required after normalization, and
 * disagreement STOPS with `historical_boundary_reconstruction_conflict` rather than picking a
 * winner — silently choosing one is how a reconstruction becomes fiction.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  buildBoundaryProvenance,
  normalizeBoundaryText,
  type BoundaryReviewProvenance,
  type ReconstructionSource,
} from "@/domain/foundry/arena-draft/boundaryProvenance";

export class HistoricalReconstructionConflict extends Error {
  readonly code = "historical_boundary_reconstruction_conflict";
}

const sha = (b: Buffer | string): string => createHash("sha256").update(b).digest("hex");

const normalizedBoundaryDigest = (id: string, statement: string): string =>
  sha(JSON.stringify({ id, statement: normalizeBoundaryText(statement) }));

export type ExtractedBoundary = { id: string; statement: string; source: ReconstructionSource };

/** SOURCE 1 — the canonical corpus case that DEFINES the boundary. */
export function extractFromCorpus(corpusPath: string, caseId: string): ExtractedBoundary {
  const raw = readFileSync(corpusPath);
  const src = raw.toString("utf8");
  const at = src.indexOf(caseId);
  if (at < 0) throw new HistoricalReconstructionConflict(`case ${caseId} not found in ${corpusPath}`);
  const block = src.slice(at, at + 1500);
  const m = /id:\s*"([^"]+)"\s*,\s*statement:\s*"([^"]+)"/.exec(block);
  if (!m) throw new HistoricalReconstructionConflict(`no boundary constraint found for ${caseId}`);
  return {
    id: m[1],
    statement: normalizeBoundaryText(m[2]),
    source: {
      path: corpusPath,
      sha256: sha(raw),
      evidenceLocation: `EVAL_CORPUS ${caseId} .boundary.constraints[0]`,
      normalizedBoundaryDigest: normalizedBoundaryDigest(m[1], m[2]),
    },
  };
}

/**
 * SOURCE 2 — the server-authored correction packet retained inside the immutable case artifact.
 *
 * Independent of the corpus: it was written by the server at generation time from the resolved
 * authority, so agreement between the two means the rule the generator was held to is the rule the
 * corpus defines.
 */
export function extractFromArtifactCorrectionPacket(artifactPath: string): ExtractedBoundary {
  const raw = readFileSync(artifactPath);
  const body = JSON.parse(raw.toString("utf8")) as { attempts?: Array<Record<string, unknown>> };
  let hit: { id: string; statement: string; location: string } | null = null;
  const hunt = (node: unknown, path: string): void => {
    if (hit) return;
    if (Array.isArray(node)) {
      node.forEach((v, i) => hunt(v, `${path}[${i}]`));
      return;
    }
    if (node && typeof node === "object") {
      const o = node as Record<string, unknown>;
      if (typeof o.id === "string" && typeof o.statement === "string") {
        hit = { id: o.id, statement: normalizeBoundaryText(o.statement), location: path };
        return;
      }
      for (const [k, v] of Object.entries(o)) hunt(v, `${path}.${k}`);
    }
  };
  (body.attempts ?? []).forEach((a, i) => hunt(a.correctionPacket, `attempts[${i}].correctionPacket`));
  if (!hit) throw new HistoricalReconstructionConflict(`no server-authored boundary evidence in ${artifactPath}`);
  const found = hit as { id: string; statement: string; location: string };
  return {
    id: found.id,
    statement: found.statement,
    source: {
      path: artifactPath,
      sha256: sha(raw),
      evidenceLocation: found.location,
      normalizedBoundaryDigest: normalizedBoundaryDigest(found.id, found.statement),
    },
  };
}

/**
 * Reconcile the sources into one provenance record, or refuse.
 *
 * Agreement is compared on the NORMALIZED digest, so whitespace differences between a TypeScript
 * literal and a serialized packet are not treated as a conflict, while any difference in the rule
 * itself is.
 */
export function reconstructHistoricalProvenance(args: {
  sources: ExtractedBoundary[];
  sourceReference: string;
}): BoundaryReviewProvenance {
  if (args.sources.length < 2) {
    throw new HistoricalReconstructionConflict("a reconstruction requires at least two independent sources");
  }
  const digests = new Set(args.sources.map((s) => s.source.normalizedBoundaryDigest));
  if (digests.size !== 1) {
    throw new HistoricalReconstructionConflict(
      `historical_boundary_reconstruction_conflict — sources disagree: ${args.sources.map((s) => `${s.id}=${s.source.normalizedBoundaryDigest.slice(0, 12)}`).join(" vs ")}`,
    );
  }
  const [first] = args.sources;
  return buildBoundaryProvenance({
    available: [{ id: first.id, statement: first.statement, provenance: "manager_entered" }],
    activeIds: [first.id],
    scopeConfirmed: true,
    sourceKind: "historical_reconstruction",
    sourceReference: args.sourceReference,
    // The reconstruction's own source digest is the digest of the agreeing evidence set.
    sourceSha256: sha(JSON.stringify(args.sources.map((s) => s.source.sha256).sort())),
    reconstructionSources: args.sources.map((s) => s.source),
  });
}

export const RECONSTRUCTION_DISCLAIMER =
  "This reconstructed subject is NOT evidence of what the historical reviewer originally received. " +
  "R2.26 measured that the R2.25 c18 replay was given an empty boundary set and that the reviewer " +
  "reported boundaryIdsConsidered: []. This subject exists only to perform a corrected-boundary " +
  "reviewer replay.";
