/**
 * IMMUTABLE EVALUATION-ARTIFACT AUTHORITY (Slice 3.2I-R5B1A.1-R2.23).
 *
 * R2.20 measured what happens without one: every filtered run wrote the same
 * `practice-generation.canary.json`, so each canary destroyed the evidence of the one before it.
 * Four artifacts are permanently gone. R2.20 introduced unique paths; this module makes the whole
 * authority explicit and testable — path construction, fail-closed collision, the ordering that
 * guarantees evidence survives a failing run, and a lineage index that never claims a missing
 * historical artifact was restored.
 *
 * The name carries the identity: run, HEAD, contract manifest, pass. An artifact whose filename
 * does not match the contract that produced it is not evidence.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const ARTIFACT_DIR = ".eval-artifacts";
export const LATEST_POINTER = "practice-generation.latest.json";

export type ArtifactIdentity = {
  /** e.g. "r2.23.stability" — the slice and purpose. */
  kind: string;
  /** UTC run id, supplied by the caller (this module takes no clock). */
  runId: string;
  /** Full source HEAD; the path carries its short form. */
  head: string;
  /** Full contract-manifest digest; the path carries its short form. */
  manifestSha256: string;
  /** Which independent pass of the run this is. */
  passId: string;
};

const shortHex = (s: string) => s.replace(/[^0-9a-f]/gi, "").slice(0, 12) || "unknown";
/**
 * Dots are the field separator, so they are stripped from every component. Without this a kind like
 * "r2.23.stability" would silently produce a filename the lineage index cannot attribute.
 */
const safe = (s: string) => s.replace(/[^A-Za-z0-9_-]/g, "-");

/**
 * `practice-generation.<kind>.<runId>.<head12>.<manifest12>.<passId>.json`
 *
 * Every authority field is in the name, so an artifact can be attributed without opening it and two
 * runs of different contracts can never collide.
 */
export function artifactPath(id: ArtifactIdentity): string {
  return [
    "practice-generation",
    safe(id.kind),
    safe(id.runId),
    shortHex(id.head),
    shortHex(id.manifestSha256),
    safe(id.passId),
    "json",
  ].join(".");
}

export const sha256 = (s: string): string => createHash("sha256").update(s).digest("hex");

export type WriteResult = { path: string; sha256: string; bytes: number };

/**
 * Write the immutable artifact.
 *
 * Fails CLOSED on collision: it does not append, truncate, rename or pick another path under the
 * same run id. A collision means two different results claim one identity, and silently resolving
 * that is how evidence gets lost.
 */
export function writeImmutableArtifact(dir: string, id: ArtifactIdentity, payload: string): WriteResult {
  mkdirSync(dir, { recursive: true });
  const name = artifactPath(id);
  const full = join(dir, name);
  if (existsSync(full)) {
    throw new Error(`ARTIFACT COLLISION · refusing to overwrite ${name} — a result already exists for this run/pass and contract`);
  }
  writeFileSync(full, payload);
  return { path: name, sha256: sha256(payload), bytes: Buffer.byteLength(payload, "utf8") };
}

/**
 * Update the convenience pointer. NEVER authoritative — it exists so a human can open the newest
 * run without listing a directory, and it is written only after the immutable copy is safe.
 */
export function writeLatestPointer(dir: string, payload: string, name = LATEST_POINTER): void {
  writeFileSync(join(dir, name), payload);
}

export type LineageEntry = { file: string; kind: string; runId: string; head: string; manifest: string; passId: string };

/**
 * List the immutable artifacts actually present.
 *
 * It reports what EXISTS. It never infers, reconstructs or claims a missing historical artifact —
 * the four destroyed before R2.20 remain gone, and a lineage index that pretended otherwise would
 * be worse than none.
 */
export function lineageIndex(dir: string): LineageEntry[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.startsWith("practice-generation.") && f.endsWith(".json") && f !== LATEST_POINTER)
    .map((file) => {
      const parts = file.split(".");
      // practice-generation . kind . runId . head12 . manifest12 . passId . json
      if (parts.length !== 7) return null;
      return { file, kind: parts[1], runId: parts[2], head: parts[3], manifest: parts[4], passId: parts[5] };
    })
    .filter((e): e is LineageEntry => e !== null)
    .sort((a, b) => (a.file < b.file ? -1 : 1));
}

// ---------------------------------------------------------------------------
// INCREMENTAL RUN RETENTION (full-evidence retention v1)
// ---------------------------------------------------------------------------

/**
 * ★ THE IMMUTABLE ARTIFACT CANNOT BE THE ONLY RECORD.
 *
 * `writeImmutableArtifact` is written ONCE, at the end of a case, and refuses to overwrite. That is
 * exactly right for a finished result and useless for a run that dies in the middle — and two
 * postmortems were blocked precisely because failed and timed-out runs left nothing behind.
 *
 * This is the mutable companion: one record per run, rewritten after every evidence-bearing stage,
 * so a process killed after Render still leaves the plan, the draft, the gates and the stage timing
 * already observed. It never replaces the immutable artifact and never claims its authority.
 *
 * ★ ISOLATED FROM THE BOUNDARY-REPLAY PARITY SWEEP, TWICE OVER.
 *
 * `boundaryRuleKindCapturedParity` reads `.eval-artifacts` with a NON-recursive `readdirSync` and
 * keeps only files whose name starts with `practice-review.boundaryreplay.`. Retention records live
 * in a SUBDIRECTORY and carry a different prefix, so neither filter can reach them. Both defences
 * were measured before this module was written, not assumed.
 */
export const RETENTION_SUBDIR = "retention-v1";
const RETENTION_PREFIX = "practice-retention";

/** One run's durable identity. Distinct from `ArtifactIdentity`: a retention record is mutable. */
export type RetentionIdentity = {
  experimentId: string;
  fixtureId: string;
  architecture: string;
  runNumber: number;
};

export function retentionPath(id: RetentionIdentity): string {
  return [RETENTION_PREFIX, safe(id.experimentId), safe(id.fixtureId), safe(id.architecture), String(id.runNumber), "json"].join(".");
}

/**
 * Write/replace one run record ATOMICALLY.
 *
 * Temp file then rename: a reader never observes a half-written record, and an interrupted update
 * leaves the PREVIOUS complete record intact rather than a truncated one.
 */
export function writeRetentionRecord(dir: string, id: RetentionIdentity, payload: string): WriteResult {
  const root = join(dir, RETENTION_SUBDIR);
  mkdirSync(root, { recursive: true });
  const name = retentionPath(id);
  const full = join(root, name);
  const tmp = `${full}.tmp`;
  writeFileSync(tmp, payload);
  renameSync(tmp, full);
  return { path: join(RETENTION_SUBDIR, name), sha256: sha256(payload), bytes: Buffer.byteLength(payload, "utf8") };
}

/** Every retention record currently on disk. Non-recursive, prefix-scoped — the same discipline. */
export function retentionRecords(dir: string): string[] {
  try {
    return readdirSync(join(dir, RETENTION_SUBDIR)).filter((f) => f.startsWith(RETENTION_PREFIX) && f.endsWith(".json"));
  } catch {
    return [];
  }
}
